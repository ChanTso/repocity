/**
 * Deterministic, renderer-agnostic city planning for the V2 vertical slice.
 *
 * The planner intentionally uses only axis-aligned rectangles and orthogonal
 * paths. Coordinates describe the X/Z ground plane and rectangles use their
 * centre point.
 */

export interface CityPoint {
  x: number;
  z: number;
}

export interface CityRect extends CityPoint {
  width: number;
  depth: number;
}

export interface CityBounds extends CityRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LivingCityEntityInput {
  id: string;
  path: string;
  districtId: string;
  name?: string;
  role?: string;
  maxMetrics?: {
    loc?: number;
    exports?: number;
    fanIn?: number;
    fanOut?: number;
    churn?: number;
  };
}

export interface LivingCityDistrictInput {
  id: string;
  name?: string;
  color?: string;
  entityIds?: readonly string[];
}

export interface LivingCityRelationInput {
  id?: string;
  sourceId: string;
  targetId: string;
  weight?: number;
}

export interface LivingCityInput {
  entities: readonly LivingCityEntityInput[];
  districts: readonly LivingCityDistrictInput[];
  relations: readonly LivingCityRelationInput[];
  seed?: string;
}

export type DistrictBank = "inland" | "west" | "east";

export interface PlannedDistrict extends CityRect {
  id: string;
  name: string;
  color: string;
  bank: DistrictBank;
  entityIds: string[];
  blockIds: string[];
}

export interface RiverStrip extends CityRect {
  id: string;
  axis: "z";
}

export type RoadClass = "arterial" | "local";
export type RoadLevel = "ground" | "elevated";
export type RoadSurface = "ground" | "bridge";

export interface RoadSegment {
  id: string;
  roadClass: RoadClass;
  level: RoadLevel;
  surface: RoadSurface;
  axis: "x" | "z";
  start: CityPoint;
  end: CityPoint;
  width: number;
  districtIds: string[];
  bridgeId: string | null;
  outsideConnection: boolean;
}

export interface PlannedBridge extends CityRect {
  id: string;
  riverId: string;
  roadId: string;
  axis: "x";
}

export interface CityBlock extends CityRect {
  id: string;
  districtId: string;
  kind: "development" | "park";
}

export type FrontageSide = "north" | "south" | "east" | "west";

export interface CityParcel extends CityRect {
  id: string;
  districtId: string;
  blockId: string;
  address: number;
  frontageSide: FrontageSide;
  frontageRoadId: string;
}

export type BuildingArchetype =
  | "low-rise-studio"
  | "mid-rise-mixed"
  | "office-slab"
  | "city-tower"
  | "industrial-shed"
  | "library-hall"
  | "quality-laboratory"
  | "maintenance-depot"
  | "control-data-center"
  | "gateway-landmark";

export type FacilityKind =
  | "library"
  | "quality-lab"
  | "maintenance"
  | "control-center"
  | "data-center"
  | "gateway";

export interface PlannedBuilding extends CityRect {
  id: string;
  entityId: string;
  districtId: string;
  blockId: string;
  parcelId: string;
  path: string;
  archetype: BuildingArchetype;
  facility: FacilityKind | null;
  floors: number;
  height: number;
  frontage: {
    side: FrontageSide;
    roadId: string;
    point: CityPoint;
  };
}

export interface PlannedPark extends CityRect {
  id: string;
  districtId: string;
  blockId: string;
}

export interface CityProp extends CityPoint {
  id: string;
  districtId: string;
  kind: "tree" | "streetlight";
  rotationY: number;
  scale: number;
}

export type MobilityMode = "car" | "pedestrian" | "boat";

export interface MobilityRoute {
  id: string;
  mode: MobilityMode;
  points: CityPoint[];
  closed: boolean;
  districtIds: string[];
  weight: number;
}

export interface LivingCityPlan {
  version: "0.2";
  seed: string;
  bounds: CityBounds;
  geography: {
    river: RiverStrip | null;
  };
  districts: PlannedDistrict[];
  roads: RoadSegment[];
  bridges: PlannedBridge[];
  blocks: CityBlock[];
  parcels: CityParcel[];
  buildings: PlannedBuilding[];
  parks: PlannedPark[];
  props: CityProp[];
  mobility: {
    carRoutes: MobilityRoute[];
    pedestrianRoutes: MobilityRoute[];
    boatRoutes: MobilityRoute[];
  };
}

const ROAD_WIDTH = 2;
const BLOCK_SIZE = 12;
const BLOCK_PITCH = BLOCK_SIZE + ROAD_WIDTH;
const PARCEL_SIZE = 5.2;
const RIVER_WIDTH = 10;
const WORLD_MARGIN = 6;

interface DistrictWork extends PlannedDistrict {
  row: number;
  column: number;
}

interface RoadDraft extends Omit<RoadSegment, "districtIds"> {
  districtIds: Set<string>;
}

interface BuildingClassification {
  archetype: BuildingArchetype;
  facility: FacilityKind | null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : 0;
}

function round(value: number): number {
  const result = Math.round(value * 1_000) / 1_000;
  return Object.is(result, -0) ? 0 : result;
}

function point(x: number, z: number): CityPoint {
  return { x: round(x), z: round(z) };
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function derivedSeed(input: LivingCityInput): string {
  if (input.seed) return input.seed;

  const facts = [
    ...input.districts.map((district) => `d:${district.id}`).sort(compareText),
    ...input.entities
      .map((entity) => `e:${entity.id}:${entity.path}:${entity.districtId}`)
      .sort(compareText),
    ...input.relations
      .map(
        (relation) =>
          `r:${relation.sourceId}:${relation.targetId}:${relation.weight ?? 1}`,
      )
      .sort(compareText),
  ].join("|");

  return `repo-${stableHash(facts).toString(16).padStart(8, "0")}`;
}

function roadGeometryKey(
  axis: "x" | "z",
  start: CityPoint,
  end: CityPoint,
  level: RoadLevel,
  surface: RoadSurface,
): string {
  return [
    level,
    surface,
    axis,
    round(start.x),
    round(start.z),
    round(end.x),
    round(end.z),
  ].join(":");
}

function roadIdFor(
  axis: "x" | "z",
  start: CityPoint,
  end: CityPoint,
  level: RoadLevel = "ground",
  surface: RoadSurface = "ground",
): string {
  const key = roadGeometryKey(axis, start, end, level, surface);
  return `road-${stableHash(key).toString(36)}`;
}

function boundsFor(rectangles: readonly CityRect[]): CityBounds {
  if (rectangles.length === 0) {
    return {
      x: 0,
      z: 0,
      width: 24,
      depth: 24,
      minX: -12,
      maxX: 12,
      minZ: -12,
      maxZ: 12,
    };
  }

  const minX =
    Math.min(...rectangles.map((rect) => rect.x - rect.width / 2)) -
    WORLD_MARGIN;
  const maxX =
    Math.max(...rectangles.map((rect) => rect.x + rect.width / 2)) +
    WORLD_MARGIN;
  const minZ =
    Math.min(...rectangles.map((rect) => rect.z - rect.depth / 2)) -
    WORLD_MARGIN;
  const maxZ =
    Math.max(...rectangles.map((rect) => rect.z + rect.depth / 2)) +
    WORLD_MARGIN;

  return {
    x: round((minX + maxX) / 2),
    z: round((minZ + maxZ) / 2),
    width: round(maxX - minX),
    depth: round(maxZ - minZ),
    minX: round(minX),
    maxX: round(maxX),
    minZ: round(minZ),
    maxZ: round(maxZ),
  };
}

function makeDistrictInputs(
  input: LivingCityInput,
  entities: readonly LivingCityEntityInput[],
): LivingCityDistrictInput[] {
  const districts = new Map<string, LivingCityDistrictInput>();

  for (const district of [...input.districts].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    if (districts.has(district.id)) {
      throw new Error(`Duplicate district id: ${district.id}`);
    }
    districts.set(district.id, district);
  }

  for (const entity of entities) {
    if (!districts.has(entity.districtId)) {
      districts.set(entity.districtId, {
        id: entity.districtId,
        name: entity.districtId,
      });
    }
  }

  return [...districts.values()].sort((left, right) =>
    compareText(left.id, right.id),
  );
}

function makeDistrictLayout(
  districts: readonly LivingCityDistrictInput[],
  entitiesByDistrict: ReadonlyMap<string, readonly LivingCityEntityInput[]>,
  blockColumns: number,
  blockRows: number,
  hasRiver: boolean,
): DistrictWork[] {
  const zoneWidth = blockColumns * BLOCK_PITCH;
  const zoneDepth = blockRows * BLOCK_PITCH;

  if (!hasRiver) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(districts.length)));
    const rows = Math.max(1, Math.ceil(districts.length / columns));

    return districts.map((district, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        id: district.id,
        name: district.name ?? district.id,
        color: district.color ?? "#68b8a8",
        bank: "inland",
        entityIds: (entitiesByDistrict.get(district.id) ?? []).map(
          (entity) => entity.id,
        ),
        blockIds: [],
        x: round((column - (columns - 1) / 2) * zoneWidth),
        z: round((row - (rows - 1) / 2) * zoneDepth),
        width: zoneWidth,
        depth: zoneDepth,
        row,
        column,
      };
    });
  }

  const westCount = Math.ceil(districts.length / 2);
  const west = districts.slice(0, westCount);
  const east = districts.slice(westCount);
  const rows = Math.max(west.length, east.length);
  const bankRoadX = RIVER_WIDTH / 2 + ROAD_WIDTH / 2;

  return [...west, ...east].map((district) => {
    const westIndex = west.findIndex((item) => item.id === district.id);
    const isWest = westIndex >= 0;
    const row = isWest
      ? westIndex
      : east.findIndex((item) => item.id === district.id);
    const bank: DistrictBank = isWest ? "west" : "east";
    const x = isWest
      ? -bankRoadX - zoneWidth / 2
      : bankRoadX + zoneWidth / 2;

    return {
      id: district.id,
      name: district.name ?? district.id,
      color: district.color ?? "#68b8a8",
      bank,
      entityIds: (entitiesByDistrict.get(district.id) ?? []).map(
        (entity) => entity.id,
      ),
      blockIds: [],
      x: round(x),
      z: round((row - (rows - 1) / 2) * zoneDepth),
      width: zoneWidth,
      depth: zoneDepth,
      row,
      column: isWest ? 0 : 1,
    };
  });
}

function nearestRoadLine(
  start: number,
  target: number,
  segmentCount: number,
): number {
  let nearest = start;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= segmentCount; index += 1) {
    const candidate = start + index * BLOCK_PITCH;
    const candidateDistance = Math.abs(candidate - target);
    if (candidateDistance < distance) {
      nearest = candidate;
      distance = candidateDistance;
    }
  }
  return round(nearest);
}

function compactPath(points: readonly CityPoint[]): CityPoint[] {
  const output: CityPoint[] = [];
  for (const candidate of points) {
    const previous = output.at(-1);
    if (!previous || previous.x !== candidate.x || previous.z !== candidate.z) {
      output.push(candidate);
    }
  }
  return output;
}

function classifySemanticBuilding(
  entity: LivingCityEntityInput,
): BuildingClassification | null {
  const path = entity.path.toLowerCase();
  const role = entity.role?.toLowerCase() ?? "source";

  if (role === "docs" || /(^|\/)(docs?|specs?|knowledge)(\/|$)/.test(path)) {
    return { archetype: "library-hall", facility: "library" };
  }
  if (
    role === "test" ||
    /(^|\/)(__tests__|tests?|fixtures?|validation)(\/|$)/.test(path)
  ) {
    return { archetype: "quality-laboratory", facility: "quality-lab" };
  }
  if (
    role === "script" ||
    /(^|\/)(scripts?|build|ci|workflows?)(\/|$)/.test(path)
  ) {
    return { archetype: "maintenance-depot", facility: "maintenance" };
  }
  if (
    role === "config" ||
    /(^|\/)(config|tooling)(\/|$)|(^|\/)[^/]+\.config\.[^/]+$/.test(path)
  ) {
    return { archetype: "control-data-center", facility: "control-center" };
  }
  if (/(^|\/)(network|server|adapters?|infra)(\/|$)/.test(path)) {
    return { archetype: "control-data-center", facility: "data-center" };
  }
  if (/(^|\/)(storage|database|cache|artifacts?)(\/|$)/.test(path)) {
    return { archetype: "industrial-shed", facility: null };
  }

  return null;
}

function isExplicitGateway(entity: LivingCityEntityInput): boolean {
  return /(^|\/)(index|main|entry|public-api)\.[^/]+$/i.test(entity.path);
}

function compareGatewayCandidates(
  left: LivingCityEntityInput,
  right: LivingCityEntityInput,
): number {
  const fanInDifference =
    finiteNonNegative(right.maxMetrics?.fanIn) -
    finiteNonNegative(left.maxMetrics?.fanIn);
  if (fanInDifference !== 0) return fanInDifference;

  const exportsDifference =
    finiteNonNegative(right.maxMetrics?.exports) -
    finiteNonNegative(left.maxMetrics?.exports);
  if (exportsDifference !== 0) return exportsDifference;

  const locDifference =
    finiteNonNegative(right.maxMetrics?.loc) -
    finiteNonNegative(left.maxMetrics?.loc);
  return locDifference || compareText(left.id, right.id);
}

function selectGatewayEntityIds(
  entitiesByDistrict: ReadonlyMap<
    string,
    readonly LivingCityEntityInput[]
  >,
): Set<string> {
  const selected = new Set<string>();
  const districtIds = [...entitiesByDistrict.keys()].sort(compareText);

  for (const districtId of districtIds) {
    const candidates = (entitiesByDistrict.get(districtId) ?? [])
      .filter((entity) => classifySemanticBuilding(entity) === null)
      .sort(compareGatewayCandidates);
    if (candidates.length === 0) continue;

    const explicit = candidates
      .filter(isExplicitGateway)
      .sort(compareGatewayCandidates);
    if (explicit[0]) selected.add(explicit[0].id);

    const relativeHub = candidates.find(
      (entity) =>
        !selected.has(entity.id) &&
        finiteNonNegative(entity.maxMetrics?.fanIn) > 0,
    );
    if (relativeHub) {
      selected.add(relativeHub.id);
    } else if (explicit[1]) {
      selected.add(explicit[1].id);
    } else if (explicit.length === 0) {
      selected.add(candidates[0]!.id);
    }
  }

  return selected;
}

function classifyBuilding(
  entity: LivingCityEntityInput,
  isGateway: boolean,
): BuildingClassification {
  const semanticClassification = classifySemanticBuilding(entity);
  if (semanticClassification) return semanticClassification;

  const loc = finiteNonNegative(entity.maxMetrics?.loc);
  const fanIn = finiteNonNegative(entity.maxMetrics?.fanIn);
  if (isGateway) {
    return { archetype: "gateway-landmark", facility: "gateway" };
  }
  if (loc >= 420 || fanIn >= 5) {
    return { archetype: "city-tower", facility: null };
  }
  if (loc >= 150) {
    return { archetype: "office-slab", facility: null };
  }
  if (loc >= 65) {
    return { archetype: "mid-rise-mixed", facility: null };
  }
  return { archetype: "low-rise-studio", facility: null };
}

function floorCount(
  entity: LivingCityEntityInput,
  archetype: BuildingArchetype,
): number {
  const loc = finiteNonNegative(entity.maxMetrics?.loc);
  const fanIn = finiteNonNegative(entity.maxMetrics?.fanIn);
  let floors =
    loc <= 30
      ? 1
      : loc <= 80
        ? 2
        : loc <= 160
          ? 3
          : loc <= 320
            ? 5
            : loc <= 640
              ? 8
              : 12;

  floors += Math.min(3, Math.floor(Math.log2(fanIn + 1)));

  if (archetype === "industrial-shed" || archetype === "maintenance-depot") {
    return Math.min(2, floors);
  }
  if (
    archetype === "library-hall" ||
    archetype === "quality-laboratory" ||
    archetype === "control-data-center"
  ) {
    return Math.min(4, Math.max(2, floors));
  }
  if (archetype === "gateway-landmark") {
    return Math.max(4, floors);
  }
  return floors;
}

function routeWeight(
  districtId: string,
  relations: readonly LivingCityRelationInput[],
  entityDistrict: ReadonlyMap<string, string>,
): number {
  const total = relations.reduce((sum, relation) => {
    const sourceDistrict = entityDistrict.get(relation.sourceId);
    const targetDistrict = entityDistrict.get(relation.targetId);
    if (sourceDistrict !== districtId && targetDistrict !== districtId) {
      return sum;
    }
    return sum + Math.max(1, finiteNonNegative(relation.weight));
  }, 0);

  return Math.max(1, round(1 + Math.log2(total + 1)));
}

/**
 * Build a stable V2 city plan. The function never mutates its input and the
 * ordering of input arrays has no effect on the returned plan.
 */
export function planLivingCity(input: LivingCityInput): LivingCityPlan {
  const entities = [...input.entities].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const duplicateEntity = entities.find(
    (entity, index) => index > 0 && entities[index - 1]?.id === entity.id,
  );
  if (duplicateEntity) {
    throw new Error(`Duplicate entity id: ${duplicateEntity.id}`);
  }

  const relations = [...input.relations].sort((left, right) => {
    const leftKey = `${left.sourceId}:${left.targetId}:${left.id ?? ""}`;
    const rightKey = `${right.sourceId}:${right.targetId}:${right.id ?? ""}`;
    return compareText(leftKey, rightKey);
  });
  const districtInputs = makeDistrictInputs(input, entities);
  const entitiesByDistrict = new Map<string, LivingCityEntityInput[]>();
  for (const district of districtInputs) {
    entitiesByDistrict.set(district.id, []);
  }
  for (const entity of entities) {
    entitiesByDistrict.get(entity.districtId)!.push(entity);
  }
  const gatewayEntityIds = selectGatewayEntityIds(entitiesByDistrict);

  const largestDistrict = Math.max(
    0,
    ...[...entitiesByDistrict.values()].map((group) => group.length),
  );
  const maximumBlocks = Math.max(2, Math.ceil(largestDistrict / 4) + 1);
  const blockColumns = Math.max(2, Math.ceil(Math.sqrt(maximumBlocks)));
  const blockRows = Math.max(1, Math.ceil(maximumBlocks / blockColumns));
  const hasRiver = districtInputs.length >= 4 && entities.length >= 80;
  const hasElevatedRoad = entities.length >= 180;
  const seed = derivedSeed(input);

  const districtWork = makeDistrictLayout(
    districtInputs,
    entitiesByDistrict,
    blockColumns,
    blockRows,
    hasRiver,
  );
  const bounds = boundsFor(districtWork);
  const river: RiverStrip | null = hasRiver
    ? {
        id: "river-main",
        axis: "z",
        x: 0,
        z: bounds.z,
        width: RIVER_WIDTH,
        depth: bounds.depth,
      }
    : null;

  const roadDrafts = new Map<string, RoadDraft>();
  const addRoad = (
    axis: "x" | "z",
    start: CityPoint,
    end: CityPoint,
    roadClass: RoadClass,
    level: RoadLevel,
    surface: RoadSurface,
    width: number,
    districtIds: readonly string[],
    options: {
      bridgeId?: string;
      outsideConnection?: boolean;
    } = {},
  ): string => {
    const normalizedStart =
      axis === "x" && start.x > end.x
        ? end
        : axis === "z" && start.z > end.z
          ? end
          : start;
    const normalizedEnd = normalizedStart === start ? end : start;
    const key = roadGeometryKey(
      axis,
      normalizedStart,
      normalizedEnd,
      level,
      surface,
    );
    const id = roadIdFor(axis, normalizedStart, normalizedEnd, level, surface);
    const existing = roadDrafts.get(key);
    if (existing) {
      for (const districtId of districtIds) {
        existing.districtIds.add(districtId);
      }
      if (roadClass === "arterial") existing.roadClass = "arterial";
      existing.width = Math.max(existing.width, width);
      return existing.id;
    }

    roadDrafts.set(key, {
      id,
      roadClass,
      level,
      surface,
      axis,
      start: normalizedStart,
      end: normalizedEnd,
      width,
      districtIds: new Set(districtIds),
      bridgeId: options.bridgeId ?? null,
      outsideConnection: options.outsideConnection ?? false,
    });
    return id;
  };

  for (const district of districtWork) {
    const minX = district.x - district.width / 2;
    const maxX = district.x + district.width / 2;
    const minZ = district.z - district.depth / 2;
    const maxZ = district.z + district.depth / 2;

    for (let column = 0; column <= blockColumns; column += 1) {
      const x = minX + column * BLOCK_PITCH;
      addRoad(
        "z",
        point(x, minZ),
        point(x, maxZ),
        column === 0 || column === blockColumns ? "arterial" : "local",
        "ground",
        "ground",
        ROAD_WIDTH,
        [district.id],
      );
    }
    for (let row = 0; row <= blockRows; row += 1) {
      const z = minZ + row * BLOCK_PITCH;
      addRoad(
        "x",
        point(minX, z),
        point(maxX, z),
        row === 0 || row === blockRows ? "arterial" : "local",
        "ground",
        "ground",
        ROAD_WIDTH,
        [district.id],
      );
    }
  }

  const bridges: PlannedBridge[] = [];
  let bridgeZ: number | null = null;
  if (river) {
    const west = districtWork.filter((district) => district.bank === "west");
    const east = districtWork.filter((district) => district.bank === "east");
    const sharedRoadLines = new Set<number>();
    for (const district of west) {
      const minZ = district.z - district.depth / 2;
      for (let row = 0; row <= blockRows; row += 1) {
        const z = round(minZ + row * BLOCK_PITCH);
        if (
          east.some((candidate) => {
            const eastMinZ = candidate.z - candidate.depth / 2;
            return Array.from({ length: blockRows + 1 }).some(
              (_, index) =>
                round(eastMinZ + index * BLOCK_PITCH) === z,
            );
          })
        ) {
          sharedRoadLines.add(z);
        }
      }
    }

    const bridgeLines = [...sharedRoadLines]
      .sort((left, right) => Math.abs(left) - Math.abs(right) || left - right)
      .slice(0, Math.min(2, sharedRoadLines.size));
    const westBankX = -RIVER_WIDTH / 2 - ROAD_WIDTH / 2;
    const eastBankX = RIVER_WIDTH / 2 + ROAD_WIDTH / 2;

    for (const [index, z] of bridgeLines.entries()) {
      const bridgeId = `bridge-${index + 1}`;
      const start = point(westBankX, z);
      const end = point(eastBankX, z);
      const roadId = addRoad(
        "x",
        start,
        end,
        "arterial",
        "ground",
        "bridge",
        3,
        [...west.map((district) => district.id), ...east.map((district) => district.id)],
        { bridgeId },
      );
      bridges.push({
        id: bridgeId,
        riverId: river.id,
        roadId,
        axis: "x",
        x: 0,
        z,
        width: eastBankX - westBankX,
        depth: 3,
      });
    }
    bridgeZ = bridgeLines[0] ?? null;
  }

  if (hasElevatedRoad && districtWork.length > 0) {
    const easternEdge = Math.max(
      ...districtWork.map((district) => district.x + district.width / 2),
    );
    addRoad(
      "z",
      point(easternEdge, bounds.minZ),
      point(easternEdge, bounds.maxZ),
      "arterial",
      "elevated",
      "ground",
      ROAD_WIDTH,
      districtWork
        .filter(
          (district) =>
            district.x + district.width / 2 === easternEdge,
        )
        .map((district) => district.id),
      { outsideConnection: true },
    );
  }

  const blocks: CityBlock[] = [];
  const parcels: CityParcel[] = [];
  const buildings: PlannedBuilding[] = [];
  const parks: PlannedPark[] = [];
  const props: CityProp[] = [];

  for (const district of districtWork) {
    const districtEntities = entitiesByDistrict.get(district.id) ?? [];
    const developmentBlocks = Math.max(1, Math.ceil(districtEntities.length / 4));
    const blockCount = developmentBlocks + 1;
    const minX = district.x - district.width / 2;
    const minZ = district.z - district.depth / 2;

    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      const column = blockIndex % blockColumns;
      const row = Math.floor(blockIndex / blockColumns);
      const blockId = `block-${district.id}-${blockIndex + 1}`;
      const block: CityBlock = {
        id: blockId,
        districtId: district.id,
        kind: blockIndex === developmentBlocks ? "park" : "development",
        x: round(minX + column * BLOCK_PITCH + BLOCK_PITCH / 2),
        z: round(minZ + row * BLOCK_PITCH + BLOCK_PITCH / 2),
        width: BLOCK_SIZE,
        depth: BLOCK_SIZE,
      };
      blocks.push(block);
      district.blockIds.push(blockId);

      if (block.kind === "park") {
        const park: PlannedPark = {
          id: `park-${district.id}`,
          districtId: district.id,
          blockId,
          x: block.x,
          z: block.z,
          width: BLOCK_SIZE - 2,
          depth: BLOCK_SIZE - 2,
        };
        parks.push(park);

        const treeOffsets = [
          [-2.6, -2.6],
          [2.6, -2.6],
          [-2.6, 2.6],
          [2.6, 2.6],
          [0, 0],
        ] as const;
        for (const [treeIndex, [offsetX, offsetZ]] of treeOffsets.entries()) {
          const hash = stableHash(`${seed}:${park.id}:${treeIndex}`);
          props.push({
            id: `tree-${district.id}-${treeIndex + 1}`,
            districtId: district.id,
            kind: "tree",
            x: round(block.x + offsetX),
            z: round(block.z + offsetZ),
            rotationY: round(((hash % 360) * Math.PI) / 180),
            scale: round(0.85 + ((hash >>> 8) % 31) / 100),
          });
        }
        continue;
      }

      const northRoadZ = minZ + row * BLOCK_PITCH;
      const southRoadZ = northRoadZ + BLOCK_PITCH;
      const northRoadId = roadIdFor(
        "x",
        point(minX, northRoadZ),
        point(minX + district.width, northRoadZ),
      );
      const southRoadId = roadIdFor(
        "x",
        point(minX, southRoadZ),
        point(minX + district.width, southRoadZ),
      );
      const parcelOffsets = [
        { x: -3.2, z: -3.2, side: "north" as const, roadId: northRoadId },
        { x: 3.2, z: -3.2, side: "north" as const, roadId: northRoadId },
        { x: -3.2, z: 3.2, side: "south" as const, roadId: southRoadId },
        { x: 3.2, z: 3.2, side: "south" as const, roadId: southRoadId },
      ];

      for (const [parcelIndex, offset] of parcelOffsets.entries()) {
        const parcelId = `parcel-${district.id}-${blockIndex + 1}-${parcelIndex + 1}`;
        parcels.push({
          id: parcelId,
          districtId: district.id,
          blockId,
          address: blockIndex * 4 + parcelIndex + 1,
          frontageSide: offset.side,
          frontageRoadId: offset.roadId,
          x: round(block.x + offset.x),
          z: round(block.z + offset.z),
          width: PARCEL_SIZE,
          depth: PARCEL_SIZE,
        });
      }

      const lampHash = stableHash(`${seed}:${blockId}:lamp`);
      props.push(
        {
          id: `lamp-${district.id}-${blockIndex + 1}-n`,
          districtId: district.id,
          kind: "streetlight",
          x: block.x,
          z: round(block.z - BLOCK_SIZE / 2 + 0.25),
          rotationY: round(((lampHash % 2) * Math.PI) / 2),
          scale: 1,
        },
        {
          id: `lamp-${district.id}-${blockIndex + 1}-s`,
          districtId: district.id,
          kind: "streetlight",
          x: block.x,
          z: round(block.z + BLOCK_SIZE / 2 - 0.25),
          rotationY: round((((lampHash >>> 1) % 2) * Math.PI) / 2),
          scale: 1,
        },
      );
    }

    const districtParcels = parcels.filter(
      (parcel) => parcel.districtId === district.id,
    );
    for (const [entityIndex, entity] of districtEntities.entries()) {
      const parcel = districtParcels[entityIndex]!;
      const classification = classifyBuilding(
        entity,
        gatewayEntityIds.has(entity.id),
      );
      const floors = floorCount(entity, classification.archetype);
      const loc = finiteNonNegative(entity.maxMetrics?.loc);
      const variation = stableHash(`${seed}:${entity.id}:${entity.path}`);
      const width = Math.min(
        PARCEL_SIZE - 0.6,
        2.8 + Math.log1p(loc) * 0.22 + (variation % 4) * 0.12,
      );
      const depth = Math.min(
        PARCEL_SIZE - 0.6,
        2.7 + Math.log1p(loc) * 0.2 + ((variation >>> 4) % 4) * 0.12,
      );
      const frontageZ =
        parcel.frontageSide === "north"
          ? parcel.z - parcel.depth / 2
          : parcel.z + parcel.depth / 2;

      buildings.push({
        id: `building-${entity.id}`,
        entityId: entity.id,
        districtId: district.id,
        blockId: parcel.blockId,
        parcelId: parcel.id,
        path: entity.path,
        archetype: classification.archetype,
        facility: classification.facility,
        floors,
        x: parcel.x,
        z: parcel.z,
        width: round(width),
        depth: round(depth),
        height: round(0.7 + floors * 1.7),
        frontage: {
          side: parcel.frontageSide,
          roadId: parcel.frontageRoadId,
          point: point(parcel.x, frontageZ),
        },
      });
    }
  }

  const entityDistrict = new Map(
    entities.map((entity) => [entity.id, entity.districtId] as const),
  );
  const carRoutes: MobilityRoute[] = districtWork.map((district) => {
    const minX = district.x - district.width / 2;
    const maxX = district.x + district.width / 2;
    const minZ = district.z - district.depth / 2;
    const maxZ = district.z + district.depth / 2;
    const first = point(minX, minZ);
    return {
      id: `car-loop-${district.id}`,
      mode: "car",
      points: [
        first,
        point(maxX, minZ),
        point(maxX, maxZ),
        point(minX, maxZ),
        first,
      ],
      closed: true,
      districtIds: [district.id],
      weight: routeWeight(district.id, relations, entityDistrict),
    };
  });

  if (river && bridgeZ !== null) {
    const west = districtWork.filter((district) => district.bank === "west");
    const east = districtWork.filter((district) => district.bank === "east");
    const bankByDistrict = new Map(
      districtWork.map((district) => [district.id, district.bank] as const),
    );
    const pairWeights = new Map<string, number>();
    for (const relation of relations) {
      const sourceDistrict = entityDistrict.get(relation.sourceId);
      const targetDistrict = entityDistrict.get(relation.targetId);
      if (!sourceDistrict || !targetDistrict) continue;
      const sourceBank = bankByDistrict.get(sourceDistrict);
      const targetBank = bankByDistrict.get(targetDistrict);
      if (
        !sourceBank ||
        !targetBank ||
        sourceBank === targetBank ||
        sourceBank === "inland" ||
        targetBank === "inland"
      ) {
        continue;
      }
      const westId = sourceBank === "west" ? sourceDistrict : targetDistrict;
      const eastId = sourceBank === "east" ? sourceDistrict : targetDistrict;
      const key = `${westId}:${eastId}`;
      pairWeights.set(
        key,
        (pairWeights.get(key) ?? 0) +
          Math.max(1, finiteNonNegative(relation.weight)),
      );
    }

    const bestPair = [...pairWeights.entries()].sort(
      ([leftKey, leftWeight], [rightKey, rightWeight]) =>
        rightWeight - leftWeight || compareText(leftKey, rightKey),
    )[0];
    const [westId, eastId] = bestPair
      ? bestPair[0].split(":")
      : [west[0]!.id, east[0]!.id];
    const westDistrict = west.find((district) => district.id === westId)!;
    const eastDistrict = east.find((district) => district.id === eastId)!;
    const westRoadX = -RIVER_WIDTH / 2 - ROAD_WIDTH / 2;
    const eastRoadX = RIVER_WIDTH / 2 + ROAD_WIDTH / 2;
    const westRouteX = nearestRoadLine(
      westDistrict.x - westDistrict.width / 2,
      westDistrict.x,
      blockColumns,
    );
    const eastRouteX = nearestRoadLine(
      eastDistrict.x - eastDistrict.width / 2,
      eastDistrict.x,
      blockColumns,
    );
    const westRouteZ = nearestRoadLine(
      westDistrict.z - westDistrict.depth / 2,
      westDistrict.z,
      blockRows,
    );
    const eastRouteZ = nearestRoadLine(
      eastDistrict.z - eastDistrict.depth / 2,
      eastDistrict.z,
      blockRows,
    );

    carRoutes.push({
      id: `car-cross-river-${westId}-${eastId}`,
      mode: "car",
      points: compactPath([
        point(westRouteX, westRouteZ),
        point(westRoadX, westRouteZ),
        point(westRoadX, bridgeZ),
        point(eastRoadX, bridgeZ),
        point(eastRoadX, eastRouteZ),
        point(eastRouteX, eastRouteZ),
      ]),
      closed: false,
      districtIds: [westId!, eastId!],
      weight: Math.max(1, bestPair?.[1] ?? 1),
    });
  }

  const pedestrianRoutes: MobilityRoute[] = parks.map((park) => {
    const inset = 0.7;
    const minX = park.x - park.width / 2 + inset;
    const maxX = park.x + park.width / 2 - inset;
    const minZ = park.z - park.depth / 2 + inset;
    const maxZ = park.z + park.depth / 2 - inset;
    const first = point(minX, minZ);
    return {
      id: `pedestrian-${park.id}`,
      mode: "pedestrian",
      points: [
        first,
        point(maxX, minZ),
        point(maxX, maxZ),
        point(minX, maxZ),
        first,
      ],
      closed: true,
      districtIds: [park.districtId],
      weight: 1,
    };
  });

  const westDistricts = districtWork.filter(
    (district) => district.bank === "west",
  );
  const eastDistricts = districtWork.filter(
    (district) => district.bank === "east",
  );
  const boatRoutes: MobilityRoute[] =
    river && westDistricts.length > 0 && eastDistricts.length > 0
      ? [
          {
            id: "boat-river-main",
            mode: "boat",
            points: [
              point(river.x, bounds.minZ + 2),
              point(river.x, bounds.maxZ - 2),
            ],
            closed: false,
            districtIds: [westDistricts[0]!.id, eastDistricts[0]!.id],
            weight: 1,
          },
        ]
      : [];

  const roads: RoadSegment[] = [...roadDrafts.values()]
    .map((road) => ({
      ...road,
      districtIds: [...road.districtIds].sort(compareText),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  return {
    version: "0.2",
    seed,
    bounds,
    geography: { river },
    districts: districtWork
      .map(
        (district): PlannedDistrict => ({
          id: district.id,
          name: district.name,
          color: district.color,
          bank: district.bank,
          entityIds: district.entityIds,
          blockIds: district.blockIds,
          x: district.x,
          z: district.z,
          width: district.width,
          depth: district.depth,
        }),
      )
      .sort((left, right) => compareText(left.id, right.id)),
    roads,
    bridges: bridges.sort((left, right) => compareText(left.id, right.id)),
    blocks: blocks.sort((left, right) => compareText(left.id, right.id)),
    parcels: parcels.sort((left, right) => compareText(left.id, right.id)),
    buildings: buildings.sort((left, right) =>
      compareText(left.entityId, right.entityId),
    ),
    parks: parks.sort((left, right) => compareText(left.id, right.id)),
    props: props.sort((left, right) => compareText(left.id, right.id)),
    mobility: {
      carRoutes: carRoutes.sort((left, right) =>
        compareText(left.id, right.id),
      ),
      pedestrianRoutes: pedestrianRoutes.sort((left, right) =>
        compareText(left.id, right.id),
      ),
      boatRoutes,
    },
  };
}

/** Alias matching the future static compiler naming in the V2 specification. */
export const compileLivingCity = planLivingCity;
