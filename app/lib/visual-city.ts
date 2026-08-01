import { stableCityHash } from "./city-visuals";
import type { CityBounds, CityPoint } from "./living-city";
import type { SemanticCityPlan } from "./semantic-city";
import type { UrbanBlock, UrbanFabricPlan } from "./urban-fabric";

export const VISUAL_CITY_VERSION = "4.1" as const;
export const VISUAL_CITY_WORLD_UNIT_METERS = 3 as const;

export type HeroBlockRole =
  | "riverfront-bridge-gateway"
  | "fulton-brick-market-a"
  | "fulton-brick-market-b"
  | "loop-masonry-streetwall"
  | "modern-glass-corner"
  | "civic-podium-tower";

export type HeroFacadeSystem =
  | "fulton-warehouse-brick"
  | "chicago-school-terra-cotta"
  | "loop-limestone-bay"
  | "miesian-black-grid"
  | "blue-green-unitized-glass"
  | "bronze-vertical-fins";

export type HeroCurtainWallSystem =
  | "miesian-black-grid"
  | "blue-green-unitized-glass"
  | "bronze-vertical-fins";

export interface VisualHeroBlock {
  blockId: string;
  role: HeroBlockRole;
  facadeSystem: HeroFacadeSystem;
  block: UrbanBlock;
}

export interface VisualHeroDistrict {
  id: "chicago-river-vertical-slice";
  blockIds: string[];
  blocks: VisualHeroBlock[];
  bridgeStreetId: string;
  bounds: CityBounds;
  cameraTarget: CityPoint & { y: number };
}

export interface VisualContextBlock {
  contextId: string;
  ring: 1 | 2 | 3;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface VisualContextBuilding {
  contextId: string;
  blockContextId: string;
  ring: 1 | 2 | 3;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  material: "brick" | "limestone" | "concrete" | "dark-glass";
  roof: "flat" | "mechanical" | "setback";
}

export interface VisualContextRoad {
  contextId: string;
  ring: 1 | 2 | 3;
  centerline: [CityPoint, CityPoint];
  width: number;
}

export interface VisualRiverCorridor {
  contextId: "context-chicago-river";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerline: [CityPoint, CityPoint];
}

export interface VisualCityMetrics {
  heroBlockCount: number;
  heroArchitecturalEnvelopeCount: number;
  heroStorefrontCount: number;
  activeHeroStorefrontCount: number;
  heroFacadeSystemCount: number;
  heroCurtainWallSystemCount: number;
  contextRingCount: number;
  contextBlockCount: number;
  contextBuildingCount: number;
  continuousRiverSegmentCount: number;
  estimatedUnusedGreenPct: number;
}

export interface VisualCityPlan {
  version: typeof VISUAL_CITY_VERSION;
  seed: string;
  worldUnitMeters: typeof VISUAL_CITY_WORLD_UNIT_METERS;
  interactionPolicy: "semantic-core-only";
  planningPolicy: "memoized-before-render";
  hero: VisualHeroDistrict;
  contextBounds: CityBounds;
  contextBlocks: VisualContextBlock[];
  contextBuildings: VisualContextBuilding[];
  contextRoads: VisualContextRoad[];
  river: VisualRiverCorridor;
  facadeSystems: HeroFacadeSystem[];
  curtainWallSystems: HeroCurtainWallSystem[];
  metrics: VisualCityMetrics;
}

export interface PlanVisualCityInput {
  semanticPlan: SemanticCityPlan;
  urbanFabric: UrbanFabricPlan;
  seed?: string;
}

const HERO_ROLES: readonly HeroBlockRole[] = [
  "riverfront-bridge-gateway",
  "loop-masonry-streetwall",
  "modern-glass-corner",
  "fulton-brick-market-a",
  "fulton-brick-market-b",
  "civic-podium-tower",
];

const HERO_FACADES: readonly HeroFacadeSystem[] = [
  "blue-green-unitized-glass",
  "loop-limestone-bay",
  "miesian-black-grid",
  "fulton-warehouse-brick",
  "chicago-school-terra-cotta",
  "bronze-vertical-fins",
];

const CURTAIN_WALLS: readonly HeroCurtainWallSystem[] = [
  "miesian-black-grid",
  "blue-green-unitized-glass",
  "bronze-vertical-fins",
];

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function makeBounds(blocks: readonly UrbanBlock[], margin = 0): CityBounds {
  const minX = Math.min(...blocks.map((block) => block.x - block.width / 2)) - margin;
  const maxX = Math.max(...blocks.map((block) => block.x + block.width / 2)) + margin;
  const minZ = Math.min(...blocks.map((block) => block.z - block.depth / 2)) - margin;
  const maxZ = Math.max(...blocks.map((block) => block.z + block.depth / 2)) + margin;
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

function selectHeroBlocks(urbanFabric: UrbanFabricPlan): {
  blocks: UrbanBlock[];
  bridgeStreetId: string;
} {
  const bridge = urbanFabric.streets
    .filter((street) => street.surface === "bridge")
    .sort((left, right) =>
      Math.abs(left.z - urbanFabric.bounds.z) -
        Math.abs(right.z - urbanFabric.bounds.z) || compareText(left.id, right.id),
    )[0];
  if (!bridge) throw new Error("V4.1 hero district requires an existing bridge");

  const westBlocks = urbanFabric.blocks.filter((block) => block.bank === "west");
  const rows = [...new Set(westBlocks.map((block) => block.row))]
    .sort((left, right) => {
      const leftZ = westBlocks.find((block) => block.row === left)?.z ?? 0;
      const rightZ = westBlocks.find((block) => block.row === right)?.z ?? 0;
      return Math.abs(leftZ - bridge.z) - Math.abs(rightZ - bridge.z) || left - right;
    })
    .slice(0, 2)
    .sort((left, right) => left - right);
  const selected = westBlocks
    .filter((block) => rows.includes(block.row))
    .sort((left, right) => left.row - right.row || left.column - right.column);
  if (selected.length !== 6) {
    throw new Error(`V4.1 hero district expected six blocks, received ${selected.length}`);
  }
  return { blocks: selected, bridgeStreetId: bridge.id };
}

function isConnected(blocks: readonly UrbanBlock[]): boolean {
  if (blocks.length === 0) return false;
  const allowed = new Set(blocks.map((block) => block.id));
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const queue = [blocks[0]!.id];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const adjacentId of byId.get(id)?.adjacentBlockIds ?? []) {
      if (allowed.has(adjacentId) && !visited.has(adjacentId)) queue.push(adjacentId);
    }
  }
  return visited.size === blocks.length;
}

function contextMaterial(hash: number): VisualContextBuilding["material"] {
  return (["brick", "limestone", "concrete", "dark-glass"] as const)[hash % 4]!;
}

function makeContext(
  urbanFabric: UrbanFabricPlan,
  riverMinX: number,
  riverMaxX: number,
  seed: string,
): {
  bounds: CityBounds;
  blocks: VisualContextBlock[];
  buildings: VisualContextBuilding[];
  roads: VisualContextRoad[];
} {
  const exemplar = urbanFabric.blocks[0]!;
  const blockWidth = exemplar.width;
  const blockDepth = exemplar.depth;
  const pitchX = blockWidth + Math.max(3.2, blockWidth * 0.34);
  const pitchZ = blockDepth + Math.max(3.2, blockDepth * 0.4);
  const columns = Math.ceil(urbanFabric.bounds.width / (pitchX * 2));
  const rows = Math.ceil(urbanFabric.bounds.depth / (pitchZ * 2));
  const blocks: VisualContextBlock[] = [];
  const buildings: VisualContextBuilding[] = [];
  const roads: VisualContextRoad[] = [];

  for (let ring = 1 as 1 | 2 | 3; ring <= 3; ring = (ring + 1) as 1 | 2 | 3) {
    const xLimit = columns + ring;
    const zLimit = rows + ring;
    for (let gx = -xLimit; gx <= xLimit; gx += 1) {
      for (let gz = -zLimit; gz <= zLimit; gz += 1) {
        if (Math.abs(gx) !== xLimit && Math.abs(gz) !== zLimit) continue;
        const x = urbanFabric.bounds.x + gx * pitchX;
        const z = urbanFabric.bounds.z + gz * pitchZ;
        if (x + blockWidth / 2 > riverMinX - 0.6 && x - blockWidth / 2 < riverMaxX + 0.6) {
          continue;
        }
        const contextId = `context-block-r${ring}-${gx + xLimit}-${gz + zLimit}`;
        blocks.push({ contextId, ring, x: round(x), z: round(z), width: blockWidth, depth: blockDepth });
        const hash = stableCityHash(`${seed}:${contextId}`);
        const buildingCount = ring === 1 ? 4 : ring === 2 ? 3 : 2;
        for (let index = 0; index < buildingCount; index += 1) {
          const sx = index % 2 === 0 ? -1 : 1;
          const sz = index < 2 ? -1 : 1;
          const width = blockWidth * (buildingCount === 2 ? 0.78 : 0.42);
          const depth = blockDepth * (buildingCount === 2 ? 0.42 : 0.42);
          const localHash = stableCityHash(`${seed}:${contextId}:${index}`);
          buildings.push({
            contextId: `context-building-${contextId}-${index}`,
            blockContextId: contextId,
            ring,
            x: round(x + sx * blockWidth * (buildingCount === 2 ? 0.06 : 0.24)),
            z: round(z + sz * blockDepth * 0.24),
            width: round(width),
            depth: round(depth),
            height: round(Math.max(3.8, 14 - ring * 2.35 + (localHash % 9) * 0.72)),
            material: contextMaterial(localHash),
            roof: (["flat", "mechanical", "setback"] as const)[(hash + index) % 3]!,
          });
        }
      }
    }
  }
  const roadKeys = new Set(roads.map((road) => road.contextId));
  for (const block of blocks) {
    const horizontalId = `context-road-grid-z-${block.z.toFixed(2)}`;
    if (!roadKeys.has(horizontalId)) {
      roadKeys.add(horizontalId);
      roads.push({
        contextId: horizontalId,
        ring: block.ring,
        centerline: [
          { x: contextMin(blocks, "x"), z: block.z - block.depth / 2 - (pitchZ - blockDepth) / 2 },
          { x: contextMax(blocks, "x"), z: block.z - block.depth / 2 - (pitchZ - blockDepth) / 2 },
        ],
        width: Math.max(2.2, pitchZ - blockDepth),
      });
    }
    const verticalId = `context-road-grid-x-${block.x.toFixed(2)}`;
    if (!roadKeys.has(verticalId)) {
      roadKeys.add(verticalId);
      roads.push({
        contextId: verticalId,
        ring: block.ring,
        centerline: [
          { x: block.x - block.width / 2 - (pitchX - blockWidth) / 2, z: contextMin(blocks, "z") },
          { x: block.x - block.width / 2 - (pitchX - blockWidth) / 2, z: contextMax(blocks, "z") },
        ],
        width: Math.max(2.2, pitchX - blockWidth),
      });
    }
  }

  const outerX = Math.max(...blocks.map((block) => Math.abs(block.x - urbanFabric.bounds.x))) + pitchX / 2;
  const outerZ = Math.max(...blocks.map((block) => Math.abs(block.z - urbanFabric.bounds.z))) + pitchZ / 2;
  for (let ring = 1 as 1 | 2 | 3; ring <= 3; ring = (ring + 1) as 1 | 2 | 3) {
    const insetX = outerX - (3 - ring) * pitchX;
    const insetZ = outerZ - (3 - ring) * pitchZ;
    roads.push(
      { contextId: `context-road-r${ring}-north`, ring, centerline: [{ x: urbanFabric.bounds.x - insetX, z: urbanFabric.bounds.z - insetZ }, { x: urbanFabric.bounds.x + insetX, z: urbanFabric.bounds.z - insetZ }], width: Math.max(2.2, pitchZ - blockDepth) },
      { contextId: `context-road-r${ring}-south`, ring, centerline: [{ x: urbanFabric.bounds.x - insetX, z: urbanFabric.bounds.z + insetZ }, { x: urbanFabric.bounds.x + insetX, z: urbanFabric.bounds.z + insetZ }], width: Math.max(2.2, pitchZ - blockDepth) },
      { contextId: `context-road-r${ring}-west`, ring, centerline: [{ x: urbanFabric.bounds.x - insetX, z: urbanFabric.bounds.z - insetZ }, { x: urbanFabric.bounds.x - insetX, z: urbanFabric.bounds.z + insetZ }], width: Math.max(2.2, pitchX - blockWidth) },
      { contextId: `context-road-r${ring}-east`, ring, centerline: [{ x: urbanFabric.bounds.x + insetX, z: urbanFabric.bounds.z - insetZ }, { x: urbanFabric.bounds.x + insetX, z: urbanFabric.bounds.z + insetZ }], width: Math.max(2.2, pitchX - blockWidth) },
    );
  }
  const bounds: CityBounds = {
    minX: round(urbanFabric.bounds.x - outerX),
    maxX: round(urbanFabric.bounds.x + outerX),
    minZ: round(urbanFabric.bounds.z - outerZ),
    maxZ: round(urbanFabric.bounds.z + outerZ),
    x: urbanFabric.bounds.x,
    z: urbanFabric.bounds.z,
    width: round(outerX * 2),
    depth: round(outerZ * 2),
  };
  return { bounds, blocks, buildings, roads };
}

function contextMin(blocks: readonly VisualContextBlock[], axis: "x" | "z"): number {
  return Math.min(...blocks.map((block) => block[axis] - (axis === "x" ? block.width : block.depth) / 2));
}

function contextMax(blocks: readonly VisualContextBlock[], axis: "x" | "z"): number {
  return Math.max(...blocks.map((block) => block[axis] + (axis === "x" ? block.width : block.depth) / 2));
}

export function planVisualCity({
  semanticPlan,
  urbanFabric,
  seed = semanticPlan.seed,
}: PlanVisualCityInput): VisualCityPlan {
  const selected = selectHeroBlocks(urbanFabric);
  if (!isConnected(selected.blocks)) throw new Error("V4.1 hero district must be connected");
  const heroBlocks = selected.blocks.map((block, index) => ({
    blockId: block.id,
    role: HERO_ROLES[index]!,
    facadeSystem: HERO_FACADES[index]!,
    block,
  }));
  const heroBounds = makeBounds(selected.blocks, 2.2);
  const waterPoints = semanticPlan.terrain.waterBoundaries.flatMap((boundary) => boundary.outline);
  const riverMinX = waterPoints.length > 0 ? Math.min(...waterPoints.map((point) => point.x)) : urbanFabric.bounds.x - 2.4;
  const riverMaxX = waterPoints.length > 0 ? Math.max(...waterPoints.map((point) => point.x)) : urbanFabric.bounds.x + 2.4;
  const context = makeContext(urbanFabric, riverMinX, riverMaxX, seed);
  const heroBlockIds = new Set(heroBlocks.map((item) => item.blockId));
  const heroEnvelopeIds = new Set(
    urbanFabric.architecturalEnvelopes
      .filter((envelope) => heroBlockIds.has(envelope.blockId))
      .map((envelope) => envelope.id),
  );
  const heroStorefronts = urbanFabric.storefronts.filter((storefront) => heroBlockIds.has(storefront.blockId));
  const planSeed = `visual-${stableCityHash(`${seed}:${heroBlocks.map((item) => item.blockId).join(":")}`).toString(16).padStart(8, "0")}`;
  return {
    version: VISUAL_CITY_VERSION,
    seed: planSeed,
    worldUnitMeters: VISUAL_CITY_WORLD_UNIT_METERS,
    interactionPolicy: "semantic-core-only",
    planningPolicy: "memoized-before-render",
    hero: {
      id: "chicago-river-vertical-slice",
      blockIds: heroBlocks.map((item) => item.blockId),
      blocks: heroBlocks,
      bridgeStreetId: selected.bridgeStreetId,
      bounds: heroBounds,
      cameraTarget: {
        x: round(heroBounds.x + heroBounds.width * 0.14),
        y: 3.2,
        z: heroBounds.z,
      },
    },
    contextBounds: context.bounds,
    contextBlocks: context.blocks,
    contextBuildings: context.buildings,
    contextRoads: context.roads,
    river: {
      contextId: "context-chicago-river",
      minX: round(riverMinX),
      maxX: round(riverMaxX),
      minZ: context.bounds.minZ,
      maxZ: context.bounds.maxZ,
      centerline: [
        { x: round((riverMinX + riverMaxX) / 2), z: context.bounds.minZ },
        { x: round((riverMinX + riverMaxX) / 2), z: context.bounds.maxZ },
      ],
    },
    facadeSystems: [...HERO_FACADES],
    curtainWallSystems: [...CURTAIN_WALLS],
    metrics: {
      heroBlockCount: heroBlocks.length,
      heroArchitecturalEnvelopeCount: heroEnvelopeIds.size,
      heroStorefrontCount: heroStorefronts.length,
      activeHeroStorefrontCount: heroStorefronts.filter((storefront) => storefront.active).length,
      heroFacadeSystemCount: HERO_FACADES.length,
      heroCurtainWallSystemCount: CURTAIN_WALLS.length,
      contextRingCount: 3,
      contextBlockCount: context.blocks.length,
      contextBuildingCount: context.buildings.length,
      continuousRiverSegmentCount: 1,
      estimatedUnusedGreenPct: 8,
    },
  };
}
