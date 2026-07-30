import { describe, expect, it } from "vitest";
import type {
  CityEntity,
  Relation,
  ReplayDelta,
} from "../../schema/src/index.js";
import {
  ReplayInvariantError,
  applyDelta,
  buildKeyframes,
  calculateDeltaDuration,
  createEmptyReplayState,
  createReplayCatalog,
  reduceReplay,
  seekReplay,
} from "../src/index.js";

const baseLayout = {
  x: 0,
  z: 0,
  width: 1,
  depth: 1,
  maxHeight: 8,
  rotationY: 0,
  styleVariant: 0,
};

function entity(id: string, path: string, aliases: string[] = []): CityEntity {
  return {
    id,
    kind: "building",
    path,
    aliases,
    name: path.split("/").at(-1)!,
    extension: ".ts",
    language: "typescript",
    role: "source",
    districtId: "core",
    bornAt: 0,
    maxMetrics: { loc: 20, exports: 2, fanIn: 1, fanOut: 1, churn: 8 },
    layout: { ...baseLayout },
  };
}

const entities = [
  entity("a", "src/renamed-a.ts", ["src/a.ts"]),
  entity("b", "src/b.ts"),
];
const relations: Relation[] = [
  {
    id: "a-imports-b",
    sourceId: "a",
    targetId: "b",
    kind: "import",
    bornAt: 0,
    diedAt: 3,
    weight: 1,
  },
];
const before = { loc: 10, exports: 1, fanIn: 0, fanOut: 1 };
const after = { loc: 20, exports: 2, fanIn: 0, fanOut: 1 };
const bMetrics = { loc: 8, exports: 1, fanIn: 1, fanOut: 0 };
const deltas: ReplayDelta[] = [
  {
    commitIndex: 0,
    entityChanges: [
      { op: "spawn", entityId: "a", metrics: before },
      { op: "spawn", entityId: "b", metrics: bMetrics },
    ],
    relationChanges: [{ op: "add", relationId: "a-imports-b" }],
  },
  {
    commitIndex: 1,
    entityChanges: [
      { op: "update", entityId: "a", before, after },
    ],
    relationChanges: [],
  },
  {
    commitIndex: 2,
    entityChanges: [
      {
        op: "rename",
        entityId: "a",
        beforePath: "src/a.ts",
        afterPath: "src/renamed-a.ts",
      },
    ],
    relationChanges: [],
  },
  {
    commitIndex: 3,
    entityChanges: [{ op: "remove", entityId: "b" }],
    relationChanges: [{ op: "remove", relationId: "a-imports-b" }],
  },
];

describe("replay reduction and seek", () => {
  it("derives the historical pre-rename path from deltas", () => {
    const catalog = createReplayCatalog(entities, relations, deltas);
    const atBirth = reduceReplay(deltas, catalog, 0);
    const atRename = reduceReplay(deltas, catalog, 2);
    expect(atBirth.entities.a?.path).toBe("src/a.ts");
    expect(atRename.entities.a?.path).toBe("src/renamed-a.ts");
  });

  it("produces the same state by sequential playback and direct seek", () => {
    const catalog = createReplayCatalog(entities, relations, deltas);
    const keyframes = buildKeyframes(deltas, catalog, 2);
    expect(keyframes.map((keyframe) => keyframe.commitIndex)).toEqual([0, 2]);

    for (let target = -1; target <= 3; target += 1) {
      const sequential = reduceReplay(deltas, catalog, target);
      const sought = seekReplay(target, { deltas, keyframes, catalog });
      expect(sought).toEqual(sequential);
      expect(JSON.stringify(sought)).toBe(JSON.stringify(sequential));
    }
  });

  it("is independent of delta input ordering", () => {
    const shuffled = [deltas[3]!, deltas[1]!, deltas[0]!, deltas[2]!];
    const catalog = createReplayCatalog(entities, relations, shuffled);
    expect(reduceReplay(shuffled, catalog)).toEqual(
      reduceReplay(deltas, catalog),
    );
  });

  it("fails fast when update.before does not describe current state", () => {
    const catalog = createReplayCatalog(entities, relations, deltas);
    const state = applyDelta(
      createEmptyReplayState(),
      deltas[0]!,
      catalog,
    );
    const invalid: ReplayDelta = {
      commitIndex: 1,
      entityChanges: [
        {
          op: "update",
          entityId: "a",
          before: { ...before, loc: 999 },
          after,
        },
      ],
      relationChanges: [],
    };
    expect(() => applyDelta(state, invalid, catalog)).toThrow(
      ReplayInvariantError,
    );
  });

  it("implements the specified clamped event duration", () => {
    expect(
      calculateDeltaDuration({
        commitIndex: 0,
        entityChanges: [],
        relationChanges: [],
      }),
    ).toBe(0.45);
    expect(
      calculateDeltaDuration({
        commitIndex: 0,
        entityChanges: Array.from({ length: 100 }, () => ({
          op: "remove" as const,
          entityId: "a",
        })),
        relationChanges: [],
      }),
    ).toBe(2.8);
  });
});
