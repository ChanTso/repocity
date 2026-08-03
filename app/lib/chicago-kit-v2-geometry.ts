import type {
  BuildingVisualSignature,
  ChicagoKitV2Plan,
  ChicagoLod,
  ChicagoMaterialKey,
  ContextVisualSignature,
} from "./chicago-kit-v2";
import {
  CHICAGO_KIT_V2_DEFINITION,
  chicagoBaseRecipe,
  chicagoCornerRecipe,
  chicagoRhythmRecipe,
  chicagoRoofRecipe,
  stableDefinitionHash,
} from "./chicago-kit-v2-definition";
import type {
  UrbanArchitecturalEnvelope,
  UrbanBlockEdge,
  UrbanFabricPlan,
  UrbanStorefront,
} from "./urban-fabric";
import type { VisualCityPlan, VisualContextBuilding } from "./visual-city";

export type ChicagoRenderMaterialKey =
  | ChicagoMaterialKey
  | "masonry-shadow-joint"
  | "warm-interior"
  | "context-ground"
  | "context-road"
  | "canvas-awning"
  | "civic-accent";

export type ChicagoModuleKind =
  | "base"
  | "ground-floor"
  | "middle"
  | "window"
  | "mullion"
  | "spandrel"
  | "corner"
  | "party-wall"
  | "exposed-end"
  | "rear-service"
  | "setback"
  | "top"
  | "cornice"
  | "roof-house"
  | "crown"
  | "storefront"
  | "entrance"
  | "awning"
  | "context-base"
  | "context-middle"
  | "context-top"
  | "context-window-band"
  | "context-ground"
  | "context-road";

export type ChicagoModulePrimitive =
  | "box"
  | "single-recess"
  | "paired-oriel"
  | "deep-reveal"
  | "arcade-opening"
  | "recessed-lobby"
  | "miesian-grid"
  | "unitized-panel"
  | "bronze-fin-panel"
  | "expressed-pier"
  | "chamfer-wrap"
  | "cornice-cap"
  | "screen-house"
  | "stepped-crown"
  | "context-facade-grid"
  | "awning-wedge";

export type ChicagoLocalSide = "front" | "back" | "left" | "right";
export type ChicagoExposure = "primary-street" | "secondary-street" | "exposed-end" | "party-wall" | "rear-service";

export interface ChicagoGeometryBox {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationY: number;
  material: ChicagoRenderMaterialKey;
  module: ChicagoModuleKind;
  primitive?: ChicagoModulePrimitive;
  lod: ChicagoLod;
  semantic: boolean;
  exposure?: ChicagoExposure;
  envelopeId?: string;
  semanticBuildingId?: string;
  primaryEntityId?: string;
  componentId?: string;
  contextId?: string;
  storefrontId?: string;
}

export interface ChicagoGeometryTier {
  boxes: ChicagoGeometryBox[];
  byMaterial: Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>;
  moduleCount: number;
}

export interface ChicagoCompiledMetrics {
  activeGroundFloorPct: number;
  fultonActiveGroundFloorPct: number;
  blankContextFallbackCount: number;
  distinctBuildingGeometryCount: number;
  distinctRhythmGeometryCount: number;
  distinctBaseGeometryCount: number;
  distinctCornerGeometryCount: number;
  distinctRoofGeometryCount: number;
  exposureCounts: Record<ChicagoExposure, number>;
}

export interface ChicagoKitV2Geometry {
  tiers: Record<ChicagoLod, ChicagoGeometryTier>;
  /** LOD0 compatibility view used by diagnostics and geometry review tests. */
  boxes: ChicagoGeometryBox[];
  byMaterial: Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>;
  coreModuleCount: number;
  contextModuleCount: number;
  storefrontModuleCount: number;
  semanticEnvelopeIds: string[];
  metrics: ChicagoCompiledMetrics;
}

const BASE_Y = 0.24;
const SIDES: readonly ChicagoLocalSide[] = ["front", "back", "left", "right"];
const ALL_MATERIALS: readonly ChicagoRenderMaterialKey[] = [
  "warm-red-brick", "dark-aged-brick", "buff-brick", "cream-terra-cotta", "limestone",
  "dark-granite", "architectural-concrete", "dark-structural-steel", "weathered-bronze",
  "roof-membrane", "smoked-office-glass", "blue-green-office-glass", "clear-storefront-glass",
  "masonry-shadow-joint", "warm-interior", "context-ground", "context-road", "canvas-awning", "civic-accent",
];

function round(value: number): number {
  return Number(value.toFixed(4));
}

function localPoint(envelope: UrbanArchitecturalEnvelope, localX: number, localZ: number) {
  const cosine = Math.cos(envelope.rotation);
  const sine = Math.sin(envelope.rotation);
  return {
    x: round(envelope.x + localX * cosine + localZ * sine),
    z: round(envelope.z - localX * sine + localZ * cosine),
  };
}

function coreBox(
  signature: BuildingVisualSignature,
  lod: ChicagoLod,
  input: Omit<ChicagoGeometryBox, "lod" | "semantic" | "envelopeId" | "semanticBuildingId" | "primaryEntityId" | "componentId">,
): ChicagoGeometryBox {
  return {
    ...input,
    primitive: input.primitive ?? "box",
    lod,
    semantic: true,
    envelopeId: signature.envelopeId,
    semanticBuildingId: signature.semanticBuildingId,
    primaryEntityId: signature.primaryEntityId,
    componentId: signature.componentId,
  };
}

function windowPrimitive(signature: BuildingVisualSignature, fallback: ChicagoModulePrimitive): ChicagoModulePrimitive {
  if (signature.glassSystem === "miesian-expressed-grid") return "miesian-grid";
  if (signature.glassSystem === "unitized-vision-spandrel") return "unitized-panel";
  if (signature.glassSystem === "bronze-vertical-fins") return "bronze-fin-panel";
  return fallback;
}

function facadeBox(
  signature: BuildingVisualSignature,
  envelope: UrbanArchitecturalEnvelope,
  lod: ChicagoLod,
  side: ChicagoLocalSide,
  offset: number,
  y: number,
  span: number,
  height: number,
  projection: number,
  material: ChicagoRenderMaterialKey,
  module: ChicagoModuleKind,
  id: string,
  exposure: ChicagoExposure,
): ChicagoGeometryBox {
  const frontBack = side === "front" || side === "back";
  const normal = side === "front" || side === "right" ? 1 : -1;
  const point = localPoint(
    envelope,
    frontBack ? offset : normal * (envelope.width / 2 + projection / 2),
    frontBack ? normal * (envelope.depth / 2 + projection / 2) : offset,
  );
  return coreBox(signature, lod, {
    id, x: point.x, y: round(y), z: point.z, width: round(span), height: round(height), depth: round(projection),
    rotationY: round(envelope.rotation + (frontBack ? 0 : Math.PI / 2)), material, module, exposure,
  });
}

function sideNormal(envelope: UrbanArchitecturalEnvelope, side: ChicagoLocalSide) {
  const local = side === "front" ? [0, 1] : side === "back" ? [0, -1] : side === "right" ? [1, 0] : [-1, 0];
  const cosine = Math.cos(envelope.rotation);
  const sine = Math.sin(envelope.rotation);
  return { x: local[0]! * cosine + local[1]! * sine, z: -local[0]! * sine + local[1]! * cosine };
}

const EDGE_NORMAL: Record<UrbanBlockEdge, { x: number; z: number }> = {
  north: { x: 0, z: -1 }, east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 },
};

export function chicagoLocalSideForEdge(envelope: UrbanArchitecturalEnvelope, edge: UrbanBlockEdge): ChicagoLocalSide {
  const target = EDGE_NORMAL[edge];
  return SIDES.slice().sort((left, right) => {
    const a = sideNormal(envelope, left);
    const b = sideNormal(envelope, right);
    return b.x * target.x + b.z * target.z - (a.x * target.x + a.z * target.z);
  })[0]!;
}

function sideCenter(envelope: UrbanArchitecturalEnvelope, side: ChicagoLocalSide) {
  const frontBack = side === "front" || side === "back";
  const normal = side === "front" || side === "right" ? 1 : -1;
  return localPoint(envelope, frontBack ? 0 : normal * envelope.width / 2, frontBack ? normal * envelope.depth / 2 : 0);
}

function projectedHalfExtent(envelope: UrbanArchitecturalEnvelope, axis: { x: number; z: number }): number {
  const cosine = Math.cos(envelope.rotation);
  const sine = Math.sin(envelope.rotation);
  const localX = { x: cosine, z: -sine };
  const localZ = { x: sine, z: cosine };
  return Math.abs(axis.x * localX.x + axis.z * localX.z) * envelope.width / 2
    + Math.abs(axis.x * localZ.x + axis.z * localZ.z) * envelope.depth / 2;
}

function hasPartyNeighbor(envelope: UrbanArchitecturalEnvelope, side: ChicagoLocalSide, all: readonly UrbanArchitecturalEnvelope[]): boolean {
  const normal = sideNormal(envelope, side);
  const tangent = { x: -normal.z, z: normal.x };
  const center = sideCenter(envelope, side);
  const span = side === "front" || side === "back" ? envelope.width : envelope.depth;
  return all.some((candidate) => {
    if (candidate.id === envelope.id) return false;
    const dx = candidate.x - center.x;
    const dz = candidate.z - center.z;
    const normalGap = Math.abs(dx * normal.x + dz * normal.z) - projectedHalfExtent(candidate, normal);
    const tangentGap = Math.abs(dx * tangent.x + dz * tangent.z) - projectedHalfExtent(candidate, tangent) - span / 2;
    return normalGap >= -0.08 && normalGap <= 0.42 && tangentGap < -0.35;
  });
}

export function classifyChicagoEnvelopeExposure(
  envelope: UrbanArchitecturalEnvelope,
  all: readonly UrbanArchitecturalEnvelope[],
): Record<ChicagoLocalSide, ChicagoExposure> {
  const primary = chicagoLocalSideForEdge(envelope, envelope.primaryEdge);
  const secondary = chicagoLocalSideForEdge(envelope, envelope.secondaryEdge);
  const result = Object.fromEntries(SIDES.map((side) => [side, "rear-service"])) as Record<ChicagoLocalSide, ChicagoExposure>;
  result[primary] = "primary-street";
  if (secondary !== primary) result[secondary] = "secondary-street";
  for (const side of SIDES) {
    if (side === primary || side === secondary) continue;
    if (hasPartyNeighbor(envelope, side, all)) result[side] = "party-wall";
    else {
      const normal = sideNormal(envelope, side);
      const toBlockInterior = { x: -envelope.x, z: -envelope.z };
      result[side] = normal.x * toBlockInterior.x + normal.z * toBlockInterior.z > 0 ? "rear-service" : "exposed-end";
    }
  }
  return result;
}

function baseDimensions(envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature) {
  const recipe = chicagoBaseRecipe(signature.family, signature.baseVariant);
  const warehouse = signature.family === "fulton-brick-warehouse" || signature.family === "narrow-storefront-row";
  const tower = signature.massingProfile.includes("tower") || signature.massingProfile.includes("slab")
    || signature.family === "riverfront-terrace" || signature.family === "art-deco-setback";
  const nominal = Math.min(envelope.height * (tower ? 0.27 : warehouse ? 0.21 : 0.2), tower ? 4.2 : 2.6);
  const baseHeight = Math.min(envelope.height * 0.42, nominal * recipe.heightScale);
  const inset = tower ? 0.11 : warehouse ? 0.025 : 0.055;
  return {
    baseHeight, shaftWidth: envelope.width * (1 - inset * 2), shaftDepth: envelope.depth * (1 - inset * 2),
    shaftHeight: Math.max(1.2, envelope.height - baseHeight), tower,
  };
}

function pushBody(boxes: ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature, lod: ChicagoLod) {
  const value = baseDimensions(envelope, signature);
  boxes.push(
    coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:base`, x: envelope.x, y: round(BASE_Y + value.baseHeight / 2), z: envelope.z, width: envelope.width, height: round(value.baseHeight), depth: envelope.depth, rotationY: envelope.rotation, material: signature.materials.base, module: "base" }),
    coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:middle`, x: envelope.x, y: round(BASE_Y + value.baseHeight + value.shaftHeight / 2), z: envelope.z, width: round(value.shaftWidth), height: round(value.shaftHeight), depth: round(value.shaftDepth), rotationY: envelope.rotation, material: signature.glassSystem ? signature.materials.glass! : signature.materials.wall, module: "middle" }),
  );
  if (value.tower && lod !== "lod2") boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:shoulder`, x: envelope.x, y: round(BASE_Y + value.baseHeight + 0.18), z: envelope.z, width: round(envelope.width * 0.94), height: 0.36, depth: round(envelope.depth * 0.94), rotationY: envelope.rotation, material: signature.materials.frame, module: "setback" }));
  return value;
}

function pushBaseVariant(boxes: ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature, lod: ChicagoLod, exposure: Record<ChicagoLocalSide, ChicagoExposure>, baseHeight: number) {
  if (lod === "lod2") return;
  const recipe = chicagoBaseRecipe(signature.family, signature.baseVariant);
  const side = (Object.entries(exposure).find(([, value]) => value === "primary-street")?.[0] ?? "front") as ChicagoLocalSide;
  const span = side === "front" || side === "back" ? envelope.width : envelope.depth;
  const openings = lod === "lod0" ? Math.max(2, Math.round(span / 1.4)) : 1;
  const bay = span / openings;
  for (let index = 0; index < openings; index += 1) {
    const offset = -span / 2 + bay * (index + 0.5);
    boxes.push({ ...facadeBox(signature, envelope, lod, side, offset, BASE_Y + baseHeight * 0.48, bay * recipe.openingWidth, baseHeight * 0.62, recipe.recess, signature.materials.glass ?? "clear-storefront-glass", "ground-floor", `${signature.envelopeId}:${lod}:base-opening:${index}`, "primary-street"), primitive: recipe.primitive });
    if (lod === "lod0" && index % recipe.pierCadence === 0) boxes.push(facadeBox(signature, envelope, lod, side, offset - bay * 0.43, BASE_Y + baseHeight * 0.5, Math.max(0.08, bay * 0.08), baseHeight * 0.9, recipe.recess + 0.04, signature.materials.frame, "ground-floor", `${signature.envelopeId}:${lod}:base-pier:${index}`, "primary-street"));
  }
  boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + recipe.plinthHeight / 2, span * 0.94, recipe.plinthHeight, recipe.recess + 0.02, signature.materials.base, "ground-floor", `${signature.envelopeId}:${lod}:plinth`, "primary-street"));
  if (lod === "lod0") boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight * 0.72, span * 0.58, 0.1, recipe.canopyDepth, signature.materials.frame, "ground-floor", `${signature.envelopeId}:${lod}:canopy`, "primary-street"));
}

function pushFacade(boxes: ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature, lod: ChicagoLod, exposure: Record<ChicagoLocalSide, ChicagoExposure>, baseHeight: number) {
  if (lod === "lod2") return;
  const recipe = chicagoRhythmRecipe(signature.family, signature.facadeRhythm);
  const glass = Boolean(signature.glassSystem);
  const availableHeight = Math.max(1, envelope.height - baseHeight - 0.3);
  const fullFloorCount = Math.max(2, signature.floorCount);
  const floorCount = lod === "lod0" ? fullFloorCount : Math.max(2, Math.ceil(fullFloorCount / 3));
  const floorHeight = availableHeight / floorCount;
  for (const side of SIDES) {
    const faceExposure = exposure[side];
    const frontBack = side === "front" || side === "back";
    const span = frontBack ? envelope.width : envelope.depth;
    if (faceExposure === "party-wall") {
      boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight + availableHeight / 2, span * 0.98, availableHeight, 0.035, signature.materials.wall, "party-wall", `${signature.envelopeId}:${lod}:${side}:party`, faceExposure));
      continue;
    }
    if (faceExposure === "rear-service") {
      boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight * 0.55, span * 0.28, baseHeight * 0.55, 0.06, signature.materials.frame, "rear-service", `${signature.envelopeId}:${lod}:${side}:service`, faceExposure));
      if (lod === "lod0") boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight + availableHeight * 0.62, span * 0.36, availableHeight * 0.18, 0.055, signature.materials.glass ?? "smoked-office-glass", "rear-service", `${signature.envelopeId}:${lod}:${side}:rear-window`, faceExposure));
      continue;
    }
    if (faceExposure === "exposed-end") {
      boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight + availableHeight / 2, span * 0.98, availableHeight, 0.035, signature.materials.wall, "exposed-end", `${signature.envelopeId}:${lod}:${side}:end-wall`, faceExposure));
      if (lod === "lod0") for (const offset of [-0.16, 0.16]) boxes.push(facadeBox(signature, envelope, lod, side, span * offset, BASE_Y + baseHeight + availableHeight * 0.58, span * 0.12, availableHeight * 0.3, 0.065, signature.materials.glass ?? "smoked-office-glass", "exposed-end", `${signature.envelopeId}:${lod}:${side}:end-opening:${offset}`, faceExposure));
      continue;
    }
    const detailed = faceExposure === "primary-street" || faceExposure === "secondary-street";
    const bayCount = detailed ? (frontBack ? signature.frontageBayCount : signature.sideBayCount) : Math.max(2, Math.round(span / 2.6));
    const groups = lod === "lod0" ? Math.max(1, Math.floor(bayCount / recipe.grouping)) : Math.max(1, Math.ceil(bayCount / 3));
    const bayWidth = span / groups;
    for (let floor = 0; floor < floorCount; floor += 1) {
      const y = BASE_Y + baseHeight + floorHeight * (floor + 0.5);
      for (let bay = 0; bay < groups; bay += 1) {
        const offset = -span / 2 + bayWidth * (bay + 0.5) + (floor % 2 === 0 ? recipe.offset : -recipe.offset);
        const windowBox = facadeBox(signature, envelope, lod, side, offset, y, bayWidth * (lod === "lod0" ? recipe.windowWidth : 0.76), floorHeight * (lod === "lod0" ? recipe.windowHeight : 0.46), recipe.reveal, signature.materials.glass ?? "smoked-office-glass", lod === "lod0" ? "window" : "middle", `${signature.envelopeId}:${lod}:${side}:window:${floor}:${bay}`, faceExposure);
        boxes.push({ ...windowBox, primitive: windowPrimitive(signature, recipe.primitive) });
        if (lod === "lod0" && (floor + bay + Number.parseInt(stableDefinitionHash(signature.envelopeId).slice(-2), 16)) % 3 !== 0) {
          const interior = facadeBox(signature, envelope, lod, side, offset, y, windowBox.width * 0.9, windowBox.height * 0.86, -0.08, "warm-interior", "window", `${signature.envelopeId}:${lod}:${side}:interior:${floor}:${bay}`, faceExposure);
          boxes.push({ ...interior, depth: 0.035, primitive: "box" });
        }
      }
      if (detailed) boxes.push(facadeBox(signature, envelope, lod, side, 0, BASE_Y + baseHeight + floorHeight * (floor + 0.05), span * 0.97, recipe.band, recipe.reveal + 0.025, glass ? signature.materials.frame : signature.materials.base, lod === "lod0" ? "spandrel" : "middle", `${signature.envelopeId}:${lod}:${side}:band:${floor}`, faceExposure));
    }
    if (lod === "lod0" && detailed) {
      for (let bay = 0; bay <= bayCount; bay += recipe.grouping) {
        boxes.push(facadeBox(signature, envelope, lod, side, -span / 2 + span / bayCount * bay, BASE_Y + baseHeight + availableHeight / 2, Math.max(0.055, recipe.pier), availableHeight, recipe.reveal + (signature.glassSystem === "bronze-vertical-fins" ? 0.16 : 0.04), signature.materials.frame, "mullion", `${signature.envelopeId}:${lod}:${side}:mullion:${bay}`, faceExposure));
      }
    }
  }
}

function pushCorner(boxes: ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature, lod: ChicagoLod, exposure: Record<ChicagoLocalSide, ChicagoExposure>, baseHeight: number) {
  if (lod === "lod2" || signature.cornerCondition !== "street-corner") return;
  const streetSides = SIDES.filter((side) => exposure[side] === "primary-street" || exposure[side] === "secondary-street");
  const horizontal = streetSides.find((side) => side === "left" || side === "right");
  const vertical = streetSides.find((side) => side === "front" || side === "back");
  if (!horizontal || !vertical) return;
  const recipe = chicagoCornerRecipe(signature.family, signature.cornerVariant);
  const xSide = horizontal === "right" ? 1 : -1;
  const zSide = vertical === "front" ? 1 : -1;
  const point = localPoint(envelope, xSide * (envelope.width / 2 + recipe.projection), zSide * (envelope.depth / 2 + recipe.projection));
  const height = envelope.height - baseHeight * 0.28;
  boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:street-corner`, x: point.x, y: round(BASE_Y + baseHeight * 0.28 + height / 2), z: point.z, width: recipe.width, height: round(height), depth: recipe.depth, rotationY: round(envelope.rotation + recipe.rotation * xSide * zSide), material: recipe.wrapGlass > 0.4 && signature.materials.glass ? signature.materials.glass : signature.materials.frame, module: "corner", primitive: recipe.primitive, exposure: "primary-street" }));
  if (lod === "lod0") {
    for (let index = 0; index < recipe.fins; index += 1) {
      const offset = (index - (recipe.fins - 1) / 2) * 0.12;
      boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:street-corner-fin:${index}`, x: round(point.x + offset), y: round(BASE_Y + baseHeight + height * 0.35), z: round(point.z - offset), width: 0.045, height: round(height * recipe.wrapGlass), depth: round(recipe.depth + recipe.projection), rotationY: envelope.rotation, material: signature.materials.frame, module: "corner", exposure: "primary-street" }));
    }
  }
}

function pushTop(boxes: ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, signature: BuildingVisualSignature, lod: ChicagoLod) {
  const recipe = chicagoRoofRecipe(signature.family, signature.roofVariant);
  const complexity = lod === "lod2" ? 1 : lod === "lod1" ? Math.min(2, recipe.tiers) : recipe.tiers;
  const totalHeight = Math.max(0.38, Math.min(2.8, envelope.height * recipe.heightScale));
  if (lod !== "lod2" || recipe.style === "crown") boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:cornice`, x: envelope.x, y: round(BASE_Y + envelope.height + 0.09), z: envelope.z, width: round(envelope.width * (1.015 + recipe.tiers * 0.008)), height: 0.18, depth: round(envelope.depth * (1.015 + recipe.tiers * 0.008)), rotationY: envelope.rotation, material: signature.materials.base, module: "cornice", primitive: "cornice-cap" }));
  for (let tier = 0; tier < complexity; tier += 1) {
    const scale = 1 - tier * 0.18;
    const point = localPoint(envelope, recipe.offset * envelope.width * (tier + 1), 0);
    boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:roof:${tier}`, x: point.x, y: round(BASE_Y + envelope.height + totalHeight / complexity * (tier + 0.5)), z: point.z, width: round(envelope.width * recipe.widthScale * scale), height: round(totalHeight / complexity), depth: round(envelope.depth * recipe.depthScale * scale), rotationY: envelope.rotation, material: recipe.style === "crown" && signature.materials.glass ? signature.materials.glass : signature.materials.roof, module: recipe.style === "crown" ? "crown" : recipe.style === "house" ? "roof-house" : "top", primitive: recipe.primitive }));
  }
  if (lod === "lod0") for (let index = 0; index < recipe.fins; index += 1) {
    const point = localPoint(envelope, (index - (recipe.fins - 1) / 2) * envelope.width * 0.12, 0);
    boxes.push(coreBox(signature, lod, { id: `${signature.envelopeId}:${lod}:roof-fin:${index}`, x: point.x, y: round(BASE_Y + envelope.height + totalHeight * 0.7), z: point.z, width: 0.11, height: round(totalHeight * 1.15), depth: round(envelope.depth * recipe.depthScale * 0.7), rotationY: round(envelope.rotation + (index % 2 ? 0.08 : -0.08)), material: signature.materials.frame, module: "crown" }));
  }
}

export function compileChicagoBuildingGeometry(
  signature: BuildingVisualSignature,
  envelope: UrbanArchitecturalEnvelope,
  exposure: Record<ChicagoLocalSide, ChicagoExposure>,
  lod: ChicagoLod,
): ChicagoGeometryBox[] {
  const boxes: ChicagoGeometryBox[] = [];
  const { baseHeight } = pushBody(boxes, envelope, signature, lod);
  pushBaseVariant(boxes, envelope, signature, lod, exposure, baseHeight);
  pushFacade(boxes, envelope, signature, lod, exposure, baseHeight);
  pushCorner(boxes, envelope, signature, lod, exposure, baseHeight);
  pushTop(boxes, envelope, signature, lod);
  return boxes;
}

function pushStorefront(boxes: ChicagoGeometryBox[], storefront: UrbanStorefront, signature: BuildingVisualSignature, programSignature: string) {
  const loading = storefront.category === "repair-shop";
  const lobby = storefront.category === "hotel-lobby";
  const cafe = storefront.category === "corner-cafe" || storefront.category === "restaurant" || storefront.category === "bakery";
  const glassHeight = loading ? 1.55 : lobby ? 1.72 : 1.28;
  const tangentX = Math.cos(storefront.rotation);
  const tangentZ = -Math.sin(storefront.rotation);
  const add = (suffix: string, width: number, height: number, depth: number, material: ChicagoRenderMaterialKey, module: ChicagoModuleKind, x = storefront.x, z = storefront.z, y = BASE_Y + height / 2 + 0.06, primitive: ChicagoModulePrimitive = "box") => boxes.push(coreBox(signature, "lod0", { id: `${storefront.id}:${suffix}`, x: round(x), y: round(y), z: round(z), width: round(width), height: round(height), depth, rotationY: storefront.rotation, material, module, primitive, exposure: "primary-street", storefrontId: storefront.id }));
  add("interior", storefront.width * 0.88, glassHeight, 0.1, loading ? "dark-structural-steel" : "warm-interior", loading ? "entrance" : "storefront");
  add("glass", storefront.width * 0.83, glassHeight * 0.9, 0.09, loading ? "dark-structural-steel" : "clear-storefront-glass", loading ? "entrance" : "storefront", storefront.x, storefront.z, BASE_Y + glassHeight * 0.45 + 0.06, "recessed-lobby");
  for (const side of [-1, 1]) add(`frame:${side}`, Math.max(0.055, storefront.width * 0.035), glassHeight, 0.13, signature.materials.frame, "ground-floor", storefront.x + tangentX * side * storefront.width * 0.43, storefront.z + tangentZ * side * storefront.width * 0.43);
  if (!loading) for (const offset of [-0.2, 0.2]) add(`mullion:${offset}`, Math.max(0.045, storefront.width * 0.022), glassHeight, 0.14, signature.materials.frame, "mullion", storefront.x + tangentX * offset * storefront.width, storefront.z + tangentZ * offset * storefront.width);
  add(`sign:${programSignature}`, storefront.width * 0.9, 0.24, 0.16, lobby ? "civic-accent" : signature.materials.wall, "ground-floor", storefront.x, storefront.z, BASE_Y + glassHeight + 0.23);
  if (cafe || storefront.category === "bookshop" || storefront.category === "neighborhood-grocer") add("awning", storefront.width * 0.86, 0.09, cafe ? 0.48 : 0.34, cafe ? "canvas-awning" : signature.materials.frame, "awning", storefront.x, storefront.z, BASE_Y + glassHeight + 0.04, "awning-wedge");
}

function contextBox(signature: ContextVisualSignature, lod: ChicagoLod, input: Omit<ChicagoGeometryBox, "lod" | "semantic" | "contextId">): ChicagoGeometryBox {
  return { ...input, lod, semantic: false, contextId: signature.contextId };
}

function pushContextBuilding(boxes: ChicagoGeometryBox[], building: VisualContextBuilding, signature: ContextVisualSignature, lod: ChicagoLod) {
  const baseHeight = Math.min(1.55, building.height * 0.18);
  const detail = lod === "lod0" ? (signature.ring === 1 ? 2 : signature.ring === 2 ? 1 : 0) : lod === "lod1" ? (signature.ring === 1 ? 1 : 0) : 0;
  const inset = signature.massingVariant === "base-shaft-top" ? 0.06 : signature.massingVariant === "setback-shoulder" ? 0.12 : 0.18;
  const shaftWidth = building.width * (1 - inset);
  const shaftDepth = building.depth * (1 - inset);
  const shaftHeight = Math.max(1, building.height - baseHeight);
  const upperScale = signature.massingVariant === "setback-shoulder" ? 0.72 : 1;
  const lowerShaftHeight = signature.massingVariant === "setback-shoulder" ? shaftHeight * 0.72 : shaftHeight;
  const upperShaftHeight = shaftHeight - lowerShaftHeight;
  const shaftMaterial = signature.materials.wall === "dark-structural-steel"
    ? "architectural-concrete"
    : signature.materials.wall;
  const roofRecipe = chicagoRoofRecipe(signature.family, signature.roofVariant);
  boxes.push(
    contextBox(signature, lod, { id: `${signature.contextId}:${lod}:base`, x: building.x, y: round(BASE_Y + baseHeight / 2), z: building.z, width: building.width, height: round(baseHeight), depth: building.depth, rotationY: 0, material: signature.materials.base, module: "context-base" }),
    contextBox(signature, lod, { id: `${signature.contextId}:${lod}:middle`, x: building.x, y: round(BASE_Y + baseHeight + lowerShaftHeight / 2), z: building.z, width: round(shaftWidth), height: round(lowerShaftHeight), depth: round(shaftDepth), rotationY: 0, material: shaftMaterial, module: "context-middle" }),
    contextBox(signature, lod, { id: `${signature.contextId}:${lod}:top`, x: building.x, y: round(BASE_Y + building.height + 0.3), z: building.z, width: round(shaftWidth * roofRecipe.widthScale * 0.78), height: 0.6, depth: round(shaftDepth * roofRecipe.depthScale * 0.66), rotationY: 0, material: signature.materials.roof, module: "context-top", primitive: roofRecipe.primitive }),
  );
  if (upperShaftHeight > 0) boxes.push(contextBox(signature, lod, {
    id: `${signature.contextId}:${lod}:middle-upper`,
    x: round(building.x + roofRecipe.offset * 0.35),
    y: round(BASE_Y + baseHeight + lowerShaftHeight + upperShaftHeight / 2),
    z: building.z,
    width: round(shaftWidth * upperScale),
    height: round(upperShaftHeight),
    depth: round(shaftDepth * upperScale),
    rotationY: 0,
    material: shaftMaterial,
    module: "context-middle",
  }));
  if (detail > 0) {
    const windowMaterial = signature.materials.glass ?? "smoked-office-glass";
    const groundBays = detail === 2 ? 4 : 3;
    for (let bay = 0; bay < groundBays; bay += 1) boxes.push(contextBox(signature, lod, {
      id: `${signature.contextId}:${lod}:ground-opening:${bay}`,
      x: round(building.x - building.width * 0.38 + building.width * 0.76 * (bay + 0.5) / groundBays),
      y: round(BASE_Y + baseHeight * 0.48),
      z: round(building.z - building.depth / 2 - 0.045),
      width: round(building.width * 0.6 / groundBays),
      height: round(baseHeight * 0.62),
      depth: 0.09,
      rotationY: 0,
      material: windowMaterial,
      module: "context-window-band",
      primitive: "arcade-opening",
    }));
    const pushFacadeGrid = (suffix: string, width: number, depth: number, height: number, y: number, xOffset = 0) => {
      const x = building.x + xOffset;
      boxes.push(
        contextBox(signature, lod, { id: `${signature.contextId}:${lod}:${suffix}:front`, x, y, z: round(building.z - depth / 2 - 0.045), width: round(width * 0.9), height: round(height * 0.9), depth: 0.09, rotationY: 0, material: windowMaterial, module: "context-window-band", primitive: "context-facade-grid" }),
        contextBox(signature, lod, { id: `${signature.contextId}:${lod}:${suffix}:back`, x, y, z: round(building.z + depth / 2 + 0.045), width: round(width * 0.9), height: round(height * 0.9), depth: 0.09, rotationY: Math.PI, material: windowMaterial, module: "context-window-band", primitive: "context-facade-grid" }),
        contextBox(signature, lod, { id: `${signature.contextId}:${lod}:${suffix}:right`, x: round(x + width / 2 + 0.045), y, z: building.z, width: round(depth * 0.9), height: round(height * 0.9), depth: 0.09, rotationY: Math.PI / 2, material: windowMaterial, module: "context-window-band", primitive: "context-facade-grid" }),
        contextBox(signature, lod, { id: `${signature.contextId}:${lod}:${suffix}:left`, x: round(x - width / 2 - 0.045), y, z: building.z, width: round(depth * 0.9), height: round(height * 0.9), depth: 0.09, rotationY: -Math.PI / 2, material: windowMaterial, module: "context-window-band", primitive: "context-facade-grid" }),
      );
    };
    pushFacadeGrid("facade-lower", shaftWidth, shaftDepth, lowerShaftHeight, BASE_Y + baseHeight + lowerShaftHeight / 2);
    if (upperShaftHeight > 0) pushFacadeGrid("facade-upper", shaftWidth * upperScale, shaftDepth * upperScale, upperShaftHeight, BASE_Y + baseHeight + lowerShaftHeight + upperShaftHeight / 2, roofRecipe.offset * 0.35);
  }
}

function groupByMaterial(boxes: ChicagoGeometryBox[]) {
  return Object.fromEntries(ALL_MATERIALS.map((material) => [material, boxes.filter((box) => box.material === material)])) as Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>;
}

export function chicagoBuildingGeometryFingerprint(boxes: readonly ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope): string {
  const cosine = Math.cos(envelope.rotation);
  const sine = Math.sin(envelope.rotation);
  const normalized = boxes.map((box) => {
    const dx = box.x - envelope.x;
    const dz = box.z - envelope.z;
    return [box.module, box.primitive ?? "box", round(dx * cosine - dz * sine), round(box.y - BASE_Y), round(dx * sine + dz * cosine), round(box.width), round(box.height), round(box.depth), round(box.rotationY - envelope.rotation), box.material].join(":");
  }).sort();
  return stableDefinitionHash(normalized);
}

function metricFingerprint(boxes: readonly ChicagoGeometryBox[], envelope: UrbanArchitecturalEnvelope, modules: readonly ChicagoModuleKind[]) {
  return chicagoBuildingGeometryFingerprint(boxes.filter((box) => modules.includes(box.module)), envelope);
}

export function measureChicagoKitV2CompiledGeometry(
  boxes: readonly ChicagoGeometryBox[],
  plan: ChicagoKitV2Plan,
  fabric: UrbanFabricPlan,
): ChicagoCompiledMetrics {
  const signatureByEnvelope = new Map(plan.signatures.map((signature) => [signature.envelopeId, signature]));
  const served = new Map<string, number>();
  for (const box of boxes) if (box.storefrontId && (box.module === "storefront" || box.module === "entrance")) served.set(box.storefrontId, Math.max(served.get(box.storefrontId) ?? 0, box.width));
  const coverage = (storefronts: readonly UrbanStorefront[]) => storefronts.length === 0 ? 0 : round(storefronts.reduce((sum, item) => sum + (served.get(item.id) ?? 0), 0) / storefronts.reduce((sum, item) => sum + item.width, 0) * 100);
  const fulton = fabric.storefronts.filter((item) => signatureByEnvelope.get(item.architecturalEnvelopeId)?.characterZone === "fulton-market");
  const required: Record<1 | 2 | 3, readonly ChicagoModuleKind[]> = {
    1: ["context-base", "context-middle", "context-top", "context-window-band"],
    2: ["context-base", "context-middle", "context-top", "context-window-band"],
    3: ["context-base", "context-middle", "context-top"],
  };
  let blankContextFallbackCount = 0;
  for (const signature of plan.contextSignatures) {
    const kinds = new Set(boxes.filter((box) => box.contextId === signature.contextId).map((box) => box.module));
    if (required[signature.ring].some((kind) => !kinds.has(kind))) blankContextFallbackCount += 1;
  }
  const envelopeById = new Map(fabric.architecturalEnvelopes.map((item) => [item.id, item]));
  const fingerprints = { building: new Set<string>(), rhythm: new Set<string>(), base: new Set<string>(), corner: new Set<string>(), roof: new Set<string>() };
  for (const signature of plan.signatures) {
    const envelope = envelopeById.get(signature.envelopeId)!;
    const owned = boxes.filter((box) => box.envelopeId === signature.envelopeId && !box.storefrontId);
    fingerprints.building.add(chicagoBuildingGeometryFingerprint(owned, envelope));
    fingerprints.rhythm.add(metricFingerprint(owned, envelope, ["window", "mullion", "spandrel"]));
    fingerprints.base.add(metricFingerprint(owned, envelope, ["base", "ground-floor"]));
    const corner = owned.filter((box) => box.module === "corner");
    if (corner.length > 0) fingerprints.corner.add(chicagoBuildingGeometryFingerprint(corner, envelope));
    fingerprints.roof.add(metricFingerprint(owned, envelope, ["top", "cornice", "roof-house", "crown"]));
  }
  const exposureCounts = Object.fromEntries((["primary-street", "secondary-street", "exposed-end", "party-wall", "rear-service"] as ChicagoExposure[]).map((value) => [value, boxes.filter((box) => box.exposure === value).length])) as Record<ChicagoExposure, number>;
  return {
    activeGroundFloorPct: coverage(fabric.storefronts), fultonActiveGroundFloorPct: coverage(fulton), blankContextFallbackCount,
    distinctBuildingGeometryCount: fingerprints.building.size, distinctRhythmGeometryCount: fingerprints.rhythm.size,
    distinctBaseGeometryCount: fingerprints.base.size, distinctCornerGeometryCount: fingerprints.corner.size,
    distinctRoofGeometryCount: fingerprints.roof.size, exposureCounts,
  };
}

export function selectChicagoLod(distance: number, current?: ChicagoLod): ChicagoLod {
  const { lod0MaxDistance, lod1MaxDistance, hysteresis } = CHICAGO_KIT_V2_DEFINITION.lod;
  if (!current) return distance <= lod0MaxDistance ? "lod0" : distance <= lod1MaxDistance ? "lod1" : "lod2";
  if (current === "lod0") return distance > lod0MaxDistance + hysteresis ? (distance > lod1MaxDistance ? "lod2" : "lod1") : "lod0";
  if (current === "lod1") return distance < lod0MaxDistance - hysteresis ? "lod0" : distance > lod1MaxDistance + hysteresis ? "lod2" : "lod1";
  return distance < lod1MaxDistance - hysteresis ? (distance < lod0MaxDistance ? "lod0" : "lod1") : "lod2";
}

export function buildChicagoKitV2Geometry(
  plan: ChicagoKitV2Plan,
  fabric: UrbanFabricPlan,
  visualCity: VisualCityPlan,
  hiddenSemanticBuildingIds: ReadonlySet<string> = new Set<string>(),
): ChicagoKitV2Geometry {
  const tierBoxes: Record<ChicagoLod, ChicagoGeometryBox[]> = { lod0: [], lod1: [], lod2: [] };
  const envelopeById = new Map(fabric.architecturalEnvelopes.map((envelope) => [envelope.id, envelope]));
  const signatureByEnvelope = new Map(plan.signatures.map((signature) => [signature.envelopeId, signature]));
  for (const signature of plan.signatures) {
    if (hiddenSemanticBuildingIds.has(signature.semanticBuildingId)) continue;
    const envelope = envelopeById.get(signature.envelopeId);
    if (!envelope) throw new Error(`Chicago Kit v2 missing envelope ${signature.envelopeId}`);
    const exposure = classifyChicagoEnvelopeExposure(envelope, fabric.architecturalEnvelopes);
    for (const lod of ["lod0", "lod1", "lod2"] as const) tierBoxes[lod].push(...compileChicagoBuildingGeometry(signature, envelope, exposure, lod));
  }
  const storefrontProgramById = new Map(plan.storefrontPrograms.map((program) => [program.storefrontId, program]));
  for (const storefront of fabric.storefronts) {
    const signature = signatureByEnvelope.get(storefront.architecturalEnvelopeId);
    if (!signature) throw new Error(`Chicago Kit v2 missing storefront owner ${storefront.architecturalEnvelopeId}`);
    if (!hiddenSemanticBuildingIds.has(signature.semanticBuildingId)) pushStorefront(tierBoxes.lod0, storefront, signature, storefrontProgramById.get(storefront.id)?.signature ?? "entry");
  }
  const contextById = new Map(visualCity.contextBuildings.map((building) => [building.contextId, building]));
  for (const signature of plan.contextSignatures) {
    const building = contextById.get(signature.contextId);
    if (!building) throw new Error(`Chicago Kit v2 missing context building ${signature.contextId}`);
    for (const lod of ["lod0", "lod1", "lod2"] as const) pushContextBuilding(tierBoxes[lod], building, signature, lod);
  }
  for (const lod of ["lod0", "lod1", "lod2"] as const) {
    for (const block of visualCity.contextBlocks) tierBoxes[lod].push({ id: `${block.contextId}:${lod}:ground`, x: block.x, y: 0.025, z: block.z, width: block.width, height: 0.05, depth: block.depth, rotationY: 0, material: "context-ground", module: "context-ground", lod, semantic: false, contextId: block.contextId });
    for (const road of visualCity.contextRoads) {
      const [start, end] = road.centerline;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      tierBoxes[lod].push({ id: `${road.contextId}:${lod}`, x: round((start.x + end.x) / 2), y: 0.095, z: round((start.z + end.z) / 2), width: round(Math.hypot(dx, dz)), height: 0.05, depth: road.width, rotationY: -Math.atan2(dz, dx), material: "context-road", module: "context-road", lod, semantic: false, contextId: road.contextId });
    }
  }
  const tiers = Object.fromEntries((["lod0", "lod1", "lod2"] as ChicagoLod[]).map((lod) => [lod, { boxes: tierBoxes[lod], byMaterial: groupByMaterial(tierBoxes[lod]), moduleCount: tierBoxes[lod].length }])) as Record<ChicagoLod, ChicagoGeometryTier>;
  const boxes = tiers.lod0.boxes;
  return {
    tiers, boxes, byMaterial: tiers.lod0.byMaterial,
    coreModuleCount: boxes.filter((box) => box.semantic && !box.storefrontId).length,
    contextModuleCount: boxes.filter((box) => !box.semantic).length,
    storefrontModuleCount: boxes.filter((box) => Boolean(box.storefrontId)).length,
    semanticEnvelopeIds: [...new Set(boxes.flatMap((box) => box.envelopeId ? [box.envelopeId] : []))].sort(),
    metrics: measureChicagoKitV2CompiledGeometry(boxes, plan, fabric),
  };
}
