import { describe, expect, it } from "vitest";

import {
  findRoadPath,
  projectRoadAnchor,
  type RoadPathPlan,
} from "./flow-route";
import type { CityPoint, RoadSegment } from "./living-city";

function road(
  id: string,
  axis: "x" | "z",
  start: CityPoint,
  end: CityPoint,
  options: Partial<
    Pick<RoadSegment, "level" | "surface" | "bridgeId">
  > = {},
): RoadSegment {
  return {
    id,
    axis,
    start,
    end,
    roadClass: "local",
    level: options.level ?? "ground",
    surface: options.surface ?? "ground",
    width: 2,
    districtIds: [],
    bridgeId: options.bridgeId ?? null,
    outsideConnection: false,
  };
}

function plan(...roads: RoadSegment[]): RoadPathPlan {
  return { roads };
}

function pointOnRoad(point: CityPoint, candidate: RoadSegment): boolean {
  if (candidate.level !== "ground") return false;
  const epsilon = 1e-7;
  const between = (value: number, first: number, second: number) =>
    value >= Math.min(first, second) - epsilon &&
    value <= Math.max(first, second) + epsilon;

  return candidate.axis === "x"
    ? Math.abs(point.z - candidate.start.z) <= epsilon &&
        between(point.x, candidate.start.x, candidate.end.x)
    : Math.abs(point.x - candidate.start.x) <= epsilon &&
        between(point.z, candidate.start.z, candidate.end.z);
}

function segmentCoveredByGroundRoads(
  start: CityPoint,
  end: CityPoint,
  roads: readonly RoadSegment[],
): boolean {
  const ground = roads.filter((candidate) => candidate.level === "ground");
  const axis = start.x === end.x ? "z" : start.z === end.z ? "x" : null;
  if (!axis) return false;

  const breakpoints = new Set<number>([
    axis === "x" ? start.x : start.z,
    axis === "x" ? end.x : end.z,
  ]);
  for (const candidate of ground) {
    if (candidate.axis !== axis) continue;
    const sameLine =
      axis === "x"
        ? candidate.start.z === start.z
        : candidate.start.x === start.x;
    if (!sameLine) continue;
    breakpoints.add(axis === "x" ? candidate.start.x : candidate.start.z);
    breakpoints.add(axis === "x" ? candidate.end.x : candidate.end.z);
  }

  const low = axis === "x"
    ? Math.min(start.x, end.x)
    : Math.min(start.z, end.z);
  const high = axis === "x"
    ? Math.max(start.x, end.x)
    : Math.max(start.z, end.z);
  const ordered = [...breakpoints]
    .filter((value) => value >= low && value <= high)
    .sort((left, right) => left - right);

  return ordered.slice(1).every((value, index) => {
    const midpoint = (ordered[index]! + value) / 2;
    const point = axis === "x"
      ? { x: midpoint, z: start.z }
      : { x: start.x, z: midpoint };
    return ground.some((candidate) => pointOnRoad(point, candidate));
  });
}

describe("findRoadPath", () => {
  it("projects an explicit parcel-edge frontage onto its declared road", () => {
    const ground = road("ground", "x", { x: 0, z: 0 }, { x: 10, z: 0 });

    expect(
      projectRoadAnchor(plan(ground), {
        roadId: ground.id,
        point: { x: 3, z: 1.2 },
      }),
    ).toEqual({
      roadId: ground.id,
      point: { x: 3, z: 0 },
    });
    expect(
      projectRoadAnchor(plan(ground), {
        roadId: ground.id,
        point: { x: 12, z: 1.2 },
      }),
    ).toBeNull();
  });

  it("preserves both anchors and keeps every compacted segment on ground roads", () => {
    const roads = [
      road("west-east", "x", { x: 0, z: 0 }, { x: 10, z: 0 }),
      road("south-north", "z", { x: 10, z: 0 }, { x: 10, z: 10 }),
    ];
    const source = { roadId: "west-east", point: { x: 2, z: 0 } };
    const target = { roadId: "south-north", point: { x: 10, z: 8 } };

    const path = findRoadPath({ roads }, source, target);

    expect(path).toEqual([
      source.point,
      { x: 10, z: 0 },
      target.point,
    ]);
    for (let index = 1; index < path!.length; index += 1) {
      expect(
        segmentCoveredByGroundRoads(path![index - 1]!, path![index]!, roads),
      ).toBe(true);
    }
  });

  it("crosses a river only when the ground-level bridge joins both banks", () => {
    const west = road("west-bank", "x", { x: -10, z: 2 }, { x: -4, z: 2 });
    const east = road("east-bank", "x", { x: 4, z: 2 }, { x: 10, z: 2 });
    const bridge = road(
      "river-bridge",
      "x",
      { x: -4, z: 2 },
      { x: 4, z: 2 },
      { surface: "bridge", bridgeId: "bridge-1" },
    );
    const source = { roadId: west.id, point: { x: -8, z: 2 } };
    const target = { roadId: east.id, point: { x: 8, z: 2 } };

    expect(findRoadPath(plan(west, east), source, target)).toBeNull();
    expect(findRoadPath(plan(west, bridge, east), source, target)).toEqual([
      source.point,
      target.point,
    ]);
  });

  it("does not connect ground roads through an elevated crossing", () => {
    const lower = road("lower-ground", "x", { x: 0, z: 0 }, { x: 4, z: 0 });
    const upper = road("upper-ground", "x", { x: 4, z: 10 }, { x: 8, z: 10 });
    const elevated = road(
      "elevated-ramp",
      "z",
      { x: 4, z: 0 },
      { x: 4, z: 10 },
      { level: "elevated" },
    );

    expect(
      findRoadPath(
        plan(lower, elevated, upper),
        { roadId: lower.id, point: { x: 1, z: 0 } },
        { roadId: upper.id, point: { x: 7, z: 10 } },
      ),
    ).toBeNull();
  });

  it("chooses the same shortest path regardless of road input ordering", () => {
    const roads = [
      road("left", "z", { x: 0, z: 0 }, { x: 0, z: 10 }),
      road("right", "z", { x: 10, z: 0 }, { x: 10, z: 10 }),
      road("a-top", "x", { x: 0, z: 10 }, { x: 10, z: 10 }),
      road("b-bottom", "x", { x: 0, z: 0 }, { x: 10, z: 0 }),
    ];
    const source = { roadId: "left", point: { x: 0, z: 5 } };
    const target = { roadId: "right", point: { x: 10, z: 5 } };
    const expected = findRoadPath({ roads }, source, target);

    expect(expected).not.toBeNull();
    expect(findRoadPath({ roads: [...roads].reverse() }, source, target)).toEqual(
      expected,
    );
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(findRoadPath({ roads }, source, target)).toEqual(expected);
    }
  });

  it("returns null for disconnected ground-road components", () => {
    const first = road("first", "x", { x: 0, z: 0 }, { x: 4, z: 0 });
    const second = road("second", "x", { x: 8, z: 0 }, { x: 12, z: 0 });

    expect(
      findRoadPath(
        plan(first, second),
        { roadId: first.id, point: { x: 1, z: 0 } },
        { roadId: second.id, point: { x: 11, z: 0 } },
      ),
    ).toBeNull();
  });

  it("rejects a frontage point that is not on its declared ground road", () => {
    const ground = road("ground", "x", { x: 0, z: 0 }, { x: 10, z: 0 });

    expect(
      findRoadPath(
        plan(ground),
        { roadId: ground.id, point: { x: 2, z: 0.25 } },
        { roadId: ground.id, point: { x: 8, z: 0 } },
      ),
    ).toBeNull();
  });
});
