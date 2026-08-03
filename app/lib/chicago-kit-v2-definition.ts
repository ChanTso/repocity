import definitionJson from "./chicago-kit-v2-definition.json";
import type { UrbanFacadeFamily } from "./urban-fabric";

export interface ChicagoRhythmRecipe {
  primitive: "single-recess" | "paired-oriel" | "deep-reveal";
  grouping: number;
  windowWidth: number;
  windowHeight: number;
  reveal: number;
  pier: number;
  band: number;
  offset: number;
}

export interface ChicagoBaseRecipe {
  primitive: "arcade-opening" | "recessed-lobby";
  heightScale: number;
  openingWidth: number;
  pierCadence: number;
  recess: number;
  canopyDepth: number;
  plinthHeight: number;
}

export interface ChicagoCornerRecipe {
  primitive: "expressed-pier" | "chamfer-wrap";
  width: number;
  depth: number;
  projection: number;
  rotation: number;
  wrapGlass: number;
  fins: number;
}

export interface ChicagoRoofRecipe {
  primitive: "cornice-cap" | "screen-house" | "stepped-crown";
  style: "cap" | "house" | "crown";
  heightScale: number;
  widthScale: number;
  depthScale: number;
  tiers: number;
  fins: number;
  offset: number;
}

interface ChicagoFamilyDefinition {
  colors: [string, string, string];
  rhythms: [string, string, string];
  bases: [string, string];
  corners: [string, string];
  roofs: [string, string, string];
}

interface ChicagoKitDefinition {
  version: string;
  worldUnitMeters: number;
  lod: {
    lod0MaxDistance: number;
    lod1MaxDistance: number;
    hysteresis: number;
  };
  rhythmRecipes: [ChicagoRhythmRecipe, ChicagoRhythmRecipe, ChicagoRhythmRecipe];
  baseRecipes: [ChicagoBaseRecipe, ChicagoBaseRecipe];
  cornerRecipes: [ChicagoCornerRecipe, ChicagoCornerRecipe];
  roofRecipes: [ChicagoRoofRecipe, ChicagoRoofRecipe, ChicagoRoofRecipe];
  families: Record<UrbanFacadeFamily, ChicagoFamilyDefinition>;
}

export const CHICAGO_KIT_V2_DEFINITION = definitionJson as ChicagoKitDefinition;

function byName<T>(names: readonly string[], recipes: readonly T[], value: string, kind: string): T {
  const index = names.indexOf(value);
  if (index < 0 || !recipes[index]) throw new Error(`Unknown Chicago Kit v2 ${kind} variant: ${value}`);
  return recipes[index];
}

export function chicagoFamilyDefinition(family: UrbanFacadeFamily): ChicagoFamilyDefinition {
  const definition = CHICAGO_KIT_V2_DEFINITION.families[family];
  if (!definition) throw new Error(`Unknown Chicago Kit v2 family: ${family}`);
  return definition;
}

export function chicagoRhythmRecipe(family: UrbanFacadeFamily, value: string): ChicagoRhythmRecipe {
  return byName(chicagoFamilyDefinition(family).rhythms, CHICAGO_KIT_V2_DEFINITION.rhythmRecipes, value, "rhythm");
}

export function chicagoBaseRecipe(family: UrbanFacadeFamily, value: string): ChicagoBaseRecipe {
  return byName(chicagoFamilyDefinition(family).bases, CHICAGO_KIT_V2_DEFINITION.baseRecipes, value, "base");
}

export function chicagoCornerRecipe(family: UrbanFacadeFamily, value: string): ChicagoCornerRecipe {
  return byName(chicagoFamilyDefinition(family).corners, CHICAGO_KIT_V2_DEFINITION.cornerRecipes, value, "corner");
}

export function chicagoRoofRecipe(family: UrbanFacadeFamily, value: string): ChicagoRoofRecipe {
  return byName(chicagoFamilyDefinition(family).roofs, CHICAGO_KIT_V2_DEFINITION.roofRecipes, value, "roof");
}

export function stableDefinitionHash(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function chicagoVariantDefinitionFingerprint(
  family: UrbanFacadeFamily,
  kind: "rhythm" | "base" | "corner" | "roof",
  name: string,
): string {
  const recipe = kind === "rhythm"
    ? chicagoRhythmRecipe(family, name)
    : kind === "base"
      ? chicagoBaseRecipe(family, name)
      : kind === "corner"
        ? chicagoCornerRecipe(family, name)
        : chicagoRoofRecipe(family, name);
  return stableDefinitionHash({ family, kind, recipe });
}

export function chicagoAssetRootMap(family: UrbanFacadeFamily) {
  const value = chicagoFamilyDefinition(family);
  return {
    bases: Object.fromEntries(value.bases.map((name) => [name, `base-${name}`])),
    rhythms: Object.fromEntries(value.rhythms.map((name) => [name, `middle-${name}`])),
    corners: Object.fromEntries(value.corners.map((name) => [name, `corner-${name}`])),
    roofs: Object.fromEntries(value.roofs.map((name) => [name, `roof-${name}`])),
    exposure: {
      exposedEnd: "end-wall-exposed",
      partyWall: "end-wall-party",
      rearService: "rear-service",
    },
  };
}
