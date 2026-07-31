import { describe, expect, it } from "vitest";

import {
  demoEntities,
  demoProject,
  type DemoEntity,
  type DemoRelation,
  type ProjectBoundaryFact,
} from "./demo-data";
import {
  planLivingCity,
  type CityPoint,
  type LivingCityPlan,
} from "./living-city";
import { planFlowSimulation } from "./flow-simulation";
import { projectSemanticFlow } from "./semantic-flow";
import {
  planSemanticCity,
  type SemanticCampus,
} from "./semantic-city";

function demoLivingCity(): LivingCityPlan {
  return planLivingCity({
    entities: demoProject.entities,
    districts: demoProject.districts,
    relations: demoProject.relations,
  });
}

function planDemo() {
  return planSemanticCity({
    cityPlan: demoLivingCity(),
    entities: demoProject.entities,
    relations: demoProject.relations,
    boundaryFacts: demoProject.boundaryFacts,
  });
}

function oppositeBankEntities(
  cityPlan: LivingCityPlan,
): [DemoEntity, DemoEntity] {
  const west = cityPlan.districts.find((district) => district.bank === "west");
  const east = cityPlan.districts.find((district) => district.bank === "east");
  const source = demoEntities.find(
    (entity) => entity.districtId === west?.id,
  );
  const target = demoEntities.find(
    (entity) => entity.districtId === east?.id,
  );
  if (!source || !target) {
    throw new Error("The demo fixture must expose entities on both river banks");
  }
  return [source, target];
}

function relation(
  id: string,
  sourceId: string,
  targetId: string,
  weight = 2,
): DemoRelation {
  return {
    id,
    sourceId,
    targetId,
    kind: "import",
    bornAt: 0,
    weight,
  };
}

function artifactBoundary(
  id: string,
  sourceEntityId: string,
  targetEntityId: string,
  relationId?: string,
): ProjectBoundaryFact {
  return {
    id,
    kind: "artifact",
    crossing: "water",
    sourceEntityId,
    targetEntityId,
    relationId,
    provenance: "test",
    reason: "A test fixture explicitly declares an artifact transfer boundary.",
  };
}

function isOutsideCampus(point: CityPoint, campus: SemanticCampus): boolean {
  return (
    Math.abs(point.x - campus.x) > campus.width / 2 ||
    Math.abs(point.z - campus.z) > campus.depth / 2
  );
}

function campusEnvelope(campuses: readonly SemanticCampus[]) {
  const minX = Math.min(
    ...campuses.map((campus) => campus.x - campus.width / 2),
  );
  const maxX = Math.max(
    ...campuses.map((campus) => campus.x + campus.width / 2),
  );
  const minZ = Math.min(
    ...campuses.map((campus) => campus.z - campus.depth / 2),
  );
  const maxZ = Math.max(
    ...campuses.map((campus) => campus.z + campus.depth / 2),
  );
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

describe("component-first semantic city planning", () => {
  it("projects every file into a bounded component campus", () => {
    const cityPlan = demoLivingCity();
    const semantic = planDemo();

    expect(semantic.components.length).toBeGreaterThanOrEqual(5);
    expect(semantic.components.length).toBeLessThanOrEqual(20);
    expect(semantic.campuses).toHaveLength(semantic.components.length);
    expect(
      semantic.campuses.every((campus) => campus.orientation === 0),
    ).toBe(true);
    expect(semantic.campuses.length).toBeLessThan(
      demoProject.entities.length / 4,
    );
    expect(
      semantic.components.every((component) => component.entityIds.length > 1),
    ).toBe(true);
    const architectureKinds = new Set(
      semantic.components.map((component) => component.architectureKind),
    );
    expect(architectureKinds).toEqual(
      new Set([
        "civic",
        "factory",
        "laboratory",
        "library",
        "operations",
        "port",
      ]),
    );

    const buildingByEntityId = new Map(
      cityPlan.buildings.map((building) => [
        building.entityId,
        building,
      ]),
    );
    for (const entity of demoProject.entities) {
      const address = semantic.entityAddresses[entity.id];
      const building = buildingByEntityId.get(entity.id);
      expect(address).toMatchObject({
        entityId: entity.id,
        districtId: entity.districtId,
      });
      expect(address?.componentId).toBeTruthy();
      expect(Number.isFinite(address?.worldPoint.x)).toBe(true);
      expect(Number.isFinite(address?.worldPoint.z)).toBe(true);
      expect(address?.legacyWorldPoint).toEqual({
        x: building?.x,
        z: building?.z,
      });
    }
  });

  it("is byte-stable and independent of all input collection order", () => {
    const cityPlan = demoLivingCity();
    const first = planSemanticCity({
      cityPlan,
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: demoProject.boundaryFacts,
    });
    const reordered = planSemanticCity({
      cityPlan,
      entities: [...demoProject.entities].reverse(),
      relations: [...demoProject.relations].reverse(),
      boundaryFacts: [...(demoProject.boundaryFacts ?? [])].reverse(),
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(reordered));
  });

  it("changes the city key when layout or boundary evidence changes", () => {
    const cityPlan = demoLivingCity();
    const first = planDemo();
    const withoutBoundary = planSemanticCity({
      cityPlan,
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: [],
    });
    const changedReason = planSemanticCity({
      cityPlan,
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: demoProject.boundaryFacts?.map((fact) => ({
        ...fact,
        reason: `${fact.reason} Updated evidence.`,
      })),
    });

    expect(withoutBoundary.seed).not.toBe(first.seed);
    expect(changedReason.seed).not.toBe(first.seed);
    expect(changedReason.components.map((component) => component.id)).toEqual(
      first.components.map((component) => component.id),
    );
  });

  it("scopes component, campus, corridor, and port identities to the repository seed", () => {
    const cityPlan = demoLivingCity();
    const first = planSemanticCity({
      cityPlan,
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: demoProject.boundaryFacts,
    });
    const second = planSemanticCity({
      cityPlan: {
        ...cityPlan,
        seed: `${cityPlan.seed}:another-repository`,
      },
      entities: demoProject.entities,
      relations: demoProject.relations,
      boundaryFacts: demoProject.boundaryFacts,
    });

    expect(first.components.map((component) => component.id)).not.toEqual(
      second.components.map((component) => component.id),
    );
    expect(first.campuses.map((campus) => campus.id)).not.toEqual(
      second.campuses.map((campus) => campus.id),
    );
    expect(first.corridors.map((corridor) => corridor.id)).not.toEqual(
      second.corridors.map((corridor) => corridor.id),
    );
    expect(first.roads.map((road) => road.id)).not.toEqual(
      second.roads.map((road) => road.id),
    );
    expect(
      first.corridors.flatMap((corridor) => [
        corridor.sourcePort.id,
        corridor.targetPort.id,
      ]),
    ).not.toEqual(
      second.corridors.flatMap((corridor) => [
        corridor.sourcePort.id,
        corridor.targetPort.id,
      ]),
    );
    expect(Object.keys(second.entityAddresses).sort()).toEqual(
      demoProject.entities.map((entity) => entity.id).sort(),
    );
  });

  it("hard-caps components at 30 and handles a maximum of one", () => {
    const cityPlan = demoLivingCity();
    const entities = demoEntities.slice(0, 35).map((entity, index) => ({
      ...entity,
      id: `synthetic-entity-${index}`,
      districtId: `synthetic-district-${index}`,
      path: `packages/synthetic-${index}/index.ts`,
    }));
    const capped = planSemanticCity({
      cityPlan,
      entities,
      relations: [],
      minimumComponents: 1,
      maximumComponents: 100,
    });
    const singular = planSemanticCity({
      cityPlan,
      entities,
      relations: [],
      maximumComponents: 1,
    });

    expect(capped.components).toHaveLength(30);
    expect(singular.components).toHaveLength(1);
    expect(Object.keys(capped.entityAddresses)).toHaveLength(entities.length);
    expect(Object.keys(singular.entityAddresses)).toHaveLength(entities.length);
  });

  it("aggregates static imports into structural corridors without claiming runtime traffic", () => {
    const semantic = planDemo();
    const staticCorridors = semantic.corridors.filter(
      (corridor) => corridor.basis === "static-import",
    );
    const relationById = new Map(
      demoProject.relations.map((item) => [item.id, item]),
    );
    const corridorById = new Map(
      semantic.corridors.map((corridor) => [corridor.id, corridor]),
    );

    expect(Object.keys(semantic.relationCorridorIds)).toHaveLength(
      demoProject.relations.length,
    );
    for (const corridor of staticCorridors) {
      expect(corridor.points.length).toBeGreaterThanOrEqual(4);
      expect(corridor.relationIds.length).toBeGreaterThan(0);
      expect(corridor.evidence.relationIds).toEqual(corridor.relationIds);
      expect(corridor.evidence.reason).toContain("Static file imports");
      expect(corridor.evidence.reason).toContain("never runtime traffic");
      expect(corridor.weight).toBe(
        corridor.relationIds.reduce(
          (sum, id) => sum + (relationById.get(id)?.weight ?? 0),
          0,
        ),
      );
      for (const id of corridor.relationIds) {
        expect(semantic.relationCorridorIds[id]).toBe(corridor.id);
      }
      expect(corridor.roadClass).toBe(
        corridor.scope === "campus" ? "local" : "collector",
      );
    }
    expect(new Set(semantic.roads.map((road) => road.roadClass))).toEqual(
      new Set(["local", "collector", "arterial"]),
    );
    expect(
      semantic.roads.some((road) => road.corridorIds.length > 1),
    ).toBe(true);
    expect(
      semantic.roads.every(
        (road) =>
          road.level === "ground" &&
          road.surface === "ground" &&
          (road.evidenceRelationIds.length > 0 ||
            road.corridorIds.every(
              (id) =>
                corridorById.get(id)?.basis === "component-access",
            )),
      ),
    ).toBe(true);
    const accessCorridors = semantic.corridors.filter(
      (corridor) => corridor.basis === "component-access",
    );
    expect(accessCorridors).toHaveLength(semantic.components.length);
    expect(
      accessCorridors.every(
        (corridor) =>
          corridor.scope === "campus" &&
          corridor.roadClass === "local" &&
          corridor.weight === 0 &&
          corridor.relationIds.length === 0 &&
          semantic.roads.some((road) =>
            road.corridorIds.includes(corridor.id),
          ),
      ),
    ).toBe(true);
    expect(semantic.mobility.routes).toEqual([]);
  });

  it("forms a compact center and explicit waterfront instead of reusing sparse district anchors", () => {
    const cityPlan = demoLivingCity();
    const semantic = planDemo();
    const envelope = campusEnvelope(semantic.campuses);
    const river = cityPlan.geography.river!;
    const boundary = semantic.terrain.waterBoundaries[0]!;
    const waterMinX = Math.min(
      ...boundary.outline.map((candidate) => candidate.x),
    );
    const waterMaxX = Math.max(
      ...boundary.outline.map((candidate) => candidate.x),
    );
    const fact = demoProject.boundaryFacts![0]!;
    const sourceAddress = semantic.entityAddresses[fact.sourceEntityId]!;
    const targetAddress = semantic.entityAddresses[fact.targetEntityId]!;
    const sourceCampus = semantic.campuses.find(
      (campus) => campus.id === sourceAddress.campusId,
    )!;
    const targetCampus = semantic.campuses.find(
      (campus) => campus.id === targetAddress.campusId,
    )!;

    expect(envelope.width).toBeLessThan(cityPlan.bounds.width * 0.45);
    expect(envelope.depth).toBeLessThan(cityPlan.bounds.depth * 0.3);
    expect(sourceCampus.z).toBe(targetCampus.z);
    expect(sourceCampus.x).toBeLessThan(river.x);
    expect(targetCampus.x).toBeGreaterThan(river.x);
    for (const campus of semantic.campuses) {
      const campusMinX = campus.x - campus.width / 2;
      const campusMaxX = campus.x + campus.width / 2;
      expect(
        campusMaxX <= waterMinX || campusMinX >= waterMaxX,
      ).toBe(true);
      const frontageGap =
        campus.x < river.x
          ? waterMinX - campusMaxX
          : campusMinX - waterMaxX;
      expect(frontageGap).toBeCloseTo(2.5, 2);
    }

    for (const bank of ["west", "east"] as const) {
      const bankCampuses = semantic.campuses
        .filter((campus) =>
          bank === "west"
            ? campus.x < waterMinX
            : campus.x > waterMaxX,
        )
        .sort((left, right) => left.z - right.z);
      expect(bankCampuses.length).toBeGreaterThanOrEqual(2);
      for (let index = 1; index < bankCampuses.length; index += 1) {
        const previous = bankCampuses[index - 1]!;
        const current = bankCampuses[index]!;
        const streetGap =
          current.z -
          current.depth / 2 -
          (previous.z + previous.depth / 2);
        expect(streetGap).toBeGreaterThanOrEqual(0);
        expect(streetGap).toBeLessThan(7.5);
      }
    }
  });

  it("uses component reach and architectural role for a legible density gradient", () => {
    const semantic = planDemo();
    const componentById = new Map(
      semantic.components.map((component) => [component.id, component]),
    );
    const campusByKind = new Map(
      semantic.campuses.map((campus) => [campus.kind, campus]),
    );
    const heights = semantic.campuses.map((campus) => campus.height);
    const tallest = semantic.campuses.reduce((current, candidate) =>
      candidate.height > current.height ? candidate : current,
    );
    const highestLoc = semantic.components.reduce((current, candidate) =>
      candidate.metrics.loc > current.metrics.loc
        ? candidate
        : current,
    );

    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(6);
    expect(new Set(heights).size).toBeGreaterThanOrEqual(5);
    expect(campusByKind.get("operations")!.height).toBeGreaterThan(
      campusByKind.get("library")!.height,
    );
    expect(campusByKind.get("civic")!.height).toBeGreaterThan(
      campusByKind.get("factory")!.height,
    );
    expect(campusByKind.get("port")!.width).toBeGreaterThan(
      campusByKind.get("operations")!.width,
    );
    expect(campusByKind.get("laboratory")!.width).toBeGreaterThan(
      campusByKind.get("library")!.width,
    );
    expect(tallest.componentId).not.toBe(highestLoc.id);
    expect(componentById.get(tallest.componentId)?.metrics.files).toBeGreaterThan(
      0,
    );
  });

  it("bundles land corridors into shared junctions without inventing a bridge", () => {
    const cityPlan = demoLivingCity();
    const semantic = planDemo();
    const river = cityPlan.geography.river!;
    const minX = river.x - river.width / 2;
    const maxX = river.x + river.width / 2;
    const accessCorridorIds = new Set(
      semantic.corridors
        .filter((corridor) => corridor.basis === "component-access")
        .map((corridor) => corridor.id),
    );
    const carrierRoads = semantic.roads.filter(
      (road) => road.roadClass !== "local",
    );
    const sharedCarrierRoads = carrierRoads.filter(
      (road) => road.corridorIds.length > 1,
    );
    const accessRoads = semantic.roads.filter((road) =>
      road.corridorIds.some((id) => accessCorridorIds.has(id)),
    );
    const minimumCollectorWidth = Math.min(
      ...carrierRoads
        .filter((road) => road.roadClass === "collector")
        .map((road) => road.width),
    );
    const roadBacked = (corridorId: string) =>
      semantic.roads.some((road) => road.corridorIds.includes(corridorId));

    const landCorridors = semantic.corridors.filter(
      (corridor) =>
        corridor.basis === "static-import" &&
        corridor.scope === "city",
    );
    for (const corridor of landCorridors) {
      const sourceSide =
        corridor.sourcePort.x < minX ? "west" : "east";
      const targetSide =
        corridor.targetPort.x < minX ? "west" : "east";
      expect(roadBacked(corridor.id)).toBe(sourceSide === targetSide);
    }
    for (const road of semantic.roads) {
      const west = road.centerline.some((candidate) => candidate.x < minX);
      const east = road.centerline.some((candidate) => candidate.x > maxX);
      expect(west && east).toBe(false);
    }
    expect(
      semantic.roads.some(
        (road) =>
          road.roadClass === "arterial" &&
          road.corridorIds.length >= 2,
      ),
    ).toBe(true);
    expect(carrierRoads.length).toBeGreaterThan(0);
    expect(sharedCarrierRoads.length / carrierRoads.length).toBeGreaterThanOrEqual(
      0.75,
    );
    expect(accessRoads.length).toBeGreaterThan(0);
    expect(
      accessRoads.every(
        (road) =>
          road.roadClass === "local" &&
          road.width < minimumCollectorWidth,
      ),
    ).toBe(true);
  });

  it("starts and ends every corridor at exposed frontage outside campus mass", () => {
    const semantic = planDemo();
    const campusByComponentId = new Map(
      semantic.campuses.map((campus) => [campus.componentId, campus]),
    );

    for (const corridor of semantic.corridors) {
      const sourceCampus = campusByComponentId.get(
        corridor.sourceComponentId,
      )!;
      const targetCampus = campusByComponentId.get(
        corridor.targetComponentId,
      )!;
      expect(corridor.points[0]).toEqual({
        x: corridor.sourcePort.x,
        z: corridor.sourcePort.z,
      });
      expect(corridor.points.at(-1)).toEqual({
        x: corridor.targetPort.x,
        z: corridor.targetPort.z,
      });
      expect(isOutsideCampus(corridor.sourcePort, sourceCampus)).toBe(true);
      expect(isOutsideCampus(corridor.targetPort, targetCampus)).toBe(true);
      expect(corridor.sourcePort.campusId).toBe(sourceCampus.id);
      expect(corridor.targetPort.campusId).toBe(targetCampus.id);
      if (corridor.scope === "campus") {
        expect(
          corridor.points.every((candidate) =>
            isOutsideCampus(candidate, sourceCampus),
          ),
        ).toBe(true);
      }
    }
  });

  it("does not infer water or port architecture from banks, imports, or filenames", () => {
    const cityPlan = demoLivingCity();
    const [west, east] = oppositeBankEntities(cityPlan);
    const writer = {
      ...west,
      path: "packages/compiler/static-bundle-writer.ts",
      name: "static-bundle-writer.ts",
      role: "source" as const,
    };
    const loader = {
      ...east,
      path: "apps/viewer/project-cache-loader.ts",
      name: "project-cache-loader.ts",
      role: "source" as const,
    };
    const semantic = planSemanticCity({
      cityPlan,
      entities: [writer, loader],
      relations: [relation("filename-cross-bank", writer.id, loader.id, 999)],
      minimumComponents: 1,
    });

    expect(cityPlan.geography.river).not.toBeNull();
    expect(semantic.terrain.waterBoundaries).toEqual([]);
    expect(semantic.corridors.every((corridor) => !corridor.waterCrossing)).toBe(
      true,
    );
    expect(
      semantic.components.every(
        (component) => component.architectureKind !== "port",
      ),
    ).toBe(true);
    expect(
      semantic.corridors.find(
        (corridor) => corridor.basis === "static-import",
      )?.roadClass,
    ).toBe("collector");
    expect(semantic.mobility.routes).toEqual([]);
  });

  it("uses the demo's explainable artifact fact for water and endpoint ports", () => {
    const semantic = planDemo();
    const fact = demoProject.boundaryFacts?.[0];
    expect(fact).toBeTruthy();
    const boundary = semantic.terrain.waterBoundaries[0];
    const corridor = semantic.corridors.find(
      (candidate) => candidate.boundaryFactIds[0] === fact?.id,
    );
    const sourceComponentId =
      semantic.entityAddresses[fact!.sourceEntityId]?.componentId;
    const targetComponentId =
      semantic.entityAddresses[fact!.targetEntityId]?.componentId;

    expect(boundary).toMatchObject({
      boundaryFactIds: [fact?.id],
      evidence: {
        boundaryFactIds: [fact?.id],
        provenance: "inferred",
      },
    });
    expect(boundary?.outline).toHaveLength(5);
    expect(boundary?.coastlines).toHaveLength(2);
    expect(corridor).toMatchObject({
      basis: "declared-boundary",
      waterCrossing: true,
      modeHint: "artifact",
      sourcePort: { kind: "artifact-quay" },
      targetPort: { kind: "artifact-quay" },
    });
    const waterMinX = Math.min(
      ...boundary!.outline.map((candidate) => candidate.x),
    );
    const waterMaxX = Math.max(
      ...boundary!.outline.map((candidate) => candidate.x),
    );
    const waterMinZ = Math.min(
      ...boundary!.outline.map((candidate) => candidate.z),
    );
    const waterMaxZ = Math.max(
      ...boundary!.outline.map((candidate) => candidate.z),
    );
    expect(
      [corridor!.sourcePort.x, corridor!.targetPort.x].sort(
        (left, right) => left - right,
      ),
    ).toEqual([waterMinX, waterMaxX]);
    expect(
      corridor!.points.every(
        (candidate) =>
          candidate.x >= waterMinX &&
          candidate.x <= waterMaxX &&
          candidate.z >= waterMinZ &&
          candidate.z <= waterMaxZ,
      ),
    ).toBe(true);
    expect(
      semantic.components.find(
        (component) => component.id === sourceComponentId,
      )?.architectureKind,
    ).toBe("factory");
    expect(
      semantic.components.find(
        (component) => component.id === targetComponentId,
      )?.architectureKind,
    ).toBe("port");
    expect(semantic.mobility.routes).toEqual([]);
  });

  it("projects the complete Golden Journey and keeps boat traffic inside typed water", () => {
    const cityPlan = demoLivingCity();
    const semantic = planDemo();
    const simulation = planFlowSimulation({
      entities: demoProject.entities,
      relations: demoProject.relations,
      cityPlan,
      artifactWaterBoundaries: semantic.terrain.waterBoundaries,
      artifactBoundaryFacts: demoProject.boundaryFacts ?? [],
      maxJourneys: 4,
      maxLegsPerJourney: 8,
    });
    const journey = simulation.journeys.find(
      (candidate) => candidate.id === simulation.defaultJourneyId,
    );

    expect(journey).toBeTruthy();
    expect(journey!.legs).toHaveLength(9);
    const projection = projectSemanticFlow({
      plan: semantic,
      journey: journey!,
    });
    expect(projection.routes).toHaveLength(journey!.legs.length);
    expect(projection.diagnostics.skippedLegs).toEqual([]);

    const boatRoute = projection.routes.find(
      (route) => route.mode === "boat",
    );
    const boundary = semantic.terrain.waterBoundaries.find(
      (candidate) =>
        boatRoute?.boundaryFactIds.some((id) =>
          candidate.boundaryFactIds.includes(id),
        ),
    );
    expect(boatRoute).toBeTruthy();
    expect(boundary).toBeTruthy();

    const waterMinX = Math.min(
      ...boundary!.outline.map((candidate) => candidate.x),
    );
    const waterMaxX = Math.max(
      ...boundary!.outline.map((candidate) => candidate.x),
    );
    const waterMinZ = Math.min(
      ...boundary!.outline.map((candidate) => candidate.z),
    );
    const waterMaxZ = Math.max(
      ...boundary!.outline.map((candidate) => candidate.z),
    );
    expect(
      boatRoute!.points.every(
        (candidate) =>
          candidate.x >= waterMinX &&
          candidate.x <= waterMaxX &&
          candidate.z >= waterMinZ &&
          candidate.z <= waterMaxZ,
      ),
    ).toBe(true);
  });

  it("rejects boundary facts with unknown endpoints or cited relations", () => {
    const cityPlan = demoLivingCity();
    const [west, east] = oppositeBankEntities(cityPlan);

    expect(() =>
      planSemanticCity({
        cityPlan,
        entities: [west, east],
        relations: [],
        boundaryFacts: [
          artifactBoundary("unknown-endpoint", "missing", east.id),
        ],
        minimumComponents: 1,
      }),
    ).toThrow("Unknown boundary source entity");
    expect(() =>
      planSemanticCity({
        cityPlan,
        entities: [west, east],
        relations: [],
        boundaryFacts: [
          artifactBoundary(
            "unknown-relation",
            west.id,
            east.id,
            "missing-relation",
          ),
        ],
        minimumComponents: 1,
      }),
    ).toThrow("Unknown boundary relation");
  });

  it("cannot create a water boundary when no river exists", () => {
    const base = demoLivingCity();
    const [west, east] = oppositeBankEntities(base);
    const cityPlan: LivingCityPlan = {
      ...base,
      geography: { river: null },
      mobility: {
        ...base.mobility,
        boatRoutes: [],
      },
    };
    const fact = artifactBoundary("artifact-without-water", west.id, east.id);
    const semantic = planSemanticCity({
      cityPlan,
      entities: [west, east],
      relations: [],
      boundaryFacts: [fact],
      minimumComponents: 1,
    });

    expect(semantic.terrain.waterBoundaries).toEqual([]);
    expect(
      semantic.corridors.find(
        (corridor) => corridor.boundaryFactIds.includes(fact.id),
      )?.waterCrossing,
    ).toBe(false);
    expect(semantic.mobility.routes).toEqual([]);
  });
});
