import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { analyzeGitRepository } from "../src/index.js";

const exec = promisify(execFile);

async function git(repo: string, ...args: string[]): Promise<void> {
  await exec("git", ["-C", repo, ...args]);
}

test("reads history oldest-first and preserves identity across rename", async () => {
  const repo = await mkdtemp(join(tmpdir(), "repocity-git-test-"));
  await git(repo, "init", "-q");
  await git(repo, "config", "user.name", "RepoCity Test");
  await git(repo, "config", "user.email", "test@repocity.local");
  await mkdir(join(repo, "src"));
  await writeFile(
    join(repo, "src", "math.ts"),
    "export const add = (a: number, b: number) => a + b;\n",
  );
  await writeFile(
    join(repo, "src", "index.ts"),
    'export { add } from "./math.js";\n',
  );
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "add math");
  await git(repo, "mv", "src/math.ts", "src/arithmetic.ts");
  await writeFile(
    join(repo, "src", "index.ts"),
    'export { add } from "./arithmetic.js";\n',
  );
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "rename math");
  await git(repo, "tag", "v0.1.0");

  const result = await analyzeGitRepository(repo);
  const arithmetic = result.entities.find((entity) =>
    entity.aliases.includes("src/math.ts"),
  );

  assert.equal(result.commits.length, 2);
  assert.equal(result.commits[0]?.message, "add math");
  assert.deepEqual(result.commits[1]?.tags, ["v0.1.0"]);
  assert.ok(arithmetic);
  assert.equal(arithmetic.path, "src/arithmetic.ts");
  assert.deepEqual(arithmetic.aliases, ["src/math.ts"]);
  assert.equal(
    result.deltas[1]?.entityChanges.some(
      (change) => change.op === "rename" && change.entityId === arithmetic.id,
    ),
    true,
  );
  assert.equal(result.relations.length, 1);
  assert.equal(result.relations[0]?.bornAt, 0);
  assert.equal(result.relations[0]?.diedAt, undefined);
});

test("creates a new identity when a deleted path is later recreated", async () => {
  const repo = await mkdtemp(join(tmpdir(), "repocity-recreate-test-"));
  await git(repo, "init", "-q");
  await git(repo, "config", "user.name", "RepoCity Test");
  await git(repo, "config", "user.email", "test@repocity.local");
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src", "feature.ts"), "export const version = 1;\n");
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "add first feature");
  await git(repo, "rm", "-q", "src/feature.ts");
  await git(repo, "commit", "-qm", "remove first feature");
  await mkdir(join(repo, "src"), { recursive: true });
  await writeFile(
    join(repo, "src", "feature.ts"),
    "export function replacement(): string { return 'new'; }\n",
  );
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "add unrelated replacement");

  const result = await analyzeGitRepository(repo);
  const versions = result.entities.filter(
    (entity) => entity.path === "src/feature.ts",
  );

  assert.equal(versions.length, 2);
  assert.notEqual(versions[0]?.id, versions[1]?.id);
  assert.equal(versions.find((entity) => entity.bornAt === 0)?.diedAt, 1);
  assert.equal(versions.find((entity) => entity.bornAt === 2)?.diedAt, undefined);
  assert.equal(result.deltas[2]?.entityChanges[0]?.op, "spawn");
});
