import {
  ChaptersFileSchema,
  CommitsFileSchema,
  DistrictsFileSchema,
  EntitiesFileSchema,
  ReplayDeltaSchema,
  ReplayKeyframeSchema,
  RelationsFileSchema,
  RepoManifestSchema,
  type Chapter,
  type CityEntity,
  type CommitMeta,
  type District,
  type Relation,
  type ReplayDelta,
  type ReplayKeyframe,
  type RepoManifest,
} from "@repocity/schema";
import type { ZodType } from "zod";

import type {
  DemoChapter,
  DemoCommit,
  DemoDistrict,
  DemoEntity,
  DemoManifest,
  DemoRelation,
  ViewerProject,
} from "./demo-data";

export type ProjectBundleResource =
  | "manifest"
  | "districts"
  | "entities"
  | "relations"
  | "commits"
  | "chapters"
  | "deltas"
  | "keyframe";

export interface LoadProjectBundleOptions {
  signal?: AbortSignal;
  /**
   * Primarily useful for tests and non-browser runtimes. The browser's global
   * fetch implementation is used by default.
   */
  fetch?: typeof globalThis.fetch;
}

export interface ViewerBundleSource {
  manifest: RepoManifest;
  districts: District[];
  entities: CityEntity[];
  relations: Relation[];
  commits: CommitMeta[];
  chapters: Chapter[];
  deltas?: ReplayDelta[];
  keyframes?: ReplayKeyframe[];
}

/**
 * Adds the failed resource and URL to errors without swallowing AbortError.
 */
export class ProjectBundleError extends Error {
  readonly resource: ProjectBundleResource;
  readonly url: string;

  constructor(
    resource: ProjectBundleResource,
    url: string,
    detail: string,
    options?: { cause?: unknown },
  ) {
    super(`Failed to load RepoCity ${resource} from "${url}": ${detail}`, options);
    this.name = "ProjectBundleError";
    this.resource = resource;
    this.url = url;
  }
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

function resolveBundleUrl(baseUrl: string | URL, file: string): string {
  const base = baseUrl.toString();

  if (ABSOLUTE_URL_PATTERN.test(file) || file.startsWith("//")) {
    return file;
  }

  if (baseUrl instanceof URL || ABSOLUTE_URL_PATTERN.test(base)) {
    const directoryUrl = base.endsWith("/") ? base : `${base}/`;
    return new URL(file, directoryUrl).toString();
  }

  if (file.startsWith("/")) {
    return file;
  }

  const directoryPath = base.endsWith("/") ? base : `${base}/`;
  return `${directoryPath}${file.replace(/^\.\//, "")}`;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason !== undefined) {
    throw signal.reason;
  }

  throw new DOMException("The project bundle request was aborted.", "AbortError");
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

function formatValidationIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 6)
    .map(({ path, message }) => {
      const location = path.length
        ? path
            .map((part) =>
              typeof part === "number" ? `[${part}]` : String(part),
            )
            .join(".")
            .replace(/\.\[/g, "[")
        : "<root>";
      return `${location}: ${message}`;
    })
    .join("; ");
}

function validateResource<T>(
  resource: ProjectBundleResource,
  url: string,
  schema: ZodType<T>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  throw new ProjectBundleError(
    resource,
    url,
    `schema validation failed (${formatValidationIssues(result.error.issues)})`,
    { cause: result.error },
  );
}

async function fetchJson(
  resource: ProjectBundleResource,
  url: string,
  fetchImpl: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  throwIfAborted(signal);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (isAbort(error, signal)) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    throw new ProjectBundleError(resource, url, `network request failed (${detail})`, {
      cause: error,
    });
  }

  throwIfAborted(signal);

  if (!response.ok) {
    const status = [response.status, response.statusText]
      .filter(Boolean)
      .join(" ");
    throw new ProjectBundleError(
      resource,
      url,
      `HTTP ${status || "request failed"}`,
    );
  }

  try {
    const value: unknown = await response.json();
    throwIfAborted(signal);
    return value;
  } catch (error) {
    if (isAbort(error, signal)) {
      throw error;
    }
    if (error instanceof ProjectBundleError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : String(error);
    throw new ProjectBundleError(resource, url, `invalid JSON (${detail})`, {
      cause: error,
    });
  }
}

async function loadResource<T>(
  resource: ProjectBundleResource,
  url: string,
  schema: ZodType<T>,
  fetchImpl: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<T> {
  const input = await fetchJson(resource, url, fetchImpl, signal);
  return validateResource(resource, url, schema, input);
}

async function loadDeltas(
  url: string,
  fetchImpl: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<ReplayDelta[]> {
  throwIfAborted(signal);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/x-ndjson, application/json;q=0.9",
      },
      signal,
    });
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    throw new ProjectBundleError(
      "deltas",
      url,
      `network request failed (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }

  throwIfAborted(signal);
  if (!response.ok) {
    const status = [response.status, response.statusText]
      .filter(Boolean)
      .join(" ");
    throw new ProjectBundleError(
      "deltas",
      url,
      `HTTP ${status || "request failed"}`,
    );
  }

  let contents: string;
  try {
    contents = await response.text();
    throwIfAborted(signal);
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    throw new ProjectBundleError(
      "deltas",
      url,
      `response body could not be read (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }

  const deltas: ReplayDelta[] = [];
  const lines = contents.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line) continue;

    let input: unknown;
    try {
      input = JSON.parse(line);
    } catch (error) {
      throw new ProjectBundleError(
        "deltas",
        url,
        `invalid NDJSON at line ${index + 1} (${error instanceof Error ? error.message : String(error)})`,
        { cause: error },
      );
    }

    const result = ReplayDeltaSchema.safeParse(input);
    if (!result.success) {
      throw new ProjectBundleError(
        "deltas",
        url,
        `schema validation failed at line ${index + 1} (${formatValidationIssues(result.error.issues)})`,
        { cause: result.error },
      );
    }
    deltas.push(result.data);
  }

  return deltas;
}

async function loadOptionalInitialKeyframe(
  url: string,
  fetchImpl: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<ReplayKeyframe | undefined> {
  throwIfAborted(signal);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    throw new ProjectBundleError(
      "keyframe",
      url,
      `network request failed (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }

  throwIfAborted(signal);
  if (response.status === 404) return undefined;
  if (!response.ok) {
    const status = [response.status, response.statusText]
      .filter(Boolean)
      .join(" ");
    throw new ProjectBundleError(
      "keyframe",
      url,
      `HTTP ${status || "request failed"}`,
    );
  }

  let input: unknown;
  try {
    input = await response.json();
    throwIfAborted(signal);
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    throw new ProjectBundleError(
      "keyframe",
      url,
      `invalid JSON (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }

  return validateResource(
    "keyframe",
    url,
    ReplayKeyframeSchema,
    input,
  );
}

function districtEyebrow(id: string): string {
  return (
    id
      .split(/[\/_.-]+/)
      .filter(Boolean)
      .join(" · ")
      .toLocaleUpperCase("en-US") || "DISTRICT"
  );
}

function adaptDistrict(district: District): DemoDistrict {
  return {
    id: district.id,
    name: district.name,
    eyebrow: districtEyebrow(district.id),
    x: district.layout.x,
    z: district.layout.z,
    width: district.layout.width,
    depth: district.layout.depth,
    color: district.color,
  };
}

function adaptEntity(
  entity: CityEntity,
  districtNames: ReadonlyMap<string, string>,
): DemoEntity {
  const districtName = districtNames.get(entity.districtId);
  const role = entity.role === "test" ? "test" : `${entity.role} file`;
  const location = districtName ? ` in ${districtName}` : "";

  return {
    ...entity,
    summary: `${entity.language} ${role}${location} · ${entity.maxMetrics.loc} LOC at peak`,
    // Export names live in optional knowledge documents, not entities.json.
    exportNames: [],
  };
}

function adaptRelation(relation: Relation): DemoRelation {
  return { ...relation };
}

function findChapterId(
  commit: CommitMeta,
  chapters: readonly Chapter[],
): string {
  if (commit.chapterId) {
    return commit.chapterId;
  }

  return (
    chapters.find((chapter) => chapter.commitIndices.includes(commit.index))
      ?.id ?? ""
  );
}

function adaptCommit(
  commit: CommitMeta,
  chapters: readonly Chapter[],
): DemoCommit {
  return {
    ...commit,
    chapterId: findChapterId(commit, chapters),
    // CommitMeta 0.1 does not expose line-level totals.
    additions: 0,
    deletions: 0,
  };
}

function adaptChapter(chapter: Chapter): DemoChapter {
  return {
    id: chapter.id,
    title: chapter.title,
    subtitle: chapter.summary ?? chapter.disclaimer ?? "",
    start: chapter.startCommitIndex,
    end: chapter.endCommitIndex,
  };
}

/**
 * Converts the canonical schema package shapes into the current Viewer model.
 * This function is exported so already-fetched data can share the same adapter.
 */
export function adaptProjectBundle(source: ViewerBundleSource): ViewerProject {
  const {
    manifest,
    districts,
    entities,
    relations,
    commits,
    chapters,
    deltas,
    keyframes,
  } = source;
  const districtNames = new Map(
    districts.map((district) => [district.id, district.name]),
  );

  const viewerManifest: DemoManifest = {
    schemaVersion: manifest.schemaVersion,
    projectId: manifest.projectId,
    repo: { ...manifest.repo },
    stats: { ...manifest.stats },
  };

  return {
    manifest: viewerManifest,
    districts: districts.map(adaptDistrict),
    entities: entities.map((entity) => adaptEntity(entity, districtNames)),
    relations: relations.map(adaptRelation),
    commits: commits.map((commit) => adaptCommit(commit, chapters)),
    chapters: chapters.map(adaptChapter),
    canonicalEntities: entities,
    canonicalRelations: relations,
    ...(deltas ? { deltas } : {}),
    ...(keyframes ? { keyframes } : {}),
  };
}

/**
 * Loads a RepoCity static bundle, including replay deltas and the initial
 * keyframe when one is present.
 */
export async function loadProjectBundle(
  baseUrl: string | URL,
  options: LoadProjectBundleOptions = {},
): Promise<ViewerProject> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ProjectBundleError(
      "manifest",
      resolveBundleUrl(baseUrl, "manifest.json"),
      "fetch is unavailable in this runtime",
    );
  }

  const manifestUrl = resolveBundleUrl(baseUrl, "manifest.json");
  const manifest = await loadResource(
    "manifest",
    manifestUrl,
    RepoManifestSchema,
    fetchImpl,
    options.signal,
  );

  if (!manifest.files.districts) {
    throw new ProjectBundleError(
      "manifest",
      manifestUrl,
      "manifest.files.districts is required by the Viewer",
    );
  }

  const resourceUrls = {
    districts: resolveBundleUrl(baseUrl, manifest.files.districts),
    entities: resolveBundleUrl(baseUrl, manifest.files.entities),
    relations: resolveBundleUrl(baseUrl, manifest.files.relations),
    commits: resolveBundleUrl(baseUrl, manifest.files.commits),
    chapters: resolveBundleUrl(baseUrl, manifest.files.chapters),
    deltas: resolveBundleUrl(baseUrl, manifest.files.deltas),
    initialKeyframe: resolveBundleUrl(
      baseUrl,
      `${manifest.files.keyframesDir.replace(/\/+$/, "")}/0000.json`,
    ),
  };

  const [
    districts,
    entities,
    relations,
    commits,
    chapters,
    deltas,
    initialKeyframe,
  ] = await Promise.all([
      loadResource(
        "districts",
        resourceUrls.districts,
        DistrictsFileSchema,
        fetchImpl,
        options.signal,
      ),
      loadResource(
        "entities",
        resourceUrls.entities,
        EntitiesFileSchema,
        fetchImpl,
        options.signal,
      ),
      loadResource(
        "relations",
        resourceUrls.relations,
        RelationsFileSchema,
        fetchImpl,
        options.signal,
      ),
      loadResource(
        "commits",
        resourceUrls.commits,
        CommitsFileSchema,
        fetchImpl,
        options.signal,
      ),
      loadResource(
        "chapters",
        resourceUrls.chapters,
        ChaptersFileSchema,
        fetchImpl,
        options.signal,
      ),
      loadDeltas(resourceUrls.deltas, fetchImpl, options.signal),
      loadOptionalInitialKeyframe(
        resourceUrls.initialKeyframe,
        fetchImpl,
        options.signal,
      ),
    ]);

  return adaptProjectBundle({
    manifest,
    districts,
    entities,
    relations,
    commits,
    chapters,
    deltas,
    keyframes: initialKeyframe ? [initialKeyframe] : [],
  });
}
