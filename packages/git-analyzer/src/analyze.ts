import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import {
  IgnoreMatcher,
  analyzeSource,
  classifyFileRole,
  isLikelyEntryPoint,
  loadResolverConfig,
  normalizeRepoPath,
  parseIgnoreFile,
  resolveImports,
  shouldAnalyzePath,
  type SourceAnalysis,
} from "@repocity/code-analyzer";

import {
  readCommitChanges,
  readCommitHistory,
  readFileAtCommit,
  readRepositoryMetadata,
} from "./git.js";
import type {
  ActiveAnalyzedFile,
  AnalyzeGitOptions,
  AnalyzedEntity,
  AnalyzedRelation,
  AnalyzedReplayDelta,
  EntityMaxMetrics,
  EntityReplayChange,
  GitAnalysisResult,
  RelationReplayChange,
  RuntimeMetrics,
} from "./types.js";

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024;

interface MutableEntity extends Omit<AnalyzedEntity, "aliases"> {
  aliases: Set<string>;
  churn: number;
}

function stableId(prefix: string, seed: string): string {
  return `${prefix}_${createHash("sha256").update(seed).digest("hex").slice(0, 20)}`;
}

function metricsEqual(left: RuntimeMetrics, right: RuntimeMetrics): boolean {
  return (
    left.loc === right.loc &&
    left.exports === right.exports &&
    left.fanIn === right.fanIn &&
    left.fanOut === right.fanOut
  );
}

function copyMetrics(metrics: RuntimeMetrics): RuntimeMetrics {
  return { ...metrics };
}

async function optionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function createIgnoreMatcher(
  repoPath: string,
  extraPatterns: readonly string[],
): Promise<IgnoreMatcher> {
  const [gitignore, repocityIgnore] = await Promise.all([
    optionalFile(join(repoPath, ".gitignore")),
    optionalFile(join(repoPath, ".repocityignore")),
  ]);
  return new IgnoreMatcher([
    ...(gitignore ? parseIgnoreFile(gitignore) : []),
    ...(repocityIgnore ? parseIgnoreFile(repocityIgnore) : []),
    ...extraPatterns,
  ]);
}

function analysisForPath(cached: SourceAnalysis, path: string): SourceAnalysis {
  const normalizedPath = normalizeRepoPath(path);
  return {
    ...cached,
    path: normalizedPath,
    extension: extname(normalizedPath) as SourceAnalysis["extension"],
    language:
      normalizedPath.endsWith(".ts") || normalizedPath.endsWith(".tsx")
        ? "typescript"
        : "javascript",
    role: classifyFileRole(normalizedPath),
    isEntryPoint: isLikelyEntryPoint(normalizedPath),
  };
}

function snapshotMetrics(
  activeFiles: ReadonlyMap<string, ActiveAnalyzedFile>,
  fanIn: ReadonlyMap<string, number>,
  fanOut: ReadonlyMap<string, number>,
): Map<string, RuntimeMetrics> {
  return new Map(
    [...activeFiles.values()].map((file) => [
      file.id,
      {
        loc: file.loc,
        exports: file.exports,
        fanIn: fanIn.get(file.id) ?? 0,
        fanOut: fanOut.get(file.id) ?? 0,
      },
    ]),
  );
}

function maxMetrics(
  current: EntityMaxMetrics,
  runtime: RuntimeMetrics,
  churn: number,
): EntityMaxMetrics {
  return {
    loc: Math.max(current.loc, runtime.loc),
    exports: Math.max(current.exports, runtime.exports),
    fanIn: Math.max(current.fanIn, runtime.fanIn),
    fanOut: Math.max(current.fanOut, runtime.fanOut),
    churn: Math.max(current.churn, churn),
  };
}

function relationKey(sourceId: string, targetId: string): string {
  return `${sourceId}\0${targetId}`;
}

export async function analyzeGitRepository(
  repoPath: string,
  options: AnalyzeGitOptions = {},
): Promise<GitAnalysisResult> {
  const report = options.onProgress ?? (() => {});
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const warnings: string[] = [];

  report({ phase: "metadata", message: "Reading repository metadata" });
  const [repo, rawCommits, matcher, resolverConfig] = await Promise.all([
    readRepositoryMetadata(repoPath),
    readCommitHistory(repoPath),
    createIgnoreMatcher(repoPath, options.ignorePatterns ?? []),
    loadResolverConfig(repoPath),
  ]);

  report({
    phase: "history",
    total: rawCommits.length,
    message: `Found ${rawCommits.length} commits`,
  });

  const activeByPath = new Map<string, ActiveAnalyzedFile>();
  const entities = new Map<string, MutableEntity>();
  const relations: AnalyzedRelation[] = [];
  const activeRelations = new Map<string, AnalyzedRelation>();
  const analysisCache = new Map<string, SourceAnalysis>();
  const commits: GitAnalysisResult["commits"] = [];
  const deltas: AnalyzedReplayDelta[] = [];
  let previousMetrics = new Map<string, RuntimeMetrics>();

  const parseFile = async (
    sha: string,
    path: string,
  ): Promise<SourceAnalysis | undefined> => {
    try {
      const contents = await readFileAtCommit(repo.path, sha, path, maxFileBytes);
      if (Buffer.byteLength(contents, "utf8") > maxFileBytes) {
        warnings.push(`Skipped ${path} at ${sha.slice(0, 8)}: file exceeds size limit`);
        return undefined;
      }
      const extension = extname(path);
      const cacheKey = createHash("sha256")
        .update(extension)
        .update("\0")
        .update(contents)
        .digest("hex");
      let cached = analysisCache.get(cacheKey);
      if (!cached) {
        cached = analyzeSource(path, contents);
        analysisCache.set(cacheKey, cached);
      }
      return analysisForPath(cached, path);
    } catch (error) {
      warnings.push(
        `Skipped ${path} at ${sha.slice(0, 8)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  };

  for (let commitIndex = 0; commitIndex < rawCommits.length; commitIndex += 1) {
    const rawCommit = rawCommits[commitIndex]!;
    report({
      phase: "commit",
      current: commitIndex + 1,
      total: rawCommits.length,
      message: `${rawCommit.sha.slice(0, 8)} ${rawCommit.message}`,
    });

    const fileChanges = await readCommitChanges(
      repo.path,
      rawCommit.sha,
      rawCommit.parents[0],
    );
    const spawnIds = new Set<string>();
    const removedIds = new Set<string>();
    const touchedIds = new Set<string>();
    const renameChanges: Extract<EntityReplayChange, { op: "rename" }>[] = [];

    const createEntity = (
      path: string,
      analysis: SourceAnalysis,
      seed: string,
      churn: number,
    ): ActiveAnalyzedFile => {
      const id = stableId("ent", seed);
      const normalizedPath = normalizeRepoPath(path);
      const file: ActiveAnalyzedFile = {
        id,
        path: normalizedPath,
        loc: analysis.loc,
        exports: analysis.exports,
        exportNames: analysis.exportNames,
        imports: analysis.imports,
        language: analysis.language,
        role: analysis.role,
        isEntryPoint: analysis.isEntryPoint,
      };
      entities.set(id, {
        id,
        kind: "building",
        path: normalizedPath,
        aliases: new Set([normalizedPath]),
        name: basename(normalizedPath),
        extension: extname(normalizedPath),
        language: analysis.language,
        role: analysis.role,
        bornAt: commitIndex,
        maxMetrics: {
          loc: analysis.loc,
          exports: analysis.exports,
          fanIn: 0,
          fanOut: 0,
          churn,
        },
        currentMetrics: {
          loc: analysis.loc,
          exports: analysis.exports,
          fanIn: 0,
          fanOut: 0,
        },
        exportNames: analysis.exportNames,
        isEntryPoint: analysis.isEntryPoint,
        churn,
      });
      activeByPath.set(normalizedPath, file);
      spawnIds.add(id);
      touchedIds.add(id);
      return file;
    };

    const updateFile = (
      file: ActiveAnalyzedFile,
      path: string,
      analysis: SourceAnalysis,
      churn: number,
    ): void => {
      file.path = normalizeRepoPath(path);
      file.loc = analysis.loc;
      file.exports = analysis.exports;
      file.exportNames = analysis.exportNames;
      file.imports = analysis.imports;
      file.language = analysis.language;
      file.role = analysis.role;
      file.isEntryPoint = analysis.isEntryPoint;
      const entity = entities.get(file.id)!;
      entity.path = file.path;
      entity.name = basename(file.path);
      entity.extension = extname(file.path);
      entity.language = analysis.language;
      entity.role = analysis.role;
      entity.exportNames = analysis.exportNames;
      entity.isEntryPoint = analysis.isEntryPoint;
      entity.aliases.add(file.path);
      entity.churn += churn;
      touchedIds.add(file.id);
    };

    const removeFile = (path: string): ActiveAnalyzedFile | undefined => {
      const normalizedPath = normalizeRepoPath(path);
      const file = activeByPath.get(normalizedPath);
      if (!file) {
        return undefined;
      }
      activeByPath.delete(normalizedPath);
      const entity = entities.get(file.id)!;
      entity.diedAt = commitIndex;
      removedIds.add(file.id);
      touchedIds.add(file.id);
      return file;
    };

    for (const change of fileChanges) {
      const path = normalizeRepoPath(change.path);
      const oldPath = change.oldPath ? normalizeRepoPath(change.oldPath) : undefined;
      const analyzeNew = shouldAnalyzePath(path, matcher);
      const analyzeOld = oldPath ? shouldAnalyzePath(oldPath, matcher) : false;
      const churn = change.additions + change.deletions;

      if (change.status === "delete") {
        if (shouldAnalyzePath(path, matcher)) {
          const removed = removeFile(path);
          change.entityId = removed?.id;
          if (removed) {
            entities.get(removed.id)!.churn += churn;
          }
        }
        continue;
      }

      if (change.status === "rename" && oldPath) {
        if (analyzeOld && !analyzeNew) {
          const removed = removeFile(oldPath);
          change.entityId = removed?.id;
          if (removed) {
            entities.get(removed.id)!.churn += churn;
          }
          continue;
        }

        if (analyzeOld && analyzeNew) {
          const existing = activeByPath.get(oldPath);
          const analysis = await parseFile(rawCommit.sha, path);
          if (!analysis) {
            continue;
          }
          if (existing) {
            activeByPath.delete(oldPath);
            activeByPath.set(path, existing);
            updateFile(existing, path, analysis, churn);
            renameChanges.push({
              op: "rename",
              entityId: existing.id,
              beforePath: oldPath,
              afterPath: path,
            });
            change.entityId = existing.id;
          } else {
            change.entityId = createEntity(
              path,
              analysis,
              `${rawCommit.sha}\0${path}`,
              churn,
            ).id;
          }
          continue;
        }
        // Moving an ignored file into the supported source set is a new entity.
      }

      if (!analyzeNew) {
        continue;
      }

      const analysis = await parseFile(rawCommit.sha, path);
      if (!analysis) {
        continue;
      }

      if (change.status === "add" || change.status === "copy" || !activeByPath.has(path)) {
        const replaced = activeByPath.get(path);
        if (replaced) {
          removeFile(path);
        }
        change.entityId = createEntity(
          path,
          analysis,
          `${rawCommit.sha}\0${path}`,
          churn,
        ).id;
      } else {
        const file = activeByPath.get(path)!;
        updateFile(file, path, analysis, churn);
        change.entityId = file.id;
      }
    }

    const resolvedRelations = resolveImports(activeByPath.values(), resolverConfig);
    const currentRelationKeys = new Set<string>();
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();
    const relationChanges: RelationReplayChange[] = [];

    for (const relation of resolvedRelations) {
      const key = relationKey(relation.sourceId, relation.targetId);
      currentRelationKeys.add(key);
      fanOut.set(relation.sourceId, (fanOut.get(relation.sourceId) ?? 0) + 1);
      fanIn.set(relation.targetId, (fanIn.get(relation.targetId) ?? 0) + 1);
      if (!activeRelations.has(key)) {
        const created: AnalyzedRelation = {
          id: stableId("rel", `${key}\0${commitIndex}`),
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          kind: "import",
          bornAt: commitIndex,
          weight: 1,
        };
        activeRelations.set(key, created);
        relations.push(created);
        relationChanges.push({ op: "add", relationId: created.id });
      }
    }

    for (const [key, relation] of activeRelations) {
      if (!currentRelationKeys.has(key)) {
        relation.diedAt = commitIndex;
        activeRelations.delete(key);
        relationChanges.push({ op: "remove", relationId: relation.id });
      }
    }

    const currentMetrics = snapshotMetrics(
      new Map([...activeByPath.values()].map((file) => [file.id, file])),
      fanIn,
      fanOut,
    );
    const metricChangedIds = new Set<string>();
    for (const [id, metrics] of currentMetrics) {
      const before = previousMetrics.get(id);
      if (before && !metricsEqual(before, metrics)) {
        metricChangedIds.add(id);
      }
      const entity = entities.get(id)!;
      entity.currentMetrics = copyMetrics(metrics);
      entity.maxMetrics = maxMetrics(entity.maxMetrics, metrics, entity.churn);
    }

    const entityChanges: EntityReplayChange[] = [];
    for (const id of [...spawnIds].sort()) {
      const metrics = currentMetrics.get(id);
      if (metrics) {
        entityChanges.push({ op: "spawn", entityId: id, metrics: copyMetrics(metrics) });
      }
    }
    entityChanges.push(
      ...renameChanges.sort((left, right) => left.entityId.localeCompare(right.entityId)),
    );

    const updateIds = new Set([...touchedIds, ...metricChangedIds]);
    for (const id of [...updateIds].sort()) {
      if (spawnIds.has(id) || removedIds.has(id)) {
        continue;
      }
      const before = previousMetrics.get(id);
      const after = currentMetrics.get(id);
      if (before && after) {
        entityChanges.push({
          op: "update",
          entityId: id,
          before: copyMetrics(before),
          after: copyMetrics(after),
        });
      }
    }
    for (const id of [...removedIds].sort()) {
      entityChanges.push({ op: "remove", entityId: id });
    }

    const changedEntityIds = [...new Set(
      fileChanges
        .map((change) => change.entityId)
        .filter((id): id is string => Boolean(id)),
    )].sort();
    commits.push({
      index: commitIndex,
      ...rawCommit,
      changedEntityIds,
      changes: fileChanges,
    });
    deltas.push({
      commitIndex,
      entityChanges,
      relationChanges: relationChanges.sort((left, right) =>
        left.relationId.localeCompare(right.relationId),
      ),
    });
    previousMetrics = currentMetrics;
  }

  const finalizedEntities = [...entities.values()]
    .map(({ aliases, churn: _churn, ...entity }) => ({
      ...entity,
      maxMetrics: {
        ...entity.maxMetrics,
        churn: Math.max(entity.maxMetrics.churn, _churn),
      },
      aliases: [...aliases]
        .filter((alias) => alias !== entity.path)
        .sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  report({
    phase: "complete",
    current: rawCommits.length,
    total: rawCommits.length,
    message: `Analyzed ${finalizedEntities.length} entities`,
  });

  return {
    repo,
    entities: finalizedEntities,
    relations: relations.sort((left, right) => left.id.localeCompare(right.id)),
    commits,
    deltas,
    resolverConfig,
    warnings,
  };
}
