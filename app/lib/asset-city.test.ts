import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import { demoProject } from "./demo-data";
import {
  ASSET_CITY_VERSION,
  HERO_FACADE_LANGUAGES,
  HERO_GLASS_SYSTEMS,
  NON_SEMANTIC_URBAN_CONTEXT,
  makeAssetReviewCameraPresets,
  planAssetBackedHero,
} from "./asset-city";
import { planLivingCity } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import { planUrbanFabric } from "./urban-fabric";
import { planVisualCity } from "./visual-city";

function fixture(reverse = false) {
  const entities = reverse ? [...demoProject.entities].reverse() : demoProject.entities;
  const relations = reverse ? [...demoProject.relations].reverse() : demoProject.relations;
  const districts = reverse ? [...demoProject.districts].reverse() : demoProject.districts;
  const semanticPlan = planSemanticCity({
    cityPlan: planLivingCity({ entities, relations, districts }),
    entities,
    relations,
    boundaryFacts: reverse ? [...(demoProject.boundaryFacts ?? [])].reverse() : demoProject.boundaryFacts,
  });
  const urbanFabric = planUrbanFabric({ semanticPlan });
  const visualCity = planVisualCity({ semanticPlan, urbanFabric });
  return {
    semanticPlan,
    urbanFabric,
    visualCity,
    assetHero: planAssetBackedHero(urbanFabric, visualCity),
  };
}

describe("V4.3 asset-backed Chicago proof", () => {
  it("is deterministic and selects five genuinely distinct principal assets", () => {
    const first = fixture();
    const reordered = fixture(true);
    expect(JSON.stringify(first.assetHero)).toBe(JSON.stringify(reordered.assetHero));
    expect(first.assetHero.buildings).toHaveLength(5);
    expect(new Set(first.assetHero.buildings.map((building) => building.node))).toEqual(
      new Set([
        "masonry-building",
        "limestone-office",
        "miesian-grid-tower",
        "blue-unitized-tower",
        "bronze-fin-tower",
      ]),
    );
    expect(first.assetHero.visibleStorefrontBayCount).toBe(12);
    expect(first.assetHero.version).toBe(ASSET_CITY_VERSION);
  });

  it("maps every visible building to existing semantic evidence", () => {
    const { assetHero, urbanFabric } = fixture();
    const entityIds = new Set(demoProject.entities.map((entity) => entity.id));
    const semanticBuildingIds = new Set(urbanFabric.buildings.map((building) => building.id));
    for (const building of assetHero.buildings) {
      expect(entityIds.has(building.primaryEntityId)).toBe(true);
      expect(semanticBuildingIds.has(building.semanticBuildingId)).toBe(true);
      expect(building.envelopeId).toBeTruthy();
      expect(building.componentId).toBeTruthy();
    }
  });

  it("isolates exactly two adjacent proof blocks without changing semantic counts", () => {
    const { assetHero, urbanFabric } = fixture();
    expect(assetHero.proofBlockIds).toHaveLength(2);
    const blockById = new Map(urbanFabric.blocks.map((block) => [block.id, block]));
    expect(blockById.get(assetHero.proofBlockIds[0]!)?.adjacentBlockIds).toContain(
      assetHero.proofBlockIds[1],
    );
    const heroBlockIds = new Set(assetHero.proofBlockIds);
    const expectedSuppressed = urbanFabric.architecturalEnvelopes
      .filter((envelope) => heroBlockIds.has(envelope.blockId))
      .map((envelope) => envelope.id)
      .sort();
    expect(assetHero.replacedEnvelopeIds).toEqual(expectedSuppressed);
    expect(Object.keys(urbanFabric.entityAddresses)).toHaveLength(demoProject.entities.length);
  });

  it("keeps street props, river walls and bridge abutments non-semantic", () => {
    const { assetHero } = fixture();
    expect(assetHero.riverEdge).toHaveLength(4);
    expect(assetHero.riverEdge.filter((item) => item.node === "river-edge")).toHaveLength(2);
    expect(assetHero.riverEdge.filter((item) => item.node === "bridge-abutment")).toHaveLength(2);
    for (const item of [...assetHero.visualContext, ...assetHero.streetDetails, ...assetHero.riverEdge]) {
      expect(item.semantic).toBe(false);
      expect("entityId" in item).toBe(false);
      expect("componentId" in item).toBe(false);
    }
  });

  it("keeps visual urban programs non-semantic while routing deliberate clicks to existing owners", () => {
    const { assetHero } = fixture();
    expect(new Set(assetHero.streetPrograms.map((program) => program.node))).toEqual(new Set([
      "cafe-storefront",
      "restaurant-storefront",
      "bookstore-storefront",
      "market-storefront",
      "gallery-storefront",
      "office-lobby",
      "residential-entry",
      "service-loading",
    ]));
    const entityIds = new Set(demoProject.entities.map((entity) => entity.id));
    for (const program of assetHero.streetPrograms) {
      expect(program.semantic).toBe(false);
      expect(program.layer).toBe(NON_SEMANTIC_URBAN_CONTEXT);
      expect(program.routedToOwner).toBe(true);
      expect(entityIds.has(program.ownerEntityId)).toBe(true);
    }
  });

  it("declares four grayscale-readable facade languages and three distinct glass systems", () => {
    expect(HERO_FACADE_LANGUAGES).toHaveLength(4);
    expect(new Set(HERO_FACADE_LANGUAGES).size).toBe(4);
    expect(Object.keys(HERO_GLASS_SYSTEMS)).toHaveLength(3);
    expect(new Set(Object.values(HERO_GLASS_SYSTEMS).map((system) => system.glass)).size).toBe(3);
    expect(new Set(Object.values(HERO_GLASS_SYSTEMS).map((system) => system.roughness)).size).toBe(3);
  });

  it("locks five deterministic perspective review transforms", () => {
    const first = fixture();
    const reordered = fixture(true);
    const cameras = makeAssetReviewCameraPresets(first.assetHero, first.visualCity);
    expect(cameras).toEqual(makeAssetReviewCameraPresets(reordered.assetHero, reordered.visualCity));
    expect(cameras.map((camera) => camera.id)).toEqual([
      "street-corner",
      "storefront-street",
      "river-bridge",
      "glass-facade",
      "urban-composition",
    ]);
    for (const camera of cameras) {
      expect(camera.fov).toBeGreaterThanOrEqual(30);
      expect(camera.fov).toBeLessThanOrEqual(55);
      expect(camera.position).toHaveLength(3);
      expect(camera.target).toHaveLength(3);
    }
  });

  it("keeps every generated asset present and hash-current in the provenance manifest", async () => {
    const assetRoot = new URL("../../public/assets/city-kit-v1/", import.meta.url);
    const manifest = await readFile(new URL("../../docs/assets/city-kit-v1-manifest.md", import.meta.url), "utf8");
    const files = [
      ...(await readdir(assetRoot)).filter((name) => name.endsWith(".glb")),
      ...(await readdir(new URL("textures/", assetRoot))).map((name) => `textures/${name}`),
    ].sort();
    expect(files).toHaveLength(37);
    for (const file of files) {
      const bytes = await readFile(new URL(file, assetRoot));
      const hash = createHash("sha256").update(bytes).digest("hex");
      expect(manifest).toContain(`\`${file}\``);
      expect(manifest).toContain(`\`${hash}\``);
    }
  });

  it("keeps V4.3 source and documentation portable and render-time allocation free", async () => {
    const paths = [
      "../../app/lib/asset-city.ts",
      "../../app/components/city/AssetBackedHero.tsx",
      "../../scripts/generate-city-kit.mjs",
      "../../docs/VISUAL_CITY_V4_3.md",
      "../../docs/assets/city-kit-v1-manifest.md",
    ];
    for (const path of paths) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      expect(source).not.toMatch(/\/Users\//);
    }
    const assetRenderer = await readFile(
      new URL("../../app/components/city/AssetBackedHero.tsx", import.meta.url),
      "utf8",
    );
    expect(assetRenderer).not.toContain("useFrame(");
  });
});
