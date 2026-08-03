import { stableCityHash } from "./city-visuals";
import { CHICAGO_KIT_V2_DEFINITION, chicagoFamilyDefinition } from "./chicago-kit-v2-definition";
import type { UrbanBlock, UrbanCharacterZone, UrbanFacadeFamily, UrbanFabricPlan, UrbanMassingProfile, UrbanStorefrontCategory } from "./urban-fabric";
import type { VisualCityPlan, VisualContextBuilding } from "./visual-city";

export const CHICAGO_KIT_V2_VERSION = "0.2" as const;
export const CHICAGO_KIT_V2_CLASSIFICATION = "NON_SEMANTIC_URBAN_CONTEXT" as const;

export const CHICAGO_KIT_V2_FAMILIES = [
  "chicago-school-masonry",
  "miesian-grid",
  "blue-green-curtain-wall",
  "bronze-vertical-modern",
  "fulton-brick-warehouse",
  "narrow-storefront-row",
  "art-deco-setback",
  "civic-institutional",
  "riverfront-terrace",
] as const satisfies readonly UrbanFacadeFamily[];

export type ArchitecturalEra =
  | "industrial-1880-1925"
  | "chicago-school-1890-1930"
  | "art-deco-1925-1940"
  | "civic-classical-1900-1940"
  | "miesian-modern-1950-1980"
  | "adaptive-reuse-1980-2010"
  | "contemporary-2000-present";

export type ChicagoMaterialKey =
  | "warm-red-brick"
  | "dark-aged-brick"
  | "buff-brick"
  | "cream-terra-cotta"
  | "limestone"
  | "dark-granite"
  | "architectural-concrete"
  | "dark-structural-steel"
  | "weathered-bronze"
  | "roof-membrane"
  | "smoked-office-glass"
  | "blue-green-office-glass"
  | "clear-storefront-glass";

export type CurtainWallGeometry =
  | "miesian-expressed-grid"
  | "unitized-vision-spandrel"
  | "bronze-vertical-fins";

export type ChicagoLod = "lod0" | "lod1" | "lod2";

export interface ChicagoMaterialSlots {
  wall: ChicagoMaterialKey;
  base: ChicagoMaterialKey;
  frame: ChicagoMaterialKey;
  roof: ChicagoMaterialKey;
  glass: ChicagoMaterialKey | null;
}

export interface BuildingVisualSignature {
  envelopeId: string;
  semanticBuildingId: string;
  primaryEntityId: string;
  componentId: string;
  blockId: string;
  characterZone: UrbanCharacterZone;
  era: ArchitecturalEra;
  family: UrbanFacadeFamily;
  facadeRhythm: string;
  baseVariant: string;
  cornerVariant: string;
  roofVariant: string;
  materialSet: string;
  materials: ChicagoMaterialSlots;
  glassSystem: CurtainWallGeometry | null;
  massingProfile: UrbanMassingProfile;
  heightBand: "low" | "mid" | "high";
  cornerCondition: "mid-block" | "street-corner";
  waterfrontCondition: "inland" | "river-facing";
  floorCount: number;
  floorHeight: number;
  frontageBayCount: number;
  sideBayCount: number;
  frontageBayWidth: number;
  sideBayWidth: number;
  maximumModuleDistortion: number;
  lod0Variant: string;
  lod1Variant: string;
  lod2Variant: string;
  batchingKey: string;
  signatureKey: string;
  landmark: boolean;
}

export interface ContextVisualSignature {
  contextId: string;
  ring: 1 | 2 | 3;
  characterZone: UrbanCharacterZone;
  family: UrbanFacadeFamily;
  materialSet: string;
  materials: ChicagoMaterialSlots;
  facadeRhythm: string;
  roofVariant: string;
  cornerVariant: string;
  massingVariant: string;
  lod: "lod1" | "lod2";
  semantic: false;
  selectable: false;
  classification: typeof CHICAGO_KIT_V2_CLASSIFICATION;
}

export interface ChicagoStorefrontProgram {
  storefrontId: string;
  envelopeId: string;
  ownerBuildingId: string;
  ownerEntityId: string;
  category: UrbanStorefrontCategory;
  programFamily: string;
  signature: string;
  semantic: false;
  searchable: false;
  classification: typeof CHICAGO_KIT_V2_CLASSIFICATION;
}

export interface ChicagoKitV2Metrics {
  architecturalEnvelopeCount: number;
  signatureCount: number;
  contextBuildingCount: number;
  facadeFamilyCount: number;
  curtainWallSystemCount: number;
  groundFloorProgramFamilyCount: number;
  exactAdjacentDuplicateCount: number;
  immediateRhythmRepeatCount: number;
  sameFamilyAdjacentPairPct: number;
  maximumSameFamilyRun: number;
  landmarkRatioPct: number;
}

export interface ChicagoKitV2Plan {
  version: typeof CHICAGO_KIT_V2_VERSION;
  seed: string;
  classification: typeof CHICAGO_KIT_V2_CLASSIFICATION;
  interactionPolicy: "existing-semantic-owners-only";
  planningPolicy: "memoized-before-render";
  worldUnitMeters: 3;
  signatures: BuildingVisualSignature[];
  contextSignatures: ContextVisualSignature[];
  storefrontPrograms: ChicagoStorefrontProgram[];
  metrics: ChicagoKitV2Metrics;
}

export interface MeasuredChicagoKitV2Plan {
  plan: ChicagoKitV2Plan;
  planningMs: number;
}

const RHYTHMS = Object.fromEntries(
  CHICAGO_KIT_V2_FAMILIES.map((family) => [family, chicagoFamilyDefinition(family).rhythms]),
) as unknown as Record<UrbanFacadeFamily, readonly string[]>;
const BASES = Object.fromEntries(
  CHICAGO_KIT_V2_FAMILIES.map((family) => [family, chicagoFamilyDefinition(family).bases]),
) as unknown as Record<UrbanFacadeFamily, readonly string[]>;
const CORNERS = Object.fromEntries(
  CHICAGO_KIT_V2_FAMILIES.map((family) => [family, chicagoFamilyDefinition(family).corners]),
) as unknown as Record<UrbanFacadeFamily, readonly string[]>;
const ROOFS = Object.fromEntries(
  CHICAGO_KIT_V2_FAMILIES.map((family) => [family, chicagoFamilyDefinition(family).roofs]),
) as unknown as Record<UrbanFacadeFamily, readonly string[]>;

const FAMILY_ERA: Record<UrbanFacadeFamily, ArchitecturalEra> = {
  "chicago-school-masonry": "chicago-school-1890-1930",
  "miesian-grid": "miesian-modern-1950-1980",
  "blue-green-curtain-wall": "contemporary-2000-present",
  "bronze-vertical-modern": "contemporary-2000-present",
  "fulton-brick-warehouse": "industrial-1880-1925",
  "narrow-storefront-row": "adaptive-reuse-1980-2010",
  "art-deco-setback": "art-deco-1925-1940",
  "civic-institutional": "civic-classical-1900-1940",
  "riverfront-terrace": "contemporary-2000-present",
};

const ZONE_FAMILIES: Record<UrbanCharacterZone, readonly UrbanFacadeFamily[]> = {
  "fulton-market": ["fulton-brick-warehouse", "narrow-storefront-row", "chicago-school-masonry"],
  "loop-core": ["chicago-school-masonry", "art-deco-setback", "narrow-storefront-row", "civic-institutional"],
  "river-north": ["miesian-grid", "blue-green-curtain-wall", "bronze-vertical-modern", "riverfront-terrace", "chicago-school-masonry", "art-deco-setback"],
  "civic-anchor": ["civic-institutional", "art-deco-setback", "chicago-school-masonry"],
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

function pick<T>(values: readonly T[], hash: number): T {
  return values[hash % values.length]!;
}

function spatialKey(envelope: UrbanFabricPlan["architecturalEnvelopes"][number]): string {
  return [
    envelope.blockId,
    round(envelope.x),
    round(envelope.z),
    round(envelope.width),
    round(envelope.depth),
    round(envelope.height),
    round(envelope.rotation),
    envelope.primaryStreetId,
    envelope.secondaryStreetId,
    envelope.primaryEdge,
    envelope.secondaryEdge,
    envelope.characterZone,
    envelope.facadeFamily,
    envelope.massingProfile,
    envelope.landmark ? "landmark" : "ordinary",
  ].join(":");
}

function materialSlots(family: UrbanFacadeFamily, age: number): ChicagoMaterialSlots {
  switch (family) {
    case "chicago-school-masonry":
      return { wall: age ? "dark-aged-brick" : "cream-terra-cotta", base: "limestone", frame: "dark-structural-steel", roof: "roof-membrane", glass: "smoked-office-glass" };
    case "miesian-grid":
      return { wall: "dark-structural-steel", base: "dark-granite", frame: "dark-structural-steel", roof: "roof-membrane", glass: "smoked-office-glass" };
    case "blue-green-curtain-wall":
      return { wall: "architectural-concrete", base: "limestone", frame: "dark-structural-steel", roof: "roof-membrane", glass: "blue-green-office-glass" };
    case "bronze-vertical-modern":
      return { wall: "architectural-concrete", base: "dark-granite", frame: "weathered-bronze", roof: "roof-membrane", glass: "smoked-office-glass" };
    case "fulton-brick-warehouse":
      return { wall: age ? "dark-aged-brick" : "warm-red-brick", base: "dark-granite", frame: "dark-structural-steel", roof: "roof-membrane", glass: "smoked-office-glass" };
    case "narrow-storefront-row":
      return { wall: age ? "buff-brick" : "warm-red-brick", base: "dark-granite", frame: "dark-structural-steel", roof: "roof-membrane", glass: "clear-storefront-glass" };
    case "art-deco-setback":
      return { wall: age ? "cream-terra-cotta" : "limestone", base: "dark-granite", frame: "weathered-bronze", roof: "roof-membrane", glass: "smoked-office-glass" };
    case "civic-institutional":
      return { wall: "limestone", base: "dark-granite", frame: "weathered-bronze", roof: "roof-membrane", glass: "clear-storefront-glass" };
    case "riverfront-terrace":
      return { wall: "architectural-concrete", base: "limestone", frame: age ? "weathered-bronze" : "dark-structural-steel", roof: "roof-membrane", glass: age ? "smoked-office-glass" : "blue-green-office-glass" };
  }
}

function glassSystem(family: UrbanFacadeFamily): CurtainWallGeometry | null {
  if (family === "miesian-grid") return "miesian-expressed-grid";
  if (family === "blue-green-curtain-wall") return "unitized-vision-spandrel";
  if (family === "bronze-vertical-modern" || family === "riverfront-terrace") return "bronze-vertical-fins";
  return null;
}

function heightBand(height: number): BuildingVisualSignature["heightBand"] {
  return height < 8 ? "low" : height < 17 ? "mid" : "high";
}

function contextZone(building: VisualContextBuilding, blocks: readonly UrbanBlock[]): UrbanCharacterZone {
  let nearest = blocks[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const distance = (building.x - block.x) ** 2 + (building.z - block.z) ** 2;
    if (distance < nearestDistance) {
      nearest = block;
      nearestDistance = distance;
    }
  }
  return nearest.characterZone;
}

function facadeDimensions(width: number, depth: number, height: number, family: UrbanFacadeFamily) {
  const targetFloorHeight = family === "fulton-brick-warehouse" ? 1.22 : family === "civic-institutional" ? 1.34 : 1.08;
  const baseHeight = family === "civic-institutional" ? 2.2 : family === "miesian-grid" ? 1.8 : 1.62;
  const floorCount = Math.max(2, Math.floor((height - baseHeight) / targetFloorHeight));
  const floorHeight = round((height - baseHeight) / floorCount);
  const targetBay = family === "fulton-brick-warehouse" ? 1.32 : family === "civic-institutional" ? 1.48 : family === "miesian-grid" ? 0.88 : 1.06;
  const frontageBayCount = Math.max(2, Math.round(width / targetBay));
  const sideBayCount = Math.max(2, Math.round(depth / targetBay));
  const frontageBayWidth = round(width / frontageBayCount);
  const sideBayWidth = round(depth / sideBayCount);
  const maximumModuleDistortion = round(Math.max(
    Math.abs(frontageBayWidth / targetBay - 1),
    Math.abs(sideBayWidth / targetBay - 1),
    Math.abs(floorHeight / targetFloorHeight - 1),
  ));
  return { floorCount, floorHeight, frontageBayCount, sideBayCount, frontageBayWidth, sideBayWidth, maximumModuleDistortion };
}

function makeSignatureKey(signature: Omit<BuildingVisualSignature, "signatureKey" | "batchingKey">): string {
  return [signature.family, signature.facadeRhythm, signature.baseVariant, signature.cornerVariant, signature.roofVariant, signature.materialSet, signature.heightBand].join("|");
}

function actualStreetGroups(signatures: readonly BuildingVisualSignature[], fabric: UrbanFabricPlan): BuildingVisualSignature[][] {
  const envelopeById = new Map(fabric.architecturalEnvelopes.map((envelope) => [envelope.id, envelope]));
  const byStreet = new Map<string, BuildingVisualSignature[]>();
  for (const signature of signatures) {
    const envelope = envelopeById.get(signature.envelopeId)!;
    const group = byStreet.get(envelope.primaryStreetId) ?? [];
    group.push(signature);
    byStreet.set(envelope.primaryStreetId, group);
  }
  return [...byStreet.values()].map((group) => group.sort((left, right) => {
    const a = envelopeById.get(left.envelopeId)!;
    const b = envelopeById.get(right.envelopeId)!;
    return a.x - b.x || a.z - b.z || compareText(a.id, b.id);
  }));
}

function resolveAdjacency(signatures: BuildingVisualSignature[], fabric: UrbanFabricPlan): void {
  for (const group of actualStreetGroups(signatures, fabric)) {
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1]!;
      const current = group[index]!;
      const previousPrevious = group[index - 2];
      if (
        previousPrevious &&
        current.family === previous.family &&
        current.family === previousPrevious.family
      ) {
        const alternatives = ZONE_FAMILIES[current.characterZone].filter(
          (family) => family !== previous.family,
        );
        const nextFamily = pick(
          alternatives,
          stableCityHash(`${current.blockId}:${current.characterZone}:${current.heightBand}:adjacency-family`),
        );
        const age = stableCityHash(`${current.signatureKey}:adjacency-age`) % 2;
        current.family = nextFamily;
        current.era = FAMILY_ERA[nextFamily];
        current.facadeRhythm = pick(RHYTHMS[nextFamily], stableCityHash(`${current.signatureKey}:adjacency-rhythm`));
        current.baseVariant = pick(BASES[nextFamily], stableCityHash(`${current.signatureKey}:adjacency-base`));
        current.cornerVariant = pick(CORNERS[nextFamily], stableCityHash(`${current.signatureKey}:adjacency-corner`));
        current.roofVariant = pick(ROOFS[nextFamily], stableCityHash(`${current.signatureKey}:adjacency-roof`));
        current.materials = materialSlots(nextFamily, age);
        current.materialSet = `${current.materials.wall}+${current.materials.base}+${current.materials.frame}+age-${age}`;
        current.glassSystem = glassSystem(nextFamily);
        current.lod0Variant = `${nextFamily}:street:${current.facadeRhythm}:${current.baseVariant}:${current.cornerVariant}:${current.roofVariant}`;
        current.lod1Variant = `${nextFamily}:city:${current.facadeRhythm}:${current.roofVariant}`;
        current.lod2Variant = `${nextFamily}:silhouette:${current.roofVariant}`;
      }
      if (current.facadeRhythm === previous.facadeRhythm) {
        const values = RHYTHMS[current.family];
        current.facadeRhythm = values[(values.indexOf(current.facadeRhythm) + 1) % values.length]!;
      }
      current.signatureKey = makeSignatureKey(current);
      if (current.signatureKey === previous.signatureKey) {
        const values = ROOFS[current.family];
        current.roofVariant = values[(values.indexOf(current.roofVariant) + 1) % values.length]!;
        current.signatureKey = makeSignatureKey(current);
      }
      current.batchingKey = [current.family, current.materialSet, current.glassSystem ?? "masonry", current.lod1Variant].join("|");
    }
  }
}

function adjacencyMetrics(signatures: readonly BuildingVisualSignature[], fabric: UrbanFabricPlan) {
  let pairs = 0;
  let sameFamily = 0;
  let exactDuplicates = 0;
  let rhythmRepeats = 0;
  let maximumRun = 1;
  for (const group of actualStreetGroups(signatures, fabric)) {
    let run = 1;
    for (let index = 1; index < group.length; index += 1) {
      pairs += 1;
      const previous = group[index - 1]!;
      const current = group[index]!;
      if (current.family === previous.family) {
        sameFamily += 1;
        run += 1;
        maximumRun = Math.max(maximumRun, run);
      } else run = 1;
      if (current.signatureKey === previous.signatureKey) exactDuplicates += 1;
      if (current.facadeRhythm === previous.facadeRhythm) rhythmRepeats += 1;
    }
  }
  return {
    exactAdjacentDuplicateCount: exactDuplicates,
    immediateRhythmRepeatCount: rhythmRepeats,
    sameFamilyAdjacentPairPct: pairs === 0 ? 0 : round((sameFamily / pairs) * 100),
    maximumSameFamilyRun: maximumRun,
  };
}

function programFamily(category: UrbanStorefrontCategory): string {
  return ({
    "corner-cafe": "cafe",
    bookshop: "bookstore",
    "neighborhood-grocer": "grocer",
    "design-studio": "gallery-studio",
    "music-room": "gallery-studio",
    bakery: "bakery",
    "repair-shop": "repair-workshop",
    gallery: "gallery-studio",
    restaurant: "restaurant",
    "hotel-lobby": "hotel-office-lobby",
  } satisfies Record<UrbanStorefrontCategory, string>)[category];
}

export function planChicagoKitV2(
  fabric: UrbanFabricPlan,
  visualCity: VisualCityPlan,
  seed = "repocity-chicago-kit-v2",
): ChicagoKitV2Plan {
  const semanticBuildingById = new Map(fabric.buildings.map((building) => [building.id, building]));
  const blockById = new Map(fabric.blocks.map((block) => [block.id, block]));
  const signatures = fabric.architecturalEnvelopes
    .slice()
    .sort((left, right) => compareText(left.id, right.id))
    .map((envelope): BuildingVisualSignature => {
      const key = `${seed}:${spatialKey(envelope)}`;
      const allowedFamilies = ZONE_FAMILIES[envelope.characterZone];
      const family = allowedFamilies.includes(envelope.facadeFamily)
        ? envelope.facadeFamily
        : pick(allowedFamilies, stableCityHash(`${key}:zone-family`));
      const rhythm = pick(RHYTHMS[family], stableCityHash(`${key}:rhythm`));
      const base = pick(BASES[family], stableCityHash(`${key}:base`));
      const corner = pick(CORNERS[family], stableCityHash(`${key}:corner`));
      const roof = pick(ROOFS[family], stableCityHash(`${key}:roof`));
      const age = stableCityHash(`${key}:age`) % 2;
      const materials = materialSlots(family, age);
      const dimensions = facadeDimensions(envelope.width, envelope.depth, envelope.height, family);
      const block = blockById.get(envelope.blockId)!;
      const cornerDistanceX = Math.abs(Math.abs(envelope.x - block.x) + envelope.width / 2 - block.width / 2);
      const cornerDistanceZ = Math.abs(Math.abs(envelope.z - block.z) + envelope.depth / 2 - block.depth / 2);
      const cornerCondition = cornerDistanceX < 1.2 && cornerDistanceZ < 1.2 ? "street-corner" : "mid-block";
      const riverFacing = envelope.massingProfile.startsWith("river-") || family === "riverfront-terrace";
      const materialSet = `${materials.wall}+${materials.base}+${materials.frame}+age-${age}`;
      const withoutKeys: Omit<BuildingVisualSignature, "signatureKey" | "batchingKey"> = {
        envelopeId: envelope.id,
        semanticBuildingId: envelope.semanticBuildingId,
        primaryEntityId: semanticBuildingById.get(envelope.semanticBuildingId)?.primaryEntityId ?? "",
        componentId: envelope.componentId,
        blockId: envelope.blockId,
        characterZone: envelope.characterZone,
        era: FAMILY_ERA[family],
        family,
        facadeRhythm: rhythm,
        baseVariant: base,
        cornerVariant: corner,
        roofVariant: roof,
        materialSet,
        materials,
        glassSystem: glassSystem(family),
        massingProfile: envelope.massingProfile,
        heightBand: heightBand(envelope.height),
        cornerCondition,
        waterfrontCondition: riverFacing ? "river-facing" : "inland",
        ...dimensions,
        lod0Variant: `${family}:street:${rhythm}:${base}:${corner}:${roof}`,
        lod1Variant: `${family}:city:${rhythm}:${roof}`,
        lod2Variant: `${family}:silhouette:${roof}`,
        landmark: envelope.landmark,
      };
      const signatureKey = makeSignatureKey(withoutKeys);
      return {
        ...withoutKeys,
        signatureKey,
        batchingKey: [family, materialSet, glassSystem(family) ?? "masonry", withoutKeys.lod1Variant].join("|"),
      };
    });
  resolveAdjacency(signatures, fabric);

  const contextSignatures = visualCity.contextBuildings.map((building): ContextVisualSignature => {
    const zone = contextZone(building, fabric.blocks);
    const key = `${seed}:${building.contextId}:${zone}`;
    const family = pick(ZONE_FAMILIES[zone], stableCityHash(`${key}:family`));
    const age = stableCityHash(`${key}:age`) % 2;
    const materials = materialSlots(family, age);
    return {
      contextId: building.contextId,
      ring: building.ring,
      characterZone: zone,
      family,
      materialSet: `${materials.wall}+${materials.base}+${materials.frame}+age-${age}`,
      materials,
      facadeRhythm: pick(RHYTHMS[family], stableCityHash(`${key}:rhythm`)),
      roofVariant: pick(ROOFS[family], stableCityHash(`${key}:roof`)),
      cornerVariant: pick(CORNERS[family], stableCityHash(`${key}:corner`)),
      massingVariant: pick(["base-shaft-top", "setback-shoulder", "podium-slab"], stableCityHash(`${key}:massing`)),
      lod: building.ring === 1 ? "lod1" : "lod2",
      semantic: false,
      selectable: false,
      classification: CHICAGO_KIT_V2_CLASSIFICATION,
    };
  });

  const signatureByEnvelope = new Map(signatures.map((signature) => [signature.envelopeId, signature]));
  const storefrontPrograms = fabric.storefronts.map((storefront, index): ChicagoStorefrontProgram => {
    const signature = signatureByEnvelope.get(storefront.architecturalEnvelopeId)!;
    const family = programFamily(storefront.category);
    return {
      storefrontId: storefront.id,
      envelopeId: storefront.architecturalEnvelopeId,
      ownerBuildingId: signature.semanticBuildingId,
      ownerEntityId: signature.primaryEntityId,
      category: storefront.category,
      programFamily: family,
      signature: `${family}:${index % 3}:${stableCityHash(`${seed}:${storefront.id}`) % 4}`,
      semantic: false,
      searchable: false,
      classification: CHICAGO_KIT_V2_CLASSIFICATION,
    };
  });
  const adjacency = adjacencyMetrics(signatures, fabric);
  return {
    version: CHICAGO_KIT_V2_VERSION,
    seed,
    classification: CHICAGO_KIT_V2_CLASSIFICATION,
    interactionPolicy: "existing-semantic-owners-only",
    planningPolicy: "memoized-before-render",
    worldUnitMeters: 3,
    signatures,
    contextSignatures,
    storefrontPrograms,
    metrics: {
      architecturalEnvelopeCount: fabric.architecturalEnvelopes.length,
      signatureCount: signatures.length,
      contextBuildingCount: contextSignatures.length,
      facadeFamilyCount: new Set(signatures.map((signature) => signature.family)).size,
      curtainWallSystemCount: new Set(signatures.map((signature) => signature.glassSystem).filter(Boolean)).size,
      groundFloorProgramFamilyCount: new Set(storefrontPrograms.map((program) => program.programFamily)).size,
      ...adjacency,
      landmarkRatioPct: fabric.morphology.landmarkRatioPct,
    },
  };
}

export function measureChicagoKitV2Plan(
  fabric: UrbanFabricPlan,
  visualCity: VisualCityPlan,
  seed?: string,
): MeasuredChicagoKitV2Plan {
  const started = performance.now();
  const plan = planChicagoKitV2(fabric, visualCity, seed);
  return { plan, planningMs: round(performance.now() - started, 4) };
}

export function chicagoKitV2ArchitecturalFingerprint(signature: BuildingVisualSignature): string {
  return [
    signature.characterZone,
    signature.era,
    signature.family,
    signature.facadeRhythm,
    signature.baseVariant,
    signature.cornerVariant,
    signature.roofVariant,
    signature.materialSet,
    signature.glassSystem ?? "masonry",
    signature.massingProfile,
    signature.lod0Variant,
    signature.lod1Variant,
    signature.lod2Variant,
    signature.batchingKey,
  ].join("|");
}

export function chicagoKitV2VariantInventory() {
  return CHICAGO_KIT_V2_FAMILIES.map((family) => ({
    family,
    facadeRhythms: RHYTHMS[family],
    bases: BASES[family],
    corners: CORNERS[family],
    roofs: ROOFS[family],
    materialAgeVariants: 2,
    canonicalDefinitionVersion: CHICAGO_KIT_V2_DEFINITION.version,
  }));
}
