import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { demoProject } from "./demo-data";
import { loadProjectBundle } from "./project-bundle";
import { resolveViewerReplayFrame } from "./viewer-replay";

const tinyBundleRoot = new URL(
  "../../public/projects/tiny/",
  import.meta.url,
);

const tinyFetch = async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input);
  const prefix = "/projects/tiny/";
  if (!url.startsWith(prefix)) {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }

  try {
    const contents = await readFile(
      new URL(url.slice(prefix.length), tinyBundleRoot),
      "utf8",
    );
    return new Response(contents, {
      headers: {
        "content-type": url.endsWith(".ndjson")
          ? "application/x-ndjson"
          : "application/json",
      },
    });
  } catch {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }
};

describe("resolveViewerReplayFrame", () => {
  it("loads and seeks the real tiny CLI bundle", async () => {
    const project = await loadProjectBundle("/projects/tiny", {
      fetch: tinyFetch as typeof fetch,
    });

    expect(project.canonicalEntities).toHaveLength(5);
    expect(project.canonicalRelations).toHaveLength(4);
    expect(project.deltas).toHaveLength(5);
    expect(project.keyframes).toHaveLength(1);

    const foundations = resolveViewerReplayFrame(project, 0);
    expect(
      Object.values(foundations.entityFrameStates).filter(
        (state) => state.visible,
      ),
    ).toHaveLength(2);
    expect(foundations.activeRelationIds).toEqual(
      new Set(["rel_53ec66375eaf4f7478d6"]),
    );
    expect(
      foundations.entityFrameStates.ent_01f5f713c83f784acb88,
    ).toMatchObject({ visible: true, loc: 2, modified: true });

    const construction = resolveViewerReplayFrame(project, 3);
    expect(
      construction.entityFrameStates.ent_6e47f62f0cfe5001a293,
    ).toMatchObject({ visible: true, loc: 1, modified: true });
    expect(construction.activeRelationIds).toContain(
      "rel_07f4ae0db19ab19c7fb6",
    );

    const demolition = resolveViewerReplayFrame(project, 4);
    expect(
      demolition.entityFrameStates.ent_6e47f62f0cfe5001a293,
    ).toEqual({ visible: false, modified: true });
    expect(demolition.activeRelationIds).not.toContain(
      "rel_07f4ae0db19ab19c7fb6",
    );

    const head = resolveViewerReplayFrame(project, null);
    expect(head.commitIndex).toBe(4);
    expect(head.activeRelationIds).toEqual(demolition.activeRelationIds);
    expect(head.changedEntityIds).toEqual(new Set());
    expect(
      head.entityFrameStates.ent_6e47f62f0cfe5001a293,
    ).toEqual({ visible: false, modified: false });
    expect(
      Object.values(head.entityFrameStates).every(
        (state) => state.modified === false,
      ),
    ).toBe(true);
  });

  it("keeps the hand-authored demo compatible without canonical replay", () => {
    const firstCommit = resolveViewerReplayFrame(demoProject, 0);
    const expectedChanged = new Set(
      demoProject.commits[0]?.changedEntityIds ?? [],
    );

    expect(firstCommit.changedEntityIds).toEqual(expectedChanged);
    expect(
      Object.values(firstCommit.entityFrameStates).some(
        (state) => state.visible,
      ),
    ).toBe(true);
    expect(
      Object.values(firstCommit.entityFrameStates).every(
        (state) => state.loc === undefined,
      ),
    ).toBe(true);

    const head = resolveViewerReplayFrame(demoProject);
    expect(head.commitIndex).toBe(demoProject.commits.at(-1)?.index);
    expect(head.changedEntityIds).toEqual(new Set());
    expect(
      Object.values(head.entityFrameStates).every(
        (state) => state.modified === false,
      ),
    ).toBe(true);
  });

  it("rejects a seek beyond the project history", () => {
    expect(() => resolveViewerReplayFrame(demoProject, 999)).toThrow(
      /exceeds the latest commit/i,
    );
  });
});
