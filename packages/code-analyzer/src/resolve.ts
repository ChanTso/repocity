import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, posix, relative } from "node:path";

import ts from "typescript";

import { normalizeRepoPath } from "./ignore.js";
import type {
  PathAlias,
  ResolvableFile,
  ResolvedImport,
  ResolverConfig,
  WorkspacePackage,
} from "./types.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function repositoryRelative(root: string, filePath: string): string {
  return normalizeRepoPath(relative(root, filePath));
}

function parsePackageEntries(value: Record<string, unknown>): string[] {
  const entries = new Set<string>();
  for (const key of ["source", "module", "main", "types", "typings"]) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      entries.add(candidate.replace(/^\.\//, ""));
    }
  }
  entries.add("src/index.ts");
  entries.add("src/index.tsx");
  entries.add("index.ts");
  entries.add("index.tsx");
  entries.add("index.js");
  return [...entries];
}

async function discoverWorkspacePackages(root: string): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const directory = queue.shift()!;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith(".")) {
          queue.push(join(directory, entry.name));
        }
        continue;
      }

      if (entry.name !== "package.json") {
        continue;
      }

      const packageJsonPath = join(directory, entry.name);
      try {
        const value = JSON.parse(await readFile(packageJsonPath, "utf8")) as Record<
          string,
          unknown
        >;
        if (typeof value.name === "string") {
          packages.push({
            name: value.name,
            directory: repositoryRelative(root, directory),
            entries: parsePackageEntries(value),
          });
        }
      } catch {
        // Invalid package metadata should not make source analysis fail.
      }
    }
  }

  return packages.sort((left, right) => right.name.length - left.name.length);
}

export async function loadResolverConfig(repoRoot: string): Promise<ResolverConfig> {
  const configPath = join(repoRoot, "tsconfig.json");
  let baseUrl = "";
  let aliases: PathAlias[] = [];

  if (await pathExists(configPath)) {
    const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!readResult.error) {
      const compilerOptions = (readResult.config?.compilerOptions ?? {}) as {
        baseUrl?: unknown;
        paths?: unknown;
      };
      if (typeof compilerOptions.baseUrl === "string") {
        baseUrl = normalizeRepoPath(compilerOptions.baseUrl);
        if (baseUrl === ".") {
          baseUrl = "";
        }
      }
      if (
        compilerOptions.paths &&
        typeof compilerOptions.paths === "object" &&
        !Array.isArray(compilerOptions.paths)
      ) {
        aliases = Object.entries(compilerOptions.paths)
          .filter(
            (entry): entry is [string, string[]] =>
              Array.isArray(entry[1]) &&
              entry[1].every((target) => typeof target === "string"),
          )
          .map(([pattern, targets]) => ({ pattern, targets }));
      }
    }
  }

  return {
    baseUrl,
    aliases,
    workspacePackages: await discoverWorkspacePackages(repoRoot),
  };
}

function matchAlias(pattern: string, specifier: string): string | null {
  const starIndex = pattern.indexOf("*");
  if (starIndex < 0) {
    return pattern === specifier ? "" : null;
  }

  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
    return null;
  }
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

function sourceCandidates(basePath: string): string[] {
  const normalizedBase = normalizeRepoPath(basePath);
  const extension = extname(normalizedBase);
  const candidates = new Set<string>();

  candidates.add(normalizedBase);
  if (extension === ".js" || extension === ".jsx") {
    const withoutExtension = normalizedBase.slice(0, -extension.length);
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.add(`${withoutExtension}${sourceExtension}`);
    }
  } else if (!SOURCE_EXTENSIONS.includes(extension as (typeof SOURCE_EXTENSIONS)[number])) {
    for (const sourceExtension of SOURCE_EXTENSIONS) {
      candidates.add(`${normalizedBase}${sourceExtension}`);
    }
  }

  for (const sourceExtension of SOURCE_EXTENSIONS) {
    candidates.add(posix.join(normalizedBase, `index${sourceExtension}`));
  }
  return [...candidates];
}

function cleanSpecifier(specifier: string): string {
  return specifier.replace(/[?#].*$/, "");
}

function resolveCandidate(
  candidate: string,
  pathToId: ReadonlyMap<string, string>,
): string | undefined {
  for (const pathCandidate of sourceCandidates(candidate)) {
    const targetId = pathToId.get(pathCandidate);
    if (targetId) {
      return targetId;
    }
  }
  return undefined;
}

export function resolveImportSpecifier(
  sourcePath: string,
  rawSpecifier: string,
  pathToId: ReadonlyMap<string, string>,
  config: ResolverConfig,
): string | undefined {
  const specifier = cleanSpecifier(rawSpecifier);

  if (specifier.startsWith(".")) {
    return resolveCandidate(
      posix.join(dirname(normalizeRepoPath(sourcePath)).replaceAll("\\", "/"), specifier),
      pathToId,
    );
  }

  for (const alias of config.aliases) {
    const wildcard = matchAlias(alias.pattern, specifier);
    if (wildcard === null) {
      continue;
    }
    for (const target of alias.targets) {
      const substituted = target.replace("*", wildcard);
      const resolved = resolveCandidate(posix.join(config.baseUrl, substituted), pathToId);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (config.baseUrl) {
    const baseUrlResult = resolveCandidate(posix.join(config.baseUrl, specifier), pathToId);
    if (baseUrlResult) {
      return baseUrlResult;
    }
  }

  for (const workspacePackage of config.workspacePackages) {
    if (
      specifier !== workspacePackage.name &&
      !specifier.startsWith(`${workspacePackage.name}/`)
    ) {
      continue;
    }

    const subpath = specifier.slice(workspacePackage.name.length).replace(/^\//, "");
    if (subpath) {
      const result = resolveCandidate(
        posix.join(workspacePackage.directory, subpath),
        pathToId,
      );
      if (result) {
        return result;
      }
    } else {
      for (const entry of workspacePackage.entries) {
        const result = resolveCandidate(
          posix.join(workspacePackage.directory, entry),
          pathToId,
        );
        if (result) {
          return result;
        }
      }
    }
  }

  return undefined;
}

export function resolveImports(
  files: Iterable<ResolvableFile>,
  config: ResolverConfig = {
    baseUrl: "",
    aliases: [],
    workspacePackages: [],
  },
): ResolvedImport[] {
  const fileList = [...files];
  const pathToId = new Map(
    fileList.map((file) => [normalizeRepoPath(file.path), file.id] as const),
  );
  const resolved = new Map<string, ResolvedImport>();

  for (const file of fileList) {
    for (const importReference of file.imports) {
      const targetId = resolveImportSpecifier(
        file.path,
        importReference.specifier,
        pathToId,
        config,
      );
      if (!targetId || targetId === file.id) {
        continue;
      }

      const key = `${file.id}\0${targetId}`;
      if (!resolved.has(key)) {
        resolved.set(key, {
          sourceId: file.id,
          targetId,
          specifier: importReference.specifier,
        });
      }
    }
  }

  return [...resolved.values()].sort((left, right) =>
    `${left.sourceId}:${left.targetId}`.localeCompare(
      `${right.sourceId}:${right.targetId}`,
    ),
  );
}
