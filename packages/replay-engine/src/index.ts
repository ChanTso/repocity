import type {
  Chapter,
  CityEntity,
  CommitMeta,
  EntityChange,
  Relation,
  ReplayDelta,
  ReplayKeyframe,
  ReplayState,
  RuntimeEntityState,
  RuntimeMetrics,
} from "../../schema/src/index.js";

export interface ReplayCatalog {
  readonly entities: ReadonlyMap<string, CityEntity>;
  readonly relations: ReadonlyMap<string, Relation>;
  readonly initialPaths: ReadonlyMap<string, string>;
}

export interface ApplyDeltaOptions {
  /**
   * Strict mode catches malformed compiler output at its first bad delta.
   * It is enabled by default and should only be disabled for data migration.
   */
  strict?: boolean;
}

export interface SeekReplayInput {
  deltas: readonly ReplayDelta[];
  keyframes?: readonly ReplayKeyframe[];
  catalog: ReplayCatalog;
  strict?: boolean;
}

export interface CompileReplayInput {
  entities: readonly CityEntity[];
  relations: readonly Relation[];
  commits: readonly CommitMeta[];
  deltas: readonly ReplayDelta[];
  keyframeInterval?: number;
  chapterSize?: number;
}

export interface CompiledReplay {
  commits: CommitMeta[];
  chapters: Chapter[];
  deltas: ReplayDelta[];
  keyframes: ReplayKeyframe[];
}

export class ReplayInvariantError extends Error {
  readonly commitIndex: number;

  constructor(commitIndex: number, message: string) {
    super(`Replay invariant failed at commit ${commitIndex}: ${message}`);
    this.name = "ReplayInvariantError";
    this.commitIndex = commitIndex;
  }
}

function sortedDeltas(deltas: readonly ReplayDelta[]): ReplayDelta[] {
  const sorted = [...deltas].sort(
    (left, right) => left.commitIndex - right.commitIndex,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]!.commitIndex === sorted[index]!.commitIndex) {
      throw new ReplayInvariantError(
        sorted[index]!.commitIndex,
        "more than one delta targets the same commit",
      );
    }
  }
  return sorted;
}

function sortedCommits(commits: readonly CommitMeta[]): CommitMeta[] {
  const sorted = [...commits].sort((left, right) => left.index - right.index);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1]!.index === sorted[index]!.index) {
      throw new ReplayInvariantError(
        sorted[index]!.index,
        "duplicate commit index",
      );
    }
  }
  return sorted;
}

function metricsEqual(
  left: RuntimeMetrics,
  right: RuntimeMetrics,
): boolean {
  return (
    left.loc === right.loc &&
    left.exports === right.exports &&
    left.fanIn === right.fanIn &&
    left.fanOut === right.fanOut
  );
}

function canonicalEntities(
  entities: Readonly<Record<string, RuntimeEntityState>>,
): Record<string, RuntimeEntityState> {
  return Object.fromEntries(
    Object.entries(entities)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([entityId, entity]) => [
        entityId,
        {
          entityId: entity.entityId,
          path: entity.path,
          metrics: { ...entity.metrics },
        },
      ]),
  );
}

export function cloneReplayState(state: ReplayState): ReplayState {
  return {
    commitIndex: state.commitIndex,
    entities: canonicalEntities(state.entities),
    relationIds: [...state.relationIds].sort(),
  };
}

export function createEmptyReplayState(): ReplayState {
  return {
    commitIndex: -1,
    entities: {},
    relationIds: [],
  };
}

/**
 * The catalog carries immutable all-history definitions and also derives the
 * pre-rename path for every entity. CityEntity.path is the latest path, while
 * aliases plus rename deltas describe earlier names.
 */
export function createReplayCatalog(
  entities: readonly CityEntity[],
  relations: readonly Relation[],
  deltas: readonly ReplayDelta[] = [],
): ReplayCatalog {
  const entityMap = new Map<string, CityEntity>();
  for (const entity of entities) {
    if (entityMap.has(entity.id)) {
      throw new Error(`Duplicate entity id: ${entity.id}`);
    }
    entityMap.set(entity.id, entity);
  }

  const relationMap = new Map<string, Relation>();
  for (const relation of relations) {
    if (relationMap.has(relation.id)) {
      throw new Error(`Duplicate relation id: ${relation.id}`);
    }
    relationMap.set(relation.id, relation);
  }

  const initialPaths = new Map(
    entities.map((entity) => [entity.id, entity.path] as const),
  );
  const firstRenameSeen = new Set<string>();
  for (const delta of sortedDeltas(deltas)) {
    for (const change of delta.entityChanges) {
      if (change.op === "rename" && !firstRenameSeen.has(change.entityId)) {
        initialPaths.set(change.entityId, change.beforePath);
        firstRenameSeen.add(change.entityId);
      }
    }
  }

  return {
    entities: entityMap,
    relations: relationMap,
    initialPaths,
  };
}

function requireActiveEntity(
  entities: Record<string, RuntimeEntityState>,
  change: EntityChange,
  commitIndex: number,
): RuntimeEntityState {
  const active = entities[change.entityId];
  if (!active) {
    throw new ReplayInvariantError(
      commitIndex,
      `${change.op} targets inactive entity ${change.entityId}`,
    );
  }
  return active;
}

export function applyDelta(
  state: ReplayState,
  delta: ReplayDelta,
  catalog: ReplayCatalog,
  options: ApplyDeltaOptions = {},
): ReplayState {
  const strict = options.strict ?? true;
  if (strict && delta.commitIndex <= state.commitIndex) {
    throw new ReplayInvariantError(
      delta.commitIndex,
      `delta must follow current state ${state.commitIndex}`,
    );
  }

  const entities: Record<string, RuntimeEntityState> = {
    ...state.entities,
  };
  const relationIds = new Set(state.relationIds);

  for (const change of delta.entityChanges) {
    const definition = catalog.entities.get(change.entityId);
    if (!definition) {
      throw new ReplayInvariantError(
        delta.commitIndex,
        `${change.op} references unknown entity ${change.entityId}`,
      );
    }

    switch (change.op) {
      case "spawn": {
        if (strict && entities[change.entityId]) {
          throw new ReplayInvariantError(
            delta.commitIndex,
            `spawn targets active entity ${change.entityId}`,
          );
        }
        entities[change.entityId] = {
          entityId: change.entityId,
          path: catalog.initialPaths.get(change.entityId) ?? definition.path,
          metrics: { ...change.metrics },
        };
        break;
      }
      case "update": {
        const active = requireActiveEntity(
          entities,
          change,
          delta.commitIndex,
        );
        if (strict && !metricsEqual(active.metrics, change.before)) {
          throw new ReplayInvariantError(
            delta.commitIndex,
            `update.before does not match ${change.entityId}`,
          );
        }
        entities[change.entityId] = {
          ...active,
          metrics: { ...change.after },
        };
        break;
      }
      case "remove": {
        requireActiveEntity(entities, change, delta.commitIndex);
        delete entities[change.entityId];
        break;
      }
      case "rename": {
        const active = requireActiveEntity(
          entities,
          change,
          delta.commitIndex,
        );
        if (strict && active.path !== change.beforePath) {
          throw new ReplayInvariantError(
            delta.commitIndex,
            `rename.beforePath "${change.beforePath}" does not match "${active.path}"`,
          );
        }
        entities[change.entityId] = {
          ...active,
          path: change.afterPath,
        };
        break;
      }
    }
  }

  for (const change of delta.relationChanges) {
    const definition = catalog.relations.get(change.relationId);
    if (!definition) {
      throw new ReplayInvariantError(
        delta.commitIndex,
        `${change.op} references unknown relation ${change.relationId}`,
      );
    }

    if (change.op === "add") {
      if (strict && relationIds.has(change.relationId)) {
        throw new ReplayInvariantError(
          delta.commitIndex,
          `relation ${change.relationId} is already active`,
        );
      }
      relationIds.add(change.relationId);
    } else {
      if (strict && !relationIds.has(change.relationId)) {
        throw new ReplayInvariantError(
          delta.commitIndex,
          `relation ${change.relationId} is not active`,
        );
      }
      relationIds.delete(change.relationId);
    }
  }

  if (strict) {
    for (const relationId of relationIds) {
      const relation = catalog.relations.get(relationId)!;
      if (!entities[relation.sourceId] || !entities[relation.targetId]) {
        throw new ReplayInvariantError(
          delta.commitIndex,
          `active relation ${relationId} has an inactive endpoint`,
        );
      }
    }
  }

  return {
    commitIndex: delta.commitIndex,
    entities: canonicalEntities(entities),
    relationIds: [...relationIds].sort(),
  };
}

export function reduceReplay(
  deltas: readonly ReplayDelta[],
  catalog: ReplayCatalog,
  targetCommitIndex = Number.POSITIVE_INFINITY,
  options: ApplyDeltaOptions = {},
): ReplayState {
  if (targetCommitIndex < -1) {
    throw new RangeError("targetCommitIndex must be -1 or greater");
  }

  let state = createEmptyReplayState();
  for (const delta of sortedDeltas(deltas)) {
    if (delta.commitIndex > targetCommitIndex) {
      break;
    }
    state = applyDelta(state, delta, catalog, options);
  }
  return state;
}

export function seekReplay(
  targetCommitIndex: number,
  input: SeekReplayInput,
): ReplayState {
  if (!Number.isInteger(targetCommitIndex) || targetCommitIndex < -1) {
    throw new RangeError("targetCommitIndex must be an integer >= -1");
  }
  if (targetCommitIndex === -1) {
    return createEmptyReplayState();
  }

  const keyframes = [...(input.keyframes ?? [])]
    .filter((keyframe) => keyframe.commitIndex <= targetCommitIndex)
    .sort((left, right) => right.commitIndex - left.commitIndex);
  let state = keyframes[0]
    ? cloneReplayState(keyframes[0])
    : createEmptyReplayState();

  for (const delta of sortedDeltas(input.deltas)) {
    if (delta.commitIndex <= state.commitIndex) {
      continue;
    }
    if (delta.commitIndex > targetCommitIndex) {
      break;
    }
    state = applyDelta(state, delta, input.catalog, {
      strict: input.strict,
    });
  }
  return state;
}

export function buildKeyframes(
  deltas: readonly ReplayDelta[],
  catalog: ReplayCatalog,
  interval = 50,
): ReplayKeyframe[] {
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new RangeError("keyframe interval must be a positive integer");
  }

  const keyframes: ReplayKeyframe[] = [];
  let state = createEmptyReplayState();
  sortedDeltas(deltas).forEach((delta, ordinal) => {
    state = applyDelta(state, delta, catalog);
    if (ordinal % interval === 0) {
      keyframes.push(cloneReplayState(state));
    }
  });
  return keyframes;
}

export interface CreateChaptersOptions {
  maxCommitsPerChapter?: number;
}

function chapterTitle(commits: readonly CommitMeta[], ordinal: number): string {
  const release = commits
    .flatMap((commit) => commit.tags)
    .find((tag) => tag.length > 0);
  if (release) {
    return `Release ${release}`;
  }
  const firstMessage = commits[0]?.message.trim().replace(/\s+/g, " ");
  if (firstMessage) {
    return firstMessage.length > 48
      ? `${firstMessage.slice(0, 47)}…`
      : firstMessage;
  }
  return `Chapter ${ordinal + 1}`;
}

export function createReplayChapters(
  commits: readonly CommitMeta[],
  options: CreateChaptersOptions = {},
): Chapter[] {
  const maxCommits = options.maxCommitsPerChapter ?? 12;
  if (!Number.isInteger(maxCommits) || maxCommits <= 0) {
    throw new RangeError("maxCommitsPerChapter must be a positive integer");
  }

  const chapters: Chapter[] = [];
  let group: CommitMeta[] = [];
  const flush = () => {
    if (group.length === 0) {
      return;
    }
    const ordinal = chapters.length;
    chapters.push({
      id: `chapter-${String(ordinal + 1).padStart(3, "0")}`,
      title: chapterTitle(group, ordinal),
      summary: `${group.length} commits · ${group.reduce(
        (sum, commit) => sum + commit.changedEntityIds.length,
        0,
      )} entity changes`,
      startCommitIndex: group[0]!.index,
      endCommitIndex: group.at(-1)!.index,
      commitIndices: group.map((commit) => commit.index),
      mode: "rules",
      disclaimer:
        "Rule-based grouping for presentation; it does not claim the developers’ original intent.",
    });
    group = [];
  };

  for (const commit of sortedCommits(commits)) {
    group.push(commit);
    if (group.length >= maxCommits || commit.tags.length > 0) {
      flush();
    }
  }
  flush();
  return chapters;
}

export function compileReplay(input: CompileReplayInput): CompiledReplay {
  const deltas = sortedDeltas(input.deltas);
  const rawCommits = sortedCommits(input.commits);
  const commitIndexSet = new Set(rawCommits.map((commit) => commit.index));

  for (const delta of deltas) {
    if (!commitIndexSet.has(delta.commitIndex)) {
      throw new ReplayInvariantError(
        delta.commitIndex,
        "delta has no matching commit metadata",
      );
    }
  }

  const chapters = createReplayChapters(rawCommits, {
    maxCommitsPerChapter: input.chapterSize,
  });
  const chapterByCommit = new Map<number, string>();
  for (const chapter of chapters) {
    for (const commitIndex of chapter.commitIndices) {
      chapterByCommit.set(commitIndex, chapter.id);
    }
  }
  const commits = rawCommits.map((commit) => ({
    ...commit,
    parents: [...commit.parents],
    tags: [...commit.tags],
    changedEntityIds: [...commit.changedEntityIds],
    chapterId: chapterByCommit.get(commit.index),
  }));

  const catalog = createReplayCatalog(input.entities, input.relations, deltas);
  const keyframes = buildKeyframes(
    deltas,
    catalog,
    input.keyframeInterval ?? 50,
  );

  return {
    commits,
    chapters,
    deltas,
    keyframes,
  };
}

export function calculateDeltaDuration(delta: ReplayDelta): number {
  const value =
    0.45 +
    delta.entityChanges.length * 0.04 +
    delta.relationChanges.length * 0.015;
  return Math.min(2.8, Math.max(0.45, value));
}
