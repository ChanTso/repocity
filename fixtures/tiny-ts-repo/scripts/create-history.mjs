#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);

const commits = [
  {
    message: "feat: plant the city foundations",
    files: {
      "package.json": `${JSON.stringify(
        {
          name: "@repocity/tiny-fixture",
          version: "0.1.0",
          private: true,
          type: "module",
        },
        null,
        2,
      )}\n`,
      "tsconfig.json": `${JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: { "@core/*": ["src/core/*"] },
            strict: true,
          },
          include: ["src", "tests"],
        },
        null,
        2,
      )}\n`,
      ".gitignore": "node_modules/\ndist/\ngenerated/\n",
      "src/core/math.ts":
        "export const add = (left: number, right: number): number => left + right;\n\n" +
        "export const multiply = (left: number, right: number): number => left * right;\n",
      "src/index.ts":
        'import { add, multiply } from "@core/math";\n\n' +
        "export function cityTotal(blocks: number, floors: number): number {\n" +
        "  return add(multiply(blocks, floors), 1);\n" +
        "}\n",
    },
  },
  {
    message: "test: inspect the arithmetic district",
    files: {
      "tests/math.test.ts":
        'import assert from "node:assert/strict";\n' +
        'import test from "node:test";\n\n' +
        'import { add, multiply } from "../src/core/math.js";\n\n' +
        'test("math helpers", () => {\n' +
        "  assert.equal(add(2, 3), 5);\n" +
        "  assert.equal(multiply(4, 5), 20);\n" +
        "});\n",
    },
    tag: "v0.1.0",
  },
  {
    message: "refactor: rename math to arithmetic",
    rename: [["src/core/math.ts", "src/core/arithmetic.ts"]],
    files: {
      "src/index.ts":
        'import { add, multiply } from "@core/arithmetic";\n\n' +
        "export function cityTotal(blocks: number, floors: number): number {\n" +
        "  return add(multiply(blocks, floors), 1);\n" +
        "}\n",
      "tests/arithmetic.test.ts":
        'import assert from "node:assert/strict";\n' +
        'import test from "node:test";\n\n' +
        'import { add, multiply } from "../src/core/arithmetic.js";\n\n' +
        'test("arithmetic helpers", () => {\n' +
        "  assert.equal(add(2, 3), 5);\n" +
        "  assert.equal(multiply(4, 5), 20);\n" +
        "});\n",
    },
    remove: ["tests/math.test.ts"],
  },
  {
    message: "feat: add formatting and a temporary legacy bridge",
    files: {
      "src/core/format.ts":
        "export function formatTotal(total: number): string {\n" +
        "  return `Total: ${total}`;\n" +
        "}\n",
      "src/legacy.ts": 'export { add as legacyAdd } from "./core/arithmetic.js";\n',
      "src/index.ts":
        'import { add, multiply } from "@core/arithmetic";\n' +
        'import { formatTotal } from "@core/format";\n\n' +
        "export function cityTotal(blocks: number, floors: number): string {\n" +
        "  return formatTotal(add(multiply(blocks, floors), 1));\n" +
        "}\n",
    },
  },
  {
    message: "chore: demolish the legacy bridge",
    files: {
      "package.json": `${JSON.stringify(
        {
          name: "@repocity/tiny-fixture",
          version: "0.2.0",
          private: true,
          type: "module",
          scripts: { test: "node --test" },
        },
        null,
        2,
      )}\n`,
      "generated/ignored.ts":
        "// The fixture .gitignore intentionally excludes this generated file.\n" +
        "export const generated = true;\n",
    },
    remove: ["src/legacy.ts"],
    tag: "v0.2.0",
  },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function git(root, args, date) {
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
  await exec("git", ["-C", root, ...args], { env });
}

export async function createTinyRepo(requestedTarget) {
  let target;
  if (requestedTarget) {
    target = resolve(requestedTarget);
    if (await exists(target)) {
      const entries = await readdir(target);
      if (entries.length > 0) {
        throw new Error(`Target directory is not empty: ${target}`);
      }
    } else {
      await mkdir(target, { recursive: true });
    }
  } else {
    target = await mkdtemp(join(tmpdir(), "repocity-tiny-"));
  }

  await git(target, ["init", "-q", "-b", "main"], "2025-01-01T09:00:00Z");
  await git(target, ["config", "user.name", "RepoCity Fixture"], "2025-01-01T09:00:00Z");
  await git(
    target,
    ["config", "user.email", "fixture@repocity.local"],
    "2025-01-01T09:00:00Z",
  );

  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    const date = `2025-01-${String(index + 1).padStart(2, "0")}T09:00:00Z`;

    for (const [before, after] of commit.rename ?? []) {
      await mkdir(dirname(join(target, after)), { recursive: true });
      await git(target, ["mv", before, after], date);
    }
    for (const [path, contents] of Object.entries(commit.files ?? {})) {
      const destination = join(target, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contents, "utf8");
    }
    for (const path of commit.remove ?? []) {
      await git(target, ["rm", "-q", "--", path], date);
    }

    await git(target, ["add", "-A"], date);
    await git(target, ["commit", "-qm", commit.message], date);
    if (commit.tag) {
      await git(target, ["tag", commit.tag], date);
    }
  }

  return target;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    console.log(await createTinyRepo(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
