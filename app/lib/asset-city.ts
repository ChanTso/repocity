import type { UrbanFabricPlan } from "./urban-fabric";
import type { VisualCityPlan } from "./visual-city";

export const ASSET_CITY_VERSION = "4.2" as const;
export const CITY_KIT_ROOT = "/assets/city-kit-v1" as const;

export type HeroAssetNode =
  | "masonry-building"
  | "limestone-office"
  | "miesian-grid-tower"
  | "blue-unitized-tower"
  | "bronze-fin-tower";

export interface AssetHeroBuildingPlacement {
  id: string;
  envelopeId: string;
  semanticBuildingId: string;
  primaryEntityId: string;
  componentId: string;
  blockId: string;
  source: "masonry-modules.glb" | "office-modules.glb" | "curtain-wall-modules.glb";
  node: HeroAssetNode;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  storefrontBays: number;
}

export type StreetAssetNode =
  | "street-lamp"
  | "traffic-signal"
  | "transit-shelter"
  | "parked-car"
  | "street-bench"
  | "street-planter"
  | "parked-bike"
  | "static-pedestrian"
  | "street-utility";

export interface VisualContextAssetPlacement {
  id: string;
  node: StreetAssetNode;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  semantic: false;
}

export interface RiverEdgeAssetPlacement {
  id: string;
  node: "river-edge" | "bridge-abutment";
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: [number, number, number];
  semantic: false;
}

export interface AssetBackedHeroPlan {
  version: typeof ASSET_CITY_VERSION;
  buildings: AssetHeroBuildingPlacement[];
  visualContext: VisualContextAssetPlacement[];
  riverEdge: RiverEdgeAssetPlacement[];
  proofBlockIds: string[];
  replacedEnvelopeIds: string[];
  visibleStorefrontBayCount: number;
}

const HERO_ASSETS: readonly {
  source: AssetHeroBuildingPlacement["source"];
  node: HeroAssetNode;
  storefrontBays: number;
}[] = [
  {
    source: "curtain-wall-modules.glb",
    node: "miesian-grid-tower",
    storefrontBays: 2,
  },
  {
    source: "office-modules.glb",
    node: "limestone-office",
    storefrontBays: 2,
  },
  {
    source: "masonry-modules.glb",
    node: "masonry-building",
    storefrontBays: 4,
  },
  {
    source: "curtain-wall-modules.glb",
    node: "blue-unitized-tower",
    storefrontBays: 2,
  },
  {
    source: "curtain-wall-modules.glb",
    node: "bronze-fin-tower",
    storefrontBays: 2,
  },
] as const;

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function makeVisualContext(
  buildings: readonly AssetHeroBuildingPlacement[],
): VisualContextAssetPlacement[] {
  const nodes: StreetAssetNode[] = [
    "street-lamp",
    "parked-car",
    "street-planter",
    "parked-bike",
    "street-bench",
    "static-pedestrian",
    "street-utility",
  ];
  const placements: VisualContextAssetPlacement[] = [];
  for (const [buildingIndex, building] of buildings.entries()) {
    const forwardX = Math.sin(building.rotation);
    const forwardZ = Math.cos(building.rotation);
    const tangentX = Math.cos(building.rotation);
    const tangentZ = -Math.sin(building.rotation);
    const streetOffset = building.depth * 0.56 + 0.42;
    for (let item = 0; item < 2; item += 1) {
      const node = nodes[(buildingIndex * 2 + item) % nodes.length]!;
      const side = item === 0 ? -1 : 1;
      placements.push({
        id: `visual-context-${building.envelopeId}-${node}`,
        node,
        x: Number((building.x + forwardX * streetOffset + tangentX * side * building.width * 0.28).toFixed(3)),
        y: 0.26,
        z: Number((building.z + forwardZ * streetOffset + tangentZ * side * building.width * 0.28).toFixed(3)),
        rotation: building.rotation + (node === "parked-car" || node === "parked-bike" ? Math.PI / 2 : 0),
        scale: node === "street-planter" ? 0.85 : node === "static-pedestrian" ? 0.9 : 1,
        semantic: false,
      });
    }
  }
  const anchor = buildings[0];
  if (anchor) {
    placements.push(
      {
        id: "visual-context-hero-signal",
        node: "traffic-signal",
        x: Number((anchor.x - anchor.width * 0.7).toFixed(3)),
        y: 0.26,
        z: Number((anchor.z + anchor.depth * 0.75).toFixed(3)),
        rotation: anchor.rotation,
        scale: 1.2,
        semantic: false,
      },
      {
        id: "visual-context-transit-shelter",
        node: "transit-shelter",
        x: Number((anchor.x + anchor.width * 0.78).toFixed(3)),
        y: 0.26,
        z: Number((anchor.z + anchor.depth * 0.67).toFixed(3)),
        rotation: anchor.rotation,
        scale: 1.05,
        semantic: false,
      },
    );
  }
  return placements;
}

function makeRiverEdge(
  visualCity: VisualCityPlan,
  urbanFabric: UrbanFabricPlan,
): RiverEdgeAssetPlacement[] {
  const [start, end] = visualCity.river.centerline;
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const rotation = -Math.atan2(end.z - start.z, end.x - start.x);
  const centerZ = (start.z + end.z) / 2;
  const bridge = urbanFabric.streets.find((street) => street.id === visualCity.hero.bridgeStreetId);
  const bridgeZ = bridge?.z ?? visualCity.hero.cameraTarget.z;
  return [
    {
      id: "visual-context-west-river-wall",
      node: "river-edge",
      x: visualCity.river.minX - 0.08,
      y: -0.18,
      z: centerZ,
      rotation,
      scale: [length, 1.55, 1],
      semantic: false,
    },
    {
      id: "visual-context-east-river-wall",
      node: "river-edge",
      x: visualCity.river.maxX + 0.08,
      y: -0.18,
      z: centerZ,
      rotation,
      scale: [length, 1.55, 1],
      semantic: false,
    },
    {
      id: "visual-context-west-bridge-abutment",
      node: "bridge-abutment",
      x: visualCity.river.minX - 0.3,
      y: -0.18,
      z: bridgeZ,
      rotation: 0,
      scale: [1.6, 1.4, 2.3],
      semantic: false,
    },
    {
      id: "visual-context-east-bridge-abutment",
      node: "bridge-abutment",
      x: visualCity.river.maxX + 0.3,
      y: -0.18,
      z: bridgeZ,
      rotation: 0,
      scale: [1.6, 1.4, 2.3],
      semantic: false,
    },
  ];
}

export function planAssetBackedHero(
  urbanFabric: UrbanFabricPlan,
  visualCity: VisualCityPlan,
): AssetBackedHeroPlan {
  const semanticBuildingById = new Map(
    urbanFabric.buildings.map((building) => [building.id, building]),
  );
  const gateway = visualCity.hero.blocks.find(
    (block) => block.role === "riverfront-bridge-gateway",
  ) ?? visualCity.hero.blocks[0];
  if (!gateway) throw new Error("V4.2 asset proof requires a hero gateway block");
  const neighbor = visualCity.hero.blocks
    .filter((candidate) => gateway.block.adjacentBlockIds.includes(candidate.blockId))
    .toSorted(
      (left, right) =>
        Math.hypot(
          left.block.x - visualCity.hero.cameraTarget.x,
          left.block.z - visualCity.hero.cameraTarget.z,
        ) -
          Math.hypot(
            right.block.x - visualCity.hero.cameraTarget.x,
            right.block.z - visualCity.hero.cameraTarget.z,
          ) ||
        compareText(left.blockId, right.blockId),
    )[0];
  if (!neighbor) throw new Error("V4.2 asset proof requires an adjacent hero block");
  const proofBlockIds = [gateway.blockId, neighbor.blockId].toSorted(compareText);
  const envelopeOrder = (
    left: UrbanFabricPlan["architecturalEnvelopes"][number],
    right: UrbanFabricPlan["architecturalEnvelopes"][number],
  ) =>
    left.z - right.z ||
    left.x - right.x ||
    compareText(left.id, right.id);
  const envelopes = [gateway.blockId, neighbor.blockId].flatMap(
    (blockId, blockIndex) => urbanFabric.architecturalEnvelopes
      .filter((envelope) => envelope.blockId === blockId)
      .toSorted(envelopeOrder)
      .slice(0, blockIndex === 0 ? 3 : 2),
  ).toSorted(
      (left, right) =>
        left.blockId.localeCompare(right.blockId, "en") ||
        envelopeOrder(left, right),
    );
  if (envelopes.length < HERO_ASSETS.length) {
    throw new Error(`V4.2 asset proof requires five envelopes, received ${envelopes.length}`);
  }
  const buildings = HERO_ASSETS.map((asset, index) => {
    const envelope = envelopes[index]!;
    const semantic = semanticBuildingById.get(envelope.semanticBuildingId);
    if (!semantic) throw new Error(`Missing semantic building ${envelope.semanticBuildingId}`);
    return {
      id: `asset-building-${envelope.id}`,
      envelopeId: envelope.id,
      semanticBuildingId: envelope.semanticBuildingId,
      primaryEntityId: semantic.primaryEntityId,
      componentId: envelope.componentId,
      blockId: envelope.blockId,
      source: asset.source,
      node: asset.node,
      x: envelope.x,
      y: 0.24,
      z: envelope.z,
      width: Number((envelope.width * 1.12).toFixed(3)),
      height: Number((envelope.height * 1.08).toFixed(3)),
      depth: Number((envelope.depth * 1.12).toFixed(3)),
      rotation: envelope.rotation,
      storefrontBays: asset.storefrontBays,
    } satisfies AssetHeroBuildingPlacement;
  }).toSorted((left, right) => compareText(left.node, right.node));

  if (buildings.length !== 5) {
    throw new Error(`V4.2 asset proof expected five principal buildings, received ${buildings.length}`);
  }
  const visibleStorefrontBayCount = buildings.reduce(
    (total, building) => total + building.storefrontBays,
    0,
  );
  return {
    version: ASSET_CITY_VERSION,
    buildings,
    visualContext: makeVisualContext(buildings),
    riverEdge: makeRiverEdge(visualCity, urbanFabric),
    proofBlockIds,
    replacedEnvelopeIds: urbanFabric.architecturalEnvelopes
      .filter((envelope) => proofBlockIds.includes(envelope.blockId))
      .map((envelope) => envelope.id)
      .toSorted(compareText),
    visibleStorefrontBayCount,
  };
}
