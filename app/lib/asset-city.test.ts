import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
import { planAssetBackedHero } from "./asset-city";
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

describe("V4.2 asset-backed Chicago proof", () => {
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
    for (const item of [...assetHero.visualContext, ...assetHero.riverEdge]) {
      expect(item.semantic).toBe(false);
      expect("entityId" in item).toBe(false);
      expect("componentId" in item).toBe(false);
    }
  });
});
