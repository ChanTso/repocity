import type {
  BuildingVisualSignature,
  ChicagoKitV2Plan,
  ChicagoMaterialKey,
  ContextVisualSignature,
} from "./chicago-kit-v2";
import type {
  UrbanArchitecturalEnvelope,
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
  | "spandrel"
  | "corner"
  | "end-wall"
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
  semantic: boolean;
  envelopeId?: string;
  semanticBuildingId?: string;
  primaryEntityId?: string;
  componentId?: string;
  contextId?: string;
}

export interface ChicagoKitV2Geometry {
  boxes: ChicagoGeometryBox[];
  byMaterial: Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>;
  coreModuleCount: number;
  contextModuleCount: number;
  storefrontModuleCount: number;
  semanticEnvelopeIds: string[];
}

const BASE_Y = 0.24;
const ALL_MATERIALS: readonly ChicagoRenderMaterialKey[] = [
  "warm-red-brick",
  "dark-aged-brick",
  "buff-brick",
  "cream-terra-cotta",
  "limestone",
  "dark-granite",
  "architectural-concrete",
  "dark-structural-steel",
  "weathered-bronze",
  "roof-membrane",
  "smoked-office-glass",
  "blue-green-office-glass",
  "clear-storefront-glass",
  "masonry-shadow-joint",
  "warm-interior",
  "context-ground",
  "context-road",
  "canvas-awning",
  "civic-accent",
] as const;

function round(value: number): number {
  return Number(value.toFixed(4));
}

function localPoint(
  envelope: UrbanArchitecturalEnvelope,
  localX: number,
  localZ: number,
): { x: number; z: number } {
  const cosine = Math.cos(envelope.rotation);
  const sine = Math.sin(envelope.rotation);
  return {
    x: round(envelope.x + localX * cosine + localZ * sine),
    z: round(envelope.z - localX * sine + localZ * cosine),
  };
}

function coreBox(
  signature: BuildingVisualSignature,
  input: Omit<ChicagoGeometryBox, "semantic" | "envelopeId" | "semanticBuildingId" | "primaryEntityId" | "componentId">,
): ChicagoGeometryBox {
  return {
    ...input,
    semantic: true,
    envelopeId: signature.envelopeId,
    semanticBuildingId: signature.semanticBuildingId,
    primaryEntityId: signature.primaryEntityId,
    componentId: signature.componentId,
  };
}

function pushBody(
  boxes: ChicagoGeometryBox[],
  envelope: UrbanArchitecturalEnvelope,
  signature: BuildingVisualSignature,
): { baseHeight: number; shaftWidth: number; shaftDepth: number; shaftHeight: number } {
  const civic = signature.family === "civic-institutional";
  const warehouse = signature.family === "fulton-brick-warehouse" || signature.family === "narrow-storefront-row";
  const podiumTower =
    signature.massingProfile.includes("tower") ||
    signature.massingProfile.includes("slab") ||
    signature.family === "riverfront-terrace" ||
    signature.family === "art-deco-setback";
  const baseHeight = Math.min(
    envelope.height * (podiumTower ? 0.28 : warehouse ? 0.22 : 0.2),
    civic ? 3.4 : podiumTower ? 4.3 : 2.45,
  );
  const shaftInset = podiumTower ? (signature.family === "art-deco-setback" ? 0.16 : 0.11) : warehouse ? 0.025 : 0.055;
  const shaftWidth = envelope.width * (1 - shaftInset * 2);
  const shaftDepth = envelope.depth * (1 - shaftInset * 2);
  const shaftHeight = Math.max(1.2, envelope.height - baseHeight);
  boxes.push(
    coreBox(signature, {
      id: `${signature.envelopeId}:base`,
      x: envelope.x,
      y: round(BASE_Y + baseHeight / 2),
      z: envelope.z,
      width: envelope.width,
      height: round(baseHeight),
      depth: envelope.depth,
      rotationY: envelope.rotation,
      material: signature.materials.base,
      module: "base",
    }),
    coreBox(signature, {
      id: `${signature.envelopeId}:middle`,
      x: envelope.x,
      y: round(BASE_Y + baseHeight + shaftHeight / 2),
      z: envelope.z,
      width: round(shaftWidth),
      height: round(shaftHeight),
      depth: round(shaftDepth),
      rotationY: envelope.rotation,
      material: signature.glassSystem ? signature.materials.glass! : signature.materials.wall,
      module: "middle",
    }),
  );
  if (podiumTower) {
    const shoulderHeight = Math.max(0.22, Math.min(0.55, envelope.height * 0.035));
    boxes.push(coreBox(signature, {
      id: `${signature.envelopeId}:shoulder`,
      x: envelope.x,
      y: round(BASE_Y + baseHeight + shoulderHeight / 2),
      z: envelope.z,
      width: round(envelope.width * 0.94),
      height: round(shoulderHeight),
      depth: round(envelope.depth * 0.94),
      rotationY: envelope.rotation,
      material: signature.materials.frame,
      module: "setback",
    }));
  }
  return { baseHeight, shaftWidth, shaftDepth, shaftHeight };
}

function facadeBox(
  signature: BuildingVisualSignature,
  envelope: UrbanArchitecturalEnvelope,
  side: "front" | "back" | "left" | "right",
  offset: number,
  y: number,
  span: number,
  height: number,
  projection: number,
  material: ChicagoRenderMaterialKey,
  module: ChicagoModuleKind,
  id: string,
): ChicagoGeometryBox {
  const frontBack = side === "front" || side === "back";
  const normal = side === "front" || side === "right" ? 1 : -1;
  const localX = frontBack ? offset : normal * (envelope.width / 2 + projection / 2);
  const localZ = frontBack ? normal * (envelope.depth / 2 + projection / 2) : offset;
  const point = localPoint(envelope, localX, localZ);
  return coreBox(signature, {
    id,
    x: point.x,
    y: round(y),
    z: point.z,
    width: round(span),
    height: round(height),
    depth: round(projection),
    rotationY: envelope.rotation + (frontBack ? 0 : Math.PI / 2),
    material,
    module,
  });
}

function pushFacade(
  boxes: ChicagoGeometryBox[],
  envelope: UrbanArchitecturalEnvelope,
  signature: BuildingVisualSignature,
  baseHeight: number,
): void {
  const warehouse = signature.family === "fulton-brick-warehouse";
  const civic = signature.family === "civic-institutional";
  const glass = Boolean(signature.glassSystem);
  const windowMaterial = signature.materials.glass ?? "smoked-office-glass";
  const floorCount = Math.max(2, signature.floorCount);
  const availableHeight = Math.max(1, envelope.height - baseHeight - 0.35);
  const floorHeight = availableHeight / floorCount;
  for (const side of ["front", "back", "left", "right"] as const) {
    const frontBack = side === "front" || side === "back";
    const span = frontBack ? envelope.width : envelope.depth;
    const bayCount = frontBack ? signature.frontageBayCount : signature.sideBayCount;
    const bayWidth = span / bayCount;
    const windowRatio = glass ? 0.84 : warehouse ? 0.66 : civic ? 0.52 : 0.58;
    const heightRatio = glass ? 0.72 : warehouse ? 0.58 : 0.52;
    for (let floor = 0; floor < floorCount; floor += 1) {
      const y = BASE_Y + baseHeight + floorHeight * (floor + 0.52);
      for (let bay = 0; bay < bayCount; bay += 1) {
        const offset = -span / 2 + bayWidth * (bay + 0.5);
        boxes.push(facadeBox(
          signature,
          envelope,
          side,
          offset,
          y,
          bayWidth * windowRatio,
          floorHeight * heightRatio,
          glass ? 0.055 : 0.075,
          windowMaterial,
          "window",
          `${signature.envelopeId}:${side}:window:${floor}:${bay}`,
        ));
      }
      const bandMaterial = signature.glassSystem === "unitized-vision-spandrel"
        ? signature.materials.wall
        : glass
          ? signature.materials.frame
          : signature.materials.base;
      boxes.push(facadeBox(
        signature,
        envelope,
        side,
        0,
        BASE_Y + baseHeight + floorHeight * (floor + 0.04),
        span * 0.98,
        glass ? 0.075 : warehouse ? 0.11 : 0.08,
        glass ? 0.08 : 0.105,
        bandMaterial,
        glass ? "spandrel" : "middle",
        `${signature.envelopeId}:${side}:floor-band:${floor}`,
      ));
    }
    const verticalStride = signature.glassSystem === "miesian-expressed-grid" ? 1 : signature.glassSystem === "bronze-vertical-fins" ? 1 : 2;
    for (let bay = 0; bay <= bayCount; bay += verticalStride) {
      const offset = -span / 2 + bayWidth * bay;
      boxes.push(facadeBox(
        signature,
        envelope,
        side,
        offset,
        BASE_Y + baseHeight + availableHeight / 2,
        signature.glassSystem === "bronze-vertical-fins" ? 0.1 : glass ? 0.065 : Math.max(0.09, bayWidth * 0.1),
        availableHeight,
        signature.glassSystem === "bronze-vertical-fins" ? 0.24 : 0.12,
        glass ? signature.materials.frame : signature.materials.wall,
        signature.glassSystem === "bronze-vertical-fins" ? "corner" : "middle",
        `${signature.envelopeId}:${side}:pier:${bay}`,
      ));
    }
    if (!glass) {
      const jointEvery = warehouse ? 2 : 3;
      for (let floor = jointEvery; floor < floorCount; floor += jointEvery) {
        boxes.push(facadeBox(
          signature,
          envelope,
          side,
          0,
          BASE_Y + baseHeight + floorHeight * floor,
          span * 0.99,
          0.045,
          0.09,
          signature.materials.base,
          "middle",
          `${signature.envelopeId}:${side}:masonry-course:${floor}`,
        ));
      }
    }
  }
  if (civic) {
    for (const side of ["front", "back"] as const) {
      const columns = Math.max(3, Math.min(7, signature.frontageBayCount));
      for (let index = 0; index <= columns; index += 1) {
        const offset = -envelope.width * 0.42 + (envelope.width * 0.84 / columns) * index;
        boxes.push(facadeBox(
          signature,
          envelope,
          side,
          offset,
          BASE_Y + Math.min(2.1, baseHeight) / 2,
          0.18,
          Math.min(2.1, baseHeight),
          0.3,
          "civic-accent",
          "ground-floor",
          `${signature.envelopeId}:${side}:civic-column:${index}`,
        ));
      }
      boxes.push(facadeBox(
        signature,
        envelope,
        side,
        0,
        BASE_Y + Math.min(2.1, baseHeight) + 0.12,
        envelope.width * 0.92,
        0.24,
        0.34,
        signature.materials.base,
        "ground-floor",
        `${signature.envelopeId}:${side}:civic-entablature`,
      ));
    }
  }
}

function pushCorners(
  boxes: ChicagoGeometryBox[],
  envelope: UrbanArchitecturalEnvelope,
  signature: BuildingVisualSignature,
  baseHeight: number,
): void {
  const height = Math.max(1, envelope.height - baseHeight * 0.35);
  const chamfered = signature.cornerVariant.includes("chamfer") || signature.cornerVariant.includes("recessed");
  for (const xSide of [-1, 1] as const) {
    for (const zSide of [-1, 1] as const) {
      const point = localPoint(
        envelope,
        xSide * (envelope.width / 2 + 0.045),
        zSide * (envelope.depth / 2 + 0.045),
      );
      boxes.push(coreBox(signature, {
        id: `${signature.envelopeId}:corner:${xSide}:${zSide}`,
        x: point.x,
        y: round(BASE_Y + baseHeight * 0.35 + height / 2),
        z: point.z,
        width: chamfered ? 0.18 : 0.26,
        height: round(height),
        depth: chamfered ? 0.36 : 0.2,
        rotationY: envelope.rotation + (chamfered ? Math.PI / 4 : 0),
        material: signature.cornerVariant.includes("glass") ? signature.materials.glass! : signature.materials.frame,
        module: "corner",
      }));
    }
  }
}

function pushTop(
  boxes: ChicagoGeometryBox[],
  envelope: UrbanArchitecturalEnvelope,
  signature: BuildingVisualSignature,
): void {
  const topY = BASE_Y + envelope.height;
  const cornice = signature.roofVariant.includes("cornice") || signature.roofVariant.includes("parapet") || signature.family === "civic-institutional";
  if (cornice) {
    const thickness = signature.family === "civic-institutional" ? 0.34 : 0.2;
    boxes.push(coreBox(signature, {
      id: `${signature.envelopeId}:cornice`,
      x: envelope.x,
      y: round(topY + thickness / 2),
      z: envelope.z,
      width: round(envelope.width * 1.045),
      height: thickness,
      depth: round(envelope.depth * 1.045),
      rotationY: envelope.rotation,
      material: signature.materials.base,
      module: "cornice",
    }));
  }
  const stepped = signature.roofVariant.includes("step") || signature.roofVariant.includes("crown") || signature.roofVariant.includes("terrace");
  const roofHeight = stepped ? Math.min(2.2, Math.max(0.65, envelope.height * 0.1)) : Math.min(1.15, Math.max(0.42, envelope.height * 0.055));
  boxes.push(coreBox(signature, {
    id: `${signature.envelopeId}:roof-house`,
    x: envelope.x,
    y: round(topY + roofHeight / 2 + (cornice ? 0.18 : 0.04)),
    z: envelope.z,
    width: round(envelope.width * (stepped ? 0.48 : 0.62)),
    height: round(roofHeight),
    depth: round(envelope.depth * (stepped ? 0.46 : 0.58)),
    rotationY: envelope.rotation,
    material: signature.roofVariant.includes("glass") ? signature.materials.glass! : signature.materials.roof,
    module: stepped ? "crown" : "roof-house",
  }));
  if (signature.roofVariant.includes("sawtooth")) {
    for (let index = -1; index <= 1; index += 1) {
      const point = localPoint(envelope, index * envelope.width * 0.22, 0);
      boxes.push(coreBox(signature, {
        id: `${signature.envelopeId}:sawtooth:${index}`,
        x: point.x,
        y: round(topY + 0.42),
        z: point.z,
        width: round(envelope.width * 0.18),
        height: 0.42,
        depth: round(envelope.depth * 0.52),
        rotationY: envelope.rotation + 0.14,
        material: signature.materials.roof,
        module: "roof-house",
      }));
    }
  }
}

function storefrontOwner(
  storefront: UrbanStorefront,
  signatureByEnvelope: ReadonlyMap<string, BuildingVisualSignature>,
): BuildingVisualSignature {
  const signature = signatureByEnvelope.get(storefront.architecturalEnvelopeId);
  if (!signature) throw new Error(`Chicago Kit v2 missing storefront owner ${storefront.architecturalEnvelopeId}`);
  return signature;
}

function pushStorefront(
  boxes: ChicagoGeometryBox[],
  storefront: UrbanStorefront,
  signature: BuildingVisualSignature,
  programSignature: string,
): void {
  const loading = storefront.category === "repair-shop";
  const lobby = storefront.category === "hotel-lobby";
  const cafe = storefront.category === "corner-cafe" || storefront.category === "restaurant" || storefront.category === "bakery";
  const glassHeight = loading ? 1.55 : lobby ? 1.72 : 1.28;
  boxes.push(coreBox(signature, {
    id: `${storefront.id}:interior`,
    x: storefront.x,
    y: round(BASE_Y + glassHeight / 2 + 0.08),
    z: storefront.z,
    width: round(storefront.width * 0.88),
    height: glassHeight,
    depth: 0.1,
    rotationY: storefront.rotation,
    material: loading ? "dark-structural-steel" : "warm-interior",
    module: loading ? "entrance" : "storefront",
  }));
  boxes.push(coreBox(signature, {
    id: `${storefront.id}:glass`,
    x: storefront.x,
    y: round(BASE_Y + glassHeight / 2 + 0.06),
    z: storefront.z,
    width: round(storefront.width * 0.83),
    height: round(glassHeight * 0.9),
    depth: 0.09,
    rotationY: storefront.rotation,
    material: loading ? "dark-structural-steel" : "clear-storefront-glass",
    module: loading ? "entrance" : "storefront",
  }));
  const frameWidth = Math.max(0.055, storefront.width * 0.035);
  for (const side of [-1, 1] as const) {
    const tangentX = Math.cos(storefront.rotation);
    const tangentZ = -Math.sin(storefront.rotation);
    boxes.push(coreBox(signature, {
      id: `${storefront.id}:frame:${side}`,
      x: round(storefront.x + tangentX * side * storefront.width * 0.43),
      y: round(BASE_Y + glassHeight / 2 + 0.08),
      z: round(storefront.z + tangentZ * side * storefront.width * 0.43),
      width: frameWidth,
      height: glassHeight,
      depth: 0.13,
      rotationY: storefront.rotation,
      material: signature.materials.frame,
      module: "ground-floor",
    }));
  }
  if (!loading) {
    const tangentX = Math.cos(storefront.rotation);
    const tangentZ = -Math.sin(storefront.rotation);
    for (const offset of [-0.2, 0.2]) {
      boxes.push(coreBox(signature, {
        id: `${storefront.id}:mullion:${offset}`,
        x: round(storefront.x + tangentX * offset * storefront.width),
        y: round(BASE_Y + glassHeight / 2 + 0.08),
        z: round(storefront.z + tangentZ * offset * storefront.width),
        width: Math.max(0.045, storefront.width * 0.022),
        height: glassHeight,
        depth: 0.14,
        rotationY: storefront.rotation,
        material: signature.materials.frame,
        module: lobby ? "entrance" : "storefront",
      }));
    }
  }
  boxes.push(coreBox(signature, {
    id: `${storefront.id}:sign:${programSignature}`,
    x: storefront.x,
    y: round(BASE_Y + glassHeight + 0.23),
    z: storefront.z,
    width: round(storefront.width * 0.9),
    height: 0.24,
    depth: 0.16,
    rotationY: storefront.rotation,
    material: lobby ? "civic-accent" : signature.materials.wall,
    module: "ground-floor",
  }));
  if (cafe || storefront.category === "bookshop" || storefront.category === "neighborhood-grocer") {
    boxes.push(coreBox(signature, {
      id: `${storefront.id}:awning`,
      x: storefront.x,
      y: round(BASE_Y + glassHeight + 0.04),
      z: storefront.z,
      width: round(storefront.width * 0.86),
      height: 0.09,
      depth: cafe ? 0.48 : 0.34,
      rotationY: storefront.rotation,
      material: cafe ? "canvas-awning" : signature.materials.frame,
      module: "awning",
    }));
  }
}

function contextBox(
  signature: ContextVisualSignature,
  input: Omit<ChicagoGeometryBox, "semantic" | "contextId">,
): ChicagoGeometryBox {
  return { ...input, semantic: false, contextId: signature.contextId };
}

function pushContextBuilding(
  boxes: ChicagoGeometryBox[],
  building: VisualContextBuilding,
  signature: ContextVisualSignature,
): void {
  const baseHeight = Math.min(1.55, building.height * 0.18);
  const setback = signature.massingVariant !== "base-shaft-top";
  const shaftWidth = building.width * (setback ? 0.82 : 0.94);
  const shaftDepth = building.depth * (setback ? 0.82 : 0.94);
  const shaftHeight = Math.max(1, building.height - baseHeight);
  const glassFamily =
    signature.family === "miesian-grid" ||
    signature.family === "blue-green-curtain-wall" ||
    signature.family === "bronze-vertical-modern" ||
    signature.family === "riverfront-terrace";
  boxes.push(
    contextBox(signature, {
      id: `${signature.contextId}:base`,
      x: building.x,
      y: round(BASE_Y + baseHeight / 2),
      z: building.z,
      width: building.width,
      height: round(baseHeight),
      depth: building.depth,
      rotationY: 0,
      material: signature.materials.base,
      module: "context-base",
    }),
    contextBox(signature, {
      id: `${signature.contextId}:middle`,
      x: building.x,
      y: round(BASE_Y + baseHeight + shaftHeight / 2),
      z: building.z,
      width: round(shaftWidth),
      height: round(shaftHeight),
      depth: round(shaftDepth),
      rotationY: 0,
      material: glassFamily ? signature.materials.glass! : signature.materials.wall,
      module: "context-middle",
    }),
  );
  const roofHeight = signature.roofVariant.includes("crown") || signature.roofVariant.includes("step") ? 1.15 : 0.48;
  boxes.push(contextBox(signature, {
    id: `${signature.contextId}:top`,
    x: building.x,
    y: round(BASE_Y + building.height + roofHeight / 2),
    z: building.z,
    width: round(shaftWidth * (signature.roofVariant.includes("step") ? 0.6 : 0.76)),
    height: roofHeight,
    depth: round(shaftDepth * (signature.roofVariant.includes("step") ? 0.58 : 0.74)),
    rotationY: 0,
    material: signature.materials.roof,
    module: "context-top",
  }));
  if (signature.ring <= 2) {
    const bands = signature.ring === 1
      ? Math.max(2, Math.min(8, Math.floor(building.height / 1.4)))
      : Math.max(2, Math.min(4, Math.floor(building.height / 3.2)));
    for (let index = 0; index < bands; index += 1) {
      const y = BASE_Y + baseHeight + (shaftHeight / bands) * (index + 0.5);
      boxes.push(
        contextBox(signature, {
          id: `${signature.contextId}:front-band:${index}`,
          x: building.x,
          y: round(y),
          z: round(building.z - shaftDepth / 2 - 0.04),
          width: round(shaftWidth * 0.74),
          height: round(Math.min(0.5, shaftHeight / bands * 0.48)),
          depth: 0.06,
          rotationY: 0,
          material: signature.materials.glass ?? "smoked-office-glass",
          module: "context-window-band",
        }),
        contextBox(signature, {
          id: `${signature.contextId}:side-band:${index}`,
          x: round(building.x + shaftWidth / 2 + 0.04),
          y: round(y),
          z: building.z,
          width: round(shaftDepth * 0.7),
          height: round(Math.min(0.5, shaftHeight / bands * 0.48)),
          depth: 0.06,
          rotationY: Math.PI / 2,
          material: signature.materials.glass ?? "smoked-office-glass",
          module: "context-window-band",
        }),
      );
    }
    const pierCount = signature.family === "miesian-grid" ? 4 : signature.family === "fulton-brick-warehouse" ? 3 : 2;
    for (let index = 0; index <= pierCount; index += 1) {
      const offset = -shaftWidth / 2 + (shaftWidth / pierCount) * index;
      boxes.push(contextBox(signature, {
        id: `${signature.contextId}:front-pier:${index}`,
        x: round(building.x + offset),
        y: round(BASE_Y + baseHeight + shaftHeight / 2),
        z: round(building.z - shaftDepth / 2 - 0.055),
        width: signature.family === "miesian-grid" ? 0.08 : 0.13,
        height: round(shaftHeight),
        depth: 0.08,
        rotationY: 0,
        material: glassFamily ? signature.materials.frame : signature.materials.wall,
        module: "context-middle",
      }));
    }
  }
}

export function buildChicagoKitV2Geometry(
  plan: ChicagoKitV2Plan,
  fabric: UrbanFabricPlan,
  visualCity: VisualCityPlan,
  hiddenSemanticBuildingIds: ReadonlySet<string> = new Set<string>(),
): ChicagoKitV2Geometry {
  const boxes: ChicagoGeometryBox[] = [];
  const envelopeById = new Map(fabric.architecturalEnvelopes.map((envelope) => [envelope.id, envelope]));
  const signatureByEnvelope = new Map(plan.signatures.map((signature) => [signature.envelopeId, signature]));
  for (const signature of plan.signatures) {
    if (hiddenSemanticBuildingIds.has(signature.semanticBuildingId)) continue;
    const envelope = envelopeById.get(signature.envelopeId);
    if (!envelope) throw new Error(`Chicago Kit v2 missing envelope ${signature.envelopeId}`);
    const { baseHeight } = pushBody(boxes, envelope, signature);
    pushFacade(boxes, envelope, signature, baseHeight);
    pushCorners(boxes, envelope, signature, baseHeight);
    pushTop(boxes, envelope, signature);
  }
  const storefrontProgramById = new Map(plan.storefrontPrograms.map((program) => [program.storefrontId, program]));
  for (const storefront of fabric.storefronts) {
    const signature = storefrontOwner(storefront, signatureByEnvelope);
    if (hiddenSemanticBuildingIds.has(signature.semanticBuildingId)) continue;
    pushStorefront(boxes, storefront, signature, storefrontProgramById.get(storefront.id)?.signature ?? "entry");
  }
  const contextBuildingById = new Map(visualCity.contextBuildings.map((building) => [building.contextId, building]));
  for (const signature of plan.contextSignatures) {
    const building = contextBuildingById.get(signature.contextId);
    if (!building) throw new Error(`Chicago Kit v2 missing context building ${signature.contextId}`);
    pushContextBuilding(boxes, building, signature);
  }
  for (const block of visualCity.contextBlocks) {
    boxes.push({
      id: `${block.contextId}:ground`,
      x: block.x,
      y: 0.025,
      z: block.z,
      width: block.width,
      height: 0.05,
      depth: block.depth,
      rotationY: 0,
      material: "context-ground",
      module: "context-ground",
      semantic: false,
      contextId: block.contextId,
    });
  }
  for (const road of visualCity.contextRoads) {
    const [start, end] = road.centerline;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    boxes.push({
      id: road.contextId,
      x: round((start.x + end.x) / 2),
      y: 0.095,
      z: round((start.z + end.z) / 2),
      width: round(Math.hypot(dx, dz)),
      height: 0.05,
      depth: road.width,
      rotationY: -Math.atan2(dz, dx),
      material: "context-road",
      module: "context-road",
      semantic: false,
      contextId: road.contextId,
    });
  }
  const byMaterial = Object.fromEntries(
    ALL_MATERIALS.map((material) => [material, boxes.filter((box) => box.material === material)]),
  ) as Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>;
  return {
    boxes,
    byMaterial,
    coreModuleCount: boxes.filter((box) => box.semantic && box.module !== "storefront" && box.module !== "entrance" && box.module !== "awning").length,
    contextModuleCount: boxes.filter((box) => !box.semantic).length,
    storefrontModuleCount: boxes.filter((box) => box.module === "storefront" || box.module === "entrance" || box.module === "awning").length,
    semanticEnvelopeIds: [...new Set(boxes.flatMap((box) => box.envelopeId ? [box.envelopeId] : []))].sort(),
  };
}
