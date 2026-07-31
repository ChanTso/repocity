import type { CityPoint, RoadSegment } from "./living-city";

const COORDINATE_EPSILON = 1e-7;
const DISTANCE_EPSILON = 1e-9;
const KEY_PRECISION = 1e6;

export interface RoadPathPlan {
  roads: readonly RoadSegment[];
}

export interface RoadPathAnchor {
  roadId: string;
  point: CityPoint;
}

/**
 * Resolves a building frontage or driveway point onto its declared road.
 *
 * This projection is explicit because LivingCity frontage points sit at the
 * parcel edge rather than at the road centre line. The along-road coordinate
 * must still fall within the segment; malformed frontage data is rejected.
 */
export function projectRoadAnchor(
  plan: RoadPathPlan,
  frontage: RoadPathAnchor,
): RoadPathAnchor | null {
  const road = plan.roads.find(
    (candidate) =>
      candidate.id === frontage.roadId && isUsableGroundRoad(candidate),
  );
  if (!road || !finitePoint(frontage.point)) return null;
  const alongRoad =
    road.axis === "x" ? frontage.point.x : frontage.point.z;
  const start = road.axis === "x" ? road.start.x : road.start.z;
  const end = road.axis === "x" ? road.end.x : road.end.z;
  if (!between(alongRoad, start, end)) return null;

  return {
    roadId: road.id,
    point:
      road.axis === "x"
        ? normalizedPoint({ x: alongRoad, z: road.start.z })
        : normalizedPoint({ x: road.start.x, z: alongRoad }),
  };
}

interface GraphEdge {
  to: string;
  roadId: string;
  distance: number;
}

interface RoadGraphEntry {
  road: RoadSegment;
  points: Map<string, CityPoint>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finitePoint(point: CityPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.z);
}

function normalizedCoordinate(value: number): number {
  const rounded = Math.round(value * KEY_PRECISION) / KEY_PRECISION;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizedPoint(point: CityPoint): CityPoint {
  return {
    x: normalizedCoordinate(point.x),
    z: normalizedCoordinate(point.z),
  };
}

function pointKey(point: CityPoint): string {
  const normalized = normalizedPoint(point);
  return `${normalized.x.toFixed(6)},${normalized.z.toFixed(6)}`;
}

function comparePoints(left: CityPoint, right: CityPoint): number {
  return left.x - right.x || left.z - right.z;
}

function between(value: number, first: number, second: number): boolean {
  return (
    value >= Math.min(first, second) - COORDINATE_EPSILON &&
    value <= Math.max(first, second) + COORDINATE_EPSILON
  );
}

function isUsableGroundRoad(road: RoadSegment): boolean {
  if (
    road.level !== "ground" ||
    !finitePoint(road.start) ||
    !finitePoint(road.end)
  ) {
    return false;
  }

  return road.axis === "x"
    ? Math.abs(road.start.z - road.end.z) <= COORDINATE_EPSILON
    : Math.abs(road.start.x - road.end.x) <= COORDINATE_EPSILON;
}

function isPointOnRoad(point: CityPoint, road: RoadSegment): boolean {
  if (!finitePoint(point)) return false;

  return road.axis === "x"
    ? Math.abs(point.z - road.start.z) <= COORDINATE_EPSILON &&
        between(point.x, road.start.x, road.end.x)
    : Math.abs(point.x - road.start.x) <= COORDINATE_EPSILON &&
        between(point.z, road.start.z, road.end.z);
}

function addPoint(entry: RoadGraphEntry, point: CityPoint): void {
  const normalized = normalizedPoint(point);
  entry.points.set(pointKey(normalized), normalized);
}

function addPairIntersections(
  first: RoadGraphEntry,
  second: RoadGraphEntry,
): void {
  if (first.road.axis !== second.road.axis) {
    const horizontal = first.road.axis === "x" ? first : second;
    const vertical = first.road.axis === "z" ? first : second;
    const intersection = {
      x: vertical.road.start.x,
      z: horizontal.road.start.z,
    };

    if (
      isPointOnRoad(intersection, horizontal.road) &&
      isPointOnRoad(intersection, vertical.road)
    ) {
      addPoint(horizontal, intersection);
      addPoint(vertical, intersection);
    }
    return;
  }

  const sameLine =
    first.road.axis === "x"
      ? Math.abs(first.road.start.z - second.road.start.z) <=
        COORDINATE_EPSILON
      : Math.abs(first.road.start.x - second.road.start.x) <=
        COORDINATE_EPSILON;
  if (!sameLine) return;

  for (const point of [first.road.start, first.road.end]) {
    if (isPointOnRoad(point, second.road)) {
      addPoint(first, point);
      addPoint(second, point);
    }
  }
  for (const point of [second.road.start, second.road.end]) {
    if (isPointOnRoad(point, first.road)) {
      addPoint(first, point);
      addPoint(second, point);
    }
  }
}

function addUndirectedEdge(
  adjacency: Map<string, GraphEdge[]>,
  first: CityPoint,
  second: CityPoint,
  roadId: string,
): void {
  const firstKey = pointKey(first);
  const secondKey = pointKey(second);
  if (firstKey === secondKey) return;

  const distance = Math.abs(first.x - second.x) + Math.abs(first.z - second.z);
  if (distance <= DISTANCE_EPSILON) return;

  adjacency.get(firstKey)!.push({
    to: secondKey,
    roadId,
    distance,
  });
  adjacency.get(secondKey)!.push({
    to: firstKey,
    roadId,
    distance,
  });
}

function buildRoadGraph(
  roads: readonly RoadSegment[],
  source: RoadPathAnchor,
  target: RoadPathAnchor,
): {
  adjacency: Map<string, GraphEdge[]>;
  points: Map<string, CityPoint>;
  sourceKey: string;
  targetKey: string;
} | null {
  const entries = roads
    .filter(isUsableGroundRoad)
    .map(
      (road): RoadGraphEntry => ({
        road,
        points: new Map(),
      }),
    )
    .sort(
      (left, right) =>
        compareText(left.road.id, right.road.id) ||
        comparePoints(left.road.start, right.road.start) ||
        comparePoints(left.road.end, right.road.end),
    );

  const sourceEntry = entries.find((entry) => entry.road.id === source.roadId);
  const targetEntry = entries.find((entry) => entry.road.id === target.roadId);
  if (
    !sourceEntry ||
    !targetEntry ||
    !isPointOnRoad(source.point, sourceEntry.road) ||
    !isPointOnRoad(target.point, targetEntry.road)
  ) {
    return null;
  }

  for (const entry of entries) {
    addPoint(entry, entry.road.start);
    addPoint(entry, entry.road.end);
  }

  for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < entries.length;
      secondIndex += 1
    ) {
      addPairIntersections(entries[firstIndex]!, entries[secondIndex]!);
    }
  }

  addPoint(sourceEntry, source.point);
  addPoint(targetEntry, target.point);

  const points = new Map<string, CityPoint>();
  for (const entry of entries) {
    for (const [key, point] of entry.points) {
      points.set(key, point);
    }
  }

  const adjacency = new Map<string, GraphEdge[]>(
    [...points.keys()]
      .sort(compareText)
      .map((key) => [key, []] as const),
  );

  for (const entry of entries) {
    const orderedPoints = [...entry.points.values()].sort((left, right) =>
      entry.road.axis === "x"
        ? left.x - right.x || left.z - right.z
        : left.z - right.z || left.x - right.x,
    );

    for (let index = 1; index < orderedPoints.length; index += 1) {
      addUndirectedEdge(
        adjacency,
        orderedPoints[index - 1]!,
        orderedPoints[index]!,
        entry.road.id,
      );
    }
  }

  for (const edges of adjacency.values()) {
    edges.sort(
      (left, right) =>
        compareText(left.roadId, right.roadId) ||
        compareText(left.to, right.to) ||
        left.distance - right.distance,
    );
  }

  return {
    adjacency,
    points,
    sourceKey: pointKey(source.point),
    targetKey: pointKey(target.point),
  };
}

function shortestNodePath(
  adjacency: ReadonlyMap<string, readonly GraphEdge[]>,
  sourceKey: string,
  targetKey: string,
): string[] | null {
  if (sourceKey === targetKey) return [sourceKey];

  const unvisited = new Set(adjacency.keys());
  const distances = new Map<string, number>([[sourceKey, 0]]);
  const signatures = new Map<string, string>([[sourceKey, sourceKey]]);
  const previous = new Map<string, string>();

  while (unvisited.size > 0) {
    let current: string | null = null;
    for (const candidate of unvisited) {
      const candidateDistance = distances.get(candidate) ?? Infinity;
      if (!Number.isFinite(candidateDistance)) continue;
      if (current === null) {
        current = candidate;
        continue;
      }

      const currentDistance = distances.get(current) ?? Infinity;
      const distanceOrder = candidateDistance - currentDistance;
      const signatureOrder = compareText(
        signatures.get(candidate) ?? candidate,
        signatures.get(current) ?? current,
      );
      if (
        distanceOrder < -DISTANCE_EPSILON ||
        (Math.abs(distanceOrder) <= DISTANCE_EPSILON &&
          (signatureOrder < 0 ||
            (signatureOrder === 0 && compareText(candidate, current) < 0)))
      ) {
        current = candidate;
      }
    }

    if (current === null) break;
    if (current === targetKey) break;
    unvisited.delete(current);

    const currentDistance = distances.get(current)!;
    const currentSignature = signatures.get(current)!;
    for (const edge of adjacency.get(current) ?? []) {
      if (!unvisited.has(edge.to)) continue;
      const candidateDistance = currentDistance + edge.distance;
      const candidateSignature = `${currentSignature}>${edge.roadId}:${edge.to}`;
      const knownDistance = distances.get(edge.to) ?? Infinity;
      const knownSignature = signatures.get(edge.to);
      const isShorter =
        candidateDistance < knownDistance - DISTANCE_EPSILON;
      const isStableTie =
        Math.abs(candidateDistance - knownDistance) <= DISTANCE_EPSILON &&
        (knownSignature === undefined ||
          compareText(candidateSignature, knownSignature) < 0);

      if (isShorter || isStableTie) {
        distances.set(edge.to, candidateDistance);
        signatures.set(edge.to, candidateSignature);
        previous.set(edge.to, current);
      }
    }
  }

  if (!previous.has(targetKey)) return null;

  const reversed = [targetKey];
  let current = targetKey;
  while (current !== sourceKey) {
    const predecessor = previous.get(current);
    if (!predecessor) return null;
    reversed.push(predecessor);
    current = predecessor;
  }
  return reversed.reverse();
}

function samePoint(first: CityPoint, second: CityPoint): boolean {
  return (
    Math.abs(first.x - second.x) <= COORDINATE_EPSILON &&
    Math.abs(first.z - second.z) <= COORDINATE_EPSILON
  );
}

function canMergeCollinear(
  first: CityPoint,
  middle: CityPoint,
  last: CityPoint,
): boolean {
  const firstX = middle.x - first.x;
  const firstZ = middle.z - first.z;
  const secondX = last.x - middle.x;
  const secondZ = last.z - middle.z;
  const cross = firstX * secondZ - firstZ * secondX;
  const dot = firstX * secondX + firstZ * secondZ;
  return Math.abs(cross) <= COORDINATE_EPSILON && dot >= -DISTANCE_EPSILON;
}

function compactPath(points: readonly CityPoint[]): CityPoint[] {
  const compacted: CityPoint[] = [];

  for (const point of points) {
    if (compacted.length > 0 && samePoint(compacted.at(-1)!, point)) {
      continue;
    }
    while (
      compacted.length >= 2 &&
      canMergeCollinear(compacted.at(-2)!, compacted.at(-1)!, point)
    ) {
      compacted.pop();
    }
    compacted.push(point);
  }

  return compacted;
}

/**
 * Finds the shortest drivable path between two named ground-road anchors.
 *
 * The returned polyline starts and ends at the supplied points without
 * silently snapping invalid frontage data. Elevated roads are intentionally
 * excluded; ground-level bridge segments remain part of the road graph.
 */
export function findRoadPath(
  plan: RoadPathPlan,
  source: RoadPathAnchor,
  target: RoadPathAnchor,
): CityPoint[] | null {
  if (!finitePoint(source.point) || !finitePoint(target.point)) return null;

  const graph = buildRoadGraph(plan.roads, source, target);
  if (!graph) return null;

  const nodePath = shortestNodePath(
    graph.adjacency,
    graph.sourceKey,
    graph.targetKey,
  );
  if (!nodePath) return null;

  const path = nodePath.map((key) => graph.points.get(key)!);
  path[0] = { ...source.point };
  path[path.length - 1] = { ...target.point };
  return compactPath(path);
}
