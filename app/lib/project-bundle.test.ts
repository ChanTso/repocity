import { describe, expect, it, vi } from "vitest";

import {
  ProjectBundleError,
  loadProjectBundle,
} from "./project-bundle";

const manifest = {
  schemaVersion: "0.1",
  projectId: "sample-project",
  repo: {
    name: "sample",
    defaultBranch: "main",
    headSha: "abcdef0123456789",
  },
  stats: {
    entityCount: 1,
    districtCount: 1,
    commitCount: 1,
    displayedCommitCount: 1,
  },
  files: {
    districts: "data/districts.json",
    entities: "data/entities.json",
    relations: "data/relations.json",
    commits: "data/commits.json",
    chapters: "data/chapters.json",
    deltas: "data/deltas.ndjson",
    keyframesDir: "data/keyframes",
  },
};

const districts = [
  {
    id: "packages-core",
    name: "Core",
    entityIds: ["entity-1"],
    weight: 1,
    color: "#50d5b7",
    layout: { x: 4, z: 8, width: 12, depth: 10 },
  },
];

const entities = [
  {
    id: "entity-1",
    kind: "building",
    path: "packages/core/index.ts",
    aliases: [],
    name: "index.ts",
    extension: ".ts",
    language: "typescript",
    role: "source",
    districtId: "packages-core",
    bornAt: 0,
    maxMetrics: {
      loc: 42,
      exports: 2,
      fanIn: 3,
      fanOut: 1,
      churn: 10,
    },
    layout: {
      x: 4,
      z: 8,
      width: 1,
      depth: 1,
      maxHeight: 6,
      rotationY: 0,
      styleVariant: 1,
    },
  },
];

const relations: unknown[] = [];

const commits = [
  {
    index: 0,
    sha: "abcdef0123456789",
    parents: [],
    authorName: "RepoCity",
    authoredAt: "2026-07-30T10:00:00.000Z",
    message: "Initial commit",
    tags: [],
    changedEntityIds: ["entity-1"],
  },
];

const chapters = [
  {
    id: "foundations",
    title: "Foundations",
    summary: "The city begins.",
    startCommitIndex: 0,
    endCommitIndex: 0,
    commitIndices: [0],
    mode: "rules",
  },
];

const initialMetrics = {
  loc: 12,
  exports: 1,
  fanIn: 0,
  fanOut: 0,
};

const deltas = [
  {
    commitIndex: 0,
    entityChanges: [
      {
        op: "spawn",
        entityId: "entity-1",
        metrics: initialMetrics,
      },
    ],
    relationChanges: [],
  },
];

const initialKeyframe = {
  commitIndex: 0,
  entities: {
    "entity-1": {
      entityId: "entity-1",
      path: "packages/core/index.ts",
      metrics: initialMetrics,
    },
  },
  relationIds: [],
};

function createFetch(
  overrides: Record<string, unknown> = {},
  options: { includeKeyframe?: boolean } = {},
) {
  const payloads: Record<string, unknown> = {
    "/projects/sample/manifest.json": manifest,
    "/projects/sample/data/districts.json": districts,
    "/projects/sample/data/entities.json": entities,
    "/projects/sample/data/relations.json": relations,
    "/projects/sample/data/commits.json": commits,
    "/projects/sample/data/chapters.json": chapters,
    "/projects/sample/data/deltas.ndjson":
      `${deltas.map((delta) => JSON.stringify(delta)).join("\n")}\n`,
    ...(options.includeKeyframe === false
      ? {}
      : {
          "/projects/sample/data/keyframes/0000.json": initialKeyframe,
        }),
    ...overrides,
  };

  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (!(url in payloads)) {
      return new Response(null, { status: 404, statusText: "Not Found" });
    }
    const payload = payloads[url];
    return typeof payload === "string"
      ? new Response(payload, {
          headers: { "content-type": "application/x-ndjson" },
        })
      : Response.json(payload);
  });
}

describe("loadProjectBundle", () => {
  it("loads bundle files in parallel and adapts canonical shapes", async () => {
    const fetchImpl = createFetch();

    const project = await loadProjectBundle("/projects/sample", {
      fetch: fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(8);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "/projects/sample/manifest.json",
    );
    expect(fetchImpl.mock.calls.slice(1).map(([url]) => String(url))).toEqual([
      "/projects/sample/data/districts.json",
      "/projects/sample/data/entities.json",
      "/projects/sample/data/relations.json",
      "/projects/sample/data/commits.json",
      "/projects/sample/data/chapters.json",
      "/projects/sample/data/deltas.ndjson",
      "/projects/sample/data/keyframes/0000.json",
    ]);

    expect(project.manifest).not.toHaveProperty("files");
    expect(project.districts[0]).toMatchObject({
      id: "packages-core",
      eyebrow: "PACKAGES · CORE",
      x: 4,
      z: 8,
      width: 12,
      depth: 10,
    });
    expect(project.entities[0]).toMatchObject({
      id: "entity-1",
      exportNames: [],
    });
    expect(project.entities[0]?.summary).toContain("42 LOC");
    expect(project.commits[0]).toMatchObject({
      chapterId: "foundations",
      additions: 0,
      deletions: 0,
    });
    expect(project.chapters[0]).toEqual({
      id: "foundations",
      title: "Foundations",
      subtitle: "The city begins.",
      start: 0,
      end: 0,
    });
    expect(project.canonicalEntities).toEqual(entities);
    expect(project.canonicalRelations).toEqual(relations);
    expect(project.deltas).toEqual(deltas);
    expect(project.keyframes).toEqual([initialKeyframe]);
  });

  it("accepts a missing initial keyframe", async () => {
    const project = await loadProjectBundle("/projects/sample", {
      fetch: createFetch({}, { includeKeyframe: false }),
    });

    expect(project.deltas).toEqual(deltas);
    expect(project.keyframes).toEqual([]);
  });

  it("reports malformed NDJSON with its source line", async () => {
    const fetchImpl = createFetch({
      "/projects/sample/data/deltas.ndjson":
        `${JSON.stringify(deltas[0])}\n{"commitIndex":`,
    });

    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toMatchObject({
      name: "ProjectBundleError",
      resource: "deltas",
      url: "/projects/sample/data/deltas.ndjson",
    });
    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toThrow(/invalid NDJSON at line 2/i);
  });

  it("validates each NDJSON replay delta", async () => {
    const fetchImpl = createFetch({
      "/projects/sample/data/deltas.ndjson": JSON.stringify({
        commitIndex: 0,
        entityChanges: [{ op: "explode", entityId: "entity-1" }],
        relationChanges: [],
      }),
    });

    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toMatchObject({
      name: "ProjectBundleError",
      resource: "deltas",
      url: "/projects/sample/data/deltas.ndjson",
    });
    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toThrow(/schema validation failed at line 1/i);
  });

  it("rejects an invalid initial keyframe instead of hiding it", async () => {
    const fetchImpl = createFetch({
      "/projects/sample/data/keyframes/0000.json": {
        ...initialKeyframe,
        commitIndex: -2,
      },
    });

    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toMatchObject({
      name: "ProjectBundleError",
      resource: "keyframe",
      url: "/projects/sample/data/keyframes/0000.json",
    });
    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toThrow(/keyframe.*commitIndex/i);
  });

  it("reports the resource, URL and schema path for invalid data", async () => {
    const fetchImpl = createFetch({
      "/projects/sample/data/entities.json": [
        { ...entities[0], maxMetrics: { ...entities[0].maxMetrics, loc: -1 } },
      ],
    });

    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toMatchObject({
      name: "ProjectBundleError",
      resource: "entities",
      url: "/projects/sample/data/entities.json",
    });

    await expect(
      loadProjectBundle("/projects/sample", { fetch: fetchImpl }),
    ).rejects.toThrow(/entities.*\[0\]\.maxMetrics\.loc/i);
  });

  it("passes AbortSignal through without wrapping AbortError", async () => {
    const fetchImpl = createFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      loadProjectBundle("/projects/sample", {
        fetch: fetchImpl,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a clear typed error for HTTP failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(null, { status: 503, statusText: "Unavailable" });
    });

    const request = loadProjectBundle("/projects/sample", {
      fetch: fetchImpl,
    });

    await expect(request).rejects.toBeInstanceOf(ProjectBundleError);
    await expect(request).rejects.toThrow(/manifest.*HTTP 503 Unavailable/i);
  });
});
