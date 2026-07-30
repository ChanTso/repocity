import { describe, expect, it } from "vitest";
import {
  assignDistricts,
  compileCity,
  createEntityId,
  generateRepoCityFixture,
  squarifiedTreemap,
  stableHash,
  stableHashHex,
  stableStringify,
  type EntitySource,
} from "../src/index.js";

function source(index: number, path: string): EntitySource {
  return {
    path,
    bornAt: 0,
    maxMetrics: {
      loc: 20 + index * 11,
      exports: index % 4,
      fanIn: index % 3,
      fanOut: index % 5,
      churn: index * 2,
    },
  };
}

describe("stable hashing and identity", () => {
  it("canonicalizes object keys and hashes deterministically", () => {
    const first = { z: 2, nested: { beta: true, alpha: [3, 1] }, a: 1 };
    const second = {
      a: 1,
      nested: { alpha: [3, 1], beta: true },
      z: 2,
    };
    expect(stableStringify(first)).toBe(stableStringify(second));
    expect(stableHash(first)).toBe(stableHash(second));
    expect(stableHashHex(first)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("keeps the entity ID across a rename when the oldest alias is used", () => {
    const oldPath = "packages/schema/src/model.ts";
    const renamed = compileCity({
      entities: [
        {
          ...source(0, "packages/schema/src/entity.ts"),
          aliases: [oldPath],
        },
      ],
    });
    expect(renamed.entities[0]!.id).toBe(createEntityId(oldPath));
  });
});

describe("district and city layout", () => {
  it("uses workspace second-level directories and special districts", () => {
    const paths = [
      "apps/web/src/page.tsx",
      "packages/schema/src/index.ts",
      "tests/e2e/city.test.ts",
      "docs/examples/story.ts",
      "root.ts",
    ];
    expect(assignDistricts(paths)).toEqual({
      "apps/web/src/page.tsx": "apps-web",
      "packages/schema/src/index.ts": "packages-schema",
      "tests/e2e/city.test.ts": "tests",
      "docs/examples/story.ts": "docs",
      "root.ts": "core",
    });
  });

  it("uses src children as districts outside a workspace", () => {
    expect(
      assignDistricts([
        "src/auth/login.ts",
        "src/billing/invoice.ts",
        "index.ts",
      ]),
    ).toEqual({
      "src/auth/login.ts": "src-auth",
      "src/billing/invoice.ts": "src-billing",
      "index.ts": "core",
    });
  });

  it("produces identical coordinates regardless of input traversal order", () => {
    const entities = [
      source(0, "apps/web/src/page.tsx"),
      source(1, "apps/web/src/search.ts"),
      source(2, "packages/schema/src/index.ts"),
      source(3, "packages/schema/src/types.ts"),
      source(4, "tests/layout.test.ts"),
    ];
    const forward = compileCity({ entities });
    const reverse = compileCity({ entities: [...entities].reverse() });

    const positions = (city: typeof forward) =>
      Object.fromEntries(
        city.entities.map((entity) => [entity.id, entity.layout]),
      );
    expect(positions(forward)).toEqual(positions(reverse));
    expect(forward.districts).toEqual(reverse.districts);
  });

  it("allocates every treemap item inside the requested bounds", () => {
    const bounds = { x: -10, z: -5, width: 20, depth: 10 };
    const layout = squarifiedTreemap(
      [
        { id: "alpha", weight: 50 },
        { id: "beta", weight: 30 },
        { id: "gamma", weight: 20 },
      ],
      bounds,
    );
    expect(layout.size).toBe(3);
    for (const rectangle of layout.values()) {
      expect(rectangle.x).toBeGreaterThanOrEqual(bounds.x);
      expect(rectangle.z).toBeGreaterThanOrEqual(bounds.z);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(
        bounds.x + bounds.width + Number.EPSILON * 10,
      );
      expect(rectangle.z + rectangle.depth).toBeLessThanOrEqual(
        bounds.z + bounds.depth + Number.EPSILON * 10,
      );
    }
  });
});

describe("deterministic fixture", () => {
  it("contains a rich 240+ building history and passes schema validation", () => {
    const bundle = generateRepoCityFixture();
    expect(bundle.entities.length).toBeGreaterThanOrEqual(240);
    expect(bundle.districts.length).toBeGreaterThanOrEqual(8);
    expect(bundle.relations.length).toBeGreaterThan(bundle.entities.length);
    expect(new Set(bundle.entities.map((entity) => entity.role))).toEqual(
      new Set(["source", "test", "docs", "config", "script", "other"]),
    );
    expect(
      bundle.deltas.some((delta) =>
        delta.entityChanges.some((change) => change.op === "rename"),
      ),
    ).toBe(true);
    expect(
      bundle.deltas.some((delta) =>
        delta.entityChanges.some((change) => change.op === "remove"),
      ),
    ).toBe(true);
    expect(bundle.chapters.length).toBeGreaterThan(1);
    expect(bundle.keyframes.map((keyframe) => keyframe.commitIndex)).toEqual([
      0, 50,
    ]);
  });

  it("serializes byte-for-byte identically on repeated generation", () => {
    expect(JSON.stringify(generateRepoCityFixture())).toBe(
      JSON.stringify(generateRepoCityFixture()),
    );
  });
});
