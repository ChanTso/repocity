import { describe, expect, it } from "vitest";
import {
  RepoCityBundleSchema,
  safeValidateRepoCityBundle,
  validateRepoCityBundle,
  type RepoCityBundle,
} from "../src/index.js";

function minimalBundle(): RepoCityBundle {
  const metrics = { loc: 32, exports: 2, fanIn: 0, fanOut: 0 };
  const entity = {
    id: "entity_a",
    kind: "building" as const,
    path: "src/a.ts",
    aliases: [],
    name: "a.ts",
    extension: ".ts",
    language: "typescript" as const,
    role: "source" as const,
    districtId: "src-a",
    bornAt: 0,
    maxMetrics: { ...metrics, churn: 3 },
    layout: {
      x: 4,
      z: 8,
      width: 2,
      depth: 2,
      maxHeight: 12,
      rotationY: 0,
      styleVariant: 1,
    },
  };
  return {
    manifest: {
      schemaVersion: "0.1",
      projectId: "schema-test",
      repo: {
        name: "Schema test",
        defaultBranch: "main",
        headSha: "0123456789abcdef0123456789abcdef01234567",
      },
      stats: {
        entityCount: 1,
        districtCount: 1,
        commitCount: 1,
        displayedCommitCount: 1,
      },
      files: {
        districts: "districts.json",
        entities: "entities.json",
        relations: "relations.json",
        commits: "commits.json",
        chapters: "chapters.json",
        deltas: "deltas.ndjson",
        keyframesDir: "keyframes",
      },
    },
    districts: [
      {
        id: "src-a",
        name: "Source A",
        entityIds: ["entity_a"],
        weight: 32,
        color: "#5b8def",
        layout: { x: 0, z: 0, width: 10, depth: 10 },
      },
    ],
    entities: [entity],
    relations: [],
    commits: [
      {
        index: 0,
        sha: "0123456789abcdef0123456789abcdef01234567",
        parents: [],
        authorName: "Test Author",
        authoredAt: "2025-01-01T10:00:00.000Z",
        message: "Start the city",
        tags: [],
        changedEntityIds: ["entity_a"],
        chapterId: "chapter-001",
      },
    ],
    chapters: [
      {
        id: "chapter-001",
        title: "Foundations",
        startCommitIndex: 0,
        endCommitIndex: 0,
        commitIndices: [0],
        mode: "manual",
      },
    ],
    deltas: [
      {
        commitIndex: 0,
        entityChanges: [
          { op: "spawn", entityId: "entity_a", metrics: { ...metrics } },
        ],
        relationChanges: [],
      },
    ],
    keyframes: [
      {
        commitIndex: 0,
        entities: {
          entity_a: {
            entityId: "entity_a",
            path: "src/a.ts",
            metrics: { ...metrics },
          },
        },
        relationIds: [],
      },
    ],
  };
}

describe("RepoCity schema", () => {
  it("accepts a complete, internally consistent bundle", () => {
    const bundle = minimalBundle();
    expect(validateRepoCityBundle(bundle)).toEqual(bundle);
    expect(RepoCityBundleSchema.safeParse(bundle).success).toBe(true);
  });

  it("rejects count drift and dangling cross-file references", () => {
    const bundle = minimalBundle();
    bundle.manifest.stats.entityCount = 2;
    bundle.deltas[0]!.entityChanges[0]!.entityId = "missing";

    const result = safeValidateRepoCityBundle(bundle);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("entityCount is 2, expected 1");
      expect(messages).toContain(
        "delta references unknown entity: missing",
      );
    }
  });

  it("rejects malformed lifetimes and unsafe numeric layouts", () => {
    const bundle = minimalBundle();
    bundle.entities[0]!.diedAt = 0;
    bundle.entities[0]!.bornAt = 1;

    const lifetimeResult = RepoCityBundleSchema.safeParse(bundle);
    expect(lifetimeResult.success).toBe(false);
    if (!lifetimeResult.success) {
      expect(
        lifetimeResult.error.issues.some((issue) =>
          issue.message.includes("diedAt must not precede bornAt"),
        ),
      ).toBe(true);
    }

    const numericBundle = minimalBundle();
    numericBundle.entities[0]!.layout.x = Number.NaN;
    expect(RepoCityBundleSchema.safeParse(numericBundle).success).toBe(false);
  });

  it("uses strict objects so accidental format drift is visible", () => {
    const bundle = minimalBundle() as RepoCityBundle & {
      accidental?: string;
    };
    bundle.accidental = "not part of schema 0.1";
    expect(RepoCityBundleSchema.safeParse(bundle).success).toBe(false);
  });
});
