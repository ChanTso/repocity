import type {
  FlowJourney,
  FlowLeg,
  FlowProvenance,
} from "./flow-simulation";
import type { CityPoint } from "./living-city";
import type {
  SemanticCampus,
  SemanticCityPlan,
  SemanticCorridor,
  SemanticCorridorPort,
  SemanticEntityAddress,
  SemanticMobilityRoute,
} from "./semantic-city";
import { SEMANTIC_ACCESS_CLEARANCE } from "./semantic-city";

/**
 * A scenario-backed mobility route. It remains assignable to the renderer's
 * base SemanticMobilityRoute while retaining the journey evidence that
 * authorized moving agents.
 */
export type ProjectedSemanticMobilityRoute = SemanticMobilityRoute & {
  scenarioId: string;
  provenance: FlowProvenance;
  legId: string;
  sourceComponentId: string;
  targetComponentId: string;
  /** First corridor, retained for direct-route consumers. */
  corridorId: string;
  /** Complete ordered infrastructure path; one item for a direct route. */
  corridorIds: string[];
  boundaryFactIds: string[];
  tokenIds: string[];
};

export type SemanticFlowSkipReason =
  | "missing-source-address"
  | "missing-target-address"
  | "same-component"
  | "no-legal-local-corridor"
  | "missing-artifact-boundary"
  | "no-legal-water-corridor"
  | "no-legal-land-corridor"
  | "no-explicit-tokens";

export interface SemanticFlowLegDiagnostic {
  legId: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceComponentId?: string;
  targetComponentId?: string;
  reason: SemanticFlowSkipReason;
}

export interface SemanticFlowProjectionDiagnostics {
  skippedLegs: SemanticFlowLegDiagnostic[];
  ignoredTokenIds: string[];
}

export interface SemanticFlowProjection {
  routes: ProjectedSemanticMobilityRoute[];
  /**
   * Every journey leg receives an entry. An empty array means the semantic
   * macro layer could not legally replace the legacy file-level route.
   */
  legPoints: Record<string, CityPoint[]>;
  diagnostics: SemanticFlowProjectionDiagnostics;
}

export interface ProjectSemanticFlowInput {
  plan: SemanticCityPlan;
  journey: FlowJourney;
}

interface OrientedCorridor {
  corridor: SemanticCorridor;
  reversed: boolean;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clonePoints(points: readonly CityPoint[]): CityPoint[] {
  return points.map((point) => ({ x: point.x, z: point.z }));
}

function samePoint(left: CityPoint | undefined, right: CityPoint): boolean {
  return left?.x === right.x && left.z === right.z;
}

function hasLegalPortGeometry(corridor: SemanticCorridor): boolean {
  return (
    corridor.points.length >= 2 &&
    corridor.sourcePort.componentId === corridor.sourceComponentId &&
    corridor.targetPort.componentId === corridor.targetComponentId &&
    samePoint(corridor.points[0], corridor.sourcePort) &&
    samePoint(corridor.points.at(-1), corridor.targetPort)
  );
}

function directCorridors(
  plan: SemanticCityPlan,
  sourceComponentId: string,
  targetComponentId: string,
): OrientedCorridor[] {
  return plan.corridors.flatMap<OrientedCorridor>((corridor) => {
    if (
      corridor.sourceComponentId === sourceComponentId &&
      corridor.targetComponentId === targetComponentId
    ) {
      return [{ corridor, reversed: false }];
    }
    if (
      corridor.sourceComponentId === targetComponentId &&
      corridor.targetComponentId === sourceComponentId
    ) {
      return [{ corridor, reversed: true }];
    }
    return [];
  });
}

function relationOverlap(corridor: SemanticCorridor, leg: FlowLeg): number {
  const relationIds = new Set(leg.relationIds);
  return corridor.relationIds.reduce(
    (count, relationId) => count + Number(relationIds.has(relationId)),
    0,
  );
}

function candidateOrder(
  leg: FlowLeg,
  left: OrientedCorridor,
  right: OrientedCorridor,
): number {
  return (
    relationOverlap(right.corridor, leg) -
      relationOverlap(left.corridor, leg) ||
    Number(left.reversed) - Number(right.reversed) ||
    compareText(left.corridor.id, right.corridor.id)
  );
}

function isRoadBacked(
  plan: SemanticCityPlan,
  corridor: SemanticCorridor,
): boolean {
  return plan.roads.some(
    (road) =>
      road.centerline.length >= 2 &&
      road.corridorIds.includes(corridor.id),
  );
}

function legalLandCorridor(
  plan: SemanticCityPlan,
  candidate: OrientedCorridor,
): boolean {
  const { corridor } = candidate;
  return (
    corridor.basis === "static-import" &&
    !corridor.waterCrossing &&
    corridor.sourcePort.kind === "frontage" &&
    corridor.targetPort.kind === "frontage" &&
    hasLegalPortGeometry(corridor) &&
    isRoadBacked(plan, corridor)
  );
}

function legalLocalAccessCorridor(
  plan: SemanticCityPlan,
  corridor: SemanticCorridor,
  componentId: string,
): boolean {
  return (
    corridor.sourceComponentId === componentId &&
    corridor.targetComponentId === componentId &&
    corridor.scope === "campus" &&
    (corridor.basis === "component-access" ||
      corridor.basis === "static-import") &&
    !corridor.waterCrossing &&
    corridor.sourcePort.kind === "frontage" &&
    corridor.targetPort.kind === "frontage" &&
    hasLegalPortGeometry(corridor) &&
    isRoadBacked(plan, corridor)
  );
}

function localAccessCorridor(
  plan: SemanticCityPlan,
  componentId: string,
  leg: FlowLeg,
): SemanticCorridor | undefined {
  return plan.corridors
    .filter((corridor) =>
      legalLocalAccessCorridor(plan, corridor, componentId),
    )
    .sort(
      (left, right) =>
        Number(right.basis === "component-access") -
          Number(left.basis === "component-access") ||
        relationOverlap(right, leg) - relationOverlap(left, leg) ||
        compareText(left.id, right.id),
    )[0];
}

function orientedStartPort(
  candidate: OrientedCorridor,
): SemanticCorridorPort {
  return candidate.reversed
    ? candidate.corridor.targetPort
    : candidate.corridor.sourcePort;
}

function orientedEndPort(
  candidate: OrientedCorridor,
): SemanticCorridorPort {
  return candidate.reversed
    ? candidate.corridor.sourcePort
    : candidate.corridor.targetPort;
}

type CampusEdge = "north" | "east" | "south" | "west";

interface RingAnchor {
  point: CityPoint;
  edge: CampusEdge;
  scalar: number;
}

interface CampusRing {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  perimeter: number;
}

function campusRing(campus: SemanticCampus): CampusRing {
  const minX =
    campus.x - campus.width / 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxX =
    campus.x + campus.width / 2 + SEMANTIC_ACCESS_CLEARANCE;
  const minZ =
    campus.z - campus.depth / 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxZ =
    campus.z + campus.depth / 2 + SEMANTIC_ACCESS_CLEARANCE;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    perimeter: 2 * (width + depth),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function ringAnchor(
  ring: CampusRing,
  candidate: CityPoint,
  preferredEdge?: CampusEdge,
): RingAnchor {
  const distances: Array<{
    edge: CampusEdge;
    distance: number;
  }> = [
    { edge: "north", distance: Math.abs(candidate.z - ring.minZ) },
    { edge: "east", distance: Math.abs(candidate.x - ring.maxX) },
    { edge: "south", distance: Math.abs(candidate.z - ring.maxZ) },
    { edge: "west", distance: Math.abs(candidate.x - ring.minX) },
  ];
  const edge =
    preferredEdge ??
    distances.sort(
      (left, right) =>
        left.distance - right.distance ||
        compareText(left.edge, right.edge),
    )[0]!.edge;
  if (edge === "north") {
    const x = clamp(candidate.x, ring.minX, ring.maxX);
    return {
      edge,
      point: { x, z: ring.minZ },
      scalar: x - ring.minX,
    };
  }
  if (edge === "east") {
    const z = clamp(candidate.z, ring.minZ, ring.maxZ);
    return {
      edge,
      point: { x: ring.maxX, z },
      scalar: ring.width + (z - ring.minZ),
    };
  }
  if (edge === "south") {
    const x = clamp(candidate.x, ring.minX, ring.maxX);
    return {
      edge,
      point: { x, z: ring.maxZ },
      scalar: ring.width + ring.depth + (ring.maxX - x),
    };
  }
  const z = clamp(candidate.z, ring.minZ, ring.maxZ);
  return {
    edge,
    point: { x: ring.minX, z },
    scalar: 2 * ring.width + ring.depth + (ring.maxZ - z),
  };
}

function ringPointAt(ring: CampusRing, scalar: number): CityPoint {
  const normalized =
    ((scalar % ring.perimeter) + ring.perimeter) % ring.perimeter;
  if (normalized <= ring.width) {
    return { x: ring.minX + normalized, z: ring.minZ };
  }
  if (normalized <= ring.width + ring.depth) {
    return {
      x: ring.maxX,
      z: ring.minZ + normalized - ring.width,
    };
  }
  if (normalized <= 2 * ring.width + ring.depth) {
    return {
      x:
        ring.maxX -
        (normalized - ring.width - ring.depth),
      z: ring.maxZ,
    };
  }
  return {
    x: ring.minX,
    z:
      ring.maxZ -
      (normalized - 2 * ring.width - ring.depth),
  };
}

function clockwiseRingPoints(
  ring: CampusRing,
  start: RingAnchor,
  end: RingAnchor,
): CityPoint[] {
  const distance =
    (end.scalar - start.scalar + ring.perimeter) % ring.perimeter;
  const endScalar = start.scalar + distance;
  const cornerScalars = [
    ring.width,
    ring.width + ring.depth,
    2 * ring.width + ring.depth,
    ring.perimeter,
  ];
  const points: CityPoint[] = [{ ...start.point }];
  for (let lap = 0; lap <= 1; lap += 1) {
    for (const corner of cornerScalars) {
      const scalar = corner + lap * ring.perimeter;
      if (scalar > start.scalar && scalar < endScalar) {
        points.push(ringPointAt(ring, scalar));
      }
    }
  }
  points.push({ ...end.point });
  return points;
}

function campusAccessPoints(
  campus: SemanticCampus,
  from: CityPoint,
  to: CityPoint,
  fromEdge?: CampusEdge,
  toEdge?: CampusEdge,
): CityPoint[] {
  const ring = campusRing(campus);
  const start = ringAnchor(ring, from, fromEdge);
  const end = ringAnchor(ring, to, toEdge);
  const clockwise = clockwiseRingPoints(ring, start, end);
  const counterClockwise = clockwiseRingPoints(ring, end, start).reverse();
  const clockwiseDistance =
    (end.scalar - start.scalar + ring.perimeter) % ring.perimeter;
  const counterClockwiseDistance = ring.perimeter - clockwiseDistance;
  const ringPoints =
    clockwiseDistance <= counterClockwiseDistance
      ? clockwise
      : counterClockwise;
  const points = [from, ...ringPoints, to];
  return points.reduce<CityPoint[]>((output, candidate) => {
    if (!samePoint(output.at(-1), candidate)) {
      output.push({ x: candidate.x, z: candidate.z });
    }
    return output;
  }, []);
}

interface LandGraphEdge extends OrientedCorridor {
  sourceComponentId: string;
  targetComponentId: string;
}

function landGraph(
  plan: SemanticCityPlan,
): Map<string, LandGraphEdge[]> {
  const graph = new Map<string, LandGraphEdge[]>();
  const add = (edge: LandGraphEdge) => {
    const edges = graph.get(edge.sourceComponentId) ?? [];
    edges.push(edge);
    graph.set(edge.sourceComponentId, edges);
  };
  for (const corridor of [...plan.corridors].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    if (!legalLandCorridor(plan, { corridor, reversed: false })) {
      continue;
    }
    if (corridor.sourceComponentId === corridor.targetComponentId) {
      continue;
    }
    add({
      corridor,
      reversed: false,
      sourceComponentId: corridor.sourceComponentId,
      targetComponentId: corridor.targetComponentId,
    });
    add({
      corridor,
      reversed: true,
      sourceComponentId: corridor.targetComponentId,
      targetComponentId: corridor.sourceComponentId,
    });
  }
  for (const edges of graph.values()) {
    edges.sort(
      (left, right) =>
        compareText(left.corridor.id, right.corridor.id) ||
        compareText(left.targetComponentId, right.targetComponentId) ||
        Number(left.reversed) - Number(right.reversed),
    );
  }
  return graph;
}

function shortestLandPath(
  plan: SemanticCityPlan,
  sourceComponentId: string,
  targetComponentId: string,
): OrientedCorridor[] | undefined {
  const graph = landGraph(plan);
  const pending: Array<{
    componentId: string;
    path: OrientedCorridor[];
  }> = [{ componentId: sourceComponentId, path: [] }];
  const visited = new Set([sourceComponentId]);
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const current = pending[cursor]!;
    for (const edge of graph.get(current.componentId) ?? []) {
      if (visited.has(edge.targetComponentId)) continue;
      const path = [
        ...current.path,
        { corridor: edge.corridor, reversed: edge.reversed },
      ];
      if (edge.targetComponentId === targetComponentId) return path;
      visited.add(edge.targetComponentId);
      pending.push({ componentId: edge.targetComponentId, path });
    }
  }
  return undefined;
}

interface LandRouteGeometry {
  points: CityPoint[];
  corridorIds: string[];
  componentIds: string[];
}

function appendUniquePoints(
  output: CityPoint[],
  points: readonly CityPoint[],
): void {
  for (const candidate of points) {
    if (!samePoint(output.at(-1), candidate)) {
      output.push({ x: candidate.x, z: candidate.z });
    }
  }
}

function campusForAddress(
  plan: SemanticCityPlan,
  address: SemanticEntityAddress,
): SemanticCampus | undefined {
  return plan.campuses.find(
    (campus) =>
      campus.id === address.campusId &&
      campus.componentId === address.componentId,
  );
}

function localJourneyGeometry(
  plan: SemanticCityPlan,
  leg: FlowLeg,
  sourceAddress: SemanticEntityAddress,
  targetAddress: SemanticEntityAddress,
): LandRouteGeometry | undefined {
  const campus = campusForAddress(plan, sourceAddress);
  const access = localAccessCorridor(
    plan,
    sourceAddress.componentId,
    leg,
  );
  if (
    !campus ||
    !access ||
    targetAddress.campusId !== campus.id
  ) {
    return undefined;
  }
  return {
    points: campusAccessPoints(
      campus,
      sourceAddress.worldPoint,
      targetAddress.worldPoint,
    ),
    corridorIds: [access.id],
    componentIds: [sourceAddress.componentId],
  };
}

function landJourneyGeometry(
  plan: SemanticCityPlan,
  leg: FlowLeg,
  sourceAddress: SemanticEntityAddress,
  targetAddress: SemanticEntityAddress,
  path: readonly OrientedCorridor[],
): LandRouteGeometry | undefined {
  if (path.length === 0) {
    return localJourneyGeometry(
      plan,
      leg,
      sourceAddress,
      targetAddress,
    );
  }

  const sourceCampus = campusForAddress(plan, sourceAddress);
  const targetCampus = campusForAddress(plan, targetAddress);
  const sourceAccess = localAccessCorridor(
    plan,
    sourceAddress.componentId,
    leg,
  );
  const targetAccess = localAccessCorridor(
    plan,
    targetAddress.componentId,
    leg,
  );
  if (!sourceCampus || !targetCampus || !sourceAccess || !targetAccess) {
    return undefined;
  }

  const points: CityPoint[] = [];
  const corridorIds: string[] = [sourceAccess.id];
  const componentIds: string[] = [sourceAddress.componentId];
  const firstPort = orientedStartPort(path[0]!);
  appendUniquePoints(
    points,
    campusAccessPoints(
      sourceCampus,
      sourceAddress.worldPoint,
      firstPort,
      undefined,
      firstPort.edge,
    ),
  );

  for (let index = 0; index < path.length; index += 1) {
    const candidate = path[index]!;
    corridorIds.push(candidate.corridor.id);
    appendUniquePoints(points, orientedPoints(candidate));
    const arrivalPort = orientedEndPort(candidate);
    const arrivedComponentId = arrivalPort.componentId;
    if (componentIds.at(-1) !== arrivedComponentId) {
      componentIds.push(arrivedComponentId);
    }

    const next = path[index + 1];
    if (!next) continue;
    const departurePort = orientedStartPort(next);
    if (departurePort.componentId !== arrivedComponentId) {
      return undefined;
    }
    const transferCampus = plan.campuses.find(
      (campus) => campus.componentId === arrivedComponentId,
    );
    const transferAccess = localAccessCorridor(
      plan,
      arrivedComponentId,
      leg,
    );
    if (!transferCampus || !transferAccess) return undefined;
    corridorIds.push(transferAccess.id);
    appendUniquePoints(
      points,
      campusAccessPoints(
        transferCampus,
        arrivalPort,
        departurePort,
        arrivalPort.edge,
        departurePort.edge,
      ),
    );
  }

  const finalPort = orientedEndPort(path.at(-1)!);
  appendUniquePoints(
    points,
    campusAccessPoints(
      targetCampus,
      finalPort,
      targetAddress.worldPoint,
      finalPort.edge,
    ),
  );
  corridorIds.push(targetAccess.id);
  return {
    points,
    corridorIds,
    componentIds,
  };
}

function pointOnSegment(
  candidate: CityPoint,
  start: CityPoint,
  end: CityPoint,
): boolean {
  const cross =
    (candidate.z - start.z) * (end.x - start.x) -
    (candidate.x - start.x) * (end.z - start.z);
  if (Math.abs(cross) > 0.001) return false;
  return (
    candidate.x >= Math.min(start.x, end.x) - 0.001 &&
    candidate.x <= Math.max(start.x, end.x) + 0.001 &&
    candidate.z >= Math.min(start.z, end.z) - 0.001 &&
    candidate.z <= Math.max(start.z, end.z) + 0.001
  );
}

function pointInOrOnPolygon(
  candidate: CityPoint,
  polygon: readonly CityPoint[],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const start = polygon[previous]!;
    const end = polygon[index]!;
    if (pointOnSegment(candidate, start, end)) return true;
    const intersects =
      (start.z > candidate.z) !== (end.z > candidate.z) &&
      candidate.x <
        ((end.x - start.x) * (candidate.z - start.z)) /
          (end.z - start.z) +
          start.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function legalWaterCorridor(
  plan: SemanticCityPlan,
  candidate: OrientedCorridor,
  boundaryFactId: string,
): boolean {
  const { corridor } = candidate;
  const declaredBoundary = plan.terrain.waterBoundaries.find(
    (boundary) =>
      boundary.boundaryFactIds.includes(boundaryFactId) &&
      boundary.crossingCorridorIds.includes(corridor.id),
  );
  return (
    corridor.basis === "declared-boundary" &&
    corridor.waterCrossing &&
    corridor.boundaryFactIds.includes(boundaryFactId) &&
    corridor.sourcePort.kind === "artifact-quay" &&
    corridor.targetPort.kind === "artifact-quay" &&
    corridor.sourcePort.boundaryFactIds.includes(boundaryFactId) &&
    corridor.targetPort.boundaryFactIds.includes(boundaryFactId) &&
    hasLegalPortGeometry(corridor) &&
    Boolean(declaredBoundary) &&
    corridor.points.every((point) =>
      pointInOrOnPolygon(point, declaredBoundary!.outline),
    )
  );
}

function orientedPoints(candidate: OrientedCorridor): CityPoint[] {
  const points = clonePoints(candidate.corridor.points);
  return candidate.reversed ? points.reverse() : points;
}

function joinedPoints(path: readonly OrientedCorridor[]): CityPoint[] {
  const result: CityPoint[] = [];
  for (const candidate of path) {
    for (const point of orientedPoints(candidate)) {
      if (samePoint(result.at(-1), point)) continue;
      result.push(point);
    }
  }
  return result;
}

function diagnostic(
  leg: FlowLeg,
  reason: SemanticFlowSkipReason,
  sourceComponentId?: string,
  targetComponentId?: string,
): SemanticFlowLegDiagnostic {
  return {
    legId: leg.id,
    sourceEntityId: leg.sourceEntityId,
    targetEntityId: leg.targetEntityId,
    ...(sourceComponentId ? { sourceComponentId } : {}),
    ...(targetComponentId ? { targetComponentId } : {}),
    reason,
  };
}

/**
 * Project explicit journey agents onto component-scale semantic corridors.
 *
 * Static imports authorize infrastructure only. They never create traffic:
 * route weight is exactly the number of explicit journey tokens on the leg,
 * and a leg with no tokens emits no moving-agent route.
 */
export function projectSemanticFlow({
  plan,
  journey,
}: ProjectSemanticFlowInput): SemanticFlowProjection {
  const legs = [...journey.legs].sort(
    (left, right) =>
      left.index - right.index || compareText(left.id, right.id),
  );
  const legIds = new Set(legs.map((leg) => leg.id));
  const ignoredTokenIds = journey.tokens
    .filter(
      (token) =>
        token.journeyId !== journey.id || !legIds.has(token.legId),
    )
    .map((token) => token.id)
    .sort(compareText);
  const tokensByLeg = new Map<string, string[]>();
  for (const token of journey.tokens) {
    if (token.journeyId !== journey.id || !legIds.has(token.legId)) {
      continue;
    }
    const tokenIds = tokensByLeg.get(token.legId) ?? [];
    tokenIds.push(token.id);
    tokenIds.sort(compareText);
    tokensByLeg.set(token.legId, tokenIds);
  }

  const routes: ProjectedSemanticMobilityRoute[] = [];
  const legPoints: Record<string, CityPoint[]> = {};
  const skippedLegs: SemanticFlowLegDiagnostic[] = [];

  for (const leg of legs) {
    legPoints[leg.id] = [];
    const sourceAddress = plan.entityAddresses[leg.sourceEntityId];
    if (!sourceAddress) {
      skippedLegs.push(diagnostic(leg, "missing-source-address"));
      continue;
    }
    const targetAddress = plan.entityAddresses[leg.targetEntityId];
    if (!targetAddress) {
      skippedLegs.push(
        diagnostic(
          leg,
          "missing-target-address",
          sourceAddress.componentId,
        ),
      );
      continue;
    }
    const sourceComponentId = sourceAddress.componentId;
    const targetComponentId = targetAddress.componentId;
    let path: OrientedCorridor[] | undefined;
    let geometry: LandRouteGeometry | undefined;
    if (
      sourceComponentId === targetComponentId &&
      leg.mode !== "boat"
    ) {
      geometry = localJourneyGeometry(
        plan,
        leg,
        sourceAddress,
        targetAddress,
      );
      if (!geometry) {
        skippedLegs.push(
          diagnostic(
            leg,
            "no-legal-local-corridor",
            sourceComponentId,
            targetComponentId,
          ),
        );
        continue;
      }
    } else if (leg.mode === "boat") {
      const candidates = directCorridors(
        plan,
        sourceComponentId,
        targetComponentId,
      );
      const boundaryFactId = leg.artifactBoundaryId;
      if (!boundaryFactId) {
        skippedLegs.push(
          diagnostic(
            leg,
            "missing-artifact-boundary",
            sourceComponentId,
            targetComponentId,
          ),
        );
        continue;
      }
      const candidate = candidates
        .filter((possible) =>
          legalWaterCorridor(
            plan,
            possible,
            boundaryFactId,
          ),
        )
        .sort((left, right) => candidateOrder(leg, left, right))[0];
      if (!candidate) {
        skippedLegs.push(
          diagnostic(
            leg,
            "no-legal-water-corridor",
            sourceComponentId,
            targetComponentId,
          ),
        );
        continue;
      }
      path = [candidate];
    } else {
      const candidates = directCorridors(
        plan,
        sourceComponentId,
        targetComponentId,
      );
      const directCandidate = candidates
        .filter((possible) => legalLandCorridor(plan, possible))
        .sort((left, right) => candidateOrder(leg, left, right))[0];
      path = directCandidate
        ? [directCandidate]
        : shortestLandPath(
            plan,
            sourceComponentId,
            targetComponentId,
          );
      if (!path) {
        skippedLegs.push(
          diagnostic(
            leg,
            "no-legal-land-corridor",
            sourceComponentId,
            targetComponentId,
          ),
        );
        continue;
      }
      geometry = landJourneyGeometry(
        plan,
        leg,
        sourceAddress,
        targetAddress,
        path,
      );
      if (!geometry) {
        skippedLegs.push(
          diagnostic(
            leg,
            "no-legal-local-corridor",
            sourceComponentId,
            targetComponentId,
          ),
        );
        continue;
      }
    }

    const points =
      leg.mode === "boat"
        ? joinedPoints(path ?? [])
        : geometry!.points;
    const corridorIds =
      leg.mode === "boat"
        ? (path ?? []).map((candidate) => candidate.corridor.id)
        : geometry!.corridorIds;
    const componentIds =
      leg.mode === "boat"
        ? [sourceComponentId, targetComponentId]
        : geometry!.componentIds;
    legPoints[leg.id] = clonePoints(points);
    const tokenIds = [...(tokensByLeg.get(leg.id) ?? [])];
    if (tokenIds.length === 0) {
      skippedLegs.push(
        diagnostic(
          leg,
          "no-explicit-tokens",
          sourceComponentId,
          targetComponentId,
        ),
      );
      continue;
    }

    routes.push({
      id: `semantic-flow:${journey.id}:${leg.id}:${corridorIds.join(",")}`,
      scenarioId: journey.id,
      provenance: leg.provenance,
      legId: leg.id,
      sourceComponentId,
      targetComponentId,
      corridorId: corridorIds[0]!,
      corridorIds,
      mode: leg.mode,
      points,
      // This is an explicit agent count, never SemanticCorridor.weight or
      // FlowLeg.weight (both are structural/scenario metadata).
      weight: tokenIds.length,
      componentIds,
      evidenceRelationIds: [...new Set(leg.relationIds)].sort(compareText),
      boundaryFactIds:
        leg.mode === "boat" && leg.artifactBoundaryId
          ? [leg.artifactBoundaryId]
          : [],
      tokenIds,
    });
  }

  return {
    routes,
    legPoints,
    diagnostics: {
      skippedLegs,
      ignoredTokenIds,
    },
  };
}

export const projectFlowJourneyToSemanticRoutes = projectSemanticFlow;
