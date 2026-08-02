import { stableCityHash } from "./city-visuals";
import type { CityPoint } from "./living-city";
import type { SemanticTransportMode } from "./semantic-city";
import type {
  UrbanBlock,
  UrbanBuildingEnvelope,
  UrbanFabricPlan,
  UrbanStreet,
} from "./urban-fabric";
import type { VisualCityPlan } from "./visual-city";

export const AMBIENT_MOBILITY_VERSION = "0.2" as const;
export const AMBIENT_CONTEXT_CLASSIFICATION =
  "NON_SEMANTIC_URBAN_CONTEXT" as const;

export type AmbientRouteSurface =
  | "road-lane"
  | "intersection"
  | "bridge-lane"
  | "sidewalk"
  | "crosswalk"
  | "bridge-walk"
  | "entrance"
  | "plaza"
  | "riverwalk"
  | "river-channel";

export type AmbientRouteKind = "road" | "pedestrian" | "water";

export interface AmbientRoutePoint extends CityPoint {
  surface: AmbientRouteSurface;
  behavior: "travel" | "yield" | "dwell";
  streetId: string | null;
  entranceId: string | null;
}

export interface AmbientMobilityRoute {
  id: string;
  kind: AmbientRouteKind;
  points: AmbientRoutePoint[];
  closed: boolean;
  direction: 1 | -1;
  sourceStreetIds: string[];
  laneOffset: number;
  laneHalfWidth: number;
  minimumSpacing: number;
  stopProgresses: number[];
  reviewSpawnProgress: number | null;
  classification: typeof AMBIENT_CONTEXT_CLASSIFICATION;
  evidenceRelationIds: [];
  componentIds: [];
  entityIds: [];
  journeyIds: [];
}

export interface AmbientAgentPlan {
  id: string;
  routeId: string;
  mode: SemanticTransportMode;
  phase: number;
  speed: number;
  delay: number;
  dwellSeconds: number;
  colorVariant: number;
  scale: number;
  classification: typeof AMBIENT_CONTEXT_CLASSIFICATION;
}

export interface AmbientMobilityBudgets {
  roadVehicles: number;
  pedestrians: number;
  boats: number;
}

export interface AmbientMobilityDiagnostics {
  roadRouteCount: number;
  pedestrianRouteCount: number;
  waterRouteCount: number;
  vehicleCount: number;
  pedestrianCount: number;
  boatCount: number;
  bridgeRoadRouteCount: number;
  crosswalkRouteCount: number;
  entranceRouteCount: number;
  riverwalkRouteCount: number;
  serializedBytes: number;
}

export interface AmbientMobilityPlan {
  version: typeof AMBIENT_MOBILITY_VERSION;
  seed: string;
  classification: typeof AMBIENT_CONTEXT_CLASSIFICATION;
  budgets: AmbientMobilityBudgets;
  roadRoutes: AmbientMobilityRoute[];
  pedestrianRoutes: AmbientMobilityRoute[];
  waterRoutes: AmbientMobilityRoute[];
  agents: AmbientAgentPlan[];
  diagnostics: AmbientMobilityDiagnostics;
}

export interface PlanAmbientMobilityInput {
  urbanFabric: UrbanFabricPlan;
  visualCity?: VisualCityPlan | null;
  publicFrontages?: readonly AmbientPublicFrontage[];
  seed?: string;
  budgets?: Partial<AmbientMobilityBudgets>;
}

export interface AmbientPublicFrontage {
  id: string;
  envelopeId: string;
  blockId: string;
  streetId: string;
  points: readonly CityPoint[];
  priority: boolean;
}

export interface MeasuredAmbientMobilityPlan {
  plan: AmbientMobilityPlan;
  planningMs: number;
}

interface RouteCandidate {
  id: string;
  points: AmbientRoutePoint[];
  closed: boolean;
  direction: 1 | -1;
  sourceStreetIds: string[];
  laneOffset: number;
  laneHalfWidth: number;
}

const point = (
  x: number,
  z: number,
  surface: AmbientRouteSurface,
  streetId: string | null = null,
  behavior: AmbientRoutePoint["behavior"] = "travel",
  entranceId: string | null = null,
): AmbientRoutePoint => ({
  x: round(x),
  z: round(z),
  surface,
  behavior,
  streetId,
  entranceId,
});

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const round = (value: number) => Math.round(value * 1_000) / 1_000;

const compareText = (left: string, right: string) =>
  left.localeCompare(right, "en");

function seededOrder<T extends { id: string }>(
  values: readonly T[],
  seed: string,
): T[] {
  return [...values].sort(
    (left, right) =>
      stableCityHash(`${seed}:${left.id}`) -
        stableCityHash(`${seed}:${right.id}`) ||
      compareText(left.id, right.id),
  );
}

function defaultBudgets(plan: UrbanFabricPlan, hasWater: boolean): AmbientMobilityBudgets {
  const cityScale = clamp(plan.blocks.length / 12, 0.58, 1.65);
  return {
    roadVehicles: clamp(Math.round(24 * cityScale), 12, 32),
    pedestrians: clamp(Math.round(36 * cityScale), 16, 48),
    boats: hasWater ? clamp(Math.round(2 * Math.min(1.25, cityScale)), 1, 3) : 0,
  };
}

function normalizedBudgets(
  plan: UrbanFabricPlan,
  hasWater: boolean,
  override: Partial<AmbientMobilityBudgets> | undefined,
): AmbientMobilityBudgets {
  const defaults = defaultBudgets(plan, hasWater);
  return {
    roadVehicles: clamp(Math.round(override?.roadVehicles ?? defaults.roadVehicles), 0, 32),
    pedestrians: clamp(Math.round(override?.pedestrians ?? defaults.pedestrians), 0, 48),
    boats: hasWater
      ? clamp(Math.round(override?.boats ?? defaults.boats), 0, 3)
      : 0,
  };
}

function streetMap(plan: UrbanFabricPlan): Map<string, UrbanStreet> {
  return new Map(plan.streets.map((street) => [street.id, street]));
}

function horizontalCoordinate(street: UrbanStreet): number {
  return street.centerline.reduce((total, p) => total + p.z, 0) /
    Math.max(1, street.centerline.length);
}

function verticalCoordinate(street: UrbanStreet): number {
  return street.centerline.reduce((total, p) => total + p.x, 0) /
    Math.max(1, street.centerline.length);
}

function blockStreetFrame(
  block: UrbanBlock,
  streets: ReadonlyMap<string, UrbanStreet>,
) {
  const north = streets.get(block.streetIdsByEdge.north);
  const east = streets.get(block.streetIdsByEdge.east);
  const south = streets.get(block.streetIdsByEdge.south);
  const west = streets.get(block.streetIdsByEdge.west);
  if (!north || !east || !south || !west) return null;
  return {
    north,
    east,
    south,
    west,
    northZ: horizontalCoordinate(north),
    eastX: verticalCoordinate(east),
    southZ: horizontalCoordinate(south),
    westX: verticalCoordinate(west),
  };
}

function quadraticPoint(
  start: CityPoint,
  corner: CityPoint,
  end: CityPoint,
  progress: number,
): CityPoint {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * start.x +
      2 * inverse * progress * corner.x +
      progress * progress * end.x,
    z:
      inverse * inverse * start.z +
      2 * inverse * progress * corner.z +
      progress * progress * end.z,
  };
}

function normalizeVector(from: CityPoint, to: CityPoint): CityPoint {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.max(0.0001, Math.hypot(x, z));
  return { x: x / length, z: z / length };
}

function smoothClosedCorners(
  corners: readonly AmbientRoutePoint[],
  radius: number,
): AmbientRoutePoint[] {
  const output: AmbientRoutePoint[] = [];
  for (let index = 0; index < corners.length; index += 1) {
    const previous = corners[(index - 1 + corners.length) % corners.length]!;
    const corner = corners[index]!;
    const next = corners[(index + 1) % corners.length]!;
    const incoming = normalizeVector(corner, previous);
    const outgoing = normalizeVector(corner, next);
    const turnRadius = Math.min(
      radius,
      Math.hypot(previous.x - corner.x, previous.z - corner.z) * 0.2,
      Math.hypot(next.x - corner.x, next.z - corner.z) * 0.2,
    );
    const start = {
      x: corner.x + incoming.x * turnRadius,
      z: corner.z + incoming.z * turnRadius,
    };
    const end = {
      x: corner.x + outgoing.x * turnRadius,
      z: corner.z + outgoing.z * turnRadius,
    };
    const template = { ...corner, surface: "intersection" as const, behavior: "yield" as const };
    output.push({ ...template, ...start, x: round(start.x), z: round(start.z) });
    for (const progress of [0.34, 0.67]) {
      const sampled = quadraticPoint(start, corner, end, progress);
      output.push({ ...template, x: round(sampled.x), z: round(sampled.z) });
    }
    output.push({ ...template, ...end, x: round(end.x), z: round(end.z) });
  }
  return output;
}

function roadCandidateForBlock(
  block: UrbanBlock,
  streets: ReadonlyMap<string, UrbanStreet>,
  direction: 1 | -1,
): RouteCandidate | null {
  const frame = blockStreetFrame(block, streets);
  if (!frame) return null;
  const minimumWidth = Math.min(
    frame.north.width,
    frame.east.width,
    frame.south.width,
    frame.west.width,
  );
  const lane = clamp(minimumWidth * 0.24, 0.72, 1.18);
  const streetIds = [
    frame.north.id,
    frame.east.id,
    frame.south.id,
    frame.west.id,
  ];
  const clockwise = [
    point(frame.westX + lane, frame.northZ + lane, "road-lane", frame.north.id),
    point(frame.eastX - lane, frame.northZ + lane, "road-lane", frame.east.id),
    point(frame.eastX - lane, frame.southZ - lane, "road-lane", frame.south.id),
    point(frame.westX + lane, frame.southZ - lane, "road-lane", frame.west.id),
  ];
  const counterClockwise = [
    point(frame.westX - lane, frame.northZ - lane, "road-lane", frame.west.id),
    point(frame.westX - lane, frame.southZ + lane, "road-lane", frame.south.id),
    point(frame.eastX + lane, frame.southZ + lane, "road-lane", frame.east.id),
    point(frame.eastX + lane, frame.northZ - lane, "road-lane", frame.north.id),
  ];
  return {
    id: `road:block:${block.id}:${direction > 0 ? "clockwise" : "counter"}`,
    points: smoothClosedCorners(direction > 0 ? clockwise : counterClockwise, 1.12),
    closed: true,
    direction,
    sourceStreetIds: streetIds.sort(compareText),
    laneOffset: direction * lane,
    laneHalfWidth: minimumWidth / Math.max(2, Math.max(...streetIds.map((id) => streets.get(id)?.lanes ?? 2))) * 0.5,
  };
}

function bridgeLoopCandidate(
  plan: UrbanFabricPlan,
  streets: ReadonlyMap<string, UrbanStreet>,
  direction: 1 | -1,
): RouteCandidate | null {
  const bridges = plan.streets
    .filter((street) => street.surface === "bridge" && street.centerline.length >= 2)
    .sort((left, right) => horizontalCoordinate(left) - horizontalCoordinate(right));
  if (bridges.length < 2) return null;
  const lower = bridges[0]!;
  const upper = bridges.at(-1)!;
  const lowerZ = horizontalCoordinate(lower);
  const upperZ = horizontalCoordinate(upper);
  const lowerXs = lower.centerline.map((p) => p.x);
  const westX = Math.min(...lowerXs);
  const eastX = Math.max(...lowerXs);
  const westStreet = plan.streets
    .filter((street) => street.surface === "ground")
    .sort(
      (left, right) =>
        Math.abs(verticalCoordinate(left) - westX) -
        Math.abs(verticalCoordinate(right) - westX),
    )[0];
  const eastStreet = plan.streets
    .filter((street) => street.surface === "ground")
    .sort(
      (left, right) =>
        Math.abs(verticalCoordinate(left) - eastX) -
        Math.abs(verticalCoordinate(right) - eastX),
    )[0];
  if (!westStreet || !eastStreet) return null;
  const lane = clamp(Math.min(lower.width, upper.width) * 0.23, 0.72, 1.05);
  const clockwise = [
    point(westX + lane, lowerZ + lane, "bridge-lane", lower.id),
    point(eastX - lane, lowerZ + lane, "bridge-lane", lower.id),
    point(eastX - lane, upperZ - lane, "road-lane", eastStreet.id),
    point(westX + lane, upperZ - lane, "bridge-lane", upper.id),
  ];
  const counter = [
    point(westX - lane, lowerZ - lane, "bridge-lane", lower.id),
    point(westX - lane, upperZ + lane, "road-lane", westStreet.id),
    point(eastX + lane, upperZ + lane, "bridge-lane", upper.id),
    point(eastX + lane, lowerZ - lane, "road-lane", eastStreet.id),
  ];
  return {
    id: `road:bridge-loop:${direction > 0 ? "clockwise" : "counter"}`,
    points: smoothClosedCorners(direction > 0 ? clockwise : counter, 1.1).map((p) => ({
      ...p,
      surface:
        p.streetId === lower.id || p.streetId === upper.id
          ? "bridge-lane"
          : p.surface,
    })),
    closed: true,
    direction,
    sourceStreetIds: [lower.id, upper.id, westStreet.id, eastStreet.id].sort(compareText),
    laneOffset: direction * lane,
    laneHalfWidth: Math.min(lower.width, upper.width) / 4,
  };
}

function makeRoadRoutes(
  plan: UrbanFabricPlan,
  visualCity: VisualCityPlan | null,
  seed: string,
): AmbientMobilityRoute[] {
  const streets = streetMap(plan);
  const heroAdjacent = plan.blocks.filter((block) =>
    Object.values(block.streetIdsByEdge).some(
      (id) => streets.get(id)?.hierarchy !== "local",
    ),
  );
  const pool = heroAdjacent.length > 0 ? heroAdjacent : plan.blocks;
  const byId = new Map(pool.map((block) => [block.id, block]));
  const heroBlocks = (visualCity?.hero.blockIds ?? [])
    .map((id) => byId.get(id))
    .filter((block): block is UrbanBlock => Boolean(block));
  const heroIds = new Set(heroBlocks.map((block) => block.id));
  const ordered = [
    ...heroBlocks,
    ...seededOrder(pool.filter((block) => !heroIds.has(block.id)), seed),
  ];
  const candidates: RouteCandidate[] = [];
  for (const direction of [1, -1] as const) {
    const bridge = bridgeLoopCandidate(plan, streets, direction);
    if (bridge) candidates.push(bridge);
  }
  for (const block of ordered.slice(0, 5)) {
    const direction = stableCityHash(`${seed}:${block.id}:direction`) % 2 === 0 ? 1 : -1;
    const candidate = roadCandidateForBlock(block, streets, direction);
    if (candidate) candidates.push(candidate);
  }
  return candidates.map((candidate) => ({
    ...candidate,
    kind: "road",
    minimumSpacing: 0.16,
    stopProgresses: [0.02, 0.27, 0.52, 0.77],
    reviewSpawnProgress: null,
    classification: AMBIENT_CONTEXT_CLASSIFICATION,
    evidenceRelationIds: [],
    componentIds: [],
    entityIds: [],
    journeyIds: [],
  }));
}

function sidewalkLoopForBlock(
  block: UrbanBlock,
  streets: ReadonlyMap<string, UrbanStreet>,
): RouteCandidate | null {
  const frame = blockStreetFrame(block, streets);
  if (!frame) return null;
  const northZ = frame.northZ + frame.north.width / 2 + 0.34;
  const southZ = frame.southZ - frame.south.width / 2 - 0.34;
  const westX = frame.westX + frame.west.width / 2 + 0.34;
  const eastX = frame.eastX - frame.east.width / 2 - 0.34;
  return {
    id: `pedestrian:block:${block.id}`,
    points: [
      point(westX, northZ, "sidewalk", frame.north.id),
      point(eastX, northZ, "sidewalk", frame.east.id),
      point(eastX, southZ, "sidewalk", frame.south.id),
      point(westX, southZ, "sidewalk", frame.west.id),
    ],
    closed: true,
    direction: 1,
    sourceStreetIds: [frame.north.id, frame.east.id, frame.south.id, frame.west.id].sort(compareText),
    laneOffset: 0,
    laneHalfWidth: 0.55,
  };
}

function nearestPointIndex(points: readonly CityPoint[], target: CityPoint): number {
  let result = 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const candidate = points[index]!;
    const distance = Math.hypot(candidate.x - target.x, candidate.z - target.z);
    if (distance < nearest) {
      nearest = distance;
      result = index;
    }
  }
  return result;
}

export function resolvePublicEntrancePoint(
  building: UrbanBuildingEnvelope,
): CityPoint {
  const dx = building.entrance.x - building.x;
  const dz = building.entrance.z - building.z;
  if (Math.abs(dx) > Math.abs(dz)) {
    return {
      x: round(building.x + Math.sign(dx || 1) * (building.width / 2 + 0.28)),
      z: round(clamp(building.entrance.z, building.z - building.depth / 2, building.z + building.depth / 2)),
    };
  }
  return {
    x: round(clamp(building.entrance.x, building.x - building.width / 2, building.x + building.width / 2)),
    z: round(building.z + Math.sign(dz || 1) * (building.depth / 2 + 0.28)),
  };
}

function entranceRoute(
  building: UrbanBuildingEnvelope,
  blockLoop: RouteCandidate,
): RouteCandidate {
  const entrance = resolvePublicEntrancePoint(building);
  const nearestIndex = nearestPointIndex(blockLoop.points, entrance);
  const start = blockLoop.points[nearestIndex]!;
  const offset = normalizeVector(start, entrance);
  const plaza = {
    x: entrance.x - offset.x * 0.48,
    z: entrance.z - offset.z * 0.48,
  };
  return {
    id: `pedestrian:entrance:${building.id}`,
    points: [
      { ...start, behavior: "travel" },
      point(plaza.x, plaza.z, "plaza", building.primaryStreetId),
      point(
        entrance.x,
        entrance.z,
        "entrance",
        building.primaryStreetId,
        "dwell",
        building.id,
      ),
    ],
    closed: false,
    direction: 1,
    sourceStreetIds: [building.primaryStreetId],
    laneOffset: 0,
    laneHalfWidth: 0.55,
  };
}

function crosswalkCandidates(
  plan: UrbanFabricPlan,
  seed: string,
): RouteCandidate[] {
  const horizontal = plan.streets.filter((street) => {
    const [start, end] = street.centerline;
    return start && end && Math.abs(end.x - start.x) >= Math.abs(end.z - start.z);
  });
  const vertical = plan.streets.filter((street) => {
    const [start, end] = street.centerline;
    return start && end && Math.abs(end.z - start.z) > Math.abs(end.x - start.x);
  });
  const candidates: RouteCandidate[] = [];
  for (const h of horizontal) {
    const z = horizontalCoordinate(h);
    const [hStart, hEnd] = h.centerline;
    if (!hStart || !hEnd) continue;
    for (const v of vertical) {
      const x = verticalCoordinate(v);
      const [vStart, vEnd] = v.centerline;
      if (!vStart || !vEnd) continue;
      const insideH = x >= Math.min(hStart.x, hEnd.x) - 0.01 && x <= Math.max(hStart.x, hEnd.x) + 0.01;
      const insideV = z >= Math.min(vStart.z, vEnd.z) - 0.01 && z <= Math.max(vStart.z, vEnd.z) + 0.01;
      if (!insideH || !insideV || h.surface === "bridge") continue;
      const half = v.width / 2 + 0.38;
      candidates.push({
        id: `pedestrian:crosswalk:${h.id}:${v.id}`,
        points: [
          point(x - half, z, "sidewalk", h.id),
          point(x - v.width * 0.18, z, "crosswalk", v.id, "yield"),
          point(x + v.width * 0.18, z, "crosswalk", v.id),
          point(x + half, z, "sidewalk", h.id),
        ],
        closed: false,
        direction: 1,
        sourceStreetIds: [h.id, v.id].sort(compareText),
        laneOffset: 0,
        laneHalfWidth: 0.5,
      });
    }
  }
  return seededOrder(candidates, `${seed}:crosswalk`).slice(0, 3);
}

function bridgeWalkCandidates(plan: UrbanFabricPlan): RouteCandidate[] {
  return plan.streets
    .filter((street) => street.surface === "bridge" && street.centerline.length >= 2)
    .sort((left, right) => compareText(left.id, right.id))
    .slice(0, 2)
    .map((street, index) => {
      const [start, end] = street.centerline;
      const offset = street.width / 2 + 0.42;
      const direction = normalizeVector(start!, end!);
      const side = index % 2 === 0 ? 1 : -1;
      const sideX = -direction.z * offset * side;
      const sideZ = direction.x * offset * side;
      return {
        id: `pedestrian:bridge-walk:${street.id}`,
        points: [
          point(start!.x + sideX, start!.z + sideZ, "sidewalk", street.id),
          point(
            (start!.x + end!.x) / 2 + sideX,
            (start!.z + end!.z) / 2 + sideZ,
            "bridge-walk",
            street.id,
          ),
          point(end!.x + sideX, end!.z + sideZ, "sidewalk", street.id),
        ],
        closed: false,
        direction: 1 as const,
        sourceStreetIds: [street.id],
        laneOffset: side * offset,
        laneHalfWidth: 0.52,
      };
    });
}

function riverwalkCandidates(
  plan: UrbanFabricPlan,
  visualCity: VisualCityPlan | null | undefined,
): RouteCandidate[] {
  if (!visualCity) return [];
  const river = visualCity.river;
  const inset = 0.72;
  const minimumZ = Math.max(plan.bounds.minZ + 2, river.minZ + 2);
  const maximumZ = Math.min(plan.bounds.maxZ - 2, river.maxZ - 2);
  if (maximumZ <= minimumZ) return [];
  return [
    { id: "west", x: river.minX - inset, direction: 1 as const },
    { id: "east", x: river.maxX + inset, direction: -1 as const },
  ].map((bank) => ({
    id: `pedestrian:riverwalk:${bank.id}`,
    points: [
      point(bank.x, minimumZ, "riverwalk"),
      point(bank.x, (minimumZ + maximumZ) / 2, "riverwalk", null, "dwell"),
      point(bank.x, maximumZ, "riverwalk"),
    ],
    closed: false,
    direction: bank.direction,
    sourceStreetIds: [],
    laneOffset: 0,
    laneHalfWidth: 0.6,
  }));
}

function makePedestrianRoutes(
  plan: UrbanFabricPlan,
  visualCity: VisualCityPlan | null | undefined,
  publicFrontages: readonly AmbientPublicFrontage[],
  seed: string,
): AmbientMobilityRoute[] {
  const streets = streetMap(plan);
  const heroBlockIds = new Set(visualCity?.hero.blockIds ?? []);
  const heroBlocks = plan.blocks.filter((block) => heroBlockIds.has(block.id));
  const remaining = plan.blocks.filter((block) => !heroBlockIds.has(block.id));
  const orderedBlocks = [
    ...heroBlocks.sort((left, right) => compareText(left.id, right.id)),
    ...seededOrder(remaining, `${seed}:walk-block`),
  ];
  const loops = orderedBlocks
    .slice(0, 6)
    .map((block) => sidewalkLoopForBlock(block, streets))
    .filter((candidate): candidate is RouteCandidate => Boolean(candidate));
  const loopByBlock = new Map<string, RouteCandidate>();
  for (const loop of loops) {
    const blockId = loop.id.replace("pedestrian:block:", "");
    loopByBlock.set(blockId, loop);
  }
  const eligibleEntrances = plan.buildings.filter((building) =>
    loopByBlock.has(building.blockId),
  );
  const frontageEnvelopeIds = new Set(
    publicFrontages.map((frontage) => frontage.envelopeId),
  );
  const entranceOrder = seededOrder(
    eligibleEntrances.filter(
      (building) => !frontageEnvelopeIds.has(building.id),
    ),
    `${seed}:entrance`,
  );
  const entranceRoutes = entranceOrder
    .slice(0, 4)
    .flatMap((building) => {
      const loop = loopByBlock.get(building.blockId);
      return loop ? [entranceRoute(building, loop)] : [];
    });
  const frontageRoutes: RouteCandidate[] = [...publicFrontages]
    .filter((frontage) => frontage.points.length >= 2)
    .sort(
      (left, right) =>
        Number(right.priority) - Number(left.priority) ||
        compareText(left.id, right.id),
    )
    .map((frontage) => ({
      id: `pedestrian:frontage:${frontage.id}`,
      points: frontage.points.map((frontagePoint, index, points) =>
        point(
          frontagePoint.x,
          frontagePoint.z,
          index > 0 && index < points.length - 1 ? "entrance" : "sidewalk",
          frontage.streetId,
          index > 0 && index < points.length - 1 ? "dwell" : "travel",
          index > 0 && index < points.length - 1
            ? frontage.envelopeId
            : null,
        ),
      ),
      closed: false,
      direction: 1,
      sourceStreetIds: [frontage.streetId],
      laneOffset: 0,
      laneHalfWidth: 0.55,
    }));
  const candidates = [
    ...frontageRoutes,
    ...entranceRoutes,
    ...loops,
    ...crosswalkCandidates(plan, seed),
    ...bridgeWalkCandidates(plan),
    ...riverwalkCandidates(plan, visualCity),
  ];
  return candidates.map((candidate) => ({
    ...candidate,
    kind: "pedestrian",
    minimumSpacing: 0.11,
    stopProgresses: candidate.points
      .map((candidatePoint, index) =>
        candidatePoint.behavior !== "travel"
          ? round(index / Math.max(1, candidate.points.length - 1))
          : -1,
      )
      .filter((progress) => progress >= 0),
    reviewSpawnProgress: null,
    classification: AMBIENT_CONTEXT_CLASSIFICATION,
    evidenceRelationIds: [],
    componentIds: [],
    entityIds: [],
    journeyIds: [],
  }));
}

function makeWaterRoutes(
  plan: UrbanFabricPlan,
  visualCity: VisualCityPlan | null | undefined,
): AmbientMobilityRoute[] {
  if (!visualCity) return [];
  const river = visualCity.river;
  const width = river.maxX - river.minX;
  const minimumZ = Math.max(river.minZ + 3, plan.bounds.minZ - 14);
  const maximumZ = Math.min(river.maxZ - 3, plan.bounds.maxZ + 14);
  if (width < 1.5 || maximumZ <= minimumZ) return [];
  const centerX = (river.minX + river.maxX) / 2;
  const offset = clamp(width * 0.19, 0.75, 1.55);
  const bridgeZ = plan.streets
    .filter((street) => street.surface === "bridge")
    .map((street) => {
      const [start, end] = street.centerline;
      return start && end ? (start.z + end.z) / 2 : Number.NaN;
    })
    .filter(Number.isFinite)
    .sort((left, right) => Math.abs(left) - Math.abs(right))[0];
  const reviewSpawnProgress = Number.isFinite(bridgeZ)
    ? round(
        clamp(
          (bridgeZ! + 5.5 - minimumZ) / (maximumZ - minimumZ),
          0.08,
          0.92,
        ),
      )
    : 0.5;
  return [-1, 1].map((directionValue) => {
    const direction = directionValue as 1 | -1;
    const x = centerX + direction * offset;
    const route: AmbientMobilityRoute = {
      id: `water:channel:${direction > 0 ? "upstream" : "downstream"}`,
      kind: "water",
      points: [
        point(x, minimumZ, "river-channel"),
        point(x, minimumZ * 0.5, "river-channel"),
        point(x, 0, "river-channel"),
        point(x, maximumZ * 0.5, "river-channel"),
        point(x, maximumZ, "river-channel"),
      ],
      closed: false,
      direction,
      sourceStreetIds: [],
      laneOffset: direction * offset,
      laneHalfWidth: Math.max(0.4, width / 2 - Math.abs(offset) - 0.45),
      minimumSpacing: 0.24,
      stopProgresses: [],
      reviewSpawnProgress,
      classification: AMBIENT_CONTEXT_CLASSIFICATION,
      evidenceRelationIds: [],
      componentIds: [],
      entityIds: [],
      journeyIds: [],
    };
    return route;
  });
}

function roadMode(index: number, seed: number): SemanticTransportMode {
  if ((index + seed) % 11 === 0) return "transit";
  if ((index + seed) % 7 === 0) return "freight";
  return "car";
}

function speedFor(mode: SemanticTransportMode, seed: number): number {
  const variation = ((seed >>> 8) % 13) / 10_000;
  switch (mode) {
    case "pedestrian":
      return 0.018 + variation * 0.45;
    case "boat":
      return 0.013 + variation * 0.32;
    case "transit":
      return 0.021 + variation * 0.32;
    case "freight":
      return 0.019 + variation * 0.3;
    case "car":
      return 0.027 + variation;
  }
}

function agentsForRoutes(
  routes: readonly AmbientMobilityRoute[],
  count: number,
  category: "road" | "pedestrian" | "water",
  seed: string,
  priorityRouteId?: string | null,
  priorityCount = 0,
): AmbientAgentPlan[] {
  if (routes.length === 0 || count <= 0) return [];
  const allocations = new Array(routes.length).fill(0) as number[];
  const priorityIndex = priorityRouteId
    ? routes.findIndex((route) => route.id === priorityRouteId)
    : -1;
  const reserved = priorityIndex >= 0 ? Math.min(count, priorityCount) : 0;
  if (priorityIndex >= 0) allocations[priorityIndex] = reserved;
  const distributionRoutes = routes
    .map((_, index) => index)
    .filter((index) => index !== priorityIndex);
  for (let index = 0; index < count - reserved; index += 1) {
    const allocationIndex = distributionRoutes.length > 0
      ? distributionRoutes[index % distributionRoutes.length]!
      : priorityIndex;
    allocations[allocationIndex] += 1;
  }
  const agents: AmbientAgentPlan[] = [];
  let globalIndex = 0;
  routes.forEach((route, routeIndex) => {
    const routeCount = allocations[routeIndex]!;
    const routeSeed = stableCityHash(`${seed}:${route.id}:phase`);
    const phaseOffset = ((routeSeed >>> 7) % 1000) / 1000;
    for (let index = 0; index < routeCount; index += 1) {
      const agentSeed = stableCityHash(`${seed}:${route.id}:${index}`);
      const mode =
        category === "pedestrian"
          ? "pedestrian"
          : category === "water"
            ? "boat"
            : roadMode(globalIndex, agentSeed % 13);
      agents.push({
        id: `ambient:${mode}:${route.id}:${index}`,
        routeId: route.id,
        mode,
        phase:
          category === "water" && index === 0
            ? round(
                (route.reviewSpawnProgress ?? 0.5) +
                  (routeIndex === 0 ? -0.025 : 0.035),
              )
            : round((phaseOffset + index / Math.max(1, routeCount)) % 1),
        speed: round(speedFor(mode, agentSeed)),
        delay: round(((agentSeed >>> 12) % 850) / 1_000),
        dwellSeconds:
          route.stopProgresses.length > 0
            ? round(0.45 + ((agentSeed >>> 17) % 75) / 100)
            : 0,
        colorVariant: agentSeed % 7,
        scale: round(0.9 + ((agentSeed >>> 20) % 17) / 100),
        classification: AMBIENT_CONTEXT_CLASSIFICATION,
      });
      globalIndex += 1;
    }
  });
  return agents;
}

function countSurface(
  routes: readonly AmbientMobilityRoute[],
  surface: AmbientRouteSurface,
): number {
  return routes.filter((route) =>
    route.points.some((candidate) => candidate.surface === surface),
  ).length;
}

function diagnosticsFor(
  roadRoutes: readonly AmbientMobilityRoute[],
  pedestrianRoutes: readonly AmbientMobilityRoute[],
  waterRoutes: readonly AmbientMobilityRoute[],
  agents: readonly AmbientAgentPlan[],
): AmbientMobilityDiagnostics {
  const deterministicPayload = {
    roadRoutes,
    pedestrianRoutes,
    waterRoutes,
    agents,
  };
  return {
    roadRouteCount: roadRoutes.length,
    pedestrianRouteCount: pedestrianRoutes.length,
    waterRouteCount: waterRoutes.length,
    vehicleCount: agents.filter((agent) =>
      agent.mode === "car" || agent.mode === "freight" || agent.mode === "transit",
    ).length,
    pedestrianCount: agents.filter((agent) => agent.mode === "pedestrian").length,
    boatCount: agents.filter((agent) => agent.mode === "boat").length,
    bridgeRoadRouteCount: countSurface(roadRoutes, "bridge-lane"),
    crosswalkRouteCount: countSurface(pedestrianRoutes, "crosswalk"),
    entranceRouteCount: countSurface(pedestrianRoutes, "entrance"),
    riverwalkRouteCount: countSurface(pedestrianRoutes, "riverwalk"),
    serializedBytes: JSON.stringify(deterministicPayload).length,
  };
}

export function planAmbientMobility({
  urbanFabric,
  visualCity = null,
  publicFrontages = [],
  seed = `${urbanFabric.seed}:living-streets-v0.2`,
  budgets: budgetOverride,
}: PlanAmbientMobilityInput): AmbientMobilityPlan {
  const hasWater = Boolean(
    visualCity && visualCity.river.maxX - visualCity.river.minX >= 1.5,
  );
  const budgets = normalizedBudgets(urbanFabric, hasWater, budgetOverride);
  const roadRoutes = makeRoadRoutes(urbanFabric, visualCity, seed);
  const pedestrianRoutes = makePedestrianRoutes(
    urbanFabric,
    visualCity,
    publicFrontages,
    seed,
  );
  const waterRoutes = makeWaterRoutes(urbanFabric, visualCity);
  const priorityFrontage = publicFrontages.find((frontage) => frontage.priority);
  const focusEnvelope = priorityFrontage
    ? urbanFabric.architecturalEnvelopes.find(
        (building) => building.id === priorityFrontage.envelopeId,
      )
    : null;
  const priorityRoadRouteId = focusEnvelope
    ? `road:block:${focusEnvelope.blockId}`
    : null;
  const priorityPedestrianRouteId = priorityFrontage
    ? `pedestrian:frontage:${priorityFrontage.id}`
    : null;
  const agents = [
    ...agentsForRoutes(
      roadRoutes,
      budgets.roadVehicles,
      "road",
      seed,
      priorityRoadRouteId,
      8,
    ),
    ...agentsForRoutes(
      pedestrianRoutes,
      budgets.pedestrians,
      "pedestrian",
      seed,
      priorityPedestrianRouteId,
      8,
    ),
    ...agentsForRoutes(waterRoutes, budgets.boats, "water", seed),
  ].sort((left, right) => compareText(left.id, right.id));
  return {
    version: AMBIENT_MOBILITY_VERSION,
    seed,
    classification: AMBIENT_CONTEXT_CLASSIFICATION,
    budgets,
    roadRoutes,
    pedestrianRoutes,
    waterRoutes,
    agents,
    diagnostics: diagnosticsFor(roadRoutes, pedestrianRoutes, waterRoutes, agents),
  };
}

export function measureAmbientMobilityPlan(
  input: PlanAmbientMobilityInput,
): MeasuredAmbientMobilityPlan {
  const started = performance.now();
  const plan = planAmbientMobility(input);
  return {
    plan,
    planningMs: round(performance.now() - started),
  };
}

export function allAmbientRoutes(
  plan: AmbientMobilityPlan,
): readonly AmbientMobilityRoute[] {
  return [...plan.roadRoutes, ...plan.pedestrianRoutes, ...plan.waterRoutes];
}
