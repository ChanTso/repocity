import { stableCityHash } from "./city-visuals";
import type { CityBounds, CityPoint } from "./living-city";
import type {
  SemanticCityPlan,
  SemanticComponent,
  SemanticRoadClass,
} from "./semantic-city";

export const URBAN_FABRIC_VERSION = "0.2" as const;

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
  | "slate"
  | "red-brick"
  | "cream-terra-cotta"
  | "dark-metal"
  | "blue-green-glass"
  | "bronze-metal";
export type UrbanCharacterZone =
  | "loop-core"
  | "river-north"
  | "fulton-market"
  | "civic-anchor";
export type UrbanFacadeFamily =
  | "chicago-school-masonry"
  | "miesian-grid"
  | "blue-green-curtain-wall"
  | "bronze-vertical-modern"
  | "fulton-brick-warehouse"
  | "narrow-storefront-row"
  | "art-deco-setback"
  | "civic-institutional"
  | "riverfront-terrace";
export type UrbanCurtainWallVariant =
  | "dark-miesian-grid"
  | "light-blue-green-grid"
  | "bronze-vertical-fins";
export type UrbanStorefrontCategory =
  | "corner-cafe"
  | "bookshop"
  | "neighborhood-grocer"
  | "design-studio"
  | "music-room"
  | "bakery"
  | "repair-shop"
  | "gallery"
  | "restaurant"
  | "hotel-lobby";
export type UrbanMassingProfile =
  | "loop-podium-slab"
  | "loop-setback-tower"
  | "miesian-plaza-tower"
  | "river-terrace-midrise"
  | "river-corner-tower"
  | "fulton-loft"
  | "fulton-sawtooth-addition"
  | "warehouse-glass-addition"
  | "chicago-school-corner"
  | "civic-shoulder-landmark";
export type UrbanMassingKind =
  | "base"
  | "shoulder"
  | "shaft"
  | "setback"
  | "crown"
  | "roof-house";

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
  characterZone: UrbanCharacterZone;
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

/**
 * One repository component can occupy several real-looking buildings. These
 * envelopes are architectural subdivision only: they never invent files,
 * dependencies, or selectable semantic entities.
 */
export interface UrbanArchitecturalEnvelope extends CityPoint {
  id: string;
  semanticBuildingId: string;
  componentId: string;
  blockId: string;
  parcelId: string;
  characterZone: UrbanCharacterZone;
  facadeFamily: UrbanFacadeFamily;
  curtainWallVariant: UrbanCurtainWallVariant | null;
  massingProfile: UrbanMassingProfile;
  material: UrbanMaterialKey;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  primaryEdge: UrbanBlockEdge;
  secondaryEdge: UrbanBlockEdge;
  primaryStreetId: string;
  secondaryStreetId: string;
  entrance: CityPoint;
  landmark: boolean;
}

export interface UrbanArchitecturalParcel extends CityPoint {
  id: string;
  blockId: string;
  componentId: string;
  architecturalEnvelopeId: string;
  width: number;
  depth: number;
  primaryEdge: UrbanBlockEdge;
  secondaryEdge: UrbanBlockEdge;
  frontage: number;
}

export interface UrbanMassingVolume extends CityPoint {
  id: string;
  architecturalEnvelopeId: string;
  componentId: string;
  blockId: string;
  kind: UrbanMassingKind;
  material: UrbanMaterialKey;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
}

export interface UrbanStorefront extends CityPoint {
  id: string;
  architecturalEnvelopeId: string;
  componentId: string;
  blockId: string;
  category: UrbanStorefrontCategory;
  signLabel: string;
  streetId: string;
  edge: UrbanBlockEdge;
  width: number;
  rotation: number;
  active: boolean;
}

export interface UrbanMorphologyMetrics {
  architecturalEnvelopeCount: number;
  massingVolumeCount: number;
  storefrontCount: number;
  facadeInstanceCount: number;
  medianFrontageUnitsPerBlock: number;
  frontageCoveragePct: number;
  loopFrontageCoveragePct: number;
  streetWallGapPct: number;
  loopStreetWallGapPct: number;
  activeGroundFloorPct: number;
  fultonActiveGroundFloorPct: number;
  genericLawnRatioPct: number;
  diverseAdjacentPairPct: number;
  landmarkRatioPct: number;
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
  architecturalParcels: UrbanArchitecturalParcel[];
  architecturalEnvelopes: UrbanArchitecturalEnvelope[];
  massingVolumes: UrbanMassingVolume[];
  storefronts: UrbanStorefront[];
  morphology: UrbanMorphologyMetrics;
  entityAddresses: Record<string, UrbanEntityAddress>;
  componentBlockIds: Record<string, string[]>;
}

export interface PlanUrbanFabricInput {
  semanticPlan: SemanticCityPlan;
  seed?: string;
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

// V4.1 uses one world unit as three metres. These dimensions yield compact
// Chicago half-blocks, 10–16 metre streets and believable 3.1–3.7 metre floors.
const BLOCK_WIDTH = 18;
const BLOCK_DEPTH = 14;
const STREET_GAP = 5.6;
const WATERFRONT_GAP = 3;
const BUILDING_SETBACK = 0.7;
const BLOCK_COLUMNS = 3;

const MATERIALS: readonly UrbanMaterialKey[] = [
  "limestone",
  "warm-concrete",
  "brick",
  "slate",
];

const ARCHITECTURAL_MATERIALS: readonly UrbanMaterialKey[] = [
  "limestone",
  "red-brick",
  "cream-terra-cotta",
  "dark-metal",
  "blue-green-glass",
  "bronze-metal",
  "warm-concrete",
  "brick",
];

const STOREFRONT_CATEGORIES: readonly UrbanStorefrontCategory[] = [
  "corner-cafe",
  "bookshop",
  "neighborhood-grocer",
  "design-studio",
  "music-room",
  "bakery",
  "repair-shop",
  "gallery",
  "restaurant",
  "hotel-lobby",
];

const STORE_LABELS = [
  "Canal Cafe",
  "Lake Books",
  "Market Pantry",
  "Grid Studio",
  "Blue Note Room",
  "Union Bakery",
  "City Repair",
  "North Gallery",
  "Dearborn Table",
  "Loop House",
] as const;

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
    return { roadClass: "arterial", width: 5.2, lanes: 4 };
  }
  if (hierarchy === "secondary") {
    return { roadClass: "collector", width: 4.2, lanes: 2 };
  }
  return { roadClass: "local", width: 3.4, lanes: 2 };
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
        characterZone:
          column === 0
            ? "river-north"
            : layout.bank === "east"
              ? "loop-core"
              : "fulton-market",
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

function characterZoneBlocks(
  blocks: readonly UrbanBlock[],
  assignments: readonly UrbanComponentAssignment[],
  components: readonly SemanticComponent[],
): UrbanBlock[] {
  const anchorComponent = orderedComponents(components)[0];
  const anchorAssignment = assignments.find(
    (assignment) => assignment.componentId === anchorComponent?.id,
  );
  const anchorBlockId = anchorAssignment?.blockIds
    .map((id) => blocks.find((block) => block.id === id))
    .filter((block): block is UrbanBlock => Boolean(block))
    .sort(
      (left, right) =>
        right.column - left.column || compareText(left.id, right.id),
    )[0]?.id;

  return blocks.map((block) => ({
    ...block,
    characterZone:
      block.id === anchorBlockId ? "civic-anchor" : block.characterZone,
  }));
}

function massingProfileFor(
  zone: UrbanCharacterZone,
  cornerIndex: number,
  hash: number,
): UrbanMassingProfile {
  const profiles: Record<UrbanCharacterZone, readonly UrbanMassingProfile[]> = {
    "loop-core": [
      "loop-podium-slab",
      "loop-setback-tower",
      "miesian-plaza-tower",
      "chicago-school-corner",
    ],
    "river-north": [
      "river-terrace-midrise",
      "river-corner-tower",
      "chicago-school-corner",
      "loop-setback-tower",
    ],
    "fulton-market": [
      "fulton-loft",
      "fulton-sawtooth-addition",
      "warehouse-glass-addition",
      "chicago-school-corner",
    ],
    "civic-anchor": ["civic-shoulder-landmark"],
  };
  const options = profiles[zone];
  return options[(cornerIndex + hash) % options.length]!;
}

function facadeFor(
  zone: UrbanCharacterZone,
  cornerIndex: number,
  hash: number,
): UrbanFacadeFamily {
  const families: Record<UrbanCharacterZone, readonly UrbanFacadeFamily[]> = {
    "loop-core": [
      "miesian-grid",
      "chicago-school-masonry",
      "blue-green-curtain-wall",
      "art-deco-setback",
      "bronze-vertical-modern",
    ],
    "river-north": [
      "riverfront-terrace",
      "chicago-school-masonry",
      "blue-green-curtain-wall",
      "narrow-storefront-row",
    ],
    "fulton-market": [
      "fulton-brick-warehouse",
      "narrow-storefront-row",
      "chicago-school-masonry",
      "blue-green-curtain-wall",
    ],
    "civic-anchor": ["civic-institutional"],
  };
  const options = families[zone];
  return options[(cornerIndex + hash) % options.length]!;
}

function curtainWallFor(
  family: UrbanFacadeFamily,
): UrbanCurtainWallVariant | null {
  if (family === "miesian-grid") return "dark-miesian-grid";
  if (family === "blue-green-curtain-wall") {
    return "light-blue-green-grid";
  }
  if (family === "bronze-vertical-modern") return "bronze-vertical-fins";
  return null;
}

function architecturalMaterialFor(
  family: UrbanFacadeFamily,
  hash: number,
): UrbanMaterialKey {
  if (family === "miesian-grid") return "dark-metal";
  if (family === "blue-green-curtain-wall") return "blue-green-glass";
  if (family === "bronze-vertical-modern") return "bronze-metal";
  if (family === "fulton-brick-warehouse") return "red-brick";
  if (family === "chicago-school-masonry") {
    return hash % 2 === 0 ? "cream-terra-cotta" : "red-brick";
  }
  if (family === "civic-institutional") return "limestone";
  if (family === "art-deco-setback") return "limestone";
  return ARCHITECTURAL_MATERIALS[hash % ARCHITECTURAL_MATERIALS.length]!;
}

function baseHeightFor(
  zone: UrbanCharacterZone,
  profile: UrbanMassingProfile,
  hash: number,
): number {
  const jitter = (hash % 19) * 0.16;
  if (profile === "civic-shoulder-landmark") return round(14.8 + jitter);
  if (zone === "loop-core") return round(11.5 + jitter * 1.8);
  if (profile === "river-corner-tower") return round(12.2 + jitter);
  if (zone === "river-north") return round(7.4 + jitter);
  return round(5.2 + jitter * 0.72);
}

function volume(
  envelope: UrbanArchitecturalEnvelope,
  kind: UrbanMassingKind,
  index: number,
  x: number,
  z: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  material = envelope.material,
): UrbanMassingVolume {
  return {
    id: stableId("mass", `${envelope.id}:${kind}:${index}`),
    architecturalEnvelopeId: envelope.id,
    componentId: envelope.componentId,
    blockId: envelope.blockId,
    kind,
    material,
    x: round(x),
    y: round(y),
    z: round(z),
    width: round(width),
    depth: round(depth),
    height: round(height),
    rotation: envelope.rotation,
  };
}

function massingForEnvelope(
  envelope: UrbanArchitecturalEnvelope,
): UrbanMassingVolume[] {
  const baseHeight = Math.min(3.4, envelope.height * 0.38);
  const volumes = [
    volume(
      envelope,
      "base",
      0,
      envelope.x,
      envelope.z,
      baseHeight / 2,
      envelope.width,
      envelope.depth,
      baseHeight,
    ),
  ];
  const upperHeight = envelope.height - baseHeight;
  if (upperHeight <= 0.4) return volumes;
  const isWarehouse =
    envelope.massingProfile === "fulton-loft" ||
    envelope.massingProfile === "fulton-sawtooth-addition";
  const isTower =
    envelope.massingProfile.includes("tower") ||
    envelope.massingProfile === "miesian-plaza-tower" ||
    envelope.massingProfile === "civic-shoulder-landmark";
  if (isTower && upperHeight > 5) {
    const shoulderHeight = Math.min(2.8, upperHeight * 0.34);
    volumes.push(
      volume(
        envelope,
        "shoulder",
        1,
        envelope.x,
        envelope.z,
        baseHeight + shoulderHeight / 2,
        envelope.width * 0.9,
        envelope.depth * 0.88,
        shoulderHeight,
      ),
    );
    const shaftHeight = upperHeight - shoulderHeight;
    volumes.push(
      volume(
        envelope,
        "shaft",
        2,
        envelope.x + envelope.width * 0.07,
        envelope.z - envelope.depth * 0.04,
        baseHeight + shoulderHeight + shaftHeight / 2,
        envelope.width * 0.63,
        envelope.depth * 0.66,
        shaftHeight,
      ),
    );
  } else {
    volumes.push(
      volume(
        envelope,
        isWarehouse ? "shaft" : "setback",
        1,
        envelope.x,
        envelope.z,
        baseHeight + upperHeight / 2,
        envelope.width * (isWarehouse ? 0.98 : 0.88),
        envelope.depth * (isWarehouse ? 0.98 : 0.86),
        upperHeight,
      ),
    );
  }
  if (
    envelope.height > 9 ||
    envelope.massingProfile === "warehouse-glass-addition"
  ) {
    const roofHeight = 0.34;
    volumes.push(
      volume(
        envelope,
        "roof-house",
        3,
        envelope.x,
        envelope.z,
        envelope.height + roofHeight / 2,
        envelope.width * 0.28,
        envelope.depth * 0.3,
        roofHeight,
        envelope.curtainWallVariant ? "dark-metal" : "slate",
      ),
    );
  }
  return volumes;
}

function storefrontPoint(
  envelope: UrbanArchitecturalEnvelope,
  edge: UrbanBlockEdge,
): CityPoint {
  if (edge === "north") return point(envelope.x, envelope.z - envelope.depth / 2 - 0.03);
  if (edge === "south") return point(envelope.x, envelope.z + envelope.depth / 2 + 0.03);
  if (edge === "west") return point(envelope.x - envelope.width / 2 - 0.03, envelope.z);
  return point(envelope.x + envelope.width / 2 + 0.03, envelope.z);
}

function morphologyMetrics(
  blocks: readonly UrbanBlock[],
  parcels: readonly UrbanArchitecturalParcel[],
  envelopes: readonly UrbanArchitecturalEnvelope[],
  volumes: readonly UrbanMassingVolume[],
  storefronts: readonly UrbanStorefront[],
): UrbanMorphologyMetrics {
  const perimeterFor = (selected: readonly UrbanBlock[]) =>
    selected.reduce((sum, block) => sum + 2 * (block.width + block.depth), 0);
  const frontageFor = (selected: readonly UrbanBlock[]) => {
    const ids = new Set(selected.map((block) => block.id));
    return parcels
      .filter((parcel) => ids.has(parcel.blockId))
      .reduce((sum, parcel) => sum + parcel.frontage, 0);
  };
  const coverageFor = (selected: readonly UrbanBlock[]) =>
    (100 * frontageFor(selected)) / Math.max(0.001, perimeterFor(selected));
  const unitCounts = blocks
    .map(
      (block) =>
        envelopes.filter((envelope) => envelope.blockId === block.id).length,
    )
    .sort((left, right) => left - right);
  const activeStorefrontWidth = storefronts
    .filter((storefront) => storefront.active)
    .reduce((sum, storefront) => sum + storefront.width, 0);
  const fultonBlocks = blocks.filter(
    (block) => block.characterZone === "fulton-market",
  );
  const fultonIds = new Set(fultonBlocks.map((block) => block.id));
  const fultonStorefrontWidth = storefronts
    .filter(
      (storefront) =>
        storefront.active && fultonIds.has(storefront.blockId),
    )
    .reduce((sum, storefront) => sum + storefront.width, 0);
  const loopBlocks = blocks.filter(
    (block) => block.characterZone === "loop-core",
  );
  let adjacentPairs = 0;
  let diversePairs = 0;
  for (const block of blocks) {
    const candidates = envelopes
      .filter((envelope) => envelope.blockId === block.id)
      .sort((left, right) => compareText(left.id, right.id));
    for (let index = 0; index < candidates.length; index += 1) {
      const left = candidates[index]!;
      const right = candidates[(index + 1) % candidates.length]!;
      const differences = [
        left.facadeFamily !== right.facadeFamily,
        left.material !== right.material,
        Math.floor(left.height / 3) !== Math.floor(right.height / 3),
        left.massingProfile !== right.massingProfile,
      ].filter(Boolean).length;
      adjacentPairs += 1;
      if (differences >= 2) diversePairs += 1;
    }
  }
  const cityCoverage = coverageFor(blocks);
  const loopCoverage = coverageFor(loopBlocks);
  const facadeInstanceCount = envelopes.reduce((sum, envelope) => {
    const curtain = envelope.curtainWallVariant !== null;
    const warehouse =
      envelope.facadeFamily === "fulton-brick-warehouse" ||
      envelope.facadeFamily === "narrow-storefront-row";
    const floorHeight = warehouse ? 1.25 : curtain ? 0.92 : 1.08;
    const floors = Math.max(
      2,
      Math.min(11, Math.floor(Math.max(2.4, envelope.height - 2.15) / floorHeight)),
    );
    const northBays = Math.max(
      2,
      Math.min(5, Math.floor(envelope.width / 0.84)),
    );
    const sideBays = Math.max(
      2,
      Math.min(5, Math.floor(envelope.depth / 0.84)),
    );
    const windows = floors * (northBays + sideBays);
    const frames = curtain
      ? floors * 2 + northBays + sideBays + 2
      : floors * (warehouse ? 2 : 0) + 2;
    return sum + windows + frames;
  }, 0);
  return {
    architecturalEnvelopeCount: envelopes.length,
    massingVolumeCount: volumes.length,
    storefrontCount: storefronts.length,
    facadeInstanceCount: facadeInstanceCount + storefronts.length * 5,
    medianFrontageUnitsPerBlock:
      unitCounts[Math.floor(unitCounts.length / 2)] ?? 0,
    frontageCoveragePct: round(cityCoverage),
    loopFrontageCoveragePct: round(loopCoverage),
    streetWallGapPct: round(100 - cityCoverage),
    loopStreetWallGapPct: round(100 - loopCoverage),
    activeGroundFloorPct: round(
      (100 * activeStorefrontWidth) /
        Math.max(0.001, parcels.reduce((sum, parcel) => sum + parcel.frontage, 0)),
    ),
    fultonActiveGroundFloorPct: round(
      (100 * fultonStorefrontWidth) /
        Math.max(0.001, frontageFor(fultonBlocks)),
    ),
    genericLawnRatioPct: 0,
    diverseAdjacentPairPct: round(
      (100 * diversePairs) / Math.max(1, adjacentPairs),
    ),
    landmarkRatioPct: round(
      (100 * envelopes.filter((envelope) => envelope.landmark).length) /
        Math.max(1, envelopes.length),
    ),
  };
}

function makeChicagoFabricDetails(
  seed: string,
  blocks: readonly UrbanBlock[],
  assignments: readonly UrbanComponentAssignment[],
  semanticBuildings: readonly UrbanBuildingEnvelope[],
): {
  architecturalParcels: UrbanArchitecturalParcel[];
  architecturalEnvelopes: UrbanArchitecturalEnvelope[];
  massingVolumes: UrbanMassingVolume[];
  storefronts: UrbanStorefront[];
  morphology: UrbanMorphologyMetrics;
} {
  const componentByBlockId = new Map<string, string>();
  for (const assignment of assignments) {
    for (const blockId of assignment.blockIds) {
      componentByBlockId.set(blockId, assignment.componentId);
    }
  }
  const buildingsByBlockId = new Map<string, UrbanBuildingEnvelope[]>();
  for (const building of semanticBuildings) {
    const candidates = buildingsByBlockId.get(building.blockId) ?? [];
    candidates.push(building);
    buildingsByBlockId.set(building.blockId, candidates);
  }
  const architecturalParcels: UrbanArchitecturalParcel[] = [];
  const architecturalEnvelopes: UrbanArchitecturalEnvelope[] = [];
  const storefronts: UrbanStorefront[] = [];
  const massingVolumes: UrbanMassingVolume[] = [];
  const cornerDefinitions = [
    { primary: "north" as const, secondary: "west" as const, sx: -1, sz: -1 },
    { primary: "north" as const, secondary: "east" as const, sx: 1, sz: -1 },
    { primary: "south" as const, secondary: "west" as const, sx: -1, sz: 1 },
    { primary: "south" as const, secondary: "east" as const, sx: 1, sz: 1 },
  ];

  for (const block of [...blocks].sort((left, right) => compareText(left.id, right.id))) {
    const componentId = componentByBlockId.get(block.id);
    const semanticCandidates = (buildingsByBlockId.get(block.id) ?? []).sort(
      (left, right) => compareText(left.id, right.id),
    );
    if (!componentId || semanticCandidates.length === 0) continue;
    const inset = 0.26;
    const courtyardGap = block.characterZone === "fulton-market" ? 0.54 : 0.38;
    const blockHash = stableCityHash(`${seed}:${block.id}:character`);
    const width = (block.width - inset * 2 - courtyardGap) / 2;
    const depth = (block.depth - inset * 2 - courtyardGap) / 2;
    for (const [cornerIndex, corner] of cornerDefinitions.entries()) {
      const semanticBuilding = semanticCandidates[cornerIndex % semanticCandidates.length]!;
      const parcelId = stableId("frontage-parcel", `${seed}:${block.id}:${cornerIndex}`);
      const envelopeId = stableId("architecture", `${seed}:${block.id}:${cornerIndex}`);
      const hash = stableCityHash(`${seed}:${block.id}:${cornerIndex}`);
      const facadeFamily = facadeFor(
        block.characterZone,
        cornerIndex,
        blockHash,
      );
      const massingProfile = massingProfileFor(
        block.characterZone,
        cornerIndex,
        blockHash,
      );
      const x = block.x + corner.sx * (courtyardGap / 4 + width / 2);
      const z = block.z + corner.sz * (courtyardGap / 4 + depth / 2);
      const landmark = block.characterZone === "civic-anchor" && cornerIndex === 0;
      const envelope: UrbanArchitecturalEnvelope = {
        id: envelopeId,
        semanticBuildingId: semanticBuilding.id,
        componentId,
        blockId: block.id,
        parcelId,
        characterZone: block.characterZone,
        facadeFamily,
        curtainWallVariant: curtainWallFor(facadeFamily),
        massingProfile,
        material: architecturalMaterialFor(facadeFamily, hash),
        x: round(x),
        z: round(z),
        width: round(width),
        depth: round(depth),
        height: baseHeightFor(block.characterZone, massingProfile, hash),
        rotation: 0,
        primaryEdge: corner.primary,
        secondaryEdge: corner.secondary,
        primaryStreetId: block.streetIdsByEdge[corner.primary],
        secondaryStreetId: block.streetIdsByEdge[corner.secondary],
        entrance: point(
          x,
          block.z + corner.sz * (block.depth / 2 + STREET_GAP / 2),
        ),
        landmark,
      };
      architecturalParcels.push({
        id: parcelId,
        blockId: block.id,
        componentId,
        architecturalEnvelopeId: envelopeId,
        x: envelope.x,
        z: envelope.z,
        width: envelope.width,
        depth: envelope.depth,
        primaryEdge: corner.primary,
        secondaryEdge: corner.secondary,
        frontage: round(envelope.width + envelope.depth),
      });
      architecturalEnvelopes.push(envelope);
      massingVolumes.push(...massingForEnvelope(envelope));

      const storefrontEdges: UrbanBlockEdge[] = landmark
        ? [corner.primary]
        : [corner.primary, corner.secondary];
      storefrontEdges.forEach((edge, storefrontIndex) => {
        const categoryIndex =
          (hash + cornerIndex + storefrontIndex) % STOREFRONT_CATEGORIES.length;
        const category = STOREFRONT_CATEGORIES[categoryIndex]!;
        const position = storefrontPoint(envelope, edge);
        storefronts.push({
          id: stableId("storefront", `${envelope.id}:${edge}`),
          architecturalEnvelopeId: envelope.id,
          componentId,
          blockId: block.id,
          category,
          signLabel: STORE_LABELS[categoryIndex]!,
          streetId:
            edge === corner.primary
              ? envelope.primaryStreetId
              : envelope.secondaryStreetId,
          edge,
          x: position.x,
          z: position.z,
          width: round(
            (edge === "north" || edge === "south"
              ? envelope.width
              : envelope.depth) * 0.72,
          ),
          rotation: edge === "east" || edge === "west" ? Math.PI / 2 : 0,
          active: block.characterZone !== "civic-anchor" || !landmark,
        });
      });
    }
  }

  architecturalParcels.sort((left, right) => compareText(left.id, right.id));
  architecturalEnvelopes.sort((left, right) => compareText(left.id, right.id));
  massingVolumes.sort((left, right) => compareText(left.id, right.id));
  storefronts.sort((left, right) => compareText(left.id, right.id));
  return {
    architecturalParcels,
    architecturalEnvelopes,
    massingVolumes,
    storefronts,
    morphology: morphologyMetrics(
      blocks,
      architecturalParcels,
      architecturalEnvelopes,
      massingVolumes,
      storefronts,
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
  seed,
}: PlanUrbanFabricInput): UrbanFabricPlan {
  const architectureSeed = seed ?? semanticPlan.seed;
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
  const rawBlocks = bankFabrics
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
  const blocks = characterZoneBlocks(
    rawBlocks,
    componentAssignments,
    semanticPlan.components,
  );
  const built = makeBuildingsAndParcels(
    semanticPlan,
    blocks,
    componentAssignments,
  );
  const chicago = makeChicagoFabricDetails(
    architectureSeed,
    blocks,
    componentAssignments,
    built.buildings,
  );
  const bounds = fabricBounds(streets, blocks, semanticPlan.bounds);

  return {
    version: URBAN_FABRIC_VERSION,
    seed: `urban-${stableCityHash(
      `${architectureSeed}:${blocks.map((block) => block.id).join(":")}`,
    )
      .toString(16)
      .padStart(8, "0")}`,
    bounds,
    streets,
    blocks,
    componentAssignments,
    parcels: built.parcels,
    buildings: built.buildings,
    architecturalParcels: chicago.architecturalParcels,
    architecturalEnvelopes: chicago.architecturalEnvelopes,
    massingVolumes: chicago.massingVolumes,
    storefronts: chicago.storefronts,
    morphology: chicago.morphology,
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

export function selectedUrbanEnvelopes(
  plan: UrbanFabricPlan,
  componentId: string | null | undefined,
): UrbanArchitecturalEnvelope[] {
  if (!componentId) return [];
  return plan.architecturalEnvelopes.filter(
    (envelope) => envelope.componentId === componentId,
  );
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
