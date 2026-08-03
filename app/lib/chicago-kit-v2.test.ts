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
import {
  buildChicagoKitV2Geometry,
  chicagoBuildingGeometryFingerprint,
  classifyChicagoEnvelopeExposure,
  compileChicagoBuildingGeometry,
  measureChicagoKitV2CompiledGeometry,
  selectChicagoLod,
  type ChicagoModuleKind,
} from "./chicago-kit-v2-geometry";
import {
  CHICAGO_KIT_V2_DEFINITION,
  chicagoAssetRootMap,
  chicagoFamilyDefinition,
  chicagoVariantDefinitionFingerprint,
  stableDefinitionHash,
} from "./chicago-kit-v2-definition";
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
const moduleGeometrySourceUrl = new URL("../components/city/chicago-module-geometries.ts", import.meta.url);
const generatorUrl = new URL("../../scripts/generate-city-kit-v2.mjs", import.meta.url);
const definitionUrl = new URL("./chicago-kit-v2-definition.json", import.meta.url);

function variantGeometryFingerprints(
  family: UrbanFacadeFamily,
  kind: "rhythm" | "base" | "corner" | "roof",
): string[] {
  const definition = chicagoFamilyDefinition(family);
  const envelope = demo.fabric.architecturalEnvelopes[0]!;
  const seed = demo.plan.signatures[0]!;
  const modules: Record<typeof kind, readonly ChicagoModuleKind[]> = {
    rhythm: ["window", "mullion", "spandrel"],
    base: ["base", "ground-floor"],
    corner: ["corner"],
    roof: ["top", "cornice", "roof-house", "crown"],
  };
  const names = kind === "rhythm" ? definition.rhythms : kind === "base" ? definition.bases : kind === "corner" ? definition.corners : definition.roofs;
  return names.map((name) => {
    const signature = {
      ...seed,
      family,
      facadeRhythm: definition.rhythms[0],
      baseVariant: definition.bases[0],
      cornerVariant: definition.corners[0],
      roofVariant: definition.roofs[0],
      cornerCondition: "street-corner" as const,
      [kind === "rhythm" ? "facadeRhythm" : kind === "base" ? "baseVariant" : kind === "corner" ? "cornerVariant" : "roofVariant"]: name,
    };
    const boxes = compileChicagoBuildingGeometry(signature, envelope, { front: "primary-street", right: "secondary-street", back: "rear-service", left: "exposed-end" }, "lod0")
      .filter((box) => modules[kind].includes(box.module));
    return chicagoBuildingGeometryFingerprint(boxes, envelope);
  });
}

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

  it("14. derives visibly distinct roof and top counts from compiled geometry", () => {
    expect(demo.geometry.metrics.distinctRoofGeometryCount).toBeGreaterThanOrEqual(5);
  });

  it("15. derives visibly distinct corner counts from compiled geometry", () => {
    expect(demo.geometry.metrics.distinctCornerGeometryCount).toBeGreaterThanOrEqual(4);
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
    expect(demo.geometry.metrics.activeGroundFloorPct).toBeGreaterThanOrEqual(demo.fabric.morphology.activeGroundFloorPct);
    expect(demo.geometry.metrics.fultonActiveGroundFloorPct).toBeGreaterThanOrEqual(75);
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
    expect(core.length).toBeGreaterThan(8_000);
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
    expect(demo.geometry.metrics.blankContextFallbackCount).toBe(0);
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

  it("27. matches asset files, canonical root maps, fingerprints, sizes, hashes, and licenses", async () => {
    const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as { license: string; canonicalDefinition: string; assets: Array<{ family: UrbanFacadeFamily; file: string; bytes: number; sha256: string; roots: string[]; rootMap: ReturnType<typeof chicagoAssetRootMap>; variantFingerprints: Record<string, string>; usage: string }> };
    expect(catalog.license).toBe("Apache-2.0");
    expect(catalog.canonicalDefinition).toBe("app/lib/chicago-kit-v2-definition.json");
    expect(catalog.assets).toHaveLength(CHICAGO_KIT_V2_FAMILIES.length);
    for (const asset of catalog.assets) {
      const bytes = await readFile(new URL(asset.file, catalogUrl));
      expect(bytes.length).toBe(asset.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      expect(asset.rootMap).toEqual(chicagoAssetRootMap(asset.family));
      expect(asset.roots).toEqual(Object.values(asset.rootMap).flatMap((value) => Object.values(value)));
      expect(asset.usage).toBe("tooling-reference-runtime-procedural-parity");
      const family = chicagoFamilyDefinition(asset.family);
      for (const [kind, names] of [["rhythm", family.rhythms], ["base", family.bases], ["corner", family.corners], ["roof", family.roofs]] as const) {
        for (const name of names) expect(asset.variantFingerprints[`${kind}:${name}`]).toBe(chicagoVariantDefinitionFingerprint(asset.family, kind, name));
      }
    }
  });

  it("28. keeps the asset generator deterministic and free of clock/random inputs", async () => {
    const source = await readFile(generatorUrl, "utf8");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date/);
    expect(source).toContain('deterministic: true');
    expect(chicagoKitV2VariantInventory()).toHaveLength(CHICAGO_KIT_V2_FAMILIES.length);
  });

  it("29. plans and compiles outside the frame loop while frame work only toggles precompiled tiers", async () => {
    const source = await readFile(kitSourceUrl, "utf8");
    expect(source).toContain("useMemo");
    expect(source).toContain("useFrame");
    expect(source).not.toMatch(/useFrame\([\s\S]*buildChicagoKitV2Geometry/);
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

  it("31. gives every rhythm, base, corner, and roof label a distinct geometry fingerprint", () => {
    for (const family of CHICAGO_KIT_V2_FAMILIES) for (const kind of ["rhythm", "base", "corner", "roof"] as const) {
      const fingerprints = variantGeometryFingerprints(family, kind);
      expect(new Set(fingerprints).size, `${family}:${kind}`).toBe(fingerprints.length);
    }
  });

  it("32. fingerprints only local geometry, not box ids or world placement", () => {
    const envelope = demo.fabric.architecturalEnvelopes[0]!;
    const owned = demo.geometry.boxes.filter((box) => box.envelopeId === envelope.id && !box.storefrontId);
    const renamed = owned.map((box, index) => ({ ...box, id: `renamed-${index}`, x: box.x + 12, z: box.z - 7 }));
    const shiftedEnvelope = { ...envelope, x: envelope.x + 12, z: envelope.z - 7 };
    expect(chicagoBuildingGeometryFingerprint(renamed, shiftedEnvelope)).toBe(chicagoBuildingGeometryFingerprint(owned, envelope));
  });

  it("33. rejects a renamed variant that has no canonical geometry recipe", () => {
    const envelope = demo.fabric.architecturalEnvelopes[0]!;
    const signature = { ...demo.plan.signatures[0]!, facadeRhythm: "same-geometry-new-name" };
    expect(() => compileChicagoBuildingGeometry(signature, envelope, classifyChicagoEnvelopeExposure(envelope, demo.fabric.architecturalEnvelopes), "lod0")).toThrow(/Unknown Chicago Kit v2 rhythm variant/);
  });

  it("34. provides strict real-LOD module reduction", () => {
    expect(demo.geometry.tiers.lod0.moduleCount).toBeGreaterThan(demo.geometry.tiers.lod1.moduleCount);
    expect(demo.geometry.tiers.lod1.moduleCount).toBeGreaterThan(demo.geometry.tiers.lod2.moduleCount);
  });

  it("35. keeps storefronts, detailed windows, and mullions in LOD0 only", () => {
    const detail = new Set<ChicagoModuleKind>(["storefront", "entrance", "awning", "window", "mullion", "spandrel"]);
    expect(demo.geometry.tiers.lod0.boxes.some((box) => detail.has(box.module))).toBe(true);
    expect(demo.geometry.tiers.lod1.boxes.some((box) => detail.has(box.module))).toBe(false);
    expect(demo.geometry.tiers.lod2.boxes.some((box) => detail.has(box.module))).toBe(false);
  });

  it("36. retains the same semantic owners across every LOD", () => {
    const expected = new Set(demo.plan.signatures.map((signature) => signature.semanticBuildingId));
    for (const tier of Object.values(demo.geometry.tiers)) expect(new Set(tier.boxes.flatMap((box) => box.semanticBuildingId ? [box.semanticBuildingId] : []))).toEqual(expected);
  });

  it("37. keeps every tier free of duplicate instance ids", () => {
    for (const tier of Object.values(demo.geometry.tiers)) expect(new Set(tier.boxes.map((box) => box.id)).size).toBe(tier.boxes.length);
  });

  it("38. applies stable LOD thresholds with hysteresis", () => {
    const { lod0MaxDistance, lod1MaxDistance, hysteresis } = CHICAGO_KIT_V2_DEFINITION.lod;
    expect(selectChicagoLod(lod0MaxDistance - 1)).toBe("lod0");
    expect(selectChicagoLod(lod0MaxDistance + 1, "lod0")).toBe("lod0");
    expect(selectChicagoLod(lod0MaxDistance + hysteresis + 0.1, "lod0")).toBe("lod1");
    expect(selectChicagoLod(lod1MaxDistance + 1, "lod1")).toBe("lod1");
    expect(selectChicagoLod(lod1MaxDistance + hysteresis + 0.1, "lod1")).toBe("lod2");
  });

  it("39. selects LOD independently by spatial chunk and keeps Ring 1 at LOD1 or better", async () => {
    const source = await readFile(kitSourceUrl, "utf8");
    expect(source).toContain("chicago-kit-v2-spatial-chunk");
    expect(source).toContain("camera.position.x - chunk.centerX");
    expect(source).toContain('chunk.minimumLod = "lod1"');
    expect(source).not.toContain("camera.position.x - target.x");
  });

  it("40. forces selected geometry to LOD0 while removing it from regular tier batches", async () => {
    const source = await readFile(kitSourceUrl, "utf8");
    expect(source).toContain('name="chicago-kit-v2-selected-lod0"');
    expect(source).toContain("box.semanticBuildingId === selectedSemanticBuildingId) continue");
    expect(source).toContain("box.semanticBuildingId === selectedSemanticBuildingId");
  });

  it("41. derives active-frontage acceptance from compiled storefront geometry", () => {
    const withoutStorefrontGeometry = demo.geometry.boxes.filter((box) => !box.storefrontId);
    const metrics = measureChicagoKitV2CompiledGeometry(withoutStorefrontGeometry, demo.plan, demo.fabric);
    expect(metrics.activeGroundFloorPct).toBe(0);
    expect(metrics.fultonActiveGroundFloorPct).toBe(0);
  });

  it("42. derives context fallback failures from required compiled modules", () => {
    const ringOneId = demo.plan.contextSignatures.find((item) => item.ring === 1)!.contextId;
    const mutated = demo.geometry.boxes.filter((box) => !(box.contextId === ringOneId && box.module === "context-window-band"));
    expect(measureChicagoKitV2CompiledGeometry(mutated, demo.plan, demo.fabric).blankContextFallbackCount).toBe(1);
  });

  it("43. limits real corner treatment to one street intersection per corner building", () => {
    for (const signature of demo.plan.signatures) {
      const bodies = demo.geometry.boxes.filter((box) => box.envelopeId === signature.envelopeId && box.id.endsWith(":street-corner"));
      expect(bodies.length).toBe(signature.cornerCondition === "street-corner" ? 1 : 0);
    }
  });

  it("44. keeps windows and mullions off party walls", () => {
    const partyOwners = new Set(demo.geometry.boxes.filter((box) => box.module === "party-wall").map((box) => `${box.envelopeId}:${box.exposure}`));
    expect(partyOwners.size).toBeGreaterThan(0);
    expect(demo.geometry.boxes.some((box) => box.exposure === "party-wall" && (box.module === "window" || box.module === "mullion"))).toBe(false);
  });

  it("45. preserves non-semantic context and semantic owner fields through all tiers", () => {
    for (const tier of Object.values(demo.geometry.tiers)) for (const box of tier.boxes) {
      if (box.contextId) expect(box.semantic).toBe(false);
      if (box.semantic) expect(box.componentId && box.semanticBuildingId && box.primaryEntityId).toBeTruthy();
    }
  });

  it("46. keeps canonical definition and runtime inventory byte-stable", async () => {
    const disk = JSON.parse(await readFile(definitionUrl, "utf8"));
    expect(disk).toEqual(CHICAGO_KIT_V2_DEFINITION);
    expect(stableDefinitionHash(disk)).toBe(stableDefinitionHash(CHICAGO_KIT_V2_DEFINITION));
  });

  it("47. keeps facade projections outside neighboring envelope interiors", () => {
    const envelopes = demo.fabric.architecturalEnvelopes;
    const projections = demo.geometry.boxes.filter((box) => box.semantic && box.exposure && !["base", "middle", "top", "roof-house", "crown", "cornice"].includes(box.module));
    const penetrations: string[] = [];
    for (const box of projections) for (const candidate of envelopes) {
      if (candidate.id === box.envelopeId) continue;
      const dx = box.x - candidate.x;
      const dz = box.z - candidate.z;
      if (Math.hypot(dx, dz) >= (Math.hypot(candidate.width, candidate.depth) + Math.hypot(box.width, box.depth)) / 2) continue;
      const cosine = Math.cos(candidate.rotation);
      const sine = Math.sin(candidate.rotation);
      const localX = dx * cosine - dz * sine;
      const localZ = dx * sine + dz * cosine;
      if (Math.abs(localX) < candidate.width / 2 - 0.08 && Math.abs(localZ) < candidate.depth / 2 - 0.08) penetrations.push(`${box.id} overlaps ${candidate.id}`);
    }
    expect(penetrations).toEqual([]);
  });

  it("48. compiles all three tiers within the fixed-fixture performance budget", () => {
    const samples: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const started = performance.now();
      buildChicagoKitV2Geometry(demo.plan, demo.fabric, demo.visualCity);
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    // This is a CI-portable regression ceiling, not the local review measurement.
    // The documented median/p95 remains tied to the fixed review machine.
    expect(samples[Math.floor(samples.length * 0.95)]!).toBeLessThan(500);
  });

  it("49. renders isolated non-street sides through exposed-end and rear-service paths", () => {
    const envelope = demo.fabric.architecturalEnvelopes[0]!;
    expect(Object.values(classifyChicagoEnvelopeExposure(envelope, [envelope]))).toContain("exposed-end");
    const boxes = compileChicagoBuildingGeometry(demo.plan.signatures[0]!, envelope, {
      front: "primary-street",
      right: "secondary-street",
      back: "rear-service",
      left: "exposed-end",
    }, "lod0");
    expect(boxes.some((box) => box.module === "exposed-end" && box.exposure === "exposed-end")).toBe(true);
    expect(boxes.some((box) => box.module === "rear-service" && box.exposure === "rear-service")).toBe(true);
  });

  it("50. uses shared deterministic material detail instead of per-building texture allocation", async () => {
    const source = await readFile(kitSourceUrl, "utf8");
    expect(source).toContain("SHARED_SURFACE_MAPS");
    expect(source.match(/new THREE\.DataTexture/g)).toHaveLength(2);
    expect(source).toContain("vChicagoWorldPosition");
    expect(source).toContain("height.colorSpace = THREE.NoColorSpace");
    expect(source).not.toMatch(/Math\.random|Date\.now|new Date/);
  });

  it("51. uses shared non-box module geometries for facade, corner, cornice, crown, and awning roles", async () => {
    const source = await readFile(moduleGeometrySourceUrl, "utf8");
    for (const primitive of [
      "single-recess", "miesian-grid", "unitized-panel", "bronze-fin-panel",
      "chamfer-wrap", "cornice-cap", "stepped-crown", "context-facade-grid", "awning-wedge",
    ]) expect(source).toContain(`case "${primitive}"`);
    expect(source).toContain("mergeGeometries");
    expect(source).toContain("CylinderGeometry");
    expect(source).toContain("triangularAwning");
  });
});
