import type { UrbanFabricPlan } from "./urban-fabric";
import type { VisualCityPlan } from "./visual-city";
import { planChicagoKitV2 } from "./chicago-kit-v2";

export const ASSET_CITY_VERSION = "4.3" as const;
export const CITY_KIT_ROOT = "/assets/city-kit-v1" as const;
export const NON_SEMANTIC_URBAN_CONTEXT = "NON_SEMANTIC_URBAN_CONTEXT" as const;

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

export type StreetProgramNode =
  | "cafe-storefront"
  | "restaurant-storefront"
  | "bookstore-storefront"
  | "market-storefront"
  | "gallery-storefront"
  | "office-lobby"
  | "residential-entry"
  | "service-loading";

export interface StreetProgramPlacement {
  id: string;
  node: StreetProgramNode;
  ownerEntityId: string;
  ownerBuildingId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: [number, number, number];
  semantic: false;
  layer: typeof NON_SEMANTIC_URBAN_CONTEXT;
  routedToOwner: true;
}

export type StreetDetailNode =
  | "sidewalk-pavers"
  | "curb-gutter"
  | "loading-zone"
  | "waterfront-walk"
  | "river-stairs";

export interface StreetDetailPlacement {
  id: string;
  node: StreetDetailNode;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: [number, number, number];
  semantic: false;
  layer: typeof NON_SEMANTIC_URBAN_CONTEXT;
}

export const HERO_FACADE_LANGUAGES = [
  "brick-warehouse",
  "stone-prewar-office",
  "dark-steel-modernist",
  "light-contemporary-curtain-wall",
] as const;

export const HERO_GLASS_SYSTEMS = {
  "dark-steel-modernist": { glass: "smoked-curtain-glass", frame: "dark-structural-steel", opacity: 0.82, roughness: 0.2 },
  "blue-green-office": { glass: "blue-green-curtain-glass", frame: "blue-green-spandrel", opacity: 0.76, roughness: 0.24 },
  "transparent-podium": { glass: "clear-podium-glass", frame: "weathered-bronze", opacity: 0.58, roughness: 0.1 },
} as const;

export type AssetReviewCameraId =
  | "street-corner"
  | "storefront-street"
  | "river-bridge"
  | "glass-facade"
  | "urban-composition"
  | "public-alpha-hero"
  | "civic-anchor"
  | "riverfront-tower";

export interface AssetReviewCameraPreset {
  id: AssetReviewCameraId;
  key: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface AssetBackedHeroPlan {
  version: typeof ASSET_CITY_VERSION;
  buildings: AssetHeroBuildingPlacement[];
  visualContext: VisualContextAssetPlacement[];
  streetPrograms: StreetProgramPlacement[];
  streetDetails: StreetDetailPlacement[];
  riverEdge: RiverEdgeAssetPlacement[];
  proofBlockIds: string[];
  replacedEnvelopeIds: string[];
  visibleStorefrontBayCount: number;
}

const PROGRAMS_BY_BUILDING: Readonly<Record<HeroAssetNode, readonly StreetProgramNode[]>> = {
  "masonry-building": ["cafe-storefront", "restaurant-storefront", "bookstore-storefront", "market-storefront"],
  "limestone-office": ["office-lobby", "residential-entry"],
  "miesian-grid-tower": ["gallery-storefront", "office-lobby"],
  "blue-unitized-tower": ["office-lobby"],
  "bronze-fin-tower": ["service-loading"],
};

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

function makeStreetPrograms(
  buildings: readonly AssetHeroBuildingPlacement[],
): StreetProgramPlacement[] {
  return buildings.flatMap((building) => {
    const programs = PROGRAMS_BY_BUILDING[building.node];
    const forwardX = Math.sin(building.rotation);
    const forwardZ = Math.cos(building.rotation);
    const tangentX = Math.cos(building.rotation);
    const tangentZ = -Math.sin(building.rotation);
    const frontage = building.width * 0.9;
    const bayWidth = frontage / programs.length;
    return programs.map((node, index) => {
      const offset = -frontage / 2 + bayWidth * (index + 0.5);
      return {
        id: `urban-program-${building.envelopeId}-${node}-${index}`,
        node,
        ownerEntityId: building.primaryEntityId,
        ownerBuildingId: building.semanticBuildingId,
        x: Number((building.x + tangentX * offset + forwardX * (building.depth / 2 + 0.22)).toFixed(3)),
        y: 0.255,
        z: Number((building.z + tangentZ * offset + forwardZ * (building.depth / 2 + 0.22)).toFixed(3)),
        rotation: building.rotation,
        scale: [Number((bayWidth * 0.96).toFixed(3)), node === "office-lobby" ? 2.7 : 2.25, 1],
        semantic: false,
        layer: NON_SEMANTIC_URBAN_CONTEXT,
        routedToOwner: true,
      } satisfies StreetProgramPlacement;
    });
  });
}

function makeStreetDetails(
  buildings: readonly AssetHeroBuildingPlacement[],
  riverEdge: readonly RiverEdgeAssetPlacement[],
): StreetDetailPlacement[] {
  const details: StreetDetailPlacement[] = [];
  const detailedStreetBuildings = buildings.filter(
    (building) => building.node === "masonry-building" || building.node === "limestone-office",
  );
  detailedStreetBuildings.forEach((building, index) => {
    const forwardX = Math.sin(building.rotation);
    const forwardZ = Math.cos(building.rotation);
    const front = building.depth / 2;
    details.push(
      {
        id: `street-detail-sidewalk-${building.envelopeId}`,
        node: "sidewalk-pavers",
        x: Number((building.x + forwardX * (front + 0.7)).toFixed(3)),
        y: 0.205,
        z: Number((building.z + forwardZ * (front + 0.7)).toFixed(3)),
        rotation: building.rotation,
        scale: [building.width * 1.18, 1, 1.5],
        semantic: false,
        layer: NON_SEMANTIC_URBAN_CONTEXT,
      },
      {
        id: `street-detail-curb-${building.envelopeId}`,
        node: "curb-gutter",
        x: Number((building.x + forwardX * (front + 1.42)).toFixed(3)),
        y: 0.205,
        z: Number((building.z + forwardZ * (front + 1.42)).toFixed(3)),
        rotation: building.rotation,
        scale: [building.width * 1.24, 1, 1],
        semantic: false,
        layer: NON_SEMANTIC_URBAN_CONTEXT,
      },
    );
    if (index === detailedStreetBuildings.length - 1) details.push({
        id: `street-detail-loading-${building.envelopeId}`,
        node: "loading-zone" as const,
        x: Number((building.x + forwardX * (front + 2.05)).toFixed(3)),
        y: 0.27,
        z: Number((building.z + forwardZ * (front + 2.05)).toFixed(3)),
        rotation: building.rotation,
        scale: [building.width * 0.8, 1, 1] as [number, number, number],
        semantic: false,
        layer: NON_SEMANTIC_URBAN_CONTEXT,
      });
  });
  const walls = riverEdge.filter((placement) => placement.node === "river-edge");
  for (const [index, wall] of walls.entries()) {
    details.push({
      id: `street-detail-waterfront-${index}`,
      node: "waterfront-walk",
      x: wall.x + (index === 0 ? -1.05 : 1.05),
      y: 0.02,
      z: wall.z,
      rotation: wall.rotation,
      scale: [wall.scale[0], 1, 1.8],
      semantic: false,
      layer: NON_SEMANTIC_URBAN_CONTEXT,
    });
  }
  const abutment = riverEdge.find((placement) => placement.node === "bridge-abutment");
  if (abutment) details.push({
    id: "street-detail-river-stairs",
    node: "river-stairs",
    x: abutment.x - 1.1,
    y: -0.12,
    z: abutment.z + 2.7,
    rotation: Math.PI / 2,
    scale: [1.8, 1, 1.8],
    semantic: false,
    layer: NON_SEMANTIC_URBAN_CONTEXT,
  });
  return details;
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
  if (!gateway) throw new Error("V4.3 asset proof requires a hero gateway block");
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
  if (!neighbor) throw new Error("V4.3 asset proof requires an adjacent hero block");
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
    throw new Error(`V4.3 asset proof requires five envelopes, received ${envelopes.length}`);
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
    throw new Error(`V4.3 asset proof expected five principal buildings, received ${buildings.length}`);
  }
  const visibleStorefrontBayCount = buildings.reduce(
    (total, building) => total + building.storefrontBays,
    0,
  );
  const riverEdge = makeRiverEdge(visualCity, urbanFabric);
  return {
    version: ASSET_CITY_VERSION,
    buildings,
    visualContext: makeVisualContext(buildings),
    streetPrograms: makeStreetPrograms(buildings),
    streetDetails: makeStreetDetails(buildings, riverEdge),
    riverEdge,
    proofBlockIds,
    replacedEnvelopeIds: urbanFabric.architecturalEnvelopes
      .filter((envelope) => proofBlockIds.includes(envelope.blockId))
      .map((envelope) => envelope.id)
      .toSorted(compareText),
    visibleStorefrontBayCount,
  };
}

export function makeAssetReviewCameraPresets(
  plan: AssetBackedHeroPlan,
  visualCity: VisualCityPlan,
  urbanFabric?: UrbanFabricPlan,
): readonly AssetReviewCameraPreset[] {
  const bridge = plan.riverEdge.find((item) => item.node === "bridge-abutment")!;
  const fallbackFulton = visualCity.hero.blocks.find((block) => block.role === "fulton-brick-market-a")?.block ?? visualCity.hero.blocks[0]!.block;
  const fallbackLoop = visualCity.hero.blocks.find((block) => block.role === "loop-masonry-streetwall")?.block ?? visualCity.hero.blocks[0]!.block;
  const fallbackGlass = visualCity.hero.blocks.find((block) => block.role === "modern-glass-corner")?.block ?? visualCity.hero.blocks[0]!.block;
  const fallbackCivic = visualCity.hero.blocks.find((block) => block.role === "civic-podium-tower")?.block ?? visualCity.hero.blocks.at(-1)!.block;
  const chicagoSignatures = urbanFabric ? planChicagoKitV2(urbanFabric, visualCity).signatures : [];
  const envelope = (
    family: UrbanFabricPlan["architecturalEnvelopes"][number]["facadeFamily"],
    fallback: typeof fallbackFulton,
    zone?: (typeof chicagoSignatures)[number]["characterZone"],
  ) => {
    const signature = chicagoSignatures.find((candidate) => candidate.family === family && (!zone || candidate.characterZone === zone));
    return urbanFabric?.architecturalEnvelopes.find((candidate) => candidate.id === signature?.envelopeId) ?? fallback;
  };
  const fulton = envelope("fulton-brick-warehouse", fallbackFulton, "fulton-market");
  const loop = envelope("chicago-school-masonry", fallbackLoop, "loop-core");
  const glass = envelope("miesian-grid", fallbackGlass, "river-north");
  const civic = envelope("civic-institutional", fallbackCivic, "civic-anchor");
  const riverfront = envelope("riverfront-terrace", fallbackGlass, "river-north");
  const streetView = (
    anchor: typeof fulton,
    distance: number,
    tangentOffset: number,
    cameraY: number,
    targetY: number,
  ): { position: [number, number, number]; target: [number, number, number] } => {
    const edge = "primaryEdge" in anchor ? anchor.primaryEdge : "south";
    const normal = edge === "north" ? [0, -1] : edge === "south" ? [0, 1] : edge === "west" ? [-1, 0] : [1, 0];
    const tangent = [-normal[1], normal[0]];
    const extent = normal[0] === 0 ? anchor.depth / 2 : anchor.width / 2;
    return {
      position: [
        anchor.x + normal[0] * (extent + distance) + tangent[0] * tangentOffset,
        cameraY,
        anchor.z + normal[1] * (extent + distance) + tangent[1] * tangentOffset,
      ],
      target: [anchor.x, targetY, anchor.z],
    };
  };
  const loopView = {
    position: [loop.x - loop.width * 0.88, 2.35, -31] as [number, number, number],
    target: [loop.x - loop.width * 0.88, 2.45, 30] as [number, number, number],
  };
  const fultonView = {
    position: [fulton.x + fulton.width * 1.82, 2.15, 30] as [number, number, number],
    target: [fulton.x + fulton.width * 1.82, 2.3, -30] as [number, number, number],
  };
  // Acceptance cameras prove architecture from the public realm. They stay at
  // pedestrian or second-floor height so storefronts, lobbies, facade depth,
  // traffic, and the street wall remain legible instead of collapsing into an
  // elevated massing diagram.
  const glassView = streetView(glass, 5.2, -glass.width * 0.68, 2.6, Math.min(3.1, "height" in glass ? glass.height * 0.28 : 2.8));
  const civicView = streetView(civic, 25, -20, 18, Math.min(5.8, "height" in civic ? civic.height * 0.36 : 4.8));
  const riverfrontView = streetView(riverfront, 24, -17, 17, Math.min(7, "height" in riverfront ? riverfront.height * 0.4 : 5.5));
  return [
    { id: "street-corner", key: "1", ...loopView, fov: 48 },
    { id: "storefront-street", key: "2", ...fultonView, fov: 48 },
    { id: "river-bridge", key: "3", position: [visualCity.river.maxX + 13, 8.2, bridge.z + 22], target: [riverfront.x + 3.8, 3.5, bridge.z - 1.8], fov: 46 },
    { id: "glass-facade", key: "4", ...glassView, fov: 46 },
    { id: "urban-composition", key: "5", position: [visualCity.river.maxX + 53, 24, bridge.z + 49], target: [-8, 4.5, bridge.z + 4], fov: 44 },
    { id: "public-alpha-hero", key: "6", position: [-145, 17, bridge.z - 2], target: [-12, 6.2, bridge.z + 4], fov: 47 },
    { id: "civic-anchor", key: "7", ...civicView, fov: 46 },
    { id: "riverfront-tower", key: "8", ...riverfrontView, fov: 46 },
  ] as const;
}
