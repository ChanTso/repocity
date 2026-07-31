import {
  createReplayCatalog,
  seekReplay,
} from "@repocity/replay-engine";

import type { ViewerProject } from "./demo-data";

export interface ViewerEntityFrameState {
  visible: boolean;
  loc?: number;
  modified: boolean;
}

export interface ViewerReplayFrame {
  commitIndex: number;
  entityFrameStates: Record<string, ViewerEntityFrameState>;
  activeRelationIds: ReadonlySet<string>;
  changedEntityIds: ReadonlySet<string>;
}

function latestCommitIndex(project: ViewerProject): number {
  return project.commits.reduce(
    (latest, commit) => Math.max(latest, commit.index),
    -1,
  );
}

function resolveCommitIndex(
  project: ViewerProject,
  commitIndex: number | null | undefined,
): number {
  const latest = latestCommitIndex(project);
  if (commitIndex === null || commitIndex === undefined) return latest;
  if (!Number.isInteger(commitIndex) || commitIndex < -1) {
    throw new RangeError("commitIndex must be an integer >= -1");
  }
  if (commitIndex > latest) {
    throw new RangeError(
      `commitIndex ${commitIndex} exceeds the latest commit ${latest}`,
    );
  }
  return commitIndex;
}

function changedEntityIdsAt(
  project: ViewerProject,
  commitIndex: number,
): Set<string> {
  const fromCommit = project.commits.find(
    (commit) => commit.index === commitIndex,
  )?.changedEntityIds;
  if (fromCommit) return new Set(fromCommit);

  const delta = project.deltas?.find(
    (candidate) => candidate.commitIndex === commitIndex,
  );
  const changed = new Set(
    delta?.entityChanges.map((change) => change.entityId) ?? [],
  );
  const relationById = new Map(
    project.canonicalRelations?.map((relation) => [relation.id, relation]),
  );
  for (const change of delta?.relationChanges ?? []) {
    const relation = relationById.get(change.relationId);
    if (!relation) continue;
    changed.add(relation.sourceId);
    changed.add(relation.targetId);
  }
  return changed;
}

function resolveFallbackFrame(
  project: ViewerProject,
  commitIndex: number,
  changedEntityIds: Set<string>,
): ViewerReplayFrame {
  const entityFrameStates = Object.fromEntries(
    project.entities.map((entity) => [
      entity.id,
      {
        visible:
          commitIndex >= entity.bornAt &&
          (entity.diedAt === undefined || commitIndex < entity.diedAt),
        modified: changedEntityIds.has(entity.id),
      },
    ]),
  );
  const activeRelationIds = new Set(
    project.relations
      .filter(
        (relation) =>
          commitIndex >= relation.bornAt &&
          (relation.diedAt === undefined || commitIndex < relation.diedAt),
      )
      .map((relation) => relation.id),
  );

  return {
    commitIndex,
    entityFrameStates,
    activeRelationIds,
    changedEntityIds,
  };
}

/**
 * Resolves the exact canonical replay state used by the 3D renderer.
 *
 * A null/undefined commit means HEAD and is reduced through the final commit,
 * rather than substituting max historical metrics. Hand-authored demo projects
 * without canonical replay facts retain their bornAt/diedAt fallback.
 */
export function resolveViewerReplayFrame(
  project: ViewerProject,
  commitIndex?: number | null,
): ViewerReplayFrame {
  const isHead = commitIndex === null || commitIndex === undefined;
  const targetCommitIndex = resolveCommitIndex(project, commitIndex);
  const changedEntityIds = isHead
    ? new Set<string>()
    : changedEntityIdsAt(project, targetCommitIndex);
  const { canonicalEntities, canonicalRelations, deltas, keyframes } = project;

  if (!canonicalEntities || !canonicalRelations || !deltas) {
    return resolveFallbackFrame(
      project,
      targetCommitIndex,
      changedEntityIds,
    );
  }

  const catalog = createReplayCatalog(
    canonicalEntities,
    canonicalRelations,
    deltas,
  );
  const replayState = seekReplay(targetCommitIndex, {
    catalog,
    deltas,
    keyframes,
  });
  const entityFrameStates: Record<string, ViewerEntityFrameState> = {};

  for (const entity of canonicalEntities) {
    const active = replayState.entities[entity.id];
    entityFrameStates[entity.id] = active
      ? {
          visible: true,
          loc: active.metrics.loc,
          modified: changedEntityIds.has(entity.id),
        }
      : {
          visible: false,
          modified: changedEntityIds.has(entity.id),
        };
  }

  return {
    commitIndex: targetCommitIndex,
    entityFrameStates,
    activeRelationIds: new Set(replayState.relationIds),
    changedEntityIds,
  };
}
