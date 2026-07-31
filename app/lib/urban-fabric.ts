import { stableCityHash } from "./city-visuals";
import type { CityBounds, CityPoint } from "./living-city";
import type {
  SemanticCityPlan,
  SemanticComponent,
  SemanticRoadClass,
} from "./semantic-city";

export const URBAN_FABRIC_VERSION = "0.1" as const;

export type UrbanStreetHierarchy = "primary" | "secondary" | "local";
export type UrbanBlockEdge = "north" | "east" | "south" | "west";
export type UrbanBuildingTypology =
  | "narrow-street"
  | "perimeter-courtyard"
  | "podium-tower"
  | "civic-landmark"
  | "technical-hall";
export type UrbanMaterialKey =
  | "limestone"
  | "warm-concrete"
  | "brick"
  | "slate";

export interface UrbanStreet extends Omit<CityPoint, "y"> {
  id: string;
  hierarchy: UrbanStreetHierarchy;
  roadClass: SemanticRoadClass;
  centerline: CityPoint[];
  width: number;
  lanes: number;
  level: "ground" | "elevated";
  surface: "ground" | "bridge";
  corridorIds: string[];
  evidenceRelationIds: string[];
  bank: "west" | "east" | "crossing";
}

export interface UrbanBlock extends CityPoint {
  id: string;
  bank: "west" | "east";
  row: number;
  column: number;
  width: number;
  depth: number;
  adjacentBlockIds: string[];
  streetIdsByEdge: Record<UrbanBlockEdge, string>;
}

export interface UrbanComponentAssignment {
  componentId: string;
  blockIds: string[];
  accentColor: string;
}

export interface UrbanParcel extends CityPoint {
  id: string;
  componentId: string;
  blockId: string;
  width: number;
  depth: number;
  rotation: number;
  primaryEdge: UrbanBlockEdge;
  primaryStreetId: string;
  frontage: number;
  setback: number;
  entrance: CityPoint;
  buildingId: string;
}

export interface UrbanBuildingEnvelope extends CityPoint {
  id: string;
  componentId: string;
  blockId: string;
  parcelId: string;
  typology: UrbanBuildingTypology;
  material: UrbanMaterialKey;
  accentColor: string;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  primaryStreetId: string;
  entrance: CityPoint;
  primaryEntityId: string;
  entityIds: string[];
}

export interface UrbanEntityAddress {
  entityId: string;
  componentId: string;
  blockId: string;
  parcelId: string;
  buildingId: string;
  worldPoint: CityPoint;
  entrance: CityPoint;
  legacySemanticPoint: CityPoint;
}

export interface UrbanFabricPlan {
  version: typeof URBAN_FABRIC_VERSION;
  seed: string;
  bounds: CityBounds;
  streets: UrbanStreet[];
  blocks: UrbanBlock[];
  componentAssignments: UrbanComponentAssignment[];
  parcels: UrbanParcel[];
  buildings: UrbanBuildingEnvelope[];
  entityAddresses: Record<string, UrbanEntityAddress>;
  componentBlockIds: Record<string, string[]>;
}

export interface PlanUrbanFabricInput {
  semanticPlan: SemanticCityPlan;
}

interface WaterEnvelope {
  minX: number;
  maxX: number;
  centerX: number;
}

interface BankLayout {
  bank: "west" | "east";
  components: SemanticComponent[];
  innerStreetX: number;
  direction: -1 | 1;
}

interface ParcelDraft extends Omit<UrbanParcel, "buildingId"> {
  typology: UrbanBuildingTypology;
}

const BLOCK_WIDTH = 9.8;
const BLOCK_DEPTH = 8.2;
const STREET_GAP = 3.2;
const WATERFRONT_GAP = 2.2;
const BUILDING_SETBACK = 0.55;
const BLOCK_COLUMNS = 3;

const MATERIALS: readonly UrbanMaterialKey[] = [
  "limestone",
  "warm-concrete",
  "brick",
  "slate",
];

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function point(x: number, z: number): CityPoint {
  return { x: round(x), z: round(z) };
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${stableCityHash(value).toString(16).padStart(8, "0")}`;
}

function waterEnvelope(plan: SemanticCityPlan): WaterEnvelope | null {
  const points = plan.terrain.waterBoundaries.flatMap(
    (boundary) => boundary.outline,
  );
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((candidate) => candidate.x));
  const maxX = Math.max(...points.map((candidate) => candidate.x));
  return {
    minX: round(minX),
    maxX: round(maxX),
    centerX: round((minX + maxX) / 2),
  };
}

function componentImportance(component: SemanticComponent): number {
  return (
    component.metrics.externalRelationWeight * 6 +
    (component.metrics.fanIn + component.metrics.fanOut) * 3 +
    component.metrics.exports * 2 +
    component.metrics.files
  );
}

function orderedComponents(
  components: readonly SemanticComponent[],
): SemanticComponent[] {
  return [...components].sort(
    (left, right) =>
      componentImportance(right) - componentImportance(left) ||
      compareText(left.id, right.id),
  );
}

function splitComponentsByBank(
  plan: SemanticCityPlan,
  water: WaterEnvelope | null,
): { west: SemanticComponent[]; east: SemanticComponent[] } {
  const ordered = orderedComponents(plan.components);
  const campusByComponentId = new Map(
    plan.campuses.map((campus) => [campus.componentId, campus]),
  );
  const targetWest = Math.ceil(ordered.length / 2);
  const west: SemanticComponent[] = [];
  const east: SemanticComponent[] = [];
  const centerX = water?.centerX ?? plan.bounds.x;

  for (const component of ordered) {
    const campus = campusByComponentId.get(component.id);
    const preferred = (campus?.x ?? centerX) <= centerX ? west : east;
    const alternate = preferred === west ? east : west;
    const preferredLimit = preferred === west ? targetWest : ordered.length - targetWest;
    if (preferred.length < preferredLimit) preferred.push(component);
    else alternate.push(component);
  }

  while (west.length < targetWest && east.length > 0) west.push(east.pop()!);
  while (west.length > targetWest) east.push(west.pop()!);
  west.sort((left, right) => compareText(left.id, right.id));
  east.sort((left, right) => compareText(left.id, right.id));
  return { west, east };
}

function streetClass(hierarchy: UrbanStreetHierarchy): {
  roadClass: SemanticRoadClass;
  width: number;
  lanes: number;
} {
  if (hierarchy === "primary") {
    return { roadClass: "arterial", width: 3.7, lanes: 4 };
  }
  if (hierarchy === "secondary") {
    return { roadClass: "collector", width: 2.7, lanes: 2 };
  }
  return { roadClass: "local", width: 1.8, lanes: 2 };
}

function makeStreet(
  seed: string,
  bank: UrbanStreet["bank"],
  hierarchy: UrbanStreetHierarchy,
  start: CityPoint,
  end: CityPoint,
  key: string,
): UrbanStreet {
  const dimensions = streetClass(hierarchy);
  return {
    id: stableId("street", `${seed}:${bank}:${key}`),
    x: round((start.x + end.x) / 2),
    z: round((start.z + end.z) / 2),
    hierarchy,
    roadClass: dimensions.roadClass,
    centerline: [point(start.x, start.z), point(end.x, end.z)],
    width: dimensions.width,
    lanes: dimensions.lanes,
    level: "ground",
    surface: "ground",
    corridorIds: [],
    evidenceRelationIds: [],
    bank,
  };
}

function blockId(seed: string, bank: string, row: number, column: number) {
  return stableId("block", `${seed}:${bank}:${row}:${column}`);
}

function verticalStreetId(
  seed: string,
  bank: string,
  boundaryColumn: number,
) {
  return stableId("street", `${seed}:${bank}:vertical:${boundaryColumn}`);
}

function horizontalStreetId(seed: string, bank: string, boundaryRow: number) {
  return stableId("street", `${seed}:${bank}:horizontal:${boundaryRow}`);
}

function makeBankFabric(
  seed: string,
  layout: BankLayout,
  rowCount: number,
  zCenter: number,
): { streets: UrbanStreet[]; blocks: UrbanBlock[] } {
  if (layout.components.length === 0) return { streets: [], blocks: [] };
  const pitchX = BLOCK_WIDTH + STREET_GAP;
  const pitchZ = BLOCK_DEPTH + STREET_GAP;
  const totalDepth = rowCount * BLOCK_DEPTH + (rowCount + 1) * STREET_GAP;
  const minZ = zCenter - totalDepth / 2;
  const maxZ = zCenter + totalDepth / 2;
  const streets: UrbanStreet[] = [];
  const blocks: UrbanBlock[] = [];

  for (let boundaryColumn = 0; boundaryColumn <= BLOCK_COLUMNS; boundaryColumn += 1) {
    const x = layout.innerStreetX + layout.direction * boundaryColumn * pitchX;
    streets.push(
      makeStreet(
        seed,
        layout.bank,
        boundaryColumn === 0 ? "primary" : "secondary",
        point(x, minZ),
        point(x, maxZ),
        `vertical:${boundaryColumn}`,
      ),
    );
  }
  for (let boundaryRow = 0; boundaryRow <= rowCount; boundaryRow += 1) {
    const z = minZ + STREET_GAP / 2 + boundaryRow * pitchZ;
    const outerX =
      layout.innerStreetX + layout.direction * BLOCK_COLUMNS * pitchX;
    streets.push(
      makeStreet(
        seed,
        layout.bank,
        boundaryRow === 0 || boundaryRow === rowCount
          ? "secondary"
          : "local",
        point(layout.innerStreetX, z),
        point(outerX, z),
        `horizontal:${boundaryRow}`,
      ),
    );
  }

  for (let row = 0; row < layout.components.length; row += 1) {
    for (let column = 0; column < BLOCK_COLUMNS; column += 1) {
      const x =
        layout.innerStreetX +
        layout.direction * (STREET_GAP / 2 + BLOCK_WIDTH / 2 + column * pitchX);
      const z =
        minZ + STREET_GAP + BLOCK_DEPTH / 2 + row * pitchZ;
      const id = blockId(seed, layout.bank, row, column);
      const adjacentBlockIds = [
        row > 0 ? blockId(seed, layout.bank, row - 1, column) : null,
        row + 1 < layout.components.length
          ? blockId(seed, layout.bank, row + 1, column)
          : null,
        column > 0
          ? blockId(seed, layout.bank, row, column - 1)
          : null,
        column + 1 < BLOCK_COLUMNS
          ? blockId(seed, layout.bank, row, column + 1)
          : null,
      ].filter((candidate): candidate is string => candidate !== null);
      const westBoundary = layout.direction === 1 ? column : column + 1;
      const eastBoundary = layout.direction === 1 ? column + 1 : column;
      blocks.push({
        id,
        bank: layout.bank,
        row,
        column,
        x: round(x),
        z: round(z),
        width: BLOCK_WIDTH,
        depth: BLOCK_DEPTH,
        adjacentBlockIds: adjacentBlockIds.sort(compareText),
        streetIdsByEdge: {
          north: horizontalStreetId(seed, layout.bank, row),
          east: verticalStreetId(seed, layout.bank, eastBoundary),
          south: horizontalStreetId(seed, layout.bank, row + 1),
          west: verticalStreetId(seed, layout.bank, westBoundary),
        },
      });
    }
  }

  return {
    streets: streets.sort((left, right) => compareText(left.id, right.id)),
    blocks: blocks.sort((left, right) => compareText(left.id, right.id)),
  };
}

function componentColor(
  componentId: string,
  plan: SemanticCityPlan,
): string {
  return (
    plan.campuses.find((campus) => campus.componentId === componentId)?.color ??
    "#68b8a8"
  );
}

function typologyForBlock(
  _seed: string,
  _block: UrbanBlock,
  globalIndex: number,
): UrbanBuildingTypology {
  if (globalIndex === 0) return "civic-landmark";
  const cycle: readonly UrbanBuildingTypology[] = [
    "perimeter-courtyard",
    "podium-tower",
    "narrow-street",
    "perimeter-courtyard",
    "technical-hall",
    "podium-tower",
  ];
  return cycle[(globalIndex - 1) % cycle.length]!;
}

function parcelDraftsForBlock(
  seed: string,
  block: UrbanBlock,
  componentId: string,
  globalIndex: number,
): ParcelDraft[] {
  const typology = typologyForBlock(seed, block, globalIndex);
  const fullBlockTypology =
    typology === "perimeter-courtyard" ||
    typology === "civic-landmark" ||
    typology === "technical-hall";
  const makeDraft = (
    suffix: string,
    edge: "north" | "south",
    x: number,
    width: number,
    parcelTypology: UrbanBuildingTypology,
  ): ParcelDraft => {
    const setback = BUILDING_SETBACK;
    const depth = fullBlockTypology
      ? BLOCK_DEPTH - setback * 2
      : BLOCK_DEPTH / 2 - setback * 1.5;
    const z = fullBlockTypology
      ? block.z
      : block.z + (edge === "north" ? -1 : 1) * (BLOCK_DEPTH / 4);
    const entranceZ =
      block.z + (edge === "north" ? -1 : 1) * (BLOCK_DEPTH / 2 + STREET_GAP / 2);
    return {
      id: stableId("parcel", `${seed}:${block.id}:${suffix}`),
      componentId,
      blockId: block.id,
      x: round(x),
      z: round(z),
      width: round(width),
      depth: round(depth),
      rotation: 0,
      primaryEdge: edge,
      primaryStreetId: block.streetIdsByEdge[edge],
      frontage: round(width),
      setback,
      entrance: point(x, entranceZ),
      typology: parcelTypology,
    };
  };

  if (fullBlockTypology) {
    return [
      makeDraft(
        "whole",
        stableCityHash(`${block.id}:edge`) % 2 === 0 ? "north" : "south",
        block.x,
        BLOCK_WIDTH - BUILDING_SETBACK * 2,
        typology,
      ),
    ];
  }

  const halfWidth = BLOCK_WIDTH / 2 - BUILDING_SETBACK * 0.75;
  return [
    makeDraft("north", "north", block.x, halfWidth, typology),
    makeDraft(
      "south",
      "south",
      block.x,
      halfWidth,
      typology === "podium-tower" ? "narrow-street" : "podium-tower",
    ),
  ];
}

function normalizedComponentHeight(
  component: SemanticComponent,
  components: readonly SemanticComponent[],
): number {
  const values = components.map(componentImportance);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (maximum - minimum < 0.001) return 0.5;
  return (componentImportance(component) - minimum) / (maximum - minimum);
}

function typologyHeightOffset(typology: UrbanBuildingTypology): number {
  if (typology === "podium-tower") return 5.2;
  if (typology === "civic-landmark") return 3.2;
  if (typology === "perimeter-courtyard") return 0.8;
  if (typology === "technical-hall") return -2.4;
  return 0;
}

function makeBuildingsAndParcels(
  plan: SemanticCityPlan,
  blocks: readonly UrbanBlock[],
  assignments: readonly UrbanComponentAssignment[],
): {
  parcels: UrbanParcel[];
  buildings: UrbanBuildingEnvelope[];
  entityAddresses: Record<string, UrbanEntityAddress>;
} {
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const componentById = new Map(
    plan.components.map((component) => [component.id, component]),
  );
  const semanticAddressByEntityId = plan.entityAddresses;
  const parcels: UrbanParcel[] = [];
  const buildings: UrbanBuildingEnvelope[] = [];
  const entityAddresses: Record<string, UrbanEntityAddress> = {};
  let globalBlockIndex = 0;

  for (const assignment of [...assignments].sort((left, right) =>
    compareText(left.componentId, right.componentId),
  )) {
    const component = componentById.get(assignment.componentId);
    if (!component) continue;
    const drafts = assignment.blockIds.flatMap((id) => {
      const block = blockById.get(id);
      if (!block) return [];
      const result = parcelDraftsForBlock(
        plan.seed,
        block,
        component.id,
        globalBlockIndex,
      );
      globalBlockIndex += 1;
      return result;
    });
    const entityBuckets = drafts.map(() => [] as string[]);
    [...component.entityIds]
      .sort(
        (left, right) =>
          stableCityHash(left) - stableCityHash(right) || compareText(left, right),
      )
      .forEach((entityId, index) => {
        entityBuckets[index % Math.max(1, entityBuckets.length)]!.push(entityId);
      });
    const intensity = normalizedComponentHeight(component, plan.components);

    drafts.forEach((draft, index) => {
      const buildingId = stableId("building", `${plan.seed}:${draft.id}`);
      const entityIds = entityBuckets[index]!;
      const fallbackEntity = component.anchorEntityId;
      const primaryEntityId = entityIds[0] ?? fallbackEntity;
      const jitter = (stableCityHash(buildingId) % 180) / 100 - 0.9;
      const height = round(
        Math.max(
          3.4,
          Math.min(
            18.5,
            5.2 + intensity * 7.1 + typologyHeightOffset(draft.typology) + jitter,
          ),
        ),
      );
      const parcel: UrbanParcel = { ...draft, buildingId };
      delete (parcel as Partial<ParcelDraft>).typology;
      const building: UrbanBuildingEnvelope = {
        id: buildingId,
        componentId: component.id,
        blockId: draft.blockId,
        parcelId: draft.id,
        typology: draft.typology,
        material:
          MATERIALS[stableCityHash(`${buildingId}:material`) % MATERIALS.length]!,
        accentColor: assignment.accentColor,
        x: draft.x,
        z: draft.z,
        width: round(draft.width * 0.92),
        depth: round(draft.depth * 0.88),
        height,
        rotation: draft.rotation,
        primaryStreetId: draft.primaryStreetId,
        entrance: { ...draft.entrance },
        primaryEntityId,
        entityIds: [...entityIds],
      };
      parcels.push(parcel);
      buildings.push(building);
      for (const entityId of entityIds) {
        entityAddresses[entityId] = {
          entityId,
          componentId: component.id,
          blockId: draft.blockId,
          parcelId: draft.id,
          buildingId,
          worldPoint: point(building.x, building.z),
          entrance: { ...draft.entrance },
          legacySemanticPoint: {
            ...(semanticAddressByEntityId[entityId]?.worldPoint ??
              point(building.x, building.z)),
          },
        };
      }
    });
  }

  return {
    parcels: parcels.sort((left, right) => compareText(left.id, right.id)),
    buildings: buildings.sort((left, right) => compareText(left.id, right.id)),
    entityAddresses: Object.fromEntries(
      Object.entries(entityAddresses).sort(([left], [right]) => compareText(left, right)),
    ),
  };
}

function fabricBounds(
  streets: readonly UrbanStreet[],
  blocks: readonly UrbanBlock[],
  fallback: CityBounds,
): CityBounds {
  if (streets.length === 0 && blocks.length === 0) return { ...fallback };
  const xValues = [
    ...streets.flatMap((street) => street.centerline.map((candidate) => candidate.x)),
    ...blocks.flatMap((block) => [
      block.x - block.width / 2,
      block.x + block.width / 2,
    ]),
  ];
  const zValues = [
    ...streets.flatMap((street) => street.centerline.map((candidate) => candidate.z)),
    ...blocks.flatMap((block) => [
      block.z - block.depth / 2,
      block.z + block.depth / 2,
    ]),
  ];
  const margin = 4;
  const minX = Math.min(...xValues) - margin;
  const maxX = Math.max(...xValues) + margin;
  const minZ = Math.min(...zValues) - margin;
  const maxZ = Math.max(...zValues) + margin;
  return {
    minX: round(minX),
    maxX: round(maxX),
    minZ: round(minZ),
    maxZ: round(maxZ),
    x: round((minX + maxX) / 2),
    z: round((minZ + maxZ) / 2),
    width: round(maxX - minX),
    depth: round(maxZ - minZ),
  };
}

/**
 * Compile semantic facts into one deterministic public street/block fabric.
 * This projection owns geometry only; it never creates repository evidence.
 */
export function planUrbanFabric({
  semanticPlan,
}: PlanUrbanFabricInput): UrbanFabricPlan {
  const water = waterEnvelope(semanticPlan);
  const split = splitComponentsByBank(semanticPlan, water);
  const rowCount = Math.max(1, split.west.length, split.east.length);
  const waterWidth = water ? water.maxX - water.minX : 0;
  const centerX = water?.centerX ?? semanticPlan.bounds.x;
  const westInnerStreetX = water
    ? water.minX - WATERFRONT_GAP
    : centerX - waterWidth / 2 - WATERFRONT_GAP;
  const eastInnerStreetX = water
    ? water.maxX + WATERFRONT_GAP
    : centerX + waterWidth / 2 + WATERFRONT_GAP;
  const layouts: BankLayout[] = [
    {
      bank: "west",
      components: split.west,
      innerStreetX: round(westInnerStreetX),
      direction: -1,
    },
    {
      bank: "east",
      components: split.east,
      innerStreetX: round(eastInnerStreetX),
      direction: 1,
    },
  ];
  const bankFabrics = layouts.map((layout) =>
    makeBankFabric(
      semanticPlan.seed,
      layout,
      rowCount,
      semanticPlan.bounds.z,
    ),
  );
  const streets = bankFabrics
    .flatMap((fabric) => fabric.streets)
    .sort((left, right) => compareText(left.id, right.id));
  if (split.west.length > 0 && split.east.length > 0) {
    const pitchZ = BLOCK_DEPTH + STREET_GAP;
    const bridgeOffsets = rowCount > 1 ? [-0.5, 0.5] : [0];
    for (const [index, offset] of bridgeOffsets.entries()) {
      const z = semanticPlan.bounds.z + offset * pitchZ;
      const bridge = makeStreet(
        semanticPlan.seed,
        "crossing",
        "secondary",
        point(westInnerStreetX, z),
        point(eastInnerStreetX, z),
        `bridge:${index}`,
      );
      bridge.surface = water ? "bridge" : "ground";
      streets.push(bridge);
    }
    streets.sort((left, right) => compareText(left.id, right.id));
  }
  const blocks = bankFabrics
    .flatMap((fabric) => fabric.blocks)
    .sort((left, right) => compareText(left.id, right.id));
  const componentAssignments = layouts
    .flatMap((layout) =>
      layout.components.map((component, row) => ({
        componentId: component.id,
        blockIds: Array.from({ length: BLOCK_COLUMNS }, (_, column) =>
          blockId(semanticPlan.seed, layout.bank, row, column),
        ).sort(compareText),
        accentColor: componentColor(component.id, semanticPlan),
      })),
    )
    .sort((left, right) => compareText(left.componentId, right.componentId));
  const componentBlockIds = Object.fromEntries(
    componentAssignments.map((assignment) => [
      assignment.componentId,
      [...assignment.blockIds],
    ]),
  );
  const built = makeBuildingsAndParcels(
    semanticPlan,
    blocks,
    componentAssignments,
  );
  const bounds = fabricBounds(streets, blocks, semanticPlan.bounds);

  return {
    version: URBAN_FABRIC_VERSION,
    seed: `urban-${stableCityHash(
      `${semanticPlan.seed}:${blocks.map((block) => block.id).join(":")}`,
    )
      .toString(16)
      .padStart(8, "0")}`,
    bounds,
    streets,
    blocks,
    componentAssignments,
    parcels: built.parcels,
    buildings: built.buildings,
    entityAddresses: built.entityAddresses,
    componentBlockIds,
  };
}

export function selectedUrbanBlocks(
  plan: UrbanFabricPlan,
  componentId: string | null | undefined,
): UrbanBlock[] {
  if (!componentId) return [];
  const ids = new Set(plan.componentBlockIds[componentId] ?? []);
  return plan.blocks.filter((block) => ids.has(block.id));
}

export function urbanComponentForEntity(
  plan: UrbanFabricPlan,
  entityId: string | null | undefined,
): string | null {
  return entityId ? plan.entityAddresses[entityId]?.componentId ?? null : null;
}

/**
 * Reproject a land journey onto the shared V4 street hierarchy. Water legs
 * retain their evidence-authorized geometry and are returned unchanged.
 */
export function projectUrbanJourneyLeg(
  plan: UrbanFabricPlan,
  sourceEntityId: string,
  targetEntityId: string,
  mode: "pedestrian" | "car" | "transit" | "freight" | "boat",
  semanticPoints: readonly CityPoint[],
): CityPoint[] {
  if (mode === "boat") {
    return semanticPoints.map((candidate) => point(candidate.x, candidate.z));
  }
  const source = plan.entityAddresses[sourceEntityId];
  const target = plan.entityAddresses[targetEntityId];
  if (!source || !target) {
    return semanticPoints.map((candidate) => point(candidate.x, candidate.z));
  }
  const blockById = new Map(plan.blocks.map((block) => [block.id, block]));
  const sourceBlock = blockById.get(source.blockId);
  const targetBlock = blockById.get(target.blockId);
  if (!sourceBlock || !targetBlock) return [];
  const primaryByBank = new Map(
    plan.streets
      .filter((street) => street.hierarchy === "primary")
      .map((street) => [street.bank, street] as const),
  );
  const sourcePrimary = primaryByBank.get(sourceBlock.bank);
  const targetPrimary = primaryByBank.get(targetBlock.bank);
  if (!sourcePrimary || !targetPrimary) return [];
  const sourcePrimaryX = sourcePrimary.x;
  const targetPrimaryX = targetPrimary.x;
  if (sourceBlock.bank === targetBlock.bank) {
    return [
      point(source.entrance.x, source.entrance.z),
      point(sourcePrimaryX, source.entrance.z),
      point(targetPrimaryX, target.entrance.z),
      point(target.entrance.x, target.entrance.z),
    ];
  }
  const bridges = plan.streets.filter(
    (street) => street.bank === "crossing" && street.surface === "bridge",
  );
  const desiredZ = (source.entrance.z + target.entrance.z) / 2;
  const bridge = [...bridges].sort(
    (left, right) =>
      Math.abs(left.z - desiredZ) - Math.abs(right.z - desiredZ) ||
      compareText(left.id, right.id),
  )[0];
  if (!bridge) {
    return semanticPoints.map((candidate) => point(candidate.x, candidate.z));
  }
  return [
    point(source.entrance.x, source.entrance.z),
    point(sourcePrimaryX, source.entrance.z),
    point(sourcePrimaryX, bridge.z),
    point(targetPrimaryX, bridge.z),
    point(targetPrimaryX, target.entrance.z),
    point(target.entrance.x, target.entrance.z),
  ];
}
