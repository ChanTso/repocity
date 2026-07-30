import {
  RepoCityBundleSchema,
  type EntityChange,
  type EntityRole,
  type Relation,
  type RelationChange,
  type ReplayDelta,
  type RepoCityBundle,
  type RuntimeMetrics,
} from "../../schema/src/index.js";
import {
  compileReplay,
  createReplayCatalog,
  reduceReplay,
  seekReplay,
} from "../../replay-engine/src/index.js";
import {
  compileCity,
  createEntityId,
  stableHashHex,
  type EntitySource,
} from "./layout.js";

export interface FixtureOptions {
  /**
   * Defaults to 256. The demo fixture intentionally stays above the product
   * acceptance floor of 200 buildings.
   */
  entityCount?: number;
  commitCount?: number;
  projectId?: string;
}

interface FixtureEntityPlan {
  source: EntitySource & { id: string };
  initialPath: string;
  finalPath: string;
  initialMetrics: RuntimeMetrics;
  firstMetrics: RuntimeMetrics;
  finalMetrics: RuntimeMetrics;
  firstUpdateAt: number;
  secondUpdateAt: number;
  renameAt?: number;
  diedAt?: number;
}

const PATH_FACTORIES = [
  (index: number, extension: string) =>
    `apps/studio/src/scenes/scene-${index}${extension}`,
  (index: number, extension: string) =>
    `apps/console/src/panels/panel-${index}${extension}`,
  (index: number, extension: string) =>
    `packages/schema/src/models/model-${index}${extension}`,
  (index: number, extension: string) =>
    `packages/replay/src/timeline/tick-${index}${extension}`,
  (index: number, extension: string) =>
    `packages/compiler/src/layout/parcel-${index}${extension}`,
  (index: number, extension: string) =>
    `packages/ui/src/components/widget-${index}${extension}`,
  (index: number, extension: string) =>
    `packages/utils/src/math/helper-${index}${extension}`,
  (index: number, extension: string) =>
    `tests/integration/case-${index}${extension}`,
  (index: number, extension: string) =>
    `docs/examples/guide-${index}${extension}`,
  (index: number, extension: string) =>
    `scripts/tasks/job-${index}${extension}`,
  (index: number, extension: string) =>
    `config/presets/preset-${index}${extension}`,
  (index: number, extension: string) => `src/core/kernel-${index}${extension}`,
] as const;

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

function explicitRole(path: string, index: number): EntityRole | undefined {
  if (index % 29 === 0) {
    return "other";
  }
  if (path.startsWith("docs/")) {
    return "docs";
  }
  if (path.startsWith("scripts/")) {
    return "script";
  }
  if (path.startsWith("config/")) {
    return "config";
  }
  if (path.startsWith("tests/")) {
    return "test";
  }
  return undefined;
}

function renamedPath(path: string, index: number): string {
  const slash = path.lastIndexOf("/");
  const directory = path.slice(0, slash);
  const filename = path.slice(slash + 1);
  return `${directory}/landmark-${index}-${filename}`;
}

function metricsFor(index: number) {
  const initial: RuntimeMetrics = {
    loc: 18 + ((index * 17) % 94),
    exports: index % 4,
    fanIn: 0,
    fanOut: 0,
  };
  const first: RuntimeMetrics = {
    ...initial,
    loc: initial.loc + 6 + (index % 27),
    exports: initial.exports,
  };
  const final: RuntimeMetrics = {
    ...first,
    loc: first.loc + 4 + ((index * 7) % 21),
    exports: first.exports + (index % 5 === 0 ? 1 : 0),
  };
  return { initial, first, final };
}

function relationDefinitions(
  plans: readonly FixtureEntityPlan[],
): Relation[] {
  const relationPairs = new Set<string>();
  const relations: Relation[] = [];
  const offsets = [1, 11] as const;

  for (let sourceIndex = 0; sourceIndex < plans.length; sourceIndex += 1) {
    for (const offset of offsets) {
      const targetIndex =
        (sourceIndex + offset + (sourceIndex % 3)) % plans.length;
      if (targetIndex === sourceIndex) {
        continue;
      }
      const pair = `${sourceIndex}:${targetIndex}`;
      if (relationPairs.has(pair)) {
        continue;
      }
      relationPairs.add(pair);
      const source = plans[sourceIndex]!;
      const target = plans[targetIndex]!;
      const bornAt =
        Math.max(source.source.bornAt, target.source.bornAt) + 1;
      const endpointDeath = Math.min(
        source.diedAt ?? Number.POSITIVE_INFINITY,
        target.diedAt ?? Number.POSITIVE_INFINITY,
      );
      const diedAt = Number.isFinite(endpointDeath)
        ? endpointDeath
        : undefined;
      if (diedAt !== undefined && diedAt <= bornAt) {
        continue;
      }
      relations.push({
        id: `relation_${stableHashHex(
          `${source.source.id}->${target.source.id}`,
        )}`,
        sourceId: source.source.id,
        targetId: target.source.id,
        kind: "import",
        bornAt,
        diedAt,
        weight: 1 + ((sourceIndex + offset) % 4),
      });
    }
  }
  return relations.sort((left, right) => left.id.localeCompare(right.id));
}

function fixtureSha(index: number): string {
  const first = stableHashHex(`fixture-commit:${index}`);
  const second = stableHashHex(`fixture-parent:${index}`);
  return `${first}${second}${first.slice(0, 8)}`;
}

function pushEntityChange(
  changes: Map<number, EntityChange[]>,
  commitIndex: number,
  change: EntityChange,
) {
  const existing = changes.get(commitIndex) ?? [];
  existing.push(change);
  changes.set(commitIndex, existing);
}

function pushRelationChange(
  changes: Map<number, RelationChange[]>,
  commitIndex: number,
  change: RelationChange,
) {
  const existing = changes.get(commitIndex) ?? [];
  existing.push(change);
  changes.set(commitIndex, existing);
}

function withFanMetrics(
  plans: readonly FixtureEntityPlan[],
  relations: readonly Relation[],
): FixtureEntityPlan[] {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const relation of relations) {
    fanOut.set(
      relation.sourceId,
      (fanOut.get(relation.sourceId) ?? 0) + relation.weight,
    );
    fanIn.set(
      relation.targetId,
      (fanIn.get(relation.targetId) ?? 0) + relation.weight,
    );
  }

  return plans.map((plan) => {
    const counts = {
      fanIn: fanIn.get(plan.source.id) ?? 0,
      fanOut: fanOut.get(plan.source.id) ?? 0,
    };
    const initialMetrics = { ...plan.initialMetrics, ...counts };
    const firstMetrics = { ...plan.firstMetrics, ...counts };
    const finalMetrics = { ...plan.finalMetrics, ...counts };
    return {
      ...plan,
      initialMetrics,
      firstMetrics,
      finalMetrics,
      source: {
        ...plan.source,
        maxMetrics: {
          loc: finalMetrics.loc,
          exports: finalMetrics.exports,
          ...counts,
          churn:
            firstMetrics.loc -
            initialMetrics.loc +
            (finalMetrics.loc - firstMetrics.loc),
        },
      },
    };
  });
}

/**
 * Generates a deterministic, schema-valid all-history project. It is large
 * enough to exercise instancing and contains spawns, two waves of updates,
 * stable-ID renames, removals, relation lifecycles, tags, chapters and
 * keyframes.
 */
export function generateRepoCityFixture(
  options: FixtureOptions = {},
): RepoCityBundle {
  const entityCount = options.entityCount ?? 256;
  const commitCount = options.commitCount ?? 96;
  if (!Number.isInteger(entityCount) || entityCount < 240) {
    throw new RangeError("fixture entityCount must be an integer >= 240");
  }
  if (!Number.isInteger(commitCount) || commitCount < 96) {
    throw new RangeError("fixture commitCount must be an integer >= 96");
  }

  const initialPlans: FixtureEntityPlan[] = Array.from(
    { length: entityCount },
    (_, index) => {
      const extension = EXTENSIONS[index % EXTENSIONS.length]!;
      const initialPath = PATH_FACTORIES[index % PATH_FACTORIES.length]!(
        index,
        extension,
      );
      const isRenamed = index > 0 && index % 37 === 0;
      const finalPath = isRenamed
        ? renamedPath(initialPath, index)
        : initialPath;
      const bornAt = index % 64;
      const diedAt =
        index > 0 && index % 23 === 0 ? 90 + (index % 4) : undefined;
      const { initial, first, final } = metricsFor(index);
      return {
        source: {
          id: createEntityId(initialPath),
          identityKey: initialPath,
          path: finalPath,
          aliases: isRenamed ? [initialPath] : [],
          role: explicitRole(initialPath, index),
          bornAt,
          diedAt,
          maxMetrics: {
            loc: final.loc,
            exports: final.exports,
            fanIn: 0,
            fanOut: 0,
            churn: final.loc - initial.loc,
          },
        },
        initialPath,
        finalPath,
        initialMetrics: initial,
        firstMetrics: first,
        finalMetrics: final,
        firstUpdateAt: 64 + (index % 8),
        renameAt: isRenamed ? 73 + (index % 5) : undefined,
        secondUpdateAt: 78 + (index % 7),
        diedAt,
      };
    },
  );

  const initialRelations = relationDefinitions(initialPlans);
  const plans = withFanMetrics(initialPlans, initialRelations);
  const relations = relationDefinitions(plans);
  const city = compileCity({ entities: plans.map((plan) => plan.source) });

  const entityChanges = new Map<number, EntityChange[]>();
  const relationChanges = new Map<number, RelationChange[]>();
  for (const plan of plans) {
    pushEntityChange(entityChanges, plan.source.bornAt, {
      op: "spawn",
      entityId: plan.source.id,
      metrics: plan.initialMetrics,
    });
    pushEntityChange(entityChanges, plan.firstUpdateAt, {
      op: "update",
      entityId: plan.source.id,
      before: plan.initialMetrics,
      after: plan.firstMetrics,
    });
    if (plan.renameAt !== undefined) {
      pushEntityChange(entityChanges, plan.renameAt, {
        op: "rename",
        entityId: plan.source.id,
        beforePath: plan.initialPath,
        afterPath: plan.finalPath,
      });
    }
    pushEntityChange(entityChanges, plan.secondUpdateAt, {
      op: "update",
      entityId: plan.source.id,
      before: plan.firstMetrics,
      after: plan.finalMetrics,
    });
    if (plan.diedAt !== undefined) {
      pushEntityChange(entityChanges, plan.diedAt, {
        op: "remove",
        entityId: plan.source.id,
      });
    }
  }

  for (const relation of relations) {
    pushRelationChange(relationChanges, relation.bornAt, {
      op: "add",
      relationId: relation.id,
    });
    if (relation.diedAt !== undefined) {
      pushRelationChange(relationChanges, relation.diedAt, {
        op: "remove",
        relationId: relation.id,
      });
    }
  }

  const deltas: ReplayDelta[] = Array.from(
    { length: commitCount },
    (_, commitIndex) => ({
      commitIndex,
      entityChanges: (entityChanges.get(commitIndex) ?? []).sort(
        (left, right) =>
          left.entityId.localeCompare(right.entityId) ||
          left.op.localeCompare(right.op),
      ),
      relationChanges: (relationChanges.get(commitIndex) ?? []).sort(
        (left, right) => left.relationId.localeCompare(right.relationId),
      ),
    }),
  );

  const tagsByCommit = new Map<number, string[]>([
    [31, ["v0.1.0"]],
    [63, ["v0.2.0"]],
    [commitCount - 1, ["v1.0.0"]],
  ]);
  const commits = deltas.map((delta) => {
    const changedEntityIds = new Set(
      delta.entityChanges.map((change) => change.entityId),
    );
    for (const change of delta.relationChanges) {
      const relation = relations.find(
        (candidate) => candidate.id === change.relationId,
      )!;
      changedEntityIds.add(relation.sourceId);
      changedEntityIds.add(relation.targetId);
    }
    const phase =
      delta.commitIndex < 64
        ? "Lay foundations"
        : delta.commitIndex < 73
          ? "Raise the first neighborhoods"
          : delta.commitIndex < 89
            ? "Connect and refine the city"
            : "Prepare the release";
    return {
      index: delta.commitIndex,
      sha: fixtureSha(delta.commitIndex),
      parents:
        delta.commitIndex === 0 ? [] : [fixtureSha(delta.commitIndex - 1)],
      authorName: ["Ari Chen", "Mina Park", "Sam Rivera"][
        delta.commitIndex % 3
      ]!,
      authoredAt: new Date(
        Date.UTC(2024, 0, 1 + delta.commitIndex, 9, 30),
      ).toISOString(),
      message: `${phase} · ${String(delta.commitIndex + 1).padStart(2, "0")}`,
      tags: tagsByCommit.get(delta.commitIndex) ?? [],
      changedEntityIds: [...changedEntityIds].sort(),
    };
  });

  const replay = compileReplay({
    entities: city.entities,
    relations,
    commits,
    deltas,
    keyframeInterval: 50,
    chapterSize: 12,
  });
  const projectId = options.projectId ?? "repocity-zero-city";
  const headSha = replay.commits.at(-1)!.sha;
  const bundle = {
    manifest: {
      schemaVersion: "0.1" as const,
      projectId,
      repo: {
        name: "RepoCity / Zero City",
        remoteUrl: "https://github.com/repocity/zero-city",
        defaultBranch: "main",
        headSha,
      },
      stats: {
        entityCount: city.entities.length,
        districtCount: city.districts.length,
        commitCount: replay.commits.length,
        displayedCommitCount: replay.deltas.length,
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
    districts: city.districts,
    entities: city.entities,
    relations,
    commits: replay.commits,
    chapters: replay.chapters,
    deltas: replay.deltas,
    keyframes: replay.keyframes,
  };

  const validated = RepoCityBundleSchema.parse(bundle);

  // This internal assertion makes accidental fixture drift fail at generation
  // time, before the data ever reaches the viewer.
  const catalog = createReplayCatalog(
    validated.entities,
    validated.relations,
    validated.deltas,
  );
  const sequential = reduceReplay(validated.deltas, catalog);
  const sought = seekReplay(validated.commits.at(-1)!.index, {
    deltas: validated.deltas,
    keyframes: validated.keyframes,
    catalog,
  });
  if (JSON.stringify(sequential) !== JSON.stringify(sought)) {
    throw new Error("fixture replay seek diverged from sequential reduction");
  }

  return validated;
}

export const createDeterministicFixture = generateRepoCityFixture;
