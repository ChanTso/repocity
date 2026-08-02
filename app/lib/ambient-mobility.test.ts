import { describe, expect, it } from "vitest";
import {
  AMBIENT_CONTEXT_CLASSIFICATION,
  allAmbientRoutes,
  planAmbientMobility,
  resolvePublicEntrancePoint,
  type AmbientMobilityRoute,
  type AmbientPublicFrontage,
} from "./ambient-mobility";
import { demoProject } from "./demo-data";
import { planLivingCity, type CityPoint } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import { isSemanticSelectableKind } from "./semantic-lens";
import { planUrbanFabric, type UrbanStreet } from "./urban-fabric";
import { planVisualCity } from "./visual-city";

const living = planLivingCity(demoProject);
const semantic = planSemanticCity({
  cityPlan: living,
  entities: demoProject.entities,
  relations: demoProject.relations,
  boundaryFacts: demoProject.boundaryFacts,
});
const fabric = planUrbanFabric({ semanticPlan: semantic });
const visual = planVisualCity({ semanticPlan: semantic, urbanFabric: fabric });
const input = { urbanFabric: fabric, visualCity: visual, seed: "living-streets-test" };

function distanceToSegment(point: CityPoint, start: CityPoint, end: CityPoint): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 0.000001) return Math.hypot(point.x - start.x, point.z - start.z);
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared),
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.z - (start.z + dz * progress),
  );
}

function distanceToStreet(point: CityPoint, street: UrbanStreet): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < street.centerline.length; index += 1) {
    nearest = Math.min(
      nearest,
      distanceToSegment(point, street.centerline[index - 1]!, street.centerline[index]!),
    );
  }
  return nearest;
}

function streetsConnect(left: UrbanStreet, right: UrbanStreet): boolean {
  for (let leftIndex = 1; leftIndex < left.centerline.length; leftIndex += 1) {
    const leftStart = left.centerline[leftIndex - 1]!;
    const leftEnd = left.centerline[leftIndex]!;
    for (let rightIndex = 1; rightIndex < right.centerline.length; rightIndex += 1) {
      const rightStart = right.centerline[rightIndex - 1]!;
      const rightEnd = right.centerline[rightIndex]!;
      const cross = (origin: CityPoint, a: CityPoint, b: CityPoint) =>
        (a.x - origin.x) * (b.z - origin.z) -
        (a.z - origin.z) * (b.x - origin.x);
      const leftRightStart = cross(leftStart, leftEnd, rightStart);
      const leftRightEnd = cross(leftStart, leftEnd, rightEnd);
      const rightLeftStart = cross(rightStart, rightEnd, leftStart);
      const rightLeftEnd = cross(rightStart, rightEnd, leftEnd);
      const crosses =
        leftRightStart * leftRightEnd <= 0 &&
        rightLeftStart * rightLeftEnd <= 0 &&
        Math.max(Math.min(leftStart.x, leftEnd.x), Math.min(rightStart.x, rightEnd.x)) <=
          Math.min(Math.max(leftStart.x, leftEnd.x), Math.max(rightStart.x, rightEnd.x)) + 0.01 &&
        Math.max(Math.min(leftStart.z, leftEnd.z), Math.min(rightStart.z, rightEnd.z)) <=
          Math.min(Math.max(leftStart.z, leftEnd.z), Math.max(rightStart.z, rightEnd.z)) + 0.01;
      if (crosses) {
        return true;
      }
    }
  }
  return false;
}

function isInsideBuilding(point: CityPoint): boolean {
  return fabric.buildings.some(
    (building) =>
      Math.abs(point.x - building.x) < building.width / 2 - 0.02 &&
      Math.abs(point.z - building.z) < building.depth / 2 - 0.02,
  );
}

function routeStreetGraphIsConnected(route: AmbientMobilityRoute): boolean {
  if (route.sourceStreetIds.length <= 1) return true;
  const streets = route.sourceStreetIds.map((id) => fabric.streets.find((street) => street.id === id)!);
  const visited = new Set([streets[0]!.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of streets) {
      if (visited.has(candidate.id)) continue;
      if (streets.some((known) => visited.has(known.id) && streetsConnect(known, candidate))) {
        visited.add(candidate.id);
        changed = true;
      }
    }
  }
  return visited.size === streets.length;
}

describe("ambient mobility planning", () => {
  it("is identical for the same city, seed and configuration", () => {
    expect(planAmbientMobility(input)).toEqual(planAmbientMobility(input));
  });

  it("uses the seed to produce a different valid cohort", () => {
    const first = planAmbientMobility(input);
    const second = planAmbientMobility({ ...input, seed: "living-streets-other" });
    expect(second).not.toEqual(first);
    expect(second.agents).toHaveLength(first.agents.length);
    expect(new Set(second.agents.map((agent) => agent.id)).size).toBe(second.agents.length);
  });

  it("classifies every route and agent as non-semantic urban context", () => {
    const plan = planAmbientMobility(input);
    expect(plan.classification).toBe(AMBIENT_CONTEXT_CLASSIFICATION);
    for (const route of allAmbientRoutes(plan)) {
      expect(route).toMatchObject({
        classification: AMBIENT_CONTEXT_CLASSIFICATION,
        evidenceRelationIds: [],
        componentIds: [],
        entityIds: [],
        journeyIds: [],
      });
    }
    expect(plan.agents.every((agent) => agent.classification === AMBIENT_CONTEXT_CLASSIFICATION)).toBe(true);
  });

  it("does not make ambient agent types semantic-selectable", () => {
    const plan = planAmbientMobility(input);
    expect(plan.agents.every((agent) => !isSemanticSelectableKind(agent.mode))).toBe(true);
  });

  it("builds road routes only from connected source streets", () => {
    const plan = planAmbientMobility(input);
    expect(plan.roadRoutes.every(routeStreetGraphIsConnected)).toBe(true);
  });

  it("keeps vehicle samples inside the derived road and intersection envelope", () => {
    const plan = planAmbientMobility(input);
    const streetById = new Map(fabric.streets.map((street) => [street.id, street]));
    for (const route of plan.roadRoutes) {
      const streets = route.sourceStreetIds.map((id) => streetById.get(id)!);
      for (const candidate of route.points) {
        expect(
          Math.min(...streets.map((street) => distanceToStreet(candidate, street))),
        ).toBeLessThanOrEqual(Math.max(...streets.map((street) => street.width / 2)) + 0.08);
      }
    }
  });

  it("gives opposing bridge loops distinct lane offsets", () => {
    const routes = planAmbientMobility(input).roadRoutes.filter((route) =>
      route.points.some((candidate) => candidate.surface === "bridge-lane"),
    );
    expect(routes).toHaveLength(2);
    expect(Math.sign(routes[0]!.laneOffset)).toBe(-Math.sign(routes[1]!.laneOffset));
    expect(Math.abs(routes[0]!.laneOffset - routes[1]!.laneOffset)).toBeGreaterThan(1.2);
  });

  it("aligns bridge vehicle routes with real bridge roadway approaches", () => {
    const bridgeStreetIds = new Set(
      fabric.streets.filter((street) => street.surface === "bridge").map((street) => street.id),
    );
    const routes = planAmbientMobility(input).roadRoutes.filter((route) =>
      route.sourceStreetIds.some((id) => bridgeStreetIds.has(id)),
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(
      routes.every((route) =>
        route.points
          .filter((candidate) => candidate.surface === "bridge-lane")
          .every((candidate) => candidate.streetId && bridgeStreetIds.has(candidate.streetId)),
      ),
    ).toBe(true);
  });

  it("keeps every interpolated road segment inside connected street surfaces", () => {
    const plan = planAmbientMobility(input);
    const streetById = new Map(fabric.streets.map((street) => [street.id, street]));
    for (const route of plan.roadRoutes) {
      const streets = route.sourceStreetIds.map((id) => streetById.get(id)!);
      for (let index = 1; index < route.points.length; index += 1) {
        const start = route.points[index - 1]!;
        const end = route.points[index]!;
        for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
          const candidate = {
            x: start.x + (end.x - start.x) * progress,
            z: start.z + (end.z - start.z) * progress,
          };
          expect(
            Math.min(...streets.map((street) => distanceToStreet(candidate, street))),
          ).toBeLessThanOrEqual(Math.max(...streets.map((street) => street.width / 2)) + 0.1);
        }
      }
    }
  });

  it("encodes deterministic yield points at every road turn", () => {
    const routes = planAmbientMobility(input).roadRoutes;
    expect(routes.every((route) => route.stopProgresses.length === 4)).toBe(true);
    expect(routes.every((route) => route.points.filter((point) => point.behavior === "yield").length >= 8)).toBe(true);
  });

  it("maintains the configured visual spacing for vehicles on each route", () => {
    const plan = planAmbientMobility(input);
    for (const route of plan.roadRoutes) {
      const phases = plan.agents
        .filter((agent) => agent.routeId === route.id)
        .map((agent) => agent.phase)
        .sort((left, right) => left - right);
      for (let index = 0; index < phases.length; index += 1) {
        const current = phases[index]!;
        const next = phases[(index + 1) % phases.length]!;
        const gap = index === phases.length - 1 ? 1 - current + next : next - current;
        expect(gap).toBeGreaterThanOrEqual(route.minimumSpacing - 0.001);
      }
    }
  });

  it("keeps pedestrian points on declared public walking surfaces", () => {
    const allowed = new Set([
      "sidewalk",
      "crosswalk",
      "bridge-walk",
      "entrance",
      "plaza",
      "riverwalk",
    ]);
    const plan = planAmbientMobility(input);
    expect(plan.pedestrianRoutes.flatMap((route) => route.points).every((p) => allowed.has(p.surface))).toBe(true);
  });

  it("keeps pedestrians out of water except on bridge walks", () => {
    const plan = planAmbientMobility(input);
    const river = visual.river;
    for (const candidate of plan.pedestrianRoutes.flatMap((route) => route.points)) {
      const inWater =
        candidate.x > river.minX &&
        candidate.x < river.maxX &&
        candidate.z > river.minZ &&
        candidate.z < river.maxZ;
      expect(inWater && candidate.surface !== "bridge-walk").toBe(false);
    }
  });

  it("keeps pedestrian samples out of building footprints", () => {
    const plan = planAmbientMobility(input);
    expect(
      plan.pedestrianRoutes
        .flatMap((route) => route.points)
        .every((candidate) => !isInsideBuilding(candidate)),
    ).toBe(true);
  });

  it("binds every entrance dwell to a real public entrance", () => {
    const plan = planAmbientMobility(input);
    const dwellPoints = plan.pedestrianRoutes
      .flatMap((route) => route.points)
      .filter((candidate) => candidate.surface === "entrance");
    expect(dwellPoints.length).toBeGreaterThan(0);
    for (const dwell of dwellPoints) {
      const building = fabric.buildings.find((candidate) => candidate.id === dwell.entranceId);
      expect(building).toBeTruthy();
      expect(dwell).toMatchObject(resolvePublicEntrancePoint(building!));
      expect(dwell.behavior).toBe("dwell");
    }
  });

  it("prioritizes a declared public frontage without adding semantic ownership", () => {
    const envelope = fabric.architecturalEnvelopes[0]!;
    const entrance = { x: envelope.entrance.x, z: envelope.entrance.z };
    const frontage: AmbientPublicFrontage = {
      id: "review-frontage",
      envelopeId: envelope.id,
      blockId: envelope.blockId,
      streetId: envelope.primaryStreetId,
      points: [
        { x: entrance.x - 0.5, z: entrance.z },
        entrance,
        { x: entrance.x + 0.5, z: entrance.z },
      ],
      priority: true,
    };
    const plan = planAmbientMobility({ ...input, publicFrontages: [frontage] });
    const route = plan.pedestrianRoutes.find(
      (candidate) => candidate.id === "pedestrian:frontage:review-frontage",
    );
    expect(route?.componentIds).toEqual([]);
    expect(route?.entityIds).toEqual([]);
    expect(route?.evidenceRelationIds).toEqual([]);
    expect(route?.points[1]).toMatchObject({
      surface: "entrance",
      behavior: "dwell",
      entranceId: envelope.id,
    });
    expect(
      plan.agents.filter((agent) => agent.routeId === route?.id),
    ).toHaveLength(8);
  });

  it("keeps boat routes inside the navigable river channel", () => {
    const plan = planAmbientMobility(input);
    expect(plan.waterRoutes.length).toBeGreaterThan(0);
    for (const candidate of plan.waterRoutes.flatMap((route) => route.points)) {
      expect(candidate.x).toBeGreaterThan(visual.river.minX);
      expect(candidate.x).toBeLessThan(visual.river.maxX);
      expect(candidate.z).toBeGreaterThan(visual.river.minZ);
      expect(candidate.z).toBeLessThan(visual.river.maxZ);
    }
  });

  it("routes boats through the opening of every existing bridge", () => {
    const plan = planAmbientMobility(input);
    const bridges = fabric.streets.filter((street) => street.surface === "bridge");
    for (const route of plan.waterRoutes) {
      const x = route.points[0]!.x;
      for (const bridge of bridges) {
        const minimumX = Math.min(...bridge.centerline.map((point) => point.x));
        const maximumX = Math.max(...bridge.centerline.map((point) => point.x));
        expect(x).toBeGreaterThan(minimumX);
        expect(x).toBeLessThan(maximumX);
      }
    }
  });

  it("spawns a review boat near a real bridge without leaving the channel", () => {
    const plan = planAmbientMobility(input);
    const bridge = fabric.streets.find((street) => street.surface === "bridge")!;
    const bridgeZ = (bridge.centerline[0]!.z + bridge.centerline.at(-1)!.z) / 2;
    for (const route of plan.waterRoutes) {
      expect(route.reviewSpawnProgress).not.toBeNull();
      const minimumZ = route.points[0]!.z;
      const maximumZ = route.points.at(-1)!.z;
      const spawnZ =
        minimumZ + (maximumZ - minimumZ) * route.reviewSpawnProgress!;
      expect(spawnZ).toBeGreaterThan(bridgeZ);
      expect(spawnZ).toBeLessThanOrEqual(bridgeZ + 6.5);
    }
  });

  it("creates no boat route or boat agent without navigable water", () => {
    const plan = planAmbientMobility({ urbanFabric: fabric, visualCity: null, seed: "dry" });
    expect(plan.waterRoutes).toEqual([]);
    expect(plan.agents.some((agent) => agent.mode === "boat")).toBe(false);
    expect(plan.budgets.boats).toBe(0);
  });

  it("keeps presentation budgets within the documented min/max scaling", () => {
    const plan = planAmbientMobility(input);
    expect(plan.budgets.roadVehicles).toBeGreaterThanOrEqual(18);
    expect(plan.budgets.roadVehicles).toBeLessThanOrEqual(32);
    expect(plan.budgets.pedestrians).toBeGreaterThanOrEqual(24);
    expect(plan.budgets.pedestrians).toBeLessThanOrEqual(48);
    expect(plan.budgets.boats).toBeGreaterThanOrEqual(1);
    expect(plan.budgets.boats).toBeLessThanOrEqual(3);
    expect(plan.diagnostics.vehicleCount).toBe(plan.budgets.roadVehicles);
    expect(plan.diagnostics.pedestrianCount).toBe(plan.budgets.pedestrians);
    expect(plan.diagnostics.boatCount).toBe(plan.budgets.boats);
  });

  it("does not duplicate routes or agents across repeated mode-style reuse", () => {
    const plans = ["explore", "map", "journey", "replay", "explore"].map(() =>
      planAmbientMobility(input),
    );
    for (const plan of plans) {
      expect(new Set(allAmbientRoutes(plan).map((route) => route.id)).size).toBe(allAmbientRoutes(plan).length);
      expect(new Set(plan.agents.map((agent) => agent.id)).size).toBe(plan.agents.length);
      expect(plan.agents).toHaveLength(plans[0]!.agents.length);
    }
  });

  it("keeps demo planning p95 below ten milliseconds", () => {
    const samples: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const started = performance.now();
      planAmbientMobility(input);
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    const p95 = samples[Math.floor(samples.length * 0.95)]!;
    expect(p95).toBeLessThan(10);
  });
});
