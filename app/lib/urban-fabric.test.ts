import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
import { planFlowSimulation } from "./flow-simulation";
import { planLivingCity } from "./living-city";
import { projectSemanticFlow } from "./semantic-flow";
import { planSemanticCity } from "./semantic-city";
import {
  planUrbanFabric,
  projectUrbanJourneyLeg,
  selectedUrbanBlocks,
  selectedUrbanEnvelopes,
  type UrbanBlock,
} from "./urban-fabric";

function demoSemanticCity(reverse = false) {
  const entities = reverse
    ? [...demoProject.entities].reverse()
    : demoProject.entities;
  const relations = reverse
    ? [...demoProject.relations].reverse()
    : demoProject.relations;
  const boundaryFacts = reverse
    ? [...(demoProject.boundaryFacts ?? [])].reverse()
    : demoProject.boundaryFacts;
  return planSemanticCity({
    cityPlan: planLivingCity({
      entities,
      districts: reverse
        ? [...demoProject.districts].reverse()
        : demoProject.districts,
      relations,
    }),
    entities,
    relations,
    boundaryFacts,
  });
}

function demoFabric() {
  return planUrbanFabric({ semanticPlan: demoSemanticCity() });
}

function connectedBlockIds(
  start: UrbanBlock,
  allowed: ReadonlySet<string>,
  blockById: ReadonlyMap<string, UrbanBlock>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [start.id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId) || !allowed.has(currentId)) continue;
    visited.add(currentId);
    const block = blockById.get(currentId);
    if (!block) continue;
    for (const adjacentId of block.adjacentBlockIds) {
      if (allowed.has(adjacentId) && !visited.has(adjacentId)) {
        queue.push(adjacentId);
      }
    }
  }
  return visited;
}

describe("road-first urban fabric planning", () => {
  it("is byte-stable and independent of semantic input ordering", () => {
    const first = planUrbanFabric({ semanticPlan: demoSemanticCity() });
    const reordered = planUrbanFabric({
      semanticPlan: demoSemanticCity(true),
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(reordered));
  });

  it("assigns every component to three connected public blocks", () => {
    const fabric = demoFabric();
    const blockById = new Map(
      fabric.blocks.map((block) => [block.id, block]),
    );

    expect(fabric.componentAssignments).toHaveLength(
      demoSemanticCity().components.length,
    );
    for (const assignment of fabric.componentAssignments) {
      expect(assignment.blockIds).toHaveLength(3);
      const allowed = new Set(assignment.blockIds);
      const start = blockById.get(assignment.blockIds[0]!);
      expect(start).toBeTruthy();
      expect(
        connectedBlockIds(start!, allowed, blockById).size,
      ).toBe(assignment.blockIds.length);
      expect(
        selectedUrbanBlocks(fabric, assignment.componentId).map(
          (block) => block.id,
        ),
      ).toEqual(
        fabric.blocks
          .filter((block) => allowed.has(block.id))
          .map((block) => block.id),
      );
    }
  });

  it("builds one shared street graph before street-addressable parcels", () => {
    const fabric = demoFabric();
    const streetIds = new Set(fabric.streets.map((street) => street.id));
    const blockIds = new Set(fabric.blocks.map((block) => block.id));

    expect(streetIds.size).toBe(fabric.streets.length);
    expect(blockIds.size).toBe(fabric.blocks.length);
    expect(
      fabric.streets.some((street) => street.hierarchy === "primary"),
    ).toBe(true);
    expect(
      fabric.streets.some((street) => street.hierarchy === "secondary"),
    ).toBe(true);
    expect(
      fabric.streets.some((street) => street.hierarchy === "local"),
    ).toBe(true);
    expect(
      fabric.streets.filter((street) => street.surface === "bridge"),
    ).toHaveLength(2);
    expect(
      fabric.blocks.every((block) =>
        Object.values(block.streetIdsByEdge).every((id) => streetIds.has(id)),
      ),
    ).toBe(true);
    expect(
      fabric.parcels.every((parcel) =>
        streetIds.has(parcel.primaryStreetId),
      ),
    ).toBe(true);
    expect(
      fabric.parcels.filter((parcel) => parcel.frontage > 0).length /
        fabric.parcels.length,
    ).toBeGreaterThanOrEqual(0.7);
  });

  it("keeps blocks out of the typed water envelope", () => {
    const semantic = demoSemanticCity();
    const fabric = planUrbanFabric({ semanticPlan: semantic });
    const waterPoints = semantic.terrain.waterBoundaries.flatMap(
      (boundary) => boundary.outline,
    );
    expect(waterPoints.length).toBeGreaterThan(0);
    const waterMinX = Math.min(...waterPoints.map((point) => point.x));
    const waterMaxX = Math.max(...waterPoints.map((point) => point.x));

    for (const block of fabric.blocks) {
      const blockMinX = block.x - block.width / 2;
      const blockMaxX = block.x + block.width / 2;
      expect(blockMaxX <= waterMinX || blockMinX >= waterMaxX).toBe(true);
    }
  });

  it("contains every parcel inside its block and exposes varied typologies", () => {
    const fabric = demoFabric();
    const blockById = new Map(
      fabric.blocks.map((block) => [block.id, block]),
    );
    const typologies = new Set(
      fabric.buildings.map((building) => building.typology),
    );

    expect(typologies.size).toBeGreaterThanOrEqual(4);
    for (const parcel of fabric.parcels) {
      const block = blockById.get(parcel.blockId)!;
      expect(Math.abs(parcel.x - block.x) + parcel.width / 2).toBeLessThanOrEqual(
        block.width / 2 + 0.001,
      );
      expect(Math.abs(parcel.z - block.z) + parcel.depth / 2).toBeLessThanOrEqual(
        block.depth / 2 + 0.001,
      );
    }
  });

  it("gives every repository entity a building and sidewalk entrance", () => {
    const semantic = demoSemanticCity();
    const fabric = planUrbanFabric({ semanticPlan: semantic });
    const buildingIds = new Set(
      fabric.buildings.map((building) => building.id),
    );
    const parcelIds = new Set(fabric.parcels.map((parcel) => parcel.id));

    expect(Object.keys(fabric.entityAddresses)).toHaveLength(
      demoProject.entities.length,
    );
    for (const entity of demoProject.entities) {
      const address = fabric.entityAddresses[entity.id];
      expect(address).toBeTruthy();
      expect(buildingIds.has(address!.buildingId)).toBe(true);
      expect(parcelIds.has(address!.parcelId)).toBe(true);
      expect(address!.legacySemanticPoint).toEqual(
        semantic.entityAddresses[entity.id]!.worldPoint,
      );
      expect(address!.entrance).not.toEqual(address!.worldPoint);
    }
  });

  it("uses neutral facade material keys rather than component colors", () => {
    const fabric = demoFabric();
    const accentColors = new Set(
      fabric.componentAssignments.map((assignment) => assignment.accentColor),
    );
    const neutralMaterials = new Set([
      "limestone",
      "warm-concrete",
      "brick",
      "slate",
    ]);

    expect(
      fabric.buildings.every((building) =>
        neutralMaterials.has(building.material),
      ),
    ).toBe(true);
    expect(
      fabric.buildings.every(
        (building) => !accentColors.has(building.material),
      ),
    ).toBe(true);
  });

  it("subdivides semantic buildings into dense, non-semantic Chicago fabric", () => {
    const fabric = demoFabric();
    const semanticBuildingIds = new Set(
      fabric.buildings.map((building) => building.id),
    );
    const blockIds = new Set(fabric.blocks.map((block) => block.id));
    const facadeFamilies = new Set(
      fabric.architecturalEnvelopes.map((envelope) => envelope.facadeFamily),
    );
    const massingProfiles = new Set(
      fabric.architecturalEnvelopes.map((envelope) => envelope.massingProfile),
    );
    const curtainWalls = new Set(
      fabric.architecturalEnvelopes
        .map((envelope) => envelope.curtainWallVariant)
        .filter(Boolean),
    );
    const storefrontCategories = new Set(
      fabric.storefronts.map((storefront) => storefront.category),
    );

    expect(fabric.architecturalEnvelopes.length).toBeGreaterThanOrEqual(72);
    expect(fabric.massingVolumes.length).toBeGreaterThanOrEqual(60);
    expect(fabric.storefronts.length).toBeGreaterThanOrEqual(30);
    expect(fabric.morphology.facadeInstanceCount).toBeGreaterThan(1_000);
    expect(facadeFamilies.size).toBeGreaterThanOrEqual(7);
    expect(massingProfiles.size).toBeGreaterThanOrEqual(10);
    expect(curtainWalls.size).toBe(3);
    expect(storefrontCategories.size).toBeGreaterThanOrEqual(10);
    expect(
      fabric.architecturalEnvelopes.every(
        (envelope) =>
          blockIds.has(envelope.blockId) &&
          semanticBuildingIds.has(envelope.semanticBuildingId),
      ),
    ).toBe(true);
    expect(
      fabric.storefronts.every(
        (storefront) => !(storefront.id in fabric.entityAddresses),
      ),
    ).toBe(true);
  });

  it("meets measurable street-wall, active-frontage and diversity targets", () => {
    const { morphology } = demoFabric();

    expect(morphology.medianFrontageUnitsPerBlock).toBeGreaterThanOrEqual(4);
    expect(morphology.frontageCoveragePct).toBeGreaterThanOrEqual(68);
    expect(morphology.loopFrontageCoveragePct).toBeGreaterThanOrEqual(78);
    expect(morphology.streetWallGapPct).toBeLessThanOrEqual(25);
    expect(morphology.loopStreetWallGapPct).toBeLessThanOrEqual(15);
    expect(morphology.activeGroundFloorPct).toBeGreaterThanOrEqual(50);
    expect(morphology.fultonActiveGroundFloorPct).toBeGreaterThanOrEqual(70);
    expect(morphology.genericLawnRatioPct).toBeLessThanOrEqual(12);
    expect(morphology.diverseAdjacentPairPct).toBeGreaterThanOrEqual(75);
    expect(morphology.landmarkRatioPct).toBeLessThanOrEqual(10);
  });

  it("keeps frontage parcels inside blocks and selection aligned to components", () => {
    const fabric = demoFabric();
    const blockById = new Map(
      fabric.blocks.map((block) => [block.id, block]),
    );

    for (const parcel of fabric.architecturalParcels) {
      const block = blockById.get(parcel.blockId)!;
      expect(Math.abs(parcel.x - block.x) + parcel.width / 2).toBeLessThanOrEqual(
        block.width / 2 + 0.001,
      );
      expect(Math.abs(parcel.z - block.z) + parcel.depth / 2).toBeLessThanOrEqual(
        block.depth / 2 + 0.001,
      );
    }
    for (const assignment of fabric.componentAssignments) {
      const selected = selectedUrbanEnvelopes(fabric, assignment.componentId);
      expect(selected).toHaveLength(12);
      expect(
        selected.every(
          (envelope) => envelope.componentId === assignment.componentId,
        ),
      ).toBe(true);
    }
  });

  it("supports reproducible architectural seeds without changing semantic addresses", () => {
    const semantic = demoSemanticCity();
    const first = planUrbanFabric({ semanticPlan: semantic, seed: "chicago-a" });
    const repeated = planUrbanFabric({ semanticPlan: semantic, seed: "chicago-a" });
    const alternate = planUrbanFabric({ semanticPlan: semantic, seed: "chicago-b" });

    expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
    expect(first.architecturalEnvelopes).not.toEqual(
      alternate.architecturalEnvelopes,
    );
    expect(first.entityAddresses).toEqual(alternate.entityAddresses);
    expect(first.componentBlockIds).toEqual(alternate.componentBlockIds);
  });

  it("drives physical style from place rather than component assignment", () => {
    const semantic = demoSemanticCity();
    const orderedCampuses = [...semantic.campuses].sort(
      (left, right) => left.x - right.x,
    );
    const west = orderedCampuses[0]!;
    const east = orderedCampuses.at(-1)!;
    const reassigned = {
      ...semantic,
      campuses: semantic.campuses.map((campus) =>
        campus.id === west.id
          ? { ...campus, x: east.x }
          : campus.id === east.id
            ? { ...campus, x: west.x }
            : campus,
      ),
    };
    const before = planUrbanFabric({ semanticPlan: semantic });
    const after = planUrbanFabric({ semanticPlan: reassigned });
    const beforeComponentByBlock = new Map(
      before.componentAssignments.flatMap((assignment) =>
        assignment.blockIds.map((blockId) => [blockId, assignment.componentId] as const),
      ),
    );
    const afterComponentByBlock = new Map(
      after.componentAssignments.flatMap((assignment) =>
        assignment.blockIds.map((blockId) => [blockId, assignment.componentId] as const),
      ),
    );
    const afterBlockById = new Map(after.blocks.map((block) => [block.id, block]));
    const unchangedSpatialSignature = (plan: typeof before, blockId: string) =>
      plan.architecturalEnvelopes
        .filter((envelope) => envelope.blockId === blockId)
        .map((envelope) => ({
          facadeFamily: envelope.facadeFamily,
          curtainWallVariant: envelope.curtainWallVariant,
          massingProfile: envelope.massingProfile,
          material: envelope.material,
          height: envelope.height,
          width: envelope.width,
          depth: envelope.depth,
        }))
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        );
    const reassignedBlocks = before.blocks.filter((block) => {
      const afterBlock = afterBlockById.get(block.id);
      return (
        beforeComponentByBlock.get(block.id) !== afterComponentByBlock.get(block.id) &&
        afterBlock?.characterZone === block.characterZone
      );
    });

    expect(reassignedBlocks.length).toBeGreaterThan(0);
    for (const block of reassignedBlocks) {
      expect(unchangedSpatialSignature(before, block.id)).toEqual(
        unchangedSpatialSignature(after, block.id),
      );
    }
  });

  it("preserves repository journey steps 8, 9 and 10 while routing land legs on streets", () => {
    const living = planLivingCity({
      entities: demoProject.entities,
      districts: demoProject.districts,
      relations: demoProject.relations,
    });
    const semantic = planSemanticCity({
      cityPlan: living,
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: demoProject.boundaryFacts,
    });
    const fabric = planUrbanFabric({ semanticPlan: semantic });
    const simulation = planFlowSimulation({
      entities: demoProject.entities,
      relations: demoProject.relations,
      cityPlan: living,
      artifactWaterBoundaries: semantic.terrain.waterBoundaries,
      artifactBoundaryFacts: demoProject.boundaryFacts,
      maxJourneys: 4,
      maxLegsPerJourney: 12,
    });
    const journey = simulation.journeys.find(
      (candidate) => candidate.id === simulation.defaultJourneyId,
    )!;
    const semanticProjection = projectSemanticFlow({
      plan: semantic,
      journey,
    });
    const finalSteps = journey.steps.slice(7, 10);

    expect(finalSteps).toHaveLength(3);
    expect(finalSteps.map((step) => step.label)).toEqual([
      "Project Bundle 入城港",
      "Viewer 城市调度中心",
      "三维施工现场",
    ]);
    expect(
      finalSteps.every((step) => Boolean(fabric.entityAddresses[step.entityId])),
    ).toBe(true);

    for (const leg of journey.legs) {
      const semanticPoints = semanticProjection.legPoints[leg.id] ?? [];
      const projected = projectUrbanJourneyLeg(
        fabric,
        leg.sourceEntityId,
        leg.targetEntityId,
        leg.mode,
        semanticPoints,
      );
      if (leg.mode === "boat") {
        expect(projected).toEqual(semanticPoints);
        continue;
      }
      expect(projected.length).toBeGreaterThanOrEqual(4);
      expect(projected[0]).toEqual(
        fabric.entityAddresses[leg.sourceEntityId]!.entrance,
      );
      expect(projected.at(-1)).toEqual(
        fabric.entityAddresses[leg.targetEntityId]!.entrance,
      );
    }

    expect(journey.tokens.map((token) => token.id)).toEqual(
      simulation.journeys
        .find((candidate) => candidate.id === simulation.defaultJourneyId)!
        .tokens.map((token) => token.id),
    );
    expect(finalSteps.map((step) => step.evidenceIds)).toEqual(
      journey.steps.slice(7, 10).map((step) => step.evidenceIds),
    );
  });
});
