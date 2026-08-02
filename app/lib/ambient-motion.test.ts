import { describe, expect, it } from "vitest";
import {
  prepareAmbientMotionRoute,
  sampleAmbientAgent,
  samplePreparedAmbientRouteInto,
} from "./ambient-motion";
import {
  allAmbientRoutes,
  planAmbientMobility,
  roadRouteCapacity,
  waterRoutePoints,
} from "./ambient-mobility";
import { demoProject } from "./demo-data";
import { planLivingCity } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import { planUrbanFabric } from "./urban-fabric";
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
const plan = planAmbientMobility({
  urbanFabric: fabric,
  visualCity: visual,
  seed: "ambient-runtime-motion",
});

const distance = (
  left: { x: number; z: number },
  right: { x: number; z: number },
) => Math.hypot(left.x - right.x, left.z - right.z);

function firstForwardHorizontalProgress(
  route: NonNullable<ReturnType<typeof prepareAmbientMotionRoute>>,
): number {
  let best: { length: number; progress: number } | null = null;
  for (let index = 1; index < route.points.length; index += 1) {
    const start = route.points[index - 1]!;
    const end = route.points[index]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (dx <= 0 || Math.abs(dx) <= Math.abs(dz) * 4) continue;
    const midpoint =
      (route.cumulativeLengths[index - 1]! + route.cumulativeLengths[index]!) / 2;
    if (!best || length > best.length) {
      best = { length, progress: midpoint / route.length };
    }
  }
  if (!best) throw new Error(`No canonical forward horizontal segment on ${route.id}`);
  return best.progress;
}

function sampleDeclaredDirection(
  route: NonNullable<ReturnType<typeof prepareAmbientMotionRoute>>,
  canonicalProgress: number,
) {
  return sampleAmbientAgent(
    route,
    {
      mode: "car",
      phase: route.direction > 0 ? canonicalProgress : 1 - canonicalProgress,
      speed: 1,
      delay: 0,
      dwellSeconds: 0,
    },
    0,
  );
}

function generatedBlockRoute(direction: 1 | -1) {
  for (let index = 0; index < 16; index += 1) {
    const candidate = planAmbientMobility({
      urbanFabric: fabric,
      visualCity: visual,
      seed: `ambient-block-direction-${index}`,
    }).roadRoutes.find((route) => route.blockId && route.direction === direction);
    if (candidate) return candidate;
  }
  throw new Error(`No generated block route for direction ${direction}`);
}

describe("ambient runtime motion", () => {
  it("prepares a real final-to-first segment for every closed route", () => {
    const routes = allAmbientRoutes(plan).filter(
      (route) => route.motionStrategy === "closed-loop",
    );
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const prepared = prepareAmbientMotionRoute(route)!;
      expect(prepared.points).toHaveLength(route.points.length + 1);
      expect(prepared.points.at(-1)).toMatchObject(prepared.points[0]!);
      const openLength = route.points.slice(1).reduce((total, point, index) => {
        const previous = route.points[index]!;
        return total + distance(previous, point);
      }, 0);
      expect(prepared.length).toBeGreaterThan(openLength);
    }
  });

  it("is spatially continuous with finite tangents across closed-loop wrap", () => {
    for (const route of allAmbientRoutes(plan).filter(
      (candidate) => candidate.motionStrategy === "closed-loop",
    )) {
      const prepared = prepareAmbientMotionRoute(route)!;
      const before = { x: 0, z: 0 };
      const after = { x: 0, z: 0 };
      const beforeTangent = { x: 0, z: 0 };
      const afterTangent = { x: 0, z: 0 };
      samplePreparedAmbientRouteInto(prepared, 0.999_99, before, beforeTangent);
      samplePreparedAmbientRouteInto(prepared, 0.000_01, after, afterTangent);
      expect(distance(before, after)).toBeLessThan(0.02);
      for (const value of [
        beforeTangent.x,
        beforeTangent.z,
        afterTangent.x,
        afterTangent.z,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(Math.hypot(beforeTangent.x, beforeTangent.z)).toBeGreaterThan(0.99);
      expect(Math.hypot(afterTangent.x, afterTangent.z)).toBeGreaterThan(0.99);
    }
  });

  it("moves opposing bridge lanes in opposite directions on the same bridge", () => {
    const bridgeRoutes = plan.roadRoutes
      .filter((route) => route.id.startsWith("road:bridge-loop:"))
      .sort((left, right) => left.direction - right.direction);
    expect(bridgeRoutes).toHaveLength(2);
    expect(Math.sign(bridgeRoutes[0]!.laneOffset)).toBe(
      -Math.sign(bridgeRoutes[1]!.laneOffset),
    );

    const prepared = bridgeRoutes.map((route) => prepareAmbientMotionRoute(route)!);
    const samples = prepared.map((route) =>
      sampleDeclaredDirection(route, firstForwardHorizontalProgress(route)),
    );
    const tangentDot =
      samples[0]!.tangent.x * samples[1]!.tangent.x +
      samples[0]!.tangent.z * samples[1]!.tangent.z;
    expect(tangentDot).toBeLessThan(-0.9);
  });

  it.each([
    [1, "clockwise", 1],
    [-1, "counter", -1],
  ] as const)(
    "moves a generated direction %s block route in declared %s circulation",
    (direction, label, expectedTangentX) => {
      const route = generatedBlockRoute(direction);
      expect(route.id).toContain(`:${label}`);
      const prepared = prepareAmbientMotionRoute(route)!;
      const sample = sampleDeclaredDirection(
        prepared,
        firstForwardHorizontalProgress(prepared),
      );
      expect(Math.sign(sample.tangent.x)).toBe(expectedTangentX);
      expect(Math.abs(sample.tangent.x)).toBeGreaterThan(0.9);
    },
  );

  it("completes a deterministic 120 second soak without a closed-route teleport", () => {
    for (const route of allAmbientRoutes(plan).filter(
      (candidate) => candidate.motionStrategy === "closed-loop",
    )) {
      const agent = plan.agents.find((candidate) => candidate.routeId === route.id)!;
      expect(agent).toBeTruthy();
      const prepared = prepareAmbientMotionRoute(route)!;
      const cycleDuration =
        prepared.cycleDistance / agent.speed +
        prepared.stopDistances.length * agent.dwellSeconds;
      expect(cycleDuration).toBeLessThan(120);
      let previous = sampleAmbientAgent(prepared, agent, 0).position;
      let maximumStep = 0;
      for (let elapsed = 0.1; elapsed <= 120; elapsed += 0.1) {
        const current = sampleAmbientAgent(prepared, agent, elapsed).position;
        maximumStep = Math.max(maximumStep, distance(previous, current));
        previous = current;
      }
      const maximumExpectedTravel = prepared.length * agent.speed * 0.1 + 0.03;
      expect(maximumStep).toBeLessThanOrEqual(maximumExpectedTravel);
    }
  });

  it("preserves road ordering, clearance and body spacing for two cycles including dwell", () => {
    for (const route of plan.roadRoutes) {
      const agents = plan.agents.filter((agent) => agent.routeId === route.id);
      const prepared = prepareAmbientMotionRoute(route)!;
      const cycleDuration =
        prepared.cycleDistance / agents[0]!.speed +
        prepared.stopDistances.length * agents[0]!.dwellSeconds;
      expect(agents.length).toBeLessThanOrEqual(roadRouteCapacity(route));
      const requiredGap = Math.max(
        route.minimumSpacing,
        (1.92 * 1.06 + 0.45) / prepared.length,
      );
      const expectedOrder = agents
        .map((agent) => agent.id)
        .sort((leftId, rightId) => {
          const left = agents.find((agent) => agent.id === leftId)!;
          const right = agents.find((agent) => agent.id === rightId)!;
          return left.phase - right.phase;
        });
      for (let elapsed = 0; elapsed <= cycleDuration * 2; elapsed += 0.2) {
        const positions = agents
          .map((agent) => ({
            id: agent.id,
            progress: sampleAmbientAgent(prepared, agent, elapsed).cycleProgress,
          }))
          .sort((left, right) => left.progress - right.progress);
        const order = positions.map((candidate) => candidate.id);
        const rotation = order.indexOf(expectedOrder[0]!);
        expect([...order.slice(rotation), ...order.slice(0, rotation)]).toEqual(expectedOrder);
        for (let index = 0; index < positions.length; index += 1) {
          const current = positions[index]!.progress;
          const next = positions[(index + 1) % positions.length]!.progress;
          const gap = index === positions.length - 1 ? 1 - current + next : next - current;
          expect(gap).toBeGreaterThanOrEqual(requiredGap - 0.0015);
          expect(gap * prepared.length).toBeGreaterThanOrEqual(1.92 * 1.06 + 0.45 - 0.08);
        }
      }
    }
  });

  it("uses one speed, delay and dwell schedule per road route", () => {
    for (const route of plan.roadRoutes) {
      const agents = plan.agents.filter((agent) => agent.routeId === route.id);
      expect(new Set(agents.map((agent) => agent.speed)).size).toBe(1);
      expect(new Set(agents.map((agent) => agent.delay)).size).toBe(1);
      expect(new Set(agents.map((agent) => agent.dwellSeconds)).size).toBe(1);
    }
  });

  it("preserves the accepted route, agent and non-evidence diagnostic baseline", () => {
    expect(plan.budgets).toEqual({
      roadVehicles: 32,
      pedestrians: 48,
      boats: 3,
    });
    expect({
      roadRoutes: plan.roadRoutes.length,
      pedestrianRoutes: plan.pedestrianRoutes.length,
      waterRoutes: plan.waterRoutes.length,
      agents: plan.agents.length,
    }).toEqual({
      roadRoutes: 7,
      pedestrianRoutes: 17,
      waterRoutes: 2,
      agents: 83,
    });
    expect(plan.diagnostics).toEqual({
      roadRouteCount: 7,
      pedestrianRouteCount: 17,
      waterRouteCount: 2,
      vehicleCount: 32,
      pedestrianCount: 48,
      boatCount: 3,
      bridgeRoadRouteCount: 2,
      crosswalkRouteCount: 5,
      entranceRouteCount: 4,
      riverwalkRouteCount: 2,
      invalidEntranceRouteCount: 0,
      priorityRoadRouteId: null,
      priorityRoadAllocation: 0,
      priorityRoadCapacity: 0,
      serializedBytes: 55_333,
    });
    for (const route of allAmbientRoutes(plan)) {
      expect(route.evidenceRelationIds).toEqual([]);
      expect(route.journeyIds).toEqual([]);
    }
  });

  it.each([
    [12, 48],
    [-48, -12],
    [-18, 32],
  ])("interpolates translated water intervals from %s to %s", (minimumZ, maximumZ) => {
    expect(waterRoutePoints(2, minimumZ, maximumZ).map((point) => point.z)).toEqual([
      minimumZ,
      minimumZ + (maximumZ - minimumZ) * 0.25,
      minimumZ + (maximumZ - minimumZ) * 0.5,
      minimumZ + (maximumZ - minimumZ) * 0.75,
      maximumZ,
    ]);
  });

  it("consumes opposing water directions without a mid-channel reversal", () => {
    const [downstream, upstream] = plan.waterRoutes;
    expect(downstream?.motionStrategy).toBe("offscreen-wrap");
    expect(upstream?.motionStrategy).toBe("offscreen-wrap");
    const downstreamAgent = plan.agents.find((agent) => agent.routeId === downstream!.id)!;
    const upstreamAgent = plan.agents.find((agent) => agent.routeId === upstream!.id)!;
    const downstreamPrepared = prepareAmbientMotionRoute(downstream!)!;
    const upstreamPrepared = prepareAmbientMotionRoute(upstream!)!;
    for (const elapsed of [0, 4, 12, 24, 48]) {
      expect(sampleAmbientAgent(downstreamPrepared, downstreamAgent, elapsed).tangent.z).toBeLessThan(0);
      expect(sampleAmbientAgent(upstreamPrepared, upstreamAgent, elapsed).tangent.z).toBeGreaterThan(0);
    }
    for (const route of [downstream!, upstream!]) {
      expect(route.points[0]!.z).toBeLessThan(fabric.bounds.minZ);
      expect(route.points.at(-1)!.z).toBeGreaterThan(fabric.bounds.maxZ);
      expect(route.points.every((point) => point.x > visual.river.minX && point.x < visual.river.maxX)).toBe(true);
    }
  });
});
