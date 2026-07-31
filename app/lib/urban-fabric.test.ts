import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
import { planLivingCity } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import {
  planUrbanFabric,
  selectedUrbanBlocks,
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
});
