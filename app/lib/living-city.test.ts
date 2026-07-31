import { describe, expect, it } from "vitest";

import {
  type CityPoint,
  type CityRect,
  type LivingCityInput,
  planLivingCity,
} from "./living-city";
import {
  demoDistricts,
  demoEntities,
  demoRelations,
} from "./demo-data";

function makeInput(
  districtCount: number,
  entityCount: number,
): LivingCityInput {
  const districts = Array.from({ length: districtCount }, (_, index) => ({
    id: `district-${String(index + 1).padStart(2, "0")}`,
    name: `District ${index + 1}`,
    color: `#${(0x568f80 + index * 0x10101)
      .toString(16)
      .padStart(6, "0")
      .slice(-6)}`,
  }));
  const roles = ["source", "test", "docs", "script", "config"] as const;
  const entities = Array.from({ length: entityCount }, (_, index) => {
    const district = districts[index % districtCount]!;
    const role = roles[index % roles.length]!;
    return {
      id: `entity-${String(index + 1).padStart(4, "0")}`,
      path: `${district.id}/${role}/module-${index + 1}.ts`,
      districtId: district.id,
      role,
      maxMetrics: {
        loc: 20 + (index % 18) * 31,
        exports: index % 7,
        fanIn: index % 11,
        fanOut: index % 5,
        churn: index * 2,
      },
    };
  });
  const relations = entities.slice(0, -1).map((entity, index) => ({
    id: `relation-${index + 1}`,
    sourceId: entity.id,
    targetId: entities[index + 1]!.id,
    weight: (index % 4) + 1,
  }));

  return { districts, entities, relations };
}

function edges(rect: CityRect) {
  return {
    minX: rect.x - rect.width / 2,
    maxX: rect.x + rect.width / 2,
    minZ: rect.z - rect.depth / 2,
    maxZ: rect.z + rect.depth / 2,
  };
}

function contains(outer: CityRect, inner: CityRect): boolean {
  const outerEdges = edges(outer);
  const innerEdges = edges(inner);
  return (
    innerEdges.minX >= outerEdges.minX &&
    innerEdges.maxX <= outerEdges.maxX &&
    innerEdges.minZ >= outerEdges.minZ &&
    innerEdges.maxZ <= outerEdges.maxZ
  );
}

function overlaps(left: CityRect, right: CityRect): boolean {
  const a = edges(left);
  const b = edges(right);
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

function roadRect(
  road: ReturnType<typeof planLivingCity>["roads"][number],
): CityRect & { id: string } {
  return {
    id: road.id,
    x: (road.start.x + road.end.x) / 2,
    z: (road.start.z + road.end.z) / 2,
    width:
      road.axis === "x"
        ? Math.abs(road.end.x - road.start.x)
        : road.width,
    depth:
      road.axis === "z"
        ? Math.abs(road.end.z - road.start.z)
        : road.width,
  };
}

function assertContinuous(points: readonly CityPoint[], closed: boolean) {
  expect(points.length).toBeGreaterThanOrEqual(2);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const axisAligned =
      previous.x === current.x || previous.z === current.z;
    const nonZero = previous.x !== current.x || previous.z !== current.z;
    expect(axisAligned).toBe(true);
    expect(nonZero).toBe(true);
  }
  if (closed) {
    expect(points.at(-1)).toEqual(points[0]);
  }
}

describe("planLivingCity", () => {
  it("is byte-stable and independent of input ordering", () => {
    const input = makeInput(6, 120);
    const reversed: LivingCityInput = {
      districts: [...input.districts].reverse(),
      entities: [...input.entities].reverse(),
      relations: [...input.relations].reverse(),
    };

    const first = planLivingCity(input);
    const second = planLivingCity(input);
    const reordered = planLivingCity(reversed);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).toBe(JSON.stringify(reordered));
  });

  it("keeps buildings inside world, blocks and parcels", () => {
    const plan = planLivingCity(makeInput(5, 95));
    const parcels = new Map(plan.parcels.map((parcel) => [parcel.id, parcel]));
    const blocks = new Map(plan.blocks.map((block) => [block.id, block]));
    const roads = new Set(plan.roads.map((road) => road.id));

    for (const building of plan.buildings) {
      const parcel = parcels.get(building.parcelId)!;
      const block = blocks.get(building.blockId)!;
      expect(contains(plan.bounds, building)).toBe(true);
      expect(contains(parcel, building)).toBe(true);
      expect(contains(block, parcel)).toBe(true);
      expect(roads.has(building.frontage.roadId)).toBe(true);
    }
  });

  it("never places a building in a river, road, or another building", () => {
    const plan = planLivingCity(makeInput(6, 190));
    const roadRects = plan.roads.map(roadRect);

    for (const [index, building] of plan.buildings.entries()) {
      if (plan.geography.river) {
        expect(overlaps(building, plan.geography.river)).toBe(false);
      }
      for (const road of roadRects) {
        expect(
          overlaps(building, road),
          `${building.id} overlaps ${road.id}`,
        ).toBe(false);
      }
      for (const other of plan.buildings.slice(index + 1)) {
        expect(overlaps(building, other)).toBe(false);
      }
    }
  });

  it("uses explicit thresholds for water, bridges, boats, and elevated roads", () => {
    const tiny = planLivingCity(makeInput(3, 30));
    expect(tiny.geography.river).toBeNull();
    expect(tiny.bridges).toHaveLength(0);
    expect(tiny.mobility.boatRoutes).toHaveLength(0);
    expect(tiny.roads.some((road) => road.level === "elevated")).toBe(false);

    const riverCity = planLivingCity(makeInput(4, 80));
    expect(riverCity.geography.river).not.toBeNull();
    expect(riverCity.bridges.length).toBeGreaterThan(0);
    expect(riverCity.mobility.boatRoutes.length).toBeGreaterThan(0);
    expect(
      riverCity.districts.some((district) => district.bank === "west"),
    ).toBe(true);
    expect(
      riverCity.districts.some((district) => district.bank === "east"),
    ).toBe(true);
    expect(riverCity.roads.some((road) => road.level === "elevated")).toBe(
      false,
    );

    const largeCity = planLivingCity(makeInput(4, 180));
    expect(largeCity.roads.some((road) => road.level === "elevated")).toBe(
      true,
    );
    for (const bridge of largeCity.bridges) {
      expect(overlaps(bridge, largeCity.geography.river!)).toBe(true);
    }
  });

  it("produces continuous orthogonal mobility routes", () => {
    const plan = planLivingCity(makeInput(6, 185));
    const allRoutes = [
      ...plan.mobility.carRoutes,
      ...plan.mobility.pedestrianRoutes,
      ...plan.mobility.boatRoutes,
    ];

    expect(plan.mobility.carRoutes.length).toBeGreaterThan(0);
    expect(plan.mobility.pedestrianRoutes.length).toBeGreaterThan(0);
    expect(plan.mobility.boatRoutes.length).toBeGreaterThan(0);

    for (const route of allRoutes) {
      assertContinuous(route.points, route.closed);
    }
  });

  it("caps gateways at two per district in the full demo city", () => {
    const plan = planLivingCity({
      districts: demoDistricts,
      entities: demoEntities,
      relations: demoRelations,
    });
    const counts = new Map<string, number>();

    for (const building of plan.buildings) {
      if (building.archetype !== "gateway-landmark") continue;
      counts.set(
        building.districtId,
        (counts.get(building.districtId) ?? 0) + 1,
      );
    }

    expect(
      plan.buildings.filter(
        (building) => building.archetype === "gateway-landmark",
      ).length,
    ).toBeLessThanOrEqual(plan.districts.length * 2);
    for (const district of plan.districts) {
      expect(counts.get(district.id) ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it("recognizes explicit entry points without turning every high fan-in file into a landmark", () => {
    const input = makeInput(6, 220);
    const entryIds: string[] = [];
    const entities = [...input.entities];

    for (const district of input.districts) {
      const entryIndex = entities.findIndex(
        (entity) =>
          entity.districtId === district.id && entity.role === "source",
      );
      const entry = entities[entryIndex]!;
      entryIds.push(entry.id);
      entities[entryIndex] = {
        ...entry,
        path: `${district.id}/src/index.ts`,
        maxMetrics: { ...entry.maxMetrics, fanIn: 1 },
      };
    }

    const plan = planLivingCity({ ...input, entities });
    const buildings = new Map(
      plan.buildings.map((building) => [building.entityId, building]),
    );

    for (const entryId of entryIds) {
      expect(buildings.get(entryId)?.archetype).toBe("gateway-landmark");
    }
    for (const district of plan.districts) {
      expect(
        plan.buildings.filter(
          (building) =>
            building.districtId === district.id &&
            building.archetype === "gateway-landmark",
        ),
      ).toHaveLength(2);
    }
  });

  it("keeps explicit facility semantics ahead of gateway selection", () => {
    const specialEntities = [
      {
        id: "docs-entry",
        path: "docs/index.ts",
        districtId: "core",
        role: "docs",
        expected: "library-hall",
      },
      {
        id: "test-entry",
        path: "tests/main.ts",
        districtId: "core",
        role: "test",
        expected: "quality-laboratory",
      },
      {
        id: "config-entry",
        path: "config/entry.ts",
        districtId: "core",
        role: "config",
        expected: "control-data-center",
      },
      {
        id: "network-entry",
        path: "src/network/public-api.ts",
        districtId: "core",
        role: "source",
        expected: "control-data-center",
      },
      {
        id: "storage-entry",
        path: "src/storage/index.ts",
        districtId: "core",
        role: "source",
        expected: "industrial-shed",
      },
      {
        id: "real-entry",
        path: "src/index.ts",
        districtId: "core",
        role: "source",
        expected: "gateway-landmark",
      },
    ].map(({ expected, ...entity }, index) => ({
      ...entity,
      maxMetrics: {
        loc: 100,
        exports: 2,
        fanIn: 50 - index,
        fanOut: 1,
        churn: 4,
      },
      expected,
    }));
    const plan = planLivingCity({
      districts: [{ id: "core" }],
      entities: specialEntities,
      relations: [],
    });
    const buildings = new Map(
      plan.buildings.map((building) => [building.entityId, building]),
    );

    for (const entity of specialEntities) {
      expect(buildings.get(entity.id)?.archetype).toBe(entity.expected);
    }
  });
});
