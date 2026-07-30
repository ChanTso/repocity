import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import type {
  GitFileChange,
  PreparedRepository,
  RepositoryMetadata,
} from "./types.js";

const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

function describeGitError(error: unknown, args: readonly string[]): Error {
  if (error && typeof error === "object") {
    const value = error as { message?: string; stderr?: string; code?: unknown };
    const stderr = typeof value.stderr === "string" ? value.stderr.trim() : "";
    const detail = stderr || value.message || String(error);
    return new Error(`git ${args.join(" ")} failed: ${detail}`, { cause: error });
  }
  return new Error(`git ${args.join(" ")} failed: ${String(error)}`);
}

export function runGit(
  repoPath: string,
  args: readonly string[],
  maxBuffer = DEFAULT_MAX_BUFFER,
): Promise<string> {
  const commandArgs = ["-C", repoPath, ...args];
  return new Promise((resolveOutput, reject) => {
    execFile(
      "git",
      commandArgs,
      { encoding: "utf8", maxBuffer },
      (error, stdout) => {
        if (error) {
          reject(describeGitError(error, commandArgs));
          return;
        }
        resolveOutput(stdout);
      },
    );
  });
}

function runGitCommand(args: readonly string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(
      "git",
      [...args],
      { encoding: "utf8", maxBuffer: DEFAULT_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          reject(describeGitError(error, args));
          return;
        }
        resolveOutput(stdout);
      },
    );
  });
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function looksLikeRemote(input: string): boolean {
  return (
    /^(https?|ssh|git|file):\/\//i.test(input) ||
    /^[^/@\s]+@[^:\s]+:.+/.test(input)
  );
}

export async function prepareRepository(input: string): Promise<PreparedRepository> {
  if (!input || input.startsWith("-")) {
    throw new Error("Repository input must be a local path or a public Git URL.");
  }

  const localPath = resolve(input);
  if (await isDirectory(localPath)) {
    await runGit(localPath, ["rev-parse", "--git-dir"]);
    return {
      path: localPath,
      input,
      cloned: false,
      async cleanup() {},
    };
  }

  if (!looksLikeRemote(input)) {
    throw new Error(`Repository path does not exist: ${localPath}`);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "repocity-clone-"));
  const inferredName = basename(input.replace(/[/:]+$/, "")).replace(/\.git$/i, "");
  const clonePath = join(temporaryRoot, inferredName || "repo");
  try {
    await runGitCommand(["clone", "--quiet", "--", input, clonePath]);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    path: clonePath,
    input,
    cloned: true,
    async cleanup() {
      await rm(temporaryRoot, { recursive: true, force: true });
    },
  };
}

async function optionalGit(repoPath: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const output = (await runGit(repoPath, args)).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

export async function readRepositoryMetadata(
  repoPath: string,
): Promise<RepositoryMetadata> {
  const [headSha, branch, remoteUrl, root] = await Promise.all([
    runGit(repoPath, ["rev-parse", "HEAD"]).then((value) => value.trim()),
    optionalGit(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
    optionalGit(repoPath, ["remote", "get-url", "origin"]),
    runGit(repoPath, ["rev-parse", "--show-toplevel"]).then((value) => value.trim()),
  ]);

  return {
    name: basename(root).replace(/\.git$/i, ""),
    path: root,
    ...(remoteUrl ? { remoteUrl } : {}),
    defaultBranch: branch ?? "HEAD",
    headSha,
  };
}

export interface RawCommit {
  sha: string;
  parents: string[];
  authorName: string;
  authoredAt: string;
  message: string;
  tags: string[];
}

async function readTags(repoPath: string): Promise<Map<string, string[]>> {
  const output = await runGit(repoPath, [
    "for-each-ref",
    "--format=%(refname:short)%00%(objectname)%00%(*objectname)%00",
    "refs/tags",
  ]);
  const tokens = output.split("\0");
  const tagsByCommit = new Map<string, string[]>();

  for (let index = 0; index + 2 < tokens.length; index += 3) {
    const name = tokens[index]!.replace(/^\n+/, "").trim();
    const objectSha = tokens[index + 1]!.trim();
    const peeledSha = tokens[index + 2]!.trim();
    if (!name || !objectSha) {
      continue;
    }
    const commitSha = peeledSha || objectSha;
    const tags = tagsByCommit.get(commitSha) ?? [];
    tags.push(name);
    tagsByCommit.set(commitSha, tags);
  }

  for (const tags of tagsByCommit.values()) {
    tags.sort((left, right) => left.localeCompare(right));
  }
  return tagsByCommit;
}

export async function readCommitHistory(repoPath: string): Promise<RawCommit[]> {
  const [logOutput, tagsByCommit] = await Promise.all([
    runGit(repoPath, [
      "log",
      "--reverse",
      "--topo-order",
      "--date=iso-strict",
      "--format=%H%x1f%P%x1f%an%x1f%aI%x1f%B%x1e",
      "HEAD",
    ]),
    readTags(repoPath),
  ]);

  return logOutput
    .split("\x1e")
    .map((record) => record.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((record) => {
      const [sha = "", parents = "", authorName = "", authoredAt = "", message = ""] =
        record.split("\x1f");
      return {
        sha,
        parents: parents ? parents.split(" ") : [],
        authorName,
        authoredAt,
        message: message.trimEnd(),
        tags: tagsByCommit.get(sha) ?? [],
      };
    });
}

interface RawStatusChange {
  code: string;
  path: string;
  oldPath?: string;
  similarity?: number;
}

function parseNameStatus(output: string): RawStatusChange[] {
  const tokens = output.split("\0");
  const changes: RawStatusChange[] = [];

  for (let index = 0; index < tokens.length; ) {
    const code = tokens[index++]?.trim();
    if (!code) {
      continue;
    }

    if (code.startsWith("R") || code.startsWith("C")) {
      const oldPath = tokens[index++] ?? "";
      const path = tokens[index++] ?? "";
      if (oldPath && path) {
        changes.push({
          code,
          oldPath,
          path,
          similarity: Number.parseInt(code.slice(1), 10) || 0,
        });
      }
    } else {
      const path = tokens[index++] ?? "";
      if (path) {
        changes.push({ code, path });
      }
    }
  }

  return changes;
}

function numericStat(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const tokens = output.split("\0");
  const stats = new Map<string, { additions: number; deletions: number }>();

  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index++];
    if (!token) {
      continue;
    }
    const [additionsValue = "0", deletionsValue = "0", inlinePath = ""] =
      token.split("\t");
    const additions = numericStat(additionsValue);
    const deletions = numericStat(deletionsValue);
    if (inlinePath) {
      stats.set(inlinePath, { additions, deletions });
    } else {
      index += 1; // old rename/copy path
      const newPath = tokens[index++] ?? "";
      if (newPath) {
        stats.set(newPath, { additions, deletions });
      }
    }
  }

  return stats;
}

function diffArguments(
  commitSha: string,
  firstParent: string | undefined,
  mode: "name-status" | "numstat",
): string[] {
  const formatFlag = mode === "name-status" ? "--name-status" : "--numstat";
  if (firstParent) {
    return ["diff", formatFlag, "-z", "-M50%", firstParent, commitSha, "--"];
  }
  return [
    "diff-tree",
    "--root",
    "--no-commit-id",
    formatFlag,
    "-r",
    "-M50%",
    "-z",
    commitSha,
    "--",
  ];
}

function changeStatus(code: string): GitFileChange["status"] {
  if (code.startsWith("A")) return "add";
  if (code.startsWith("D")) return "delete";
  if (code.startsWith("R")) return "rename";
  if (code.startsWith("C")) return "copy";
  return "modify";
}

export async function readCommitChanges(
  repoPath: string,
  commitSha: string,
  firstParent?: string,
): Promise<GitFileChange[]> {
  const [statusOutput, numstatOutput] = await Promise.all([
    runGit(repoPath, diffArguments(commitSha, firstParent, "name-status")),
    runGit(repoPath, diffArguments(commitSha, firstParent, "numstat")),
  ]);
  const stats = parseNumstat(numstatOutput);

  return parseNameStatus(statusOutput).map((change) => {
    const values = stats.get(change.path) ?? { additions: 0, deletions: 0 };
    return {
      status: changeStatus(change.code),
      path: change.path,
      ...(change.oldPath ? { oldPath: change.oldPath } : {}),
      ...(change.similarity !== undefined ? { similarity: change.similarity } : {}),
      ...values,
    };
  });
}

export async function readFileAtCommit(
  repoPath: string,
  commitSha: string,
  filePath: string,
  maxBuffer: number,
): Promise<string> {
  return runGit(repoPath, ["show", `${commitSha}:${filePath}`], maxBuffer);
}
