import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { compileCity } from "../../../packages/city-compiler/src/index.js";
import { analyzeGitRepository } from "../../../packages/git-analyzer/src/index.js";
import type {
  AnalyzeGitOptions,
  AnalyzedEntity,
  GitAnalysisProgress,
} from "../../../packages/git-analyzer/src/index.js";
import { prepareRepository } from "../../../packages/git-analyzer/src/index.js";
import { compileReplay } from "../../../packages/replay-engine/src/index.js";
import {
  SCHEMA_VERSION,
  validateRepoCityBundle,
  type RepoCityBundle,
  type RepoManifest,
} from "../../../packages/schema/src/index.js";

export interface BuildProjectOptions {
  input: string;
  outDir: string;
  ignorePatterns?: string[];
  maxFileBytes?: number;
  keyframeInterval?: number;
  chapterSize?: number;
  onProgress?: (progress: GitAnalysisProgress) => void;
}

export interface BuildProjectResult {
  outDir: string;
  bundle: RepoCityBundle;
  warnings: string[];
}

function projectId(
  name: string,
  remoteUrl: string | undefined,
  repoPath: string,
): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const digest = createHash("sha256")
    .update(remoteUrl || repoPath)
    .digest("hex")
    .slice(0, 16);
  return `${slug || "project"}-${digest}`;
}

function webRemoteUrl(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) {
    return undefined;
  }

  const scpLike = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scpLike) {
    return `https://${scpLike[1]}/${scpLike[2]!.replace(/\.git$/, "")}`;
  }

  try {
    return new URL(remoteUrl).toString();
  } catch {
    return undefined;
  }
}

function commitMetadata(
  commits: Awaited<ReturnType<typeof analyzeGitRepository>>["commits"],
) {
  return commits.map(
    ({
      index,
      sha,
      parents,
      authorName,
      authoredAt,
      message,
      tags,
      changedEntityIds,
    }) => ({
      index,
      sha,
      parents,
      authorName,
      authoredAt,
      message,
      tags,
      changedEntityIds,
    }),
  );
}

function sourceEntities(entities: readonly AnalyzedEntity[]) {
  return entities.map((entity) => ({
    id: entity.id,
    identityKey: entity.aliases[0] ?? entity.path,
    path: entity.path,
    aliases: entity.aliases,
    name: entity.name,
    extension: entity.extension,
    language: entity.language,
    role: entity.role,
    bornAt: entity.bornAt,
    ...(entity.diedAt !== undefined ? { diedAt: entity.diedAt } : {}),
    maxMetrics: entity.maxMetrics,
  }));
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, filePath);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceWebUrl(
  remoteUrl: string | undefined,
  headSha: string,
  path: string,
): string | undefined {
  if (!remoteUrl || !/^https?:\/\/(github|gitlab|bitbucket)\./.test(remoteUrl)) {
    return undefined;
  }
  const root = remoteUrl.replace(/\.git\/?$/, "").replace(/\/$/, "");
  if (root.includes("github.com")) {
    return `${root}/blob/${headSha}/${path}`;
  }
  if (root.includes("gitlab.com")) {
    return `${root}/-/blob/${headSha}/${path}`;
  }
  return `${root}/src/${headSha}/${path}`;
}

function entityKnowledge(
  entity: AnalyzedEntity,
  remoteUrl: string | undefined,
  headSha: string,
): string {
  const sourceUrl = sourceWebUrl(remoteUrl, headSha, entity.path);
  const lines = [
    `# ${entity.name}`,
    "",
    `- Path: \`${entity.path}\``,
    `- Role: ${entity.role}`,
    `- Language: ${entity.language}`,
    `- Maximum LOC: ${entity.maxMetrics.loc}`,
    `- Maximum fan-in / fan-out: ${entity.maxMetrics.fanIn} / ${entity.maxMetrics.fanOut}`,
    `- Entry point: ${entity.isEntryPoint ? "yes" : "no"}`,
  ];
  if (entity.aliases.length > 0) {
    lines.push(`- Previous paths: ${entity.aliases.map((path) => `\`${path}\``).join(", ")}`);
  }
  if (entity.exportNames.length > 0) {
    lines.push(
      "",
      "## Exports",
      "",
      ...entity.exportNames.map((name) => `- \`${name}\``),
    );
  }
  if (sourceUrl) {
    lines.push("", `[Open source at ${headSha.slice(0, 8)}](${sourceUrl})`);
  }
  return `${lines.join("\n")}\n`;
}

async function writeStaticBundle(
  outDir: string,
  bundle: RepoCityBundle,
  analyzedEntities: readonly AnalyzedEntity[],
  remoteUrl: string | undefined,
): Promise<void> {
  const keyframesDir = join(outDir, bundle.manifest.files.keyframesDir);
  const knowledgeEntitiesDir = join(outDir, "knowledge", "entities");
  await Promise.all([
    mkdir(outDir, { recursive: true }),
    mkdir(keyframesDir, { recursive: true }),
    mkdir(knowledgeEntitiesDir, { recursive: true }),
  ]);

  await Promise.all([
    atomicWrite(join(outDir, "manifest.json"), json(bundle.manifest)),
    atomicWrite(join(outDir, "districts.json"), json(bundle.districts)),
    atomicWrite(join(outDir, "entities.json"), json(bundle.entities)),
    atomicWrite(join(outDir, "relations.json"), json(bundle.relations)),
    atomicWrite(join(outDir, "commits.json"), json(bundle.commits)),
    atomicWrite(join(outDir, "chapters.json"), json(bundle.chapters)),
    atomicWrite(
      join(outDir, "deltas.ndjson"),
      bundle.deltas.map((delta) => JSON.stringify(delta)).join("\n") +
        (bundle.deltas.length > 0 ? "\n" : ""),
    ),
    atomicWrite(
      join(outDir, "knowledge", "repo.md"),
      `# ${bundle.manifest.repo.name}\n\nGenerated by RepoCity at commit \`${bundle.manifest.repo.headSha}\`.\n`,
    ),
    ...bundle.keyframes.map((keyframe) =>
      atomicWrite(
        join(
          keyframesDir,
          `${String(keyframe.commitIndex).padStart(4, "0")}.json`,
        ),
        json(keyframe),
      ),
    ),
    ...analyzedEntities.map((entity) =>
      atomicWrite(
        join(knowledgeEntitiesDir, `${entity.id}.md`),
        entityKnowledge(entity, remoteUrl, bundle.manifest.repo.headSha),
      ),
    ),
  ]);
}

export async function buildProject(
  options: BuildProjectOptions,
): Promise<BuildProjectResult> {
  const prepared = await prepareRepository(options.input);
  try {
    const analyzeOptions: AnalyzeGitOptions = {
      ...(options.ignorePatterns ? { ignorePatterns: options.ignorePatterns } : {}),
      ...(options.maxFileBytes ? { maxFileBytes: options.maxFileBytes } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    };
    const analysis = await analyzeGitRepository(prepared.path, analyzeOptions);
    const city = compileCity({ entities: sourceEntities(analysis.entities) });
    const relations = analysis.relations.map(
      ({ id, sourceId, targetId, kind, bornAt, diedAt, weight }) => ({
        id,
        sourceId,
        targetId,
        kind,
        bornAt,
        ...(diedAt !== undefined ? { diedAt } : {}),
        weight,
      }),
    );
    const replay = compileReplay({
      entities: city.entities,
      relations,
      commits: commitMetadata(analysis.commits),
      deltas: analysis.deltas,
      ...(options.keyframeInterval
        ? { keyframeInterval: options.keyframeInterval }
        : {}),
      ...(options.chapterSize ? { chapterSize: options.chapterSize } : {}),
    });
    const remoteUrl = webRemoteUrl(analysis.repo.remoteUrl);
    const manifest: RepoManifest = {
      schemaVersion: SCHEMA_VERSION,
      projectId: projectId(analysis.repo.name, remoteUrl, analysis.repo.path),
      repo: {
        name: analysis.repo.name,
        ...(remoteUrl ? { remoteUrl } : {}),
        defaultBranch: analysis.repo.defaultBranch,
        headSha: analysis.repo.headSha,
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
    };
    const bundle = validateRepoCityBundle({
      manifest,
      districts: city.districts,
      entities: city.entities,
      relations,
      commits: replay.commits,
      chapters: replay.chapters,
      deltas: replay.deltas,
      keyframes: replay.keyframes,
    });
    const outDir = resolve(options.outDir);
    await writeStaticBundle(outDir, bundle, analysis.entities, remoteUrl);
    return { outDir, bundle, warnings: analysis.warnings };
  } finally {
    await prepared.cleanup();
  }
}

export function defaultOutputDirectory(input: string): string {
  let name: string;
  try {
    name = basename(new URL(input).pathname);
  } catch {
    const scpPath = input.match(/^[^/@\s]+@[^:\s]+:(.+)$/)?.[1];
    name = scpPath ? basename(scpPath) : basename(resolve(input));
  }
  name = name.replace(/\.git$/i, "") || "project";
  return resolve(`${name}.repocity`);
}
