import { describe, expect, it } from "vitest";

import type {
  FlowAgentToken,
  FlowJourney,
  FlowLeg,
} from "./flow-simulation";
import type { CityPoint } from "./living-city";
import {
  projectSemanticFlow,
  type ProjectedSemanticMobilityRoute,
} from "./semantic-flow";
import {
  SEMANTIC_CITY_VERSION,
  SEMANTIC_ACCESS_CLEARANCE,
  type SemanticCampus,
  type SemanticCityPlan,
  type SemanticCorridor,
  type SemanticEntityAddress,
} from "./semantic-city";

const A = "component-a";
const B = "component-b";
const C = "component-c";

function point(x: number, z: number): CityPoint {
  return { x, z };
}

function componentCenter(componentId: string): CityPoint {
  if (componentId === A) return point(0, 0);
  if (componentId === B) return point(10, 0);
  return point(20, 0);
}

function campus(componentId: string): SemanticCampus {
  const center = componentCenter(componentId);
  return {
    id: `campus-${componentId}`,
    componentId,
    districtId: `district-${componentId}`,
    label: componentId,
    kind: "mixed-use",
    ...center,
    width: 4,
    depth: 4,
    height: 6,
    color: "#68b8a8",
    orientation: 0,
    active: true,
    anchorEntityId: `anchor-${componentId}`,
    entityIds: [],
    evidence: {
      entityIds: [],
      relationIds: [],
      reason: "Fixture campus.",
    },
    fileSlots: [],
  };
}

function address(
  entityId: string,
  componentId: string,
  worldPoint: CityPoint,
): SemanticEntityAddress {
  return {
    entityId,
    districtId: `district-${componentId}`,
    componentId,
    campusId: `campus-${componentId}`,
    fileSlotId: `slot-${entityId}`,
    worldPoint: { ...worldPoint },
    legacyWorldPoint: { ...worldPoint },
  };
}

interface CorridorOptions {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  relationIds?: string[];
  boundaryFactId?: string;
  weight?: number;
}

function corridor(options: CorridorOptions): SemanticCorridor {
  const sourceCenter = componentCenter(options.sourceComponentId);
  const targetCenter = componentCenter(options.targetComponentId);
  const boundaryFactIds = options.boundaryFactId
    ? [options.boundaryFactId]
    : [];
  const waterCrossing = Boolean(options.boundaryFactId);
  const direction = Math.sign(targetCenter.x - sourceCenter.x) || 1;
  const sourcePoint = waterCrossing
    ? point(direction > 0 ? 4 : 6, sourceCenter.z)
    : point(sourceCenter.x + direction * 3, sourceCenter.z);
  const targetPoint = waterCrossing
    ? point(direction > 0 ? 6 : 4, targetCenter.z)
    : point(targetCenter.x - direction * 3, targetCenter.z);
  const dx = targetPoint.x - sourcePoint.x;
  const dz = targetPoint.z - sourcePoint.z;
  return {
    id: options.id,
    basis: waterCrossing ? "declared-boundary" : "static-import",
    sourceComponentId: options.sourceComponentId,
    targetComponentId: options.targetComponentId,
    scope: "city",
    roadClass: waterCrossing ? "local" : "collector",
    points: [
      sourcePoint,
      point(
        sourcePoint.x + dx / 3,
        sourcePoint.z + dz / 3 + (waterCrossing ? 0 : -1),
      ),
      point(
        sourcePoint.x + (dx * 2) / 3,
        sourcePoint.z + (dz * 2) / 3 + (waterCrossing ? 0 : 1),
      ),
      targetPoint,
    ],
    weight: options.weight ?? 999,
    relationIds: [...(options.relationIds ?? [])],
    boundaryFactIds,
    waterCrossing,
    modeHint: waterCrossing ? "artifact" : "sync",
    sourcePort: {
      ...sourcePoint,
      id: `${options.id}-source-port`,
      componentId: options.sourceComponentId,
      campusId: `campus-${options.sourceComponentId}`,
      edge: direction > 0 ? "east" : "west",
      kind: waterCrossing ? "artifact-quay" : "frontage",
      boundaryFactIds,
    },
    targetPort: {
      ...targetPoint,
      id: `${options.id}-target-port`,
      componentId: options.targetComponentId,
      campusId: `campus-${options.targetComponentId}`,
      edge: direction > 0 ? "west" : "east",
      kind: waterCrossing ? "artifact-quay" : "frontage",
      boundaryFactIds,
    },
    evidence: {
      entityIds: [],
      relationIds: [...(options.relationIds ?? [])],
      boundaryFactIds,
      reason: waterCrossing
        ? "Explicit fixture boundary."
        : "Static fixture infrastructure.",
    },
  };
}

function accessCorridor(componentId: string): SemanticCorridor {
  const center = componentCenter(componentId);
  const minX = center.x - 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxX = center.x + 2 + SEMANTIC_ACCESS_CLEARANCE;
  const minZ = center.z - 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxZ = center.z + 2 + SEMANTIC_ACCESS_CLEARANCE;
  const port = point(center.x, minZ);
  return {
    id: `access-${componentId}`,
    basis: "component-access",
    sourceComponentId: componentId,
    targetComponentId: componentId,
    scope: "campus",
    roadClass: "local",
    points: [
      port,
      point(maxX, minZ),
      point(maxX, maxZ),
      point(minX, maxZ),
      point(minX, minZ),
      port,
    ],
    weight: 0,
    relationIds: [],
    boundaryFactIds: [],
    waterCrossing: false,
    modeHint: "local",
    sourcePort: {
      ...port,
      id: `access-${componentId}-source-port`,
      componentId,
      campusId: `campus-${componentId}`,
      edge: "north",
      kind: "frontage",
      boundaryFactIds: [],
    },
    targetPort: {
      ...port,
      id: `access-${componentId}-target-port`,
      componentId,
      campusId: `campus-${componentId}`,
      edge: "north",
      kind: "frontage",
      boundaryFactIds: [],
    },
    evidence: {
      entityIds: [],
      relationIds: [],
      reason: "Fixture component access loop.",
    },
  };
}

function semanticPlan(
  corridors: SemanticCorridor[],
  entityAddresses: Record<string, SemanticEntityAddress> = {
    "entity-a": address("entity-a", A, point(0, 0)),
    "entity-b": address("entity-b", B, point(10, 0)),
    "entity-c": address("entity-c", C, point(20, 0)),
  },
): SemanticCityPlan {
  const bounds = {
    x: 10,
    z: 0,
    width: 40,
    depth: 20,
    minX: -10,
    maxX: 30,
    minZ: -10,
    maxZ: 10,
  };
  const waterCorridors = corridors.filter(
    (candidate) => candidate.waterCrossing,
  );
  const componentIds = [
    ...new Set(
      Object.values(entityAddresses).map(
        (candidate) => candidate.componentId,
      ),
    ),
  ].sort();
  const accessCorridors = componentIds.map(accessCorridor);
  const allCorridors = [...corridors, ...accessCorridors];
  return {
    version: SEMANTIC_CITY_VERSION,
    seed: "semantic-flow-test",
    bounds,
    terrain: {
      bounds: { ...bounds },
      waterBoundaries: waterCorridors.map((candidate) => ({
        id: `water-${candidate.id}`,
        riverId: "river-test",
        outline: [
          point(4, -10),
          point(6, -10),
          point(6, 10),
          point(4, 10),
          point(4, -10),
        ],
        coastlines: [
          { side: "west", points: [point(4, -10), point(4, 10)] },
          { side: "east", points: [point(6, -10), point(6, 10)] },
        ],
        crossingCorridorIds: [candidate.id],
        relationIds: [...candidate.relationIds],
        boundaryFactIds: [...candidate.boundaryFactIds],
        evidence: {
          entityIds: [],
          relationIds: [...candidate.relationIds],
          boundaryFactIds: [...candidate.boundaryFactIds],
          reason: "Explicit fixture water boundary.",
        },
      })),
    },
    components: [],
    campuses: componentIds.map(campus),
    corridors: allCorridors,
    roads: allCorridors
      .filter(
        (candidate) =>
          (candidate.basis === "static-import" ||
            candidate.basis === "component-access") &&
          !candidate.waterCrossing,
      )
      .map((candidate) => ({
        id: `road-${candidate.id}`,
        corridorIds: [candidate.id],
        centerline: candidate.points.map((candidatePoint) => ({
          ...candidatePoint,
        })),
        width: 3,
        lanes: 2,
        level: "ground",
        surface: "ground",
        roadClass: candidate.roadClass,
        evidenceRelationIds: [...candidate.relationIds],
      })),
    mobility: { routes: [] },
    entityAddresses,
    relationCorridorIds: {},
  };
}

interface LegOptions {
  id: string;
  index?: number;
  sourceEntityId?: string;
  targetEntityId?: string;
  mode?: FlowLeg["mode"];
  relationIds?: string[];
  artifactBoundaryId?: string | null;
  provenance?: FlowLeg["provenance"];
  weight?: number;
}

function leg(options: LegOptions): FlowLeg {
  const sourceEntityId = options.sourceEntityId ?? "entity-a";
  const targetEntityId = options.targetEntityId ?? "entity-b";
  return {
    id: options.id,
    index: options.index ?? 0,
    sourceStepId: `${options.id}-source-step`,
    targetStepId: `${options.id}-target-step`,
    sourceEntityId,
    targetEntityId,
    source: {
      entityId: sourceEntityId,
      buildingId: `building-${sourceEntityId}`,
      districtId: `district-${sourceEntityId}`,
      point: point(0, 0),
    },
    target: {
      entityId: targetEntityId,
      buildingId: `building-${targetEntityId}`,
      districtId: `district-${targetEntityId}`,
      point: point(10, 0),
    },
    mode: options.mode ?? "car",
    direction: "forward",
    phase: "transfer",
    weight: options.weight ?? 777,
    relationIds: [...(options.relationIds ?? [])],
    provenance: options.provenance ?? "simulated",
    points: [point(0, 0), point(10, 0)],
    label: "Fixture leg",
    reason: "Fixture scenario.",
    evidenceIds: [],
    artifactBoundaryId: options.artifactBoundaryId ?? null,
  };
}

function token(
  legId: string,
  id: string,
  journeyId = "scenario-test",
): FlowAgentToken {
  return {
    id,
    journeyId,
    legId,
    mode: "car",
    direction: "forward",
    provenance: "simulated",
    payload: { kind: "dependency", label: "Fixture token" },
    progress: 0,
    progressPhase: "queued",
    speed: 1,
    delay: 0,
    evidenceIds: [],
  };
}

function journey(
  legs: FlowLeg[],
  tokens: FlowAgentToken[],
): FlowJourney {
  return {
    id: "scenario-test",
    kind: "dependency-journey",
    title: "Fixture journey",
    summary: "Explicit fixture scenario.",
    provenance: "simulated",
    steps: [],
    legs,
    tokens,
    evidence: [],
  };
}

function expectRoute(
  route: ProjectedSemanticMobilityRoute | undefined,
): ProjectedSemanticMobilityRoute {
  expect(route).toBeTruthy();
  return route!;
}

describe("projectSemanticFlow", () => {
  it("never turns static import weight into inferred traffic", () => {
    const land = corridor({
      id: "land-a-b",
      sourceComponentId: A,
      targetComponentId: B,
      relationIds: ["relation-a-b"],
      weight: 9_999,
    });
    const scenarioLeg = leg({
      id: "leg-without-agents",
      relationIds: ["relation-a-b"],
      weight: 4_321,
    });

    const projection = projectSemanticFlow({
      plan: semanticPlan([land]),
      journey: journey([scenarioLeg], []),
    });

    expect(projection.routes).toEqual([]);
    const points = projection.legPoints[scenarioLeg.id]!;
    expect(points[0]).toEqual(point(0, 0));
    expect(points.at(-1)).toEqual(point(10, 0));
    expect(points).toEqual(
      expect.arrayContaining(land.points),
    );
    expect(projection.diagnostics.skippedLegs).toEqual([
      expect.objectContaining({
        legId: scenarioLeg.id,
        reason: "no-explicit-tokens",
      }),
    ]);
  });

  it("rejects boat motion without the exact declared boundary", () => {
    const water = corridor({
      id: "water-a-b",
      sourceComponentId: A,
      targetComponentId: B,
      relationIds: ["relation-a-b"],
      boundaryFactId: "boundary-real",
    });
    const noBoundary = leg({
      id: "boat-without-boundary",
      mode: "boat",
      relationIds: ["relation-a-b"],
    });
    const wrongBoundary = leg({
      id: "boat-wrong-boundary",
      index: 1,
      mode: "boat",
      relationIds: ["relation-a-b"],
      artifactBoundaryId: "boundary-invented",
    });
    const projection = projectSemanticFlow({
      plan: semanticPlan([water]),
      journey: journey(
        [noBoundary, wrongBoundary],
        [
          token(noBoundary.id, "token-no-boundary"),
          token(wrongBoundary.id, "token-wrong-boundary"),
        ],
      ),
    });

    expect(projection.routes).toEqual([]);
    expect(projection.legPoints).toEqual({
      [noBoundary.id]: [],
      [wrongBoundary.id]: [],
    });
    expect(
      projection.diagnostics.skippedLegs.map(
        (candidate) => candidate.reason,
      ),
    ).toEqual([
      "missing-artifact-boundary",
      "no-legal-water-corridor",
    ]);
  });

  it("is deterministic across corridor, leg, and token input order", () => {
    const aToB = corridor({
      id: "land-a-b",
      sourceComponentId: A,
      targetComponentId: B,
      relationIds: ["relation-a-b"],
    });
    const cToB = corridor({
      id: "land-c-b",
      sourceComponentId: C,
      targetComponentId: B,
      relationIds: ["relation-b-c"],
    });
    const firstLeg = leg({
      id: "leg-a-b",
      index: 10,
      relationIds: ["relation-a-b"],
    });
    const secondLeg = leg({
      id: "leg-b-c",
      index: 20,
      sourceEntityId: "entity-b",
      targetEntityId: "entity-c",
      relationIds: ["relation-b-c"],
    });
    const tokens = [
      token(secondLeg.id, "token-4"),
      token(firstLeg.id, "token-2"),
      token(secondLeg.id, "token-3"),
      token(firstLeg.id, "token-1"),
    ];

    const first = projectSemanticFlow({
      plan: semanticPlan([aToB, cToB]),
      journey: journey([firstLeg, secondLeg], tokens),
    });
    const reordered = projectSemanticFlow({
      plan: semanticPlan([cToB, aToB]),
      journey: journey(
        [secondLeg, firstLeg],
        [...tokens].reverse(),
      ),
    });

    expect(JSON.stringify(reordered)).toBe(JSON.stringify(first));
    expect(first.routes.map((route) => route.legId)).toEqual([
      firstLeg.id,
      secondLeg.id,
    ]);
    expect(first.routes[1]?.points[0]).toEqual(point(10, 0));
    expect(first.routes[1]?.points.at(-1)).toEqual(point(20, 0));
    expect(first.routes[1]?.corridorIds).toContain(cToB.id);
  });

  it("uses direction-correct artifact quays and explicit token count", () => {
    const water = corridor({
      id: "water-a-b",
      sourceComponentId: A,
      targetComponentId: B,
      relationIds: ["relation-a-b"],
      boundaryFactId: "boundary-bundle",
      weight: 99_999,
    });
    const boatLeg = leg({
      id: "boat-b-a",
      sourceEntityId: "entity-b",
      targetEntityId: "entity-a",
      mode: "boat",
      relationIds: ["relation-a-b"],
      artifactBoundaryId: "boundary-bundle",
      provenance: "inferred",
      weight: 88_888,
    });
    const projection = projectSemanticFlow({
      plan: semanticPlan([water]),
      journey: journey(
        [boatLeg],
        [
          token(boatLeg.id, "token-2"),
          token(boatLeg.id, "token-1"),
        ],
      ),
    });
    const route = expectRoute(projection.routes[0]);

    expect(route).toMatchObject({
      scenarioId: "scenario-test",
      provenance: "inferred",
      legId: boatLeg.id,
      sourceComponentId: B,
      targetComponentId: A,
      corridorId: water.id,
      corridorIds: [water.id],
      mode: "boat",
      weight: 2,
      componentIds: [B, A],
      evidenceRelationIds: ["relation-a-b"],
      boundaryFactIds: ["boundary-bundle"],
      tokenIds: ["token-1", "token-2"],
    });
    expect(route.points[0]).toEqual(
      point(water.targetPort.x, water.targetPort.z),
    );
    expect(route.points.at(-1)).toEqual(
      point(water.sourcePort.x, water.sourcePort.z),
    );
    expect(
      route.points.every(
        (candidate) =>
          candidate.x >= 4 &&
          candidate.x <= 6 &&
          candidate.z >= -10 &&
          candidate.z <= 10,
      ),
    ).toBe(true);
    expect(projection.legPoints[boatLeg.id]).toEqual(route.points);
    expect(projection.diagnostics.skippedLegs).toEqual([]);
  });

  it("rejects a declared boat corridor whose main path leaves water terrain", () => {
    const water = corridor({
      id: "water-outside-terrain",
      sourceComponentId: A,
      targetComponentId: B,
      boundaryFactId: "boundary-bundle",
    });
    water.points[1] = point(3.5, 0);
    const boatLeg = leg({
      id: "boat-invalid-main-path",
      mode: "boat",
      artifactBoundaryId: "boundary-bundle",
    });
    const projection = projectSemanticFlow({
      plan: semanticPlan([water]),
      journey: journey(
        [boatLeg],
        [token(boatLeg.id, "boat-token")],
      ),
    });

    expect(projection.routes).toEqual([]);
    expect(projection.legPoints[boatLeg.id]).toEqual([]);
    expect(projection.diagnostics.skippedLegs[0]).toMatchObject({
      legId: boatLeg.id,
      reason: "no-legal-water-corridor",
    });
  });

  it("routes same-component legs through the explicit access loop", () => {
    const sameComponentPlan = semanticPlan([], {
      "entity-a": address("entity-a", A, point(0, 0)),
      "entity-b": address("entity-b", A, point(1, 0)),
    });
    const localLeg = leg({ id: "leg-inside-component" });
    const projection = projectSemanticFlow({
      plan: sameComponentPlan,
      journey: journey(
        [localLeg],
        [token(localLeg.id, "local-token")],
      ),
    });

    const route = expectRoute(projection.routes[0]);
    expect(route).toMatchObject({
      legId: localLeg.id,
      sourceComponentId: A,
      targetComponentId: A,
      corridorIds: [`access-${A}`],
      componentIds: [A],
      weight: 1,
    });
    expect(route.points[0]).toEqual(point(0, 0));
    expect(route.points.at(-1)).toEqual(point(1, 0));
    expect(route.points.length).toBeGreaterThan(2);
    expect(route.points.slice(1, -1)).not.toEqual([]);
    expect(projection.legPoints[localLeg.id]).toEqual(route.points);
    expect(projection.diagnostics.skippedLegs).toEqual([]);
  });

  it("does not invent local motion when component access is absent", () => {
    const plan = semanticPlan([], {
      "entity-a": address("entity-a", A, point(0, 0)),
      "entity-b": address("entity-b", A, point(1, 0)),
    });
    plan.corridors = plan.corridors.filter(
      (candidate) => candidate.basis !== "component-access",
    );
    plan.roads = plan.roads.filter(
      (road) =>
        !road.corridorIds.some((id) => id === `access-${A}`),
    );
    const localLeg = leg({ id: "leg-without-access" });
    const projection = projectSemanticFlow({
      plan,
      journey: journey(
        [localLeg],
        [token(localLeg.id, "local-token")],
      ),
    });

    expect(projection.routes).toEqual([]);
    expect(projection.legPoints[localLeg.id]).toEqual([]);
    expect(projection.diagnostics.skippedLegs[0]).toMatchObject({
      legId: localLeg.id,
      reason: "no-legal-local-corridor",
    });
  });

  it("routes explicit agents over a deterministic multi-hop road path", () => {
    const aToB = corridor({
      id: "01-land-a-b",
      sourceComponentId: A,
      targetComponentId: B,
      relationIds: ["relation-a-b"],
    });
    const bToC = corridor({
      id: "02-land-b-c",
      sourceComponentId: B,
      targetComponentId: C,
      relationIds: ["relation-b-c"],
    });
    const multiHopLeg = leg({
      id: "leg-a-c",
      sourceEntityId: "entity-a",
      targetEntityId: "entity-c",
      relationIds: ["scenario-a-c"],
    });
    const projection = projectSemanticFlow({
      plan: semanticPlan([bToC, aToB]),
      journey: journey(
        [multiHopLeg],
        [token(multiHopLeg.id, "multi-hop-token")],
      ),
    });
    const route = expectRoute(projection.routes[0]);

    expect(route.corridorIds).toEqual([
      `access-${A}`,
      aToB.id,
      `access-${B}`,
      bToC.id,
      `access-${C}`,
    ]);
    expect(route.weight).toBe(1);
    expect(route.points[0]).toEqual(point(0, 0));
    expect(route.points.at(-1)).toEqual(point(20, 0));
    const arrivalIndex = route.points.findIndex(
      (candidate) => candidate.x === 7 && candidate.z === 0,
    );
    const departureIndex = route.points.findIndex(
      (candidate, index) =>
        index > arrivalIndex &&
        candidate.x === 13 &&
        candidate.z === 0,
    );
    expect(arrivalIndex).toBeGreaterThanOrEqual(0);
    expect(departureIndex).toBeGreaterThan(arrivalIndex);
    expect(
      route.points
        .slice(arrivalIndex + 1, departureIndex)
        .some((candidate) => Math.abs(candidate.z) > 2),
    ).toBe(true);
    expect(projection.legPoints[multiHopLeg.id]).toEqual(route.points);
  });

  it("does not invent a crossing between disconnected components", () => {
    const isolatedRoad = corridor({
      id: "land-a-b",
      sourceComponentId: A,
      targetComponentId: B,
    });
    const disconnectedLeg = leg({
      id: "leg-a-c-disconnected",
      sourceEntityId: "entity-a",
      targetEntityId: "entity-c",
    });
    const projection = projectSemanticFlow({
      plan: semanticPlan([isolatedRoad]),
      journey: journey(
        [disconnectedLeg],
        [token(disconnectedLeg.id, "disconnected-token")],
      ),
    });

    expect(projection.routes).toEqual([]);
    expect(projection.legPoints[disconnectedLeg.id]).toEqual([]);
    expect(projection.diagnostics.skippedLegs[0]).toMatchObject({
      legId: disconnectedLeg.id,
      reason: "no-legal-land-corridor",
    });
  });
});
