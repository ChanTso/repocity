import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
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
  return { semanticPlan, urbanFabric, visual: planVisualCity({ semanticPlan, urbanFabric }) };
}

describe("V4.1 Chicago visual vertical slice", () => {
  it("plans one deterministic connected six-block hero district", () => {
    const first = fixture();
    const reordered = fixture(true);
    expect(JSON.stringify(first.visual)).toBe(JSON.stringify(reordered.visual));
    expect(first.visual.hero.blockIds).toHaveLength(6);
    const allowed = new Set(first.visual.hero.blockIds);
    const byId = new Map(first.urbanFabric.blocks.map((block) => [block.id, block]));
    const visited = new Set<string>();
    const queue = [first.visual.hero.blockIds[0]!];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const neighbor of byId.get(id)?.adjacentBlockIds ?? []) {
        if (allowed.has(neighbor) && !visited.has(neighbor)) queue.push(neighbor);
      }
    }
    expect(visited.size).toBe(6);
  });

  it("keeps contextual city rings non-semantic and unselectable by policy", () => {
    const { visual } = fixture();
    expect(visual.interactionPolicy).toBe("semantic-core-only");
    expect(new Set(visual.contextBlocks.map((block) => block.ring))).toEqual(new Set([1, 2, 3]));
    for (const item of [...visual.contextBlocks, ...visual.contextBuildings, ...visual.contextRoads]) {
      expect(item.contextId.startsWith("context-")).toBe(true);
      expect("entityId" in item).toBe(false);
      expect("componentId" in item).toBe(false);
      expect("evidenceRelationIds" in item).toBe(false);
      expect("onSelect" in item).toBe(false);
    }
  });

  it("maps every hero architecture envelope back to an existing semantic container", () => {
    const { urbanFabric, visual } = fixture();
    const heroIds = new Set(visual.hero.blockIds);
    const semanticBuildingIds = new Set(urbanFabric.buildings.map((building) => building.id));
    const heroEnvelopes = urbanFabric.architecturalEnvelopes.filter((envelope) => heroIds.has(envelope.blockId));
    expect(heroEnvelopes).toHaveLength(visual.metrics.heroArchitecturalEnvelopeCount);
    expect(heroEnvelopes.every((envelope) => semanticBuildingIds.has(envelope.semanticBuildingId))).toBe(true);
  });

  it("preserves repository mappings and exact projected routes", () => {
    const { urbanFabric } = fixture();
    expect(Object.keys(urbanFabric.entityAddresses)).toHaveLength(demoProject.entities.length);
    expect(urbanFabric.streets.filter((street) => street.surface === "bridge")).toHaveLength(2);
    expect(urbanFabric.streets.every((street) => street.evidenceRelationIds.every((id) => typeof id === "string"))).toBe(true);
  });

  it("meets the focused visual-slice acceptance metrics", () => {
    const { visual } = fixture();
    expect(visual.metrics).toMatchObject({
      heroBlockCount: 6,
      heroFacadeSystemCount: 6,
      heroCurtainWallSystemCount: 3,
      contextRingCount: 3,
      continuousRiverSegmentCount: 1,
    });
    expect(visual.metrics.heroArchitecturalEnvelopeCount).toBeGreaterThanOrEqual(24);
    expect(visual.metrics.heroStorefrontCount).toBeGreaterThanOrEqual(24);
    expect(visual.metrics.activeHeroStorefrontCount).toBeGreaterThanOrEqual(20);
    expect(visual.metrics.contextBuildingCount).toBeGreaterThan(100);
    expect(visual.metrics.estimatedUnusedGreenPct).toBeLessThan(25);
    expect(visual.facadeSystems).toHaveLength(6);
    expect(new Set(visual.curtainWallSystems)).toEqual(
      new Set(["miesian-black-grid", "blue-green-unitized-glass", "bronze-vertical-fins"]),
    );
    expect(visual.river.minZ).toBeLessThan(visual.hero.bounds.minZ);
    expect(visual.river.maxZ).toBeGreaterThan(visual.hero.bounds.maxZ);
  });

  it("declares planning outside the render loop", () => {
    const { visual } = fixture();
    expect(visual.planningPolicy).toBe("memoized-before-render");
  });
});
