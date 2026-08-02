import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
import { planLivingCity } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import {
  CHICAGO_KIT_V2_CLASSIFICATION,
  CHICAGO_KIT_V2_FAMILIES,
  chicagoKitV2ArchitecturalFingerprint,
  chicagoKitV2VariantInventory,
  measureChicagoKitV2Plan,
  planChicagoKitV2,
} from "./chicago-kit-v2";
import { buildChicagoKitV2Geometry } from "./chicago-kit-v2-geometry";
import { planUrbanFabric, type UrbanCharacterZone, type UrbanFacadeFamily } from "./urban-fabric";
import { planVisualCity } from "./visual-city";

function fixture() {
  const semanticPlan = planSemanticCity({
    cityPlan: planLivingCity({
      entities: demoProject.entities,
      relations: demoProject.relations,
      districts: demoProject.districts,
    }),
    entities: demoProject.entities,
    relations: demoProject.relations,
    boundaryFacts: demoProject.boundaryFacts,
  });
  const fabric = planUrbanFabric({ semanticPlan });
  const visualCity = planVisualCity({ semanticPlan, urbanFabric: fabric });
  const plan = planChicagoKitV2(fabric, visualCity);
  const geometry = buildChicagoKitV2Geometry(plan, fabric, visualCity);
  return { semanticPlan, fabric, visualCity, plan, geometry };
}

const demo = fixture();
const catalogUrl = new URL("../../public/assets/city-kit-v2/catalog.json", import.meta.url);
const kitSourceUrl = new URL("../components/city/ChicagoKitV2.tsx", import.meta.url);
const generatorUrl = new URL("../../scripts/generate-city-kit-v2.mjs", import.meta.url);

const ZONE_RANGES: Record<UrbanCharacterZone, readonly UrbanFacadeFamily[]> = {
  "fulton-market": ["fulton-brick-warehouse", "narrow-storefront-row", "chicago-school-masonry"],
  "loop-core": ["chicago-school-masonry", "art-deco-setback", "narrow-storefront-row", "civic-institutional"],
  "river-north": ["miesian-grid", "blue-green-curtain-wall", "bronze-vertical-modern", "riverfront-terrace", "chicago-school-masonry", "art-deco-setback"],
  "civic-anchor": ["civic-institutional", "art-deco-setback", "chicago-school-masonry"],
};

describe("Chicago Kit v2 visual signatures, assets, and semantic boundaries", () => {
  it("1. produces identical visual signatures for the same input and seed", () => {
    expect(planChicagoKitV2(demo.fabric, demo.visualCity)).toEqual(demo.plan);
  });

  it("2. produces different but valid variants for a different seed", () => {
    const alternate = planChicagoKitV2(demo.fabric, demo.visualCity, "alternate-valid-seed");
    expect(alternate.signatures.map(chicagoKitV2ArchitecturalFingerprint)).not.toEqual(
      demo.plan.signatures.map(chicagoKitV2ArchitecturalFingerprint),
    );
    expect(alternate.signatures).toHaveLength(demo.fabric.architecturalEnvelopes.length);
    expect(alternate.metrics.exactAdjacentDuplicateCount).toBe(0);
  });

  it("3. assigns exactly one v2 signature to every semantic-core envelope", () => {
    expect(demo.plan.signatures).toHaveLength(demo.fabric.architecturalEnvelopes.length);
    expect(new Set(demo.plan.signatures.map((signature) => signature.envelopeId)).size).toBe(demo.plan.signatures.length);
  });

  it("4. resolves a complete LOD0, LOD1, and LOD2 identity", () => {
    for (const signature of demo.plan.signatures) {
      expect(signature.lod0Variant).toContain(signature.family);
      expect(signature.lod1Variant).toContain(signature.family);
      expect(signature.lod2Variant).toContain(signature.family);
    }
  });

  it("5. visibly exercises at least eight facade families", () => {
    expect(new Set(demo.plan.signatures.map((signature) => signature.family)).size).toBeGreaterThanOrEqual(8);
  });

  it("6. keeps every character zone inside its documented architecture range", () => {
    for (const signature of demo.plan.signatures) expect(ZONE_RANGES[signature.characterZone]).toContain(signature.family);
    expect(new Set(demo.plan.signatures.map((signature) => signature.characterZone))).toEqual(new Set(Object.keys(ZONE_RANGES)));
  });

  it("7. keeps architecture unchanged when component identity and colors are permuted", () => {
    const permuted = structuredClone(demo.fabric);
    for (const [index, envelope] of permuted.architecturalEnvelopes.entries()) envelope.componentId = `permuted-${index % 6}`;
    for (const [index, assignment] of permuted.componentAssignments.entries()) assignment.accentColor = `#${String(index + 111111).slice(0, 6)}`;
    const altered = planChicagoKitV2(permuted, demo.visualCity);
    expect(altered.signatures.map(chicagoKitV2ArchitecturalFingerprint)).toEqual(
      demo.plan.signatures.map(chicagoKitV2ArchitecturalFingerprint),
    );
  });

  it("8. excludes component colors from primary architectural material slots", () => {
    const colors = new Set(demo.fabric.componentAssignments.map((assignment) => assignment.accentColor));
    for (const signature of demo.plan.signatures) {
      expect(colors.has(signature.materials.wall)).toBe(false);
      expect(colors.has(signature.materials.roof)).toBe(false);
      expect(signature.materials.glass === null || !colors.has(signature.materials.glass)).toBe(true);
    }
  });

  it("9. rejects exact adjacent signature repetition", () => {
    expect(demo.plan.metrics.exactAdjacentDuplicateCount).toBe(0);
  });

  it("10. rejects immediate facade-rhythm repetition", () => {
    expect(demo.plan.metrics.immediateRhythmRepeatCount).toBe(0);
  });

  it("11. keeps same-family adjacent pairs below the 35 percent target", () => {
    expect(demo.plan.metrics.sameFamilyAdjacentPairPct).toBeLessThan(35);
    expect(demo.plan.metrics.maximumSameFamilyRun).toBeLessThanOrEqual(2);
  });

  it("12. preserves the existing selective-landmark cap", () => {
    expect(demo.plan.metrics.landmarkRatioPct).toBe(demo.fabric.morphology.landmarkRatioPct);
    expect(demo.plan.metrics.landmarkRatioPct).toBeLessThanOrEqual(5);
  });

  it("13. resolves three distinct curtain-wall geometry systems", () => {
    const systems = new Set(demo.plan.signatures.flatMap((signature) => signature.glassSystem ? [signature.glassSystem] : []));
    expect(systems).toEqual(new Set(["miesian-expressed-grid", "unitized-vision-spandrel", "bronze-vertical-fins"]));
  });

  it("14. uses at least five roof and top variants", () => {
    expect(new Set(demo.plan.signatures.map((signature) => signature.roofVariant)).size).toBeGreaterThanOrEqual(5);
  });

  it("15. uses at least four corner variants", () => {
    expect(new Set(demo.plan.signatures.map((signature) => signature.cornerVariant)).size).toBeGreaterThanOrEqual(4);
  });

  it("16. keeps bays and floors within the documented 34 percent tolerance", () => {
    expect(Math.max(...demo.plan.signatures.map((signature) => signature.maximumModuleDistortion))).toBeLessThanOrEqual(0.34);
    expect(demo.plan.signatures.every((signature) => signature.frontageBayWidth > 0.5 && signature.floorHeight > 0.7)).toBe(true);
  });

  it("17. prevents excessive anisotropic scaling through discrete architectural dimensions", () => {
    for (const signature of demo.plan.signatures) {
      expect(signature.frontageBayCount).toBeGreaterThanOrEqual(2);
      expect(signature.sideBayCount).toBeGreaterThanOrEqual(2);
      expect(signature.maximumModuleDistortion).toBeLessThanOrEqual(0.34);
    }
  });

  it("18. preserves and improves visually active ground floors", () => {
    expect(demo.plan.metrics.activeGroundFloorPct).toBeGreaterThanOrEqual(demo.fabric.morphology.activeGroundFloorPct);
    expect(demo.plan.metrics.fultonActiveGroundFloorPct).toBeGreaterThanOrEqual(75);
  });

  it("19. provides at least eight ground-floor program families", () => {
    expect(demo.plan.metrics.groundFloorProgramFamilyCount).toBeGreaterThanOrEqual(8);
  });

  it("20. classifies storefront programs as non-semantic urban context", () => {
    expect(demo.plan.storefrontPrograms.every((program) => program.classification === CHICAGO_KIT_V2_CLASSIFICATION && !program.semantic)).toBe(true);
  });

  it("21. prevents storefront search and evidence ownership", () => {
    for (const program of demo.plan.storefrontPrograms) {
      expect(program.searchable).toBe(false);
      expect("relationId" in program || "evidenceRelationIds" in program).toBe(false);
    }
  });

  it("22. preserves every semantic building owner", () => {
    const expected = new Set(demo.fabric.buildings.map((building) => building.id));
    const actual = new Set(demo.plan.signatures.map((signature) => signature.semanticBuildingId));
    expect(actual).toEqual(expected);
    expect(demo.plan.signatures.every((signature) => signature.primaryEntityId.length > 0)).toBe(true);
  });

  it("23. resolves every rendered semantic module through its existing component", () => {
    const components = new Set(demo.fabric.componentAssignments.map((assignment) => assignment.componentId));
    const core = demo.geometry.boxes.filter((box) => box.semantic);
    expect(core.length).toBeGreaterThan(10_000);
    expect(core.every((box) => box.componentId && components.has(box.componentId))).toBe(true);
  });

  it("24. preserves every file entrance and address", () => {
    const buildingIds = new Set(demo.fabric.buildings.map((building) => building.id));
    expect(Object.keys(demo.fabric.entityAddresses)).toHaveLength(demoProject.entities.length);
    for (const address of Object.values(demo.fabric.entityAddresses)) {
      expect(buildingIds.has(address.buildingId)).toBe(true);
      expect(Number.isFinite(address.entrance.x) && Number.isFinite(address.entrance.z)).toBe(true);
    }
  });

  it("25. gives Ring 1 family detail with no blank-slab fallback", () => {
    expect(demo.plan.metrics.blankContextFallbackCount).toBe(0);
    const ringOne = new Set(demo.plan.contextSignatures.filter((signature) => signature.ring === 1).map((signature) => signature.contextId));
    expect(demo.geometry.boxes.some((box) => box.contextId && ringOne.has(box.contextId) && box.module === "context-window-band")).toBe(true);
  });

  it("26. keeps Ring 2 and Ring 3 non-semantic and unselectable", () => {
    for (const signature of demo.plan.contextSignatures.filter((item) => item.ring >= 2)) {
      expect(signature.semantic).toBe(false);
      expect(signature.selectable).toBe(false);
      expect(signature.classification).toBe(CHICAGO_KIT_V2_CLASSIFICATION);
    }
  });

  it("27. matches asset files, roots, sizes, hashes, and licenses", async () => {
    const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as { license: string; assets: Array<{ file: string; bytes: number; sha256: string; roots: string[] }> };
    expect(catalog.license).toBe("Apache-2.0");
    expect(catalog.assets).toHaveLength(CHICAGO_KIT_V2_FAMILIES.length);
    for (const asset of catalog.assets) {
      const bytes = await readFile(new URL(asset.file, catalogUrl));
      expect(bytes.length).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      expect(asset.roots).toEqual(["base", "middle-rhythm-1", "middle-rhythm-2", "middle-rhythm-3", "corner-1", "corner-2", "end-wall", "setback-shoulder", "roof-1", "roof-2", "roof-3"]);
    }
  });

  it("28. keeps the asset generator deterministic and free of clock/random inputs", async () => {
    const source = await readFile(generatorUrl, "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date/);
    expect(source).toContain('deterministic: true');
    expect(chicagoKitV2VariantInventory()).toHaveLength(CHICAGO_KIT_V2_FAMILIES.length);
  });

  it("29. plans and compiles outside the frame loop", async () => {
    const source = await readFile(kitSourceUrl, "utf8");
    expect(source).toContain("useMemo");
    expect(source).not.toContain("useFrame");
    const timings = Array.from({ length: 100 }, (_, index) => measureChicagoKitV2Plan(demo.fabric, demo.visualCity, `perf-${index}`).planningMs).sort((a, b) => a - b);
    expect(timings[94]!).toBeLessThan(15);
  });

  it("30. makes repeated mode geometry builds stable without duplicated instances", () => {
    const hiddenId = demo.plan.signatures[0]!.semanticBuildingId;
    const exploreAgain = buildChicagoKitV2Geometry(demo.plan, demo.fabric, demo.visualCity);
    const flowFirst = buildChicagoKitV2Geometry(demo.plan, demo.fabric, demo.visualCity, new Set([hiddenId]));
    const flowAgain = buildChicagoKitV2Geometry(demo.plan, demo.fabric, demo.visualCity, new Set([hiddenId]));
    expect(exploreAgain.boxes).toEqual(demo.geometry.boxes);
    expect(flowAgain.boxes).toEqual(flowFirst.boxes);
    expect(new Set(exploreAgain.boxes.map((box) => box.id)).size).toBe(exploreAgain.boxes.length);
  });
});
