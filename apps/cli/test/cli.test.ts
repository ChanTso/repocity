import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { validateRepoCityBundle } from "../../../packages/schema/src/index.js";
import { buildProject, defaultOutputDirectory } from "../src/bundle.js";
import { parseArguments } from "../src/cli.js";

const exec = promisify(execFile);

async function git(repo: string, ...args: string[]): Promise<void> {
  await exec("git", ["-C", repo, ...args]);
}

async function createRepository(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "repocity-cli-repo-"));
  await git(repo, "init", "-q");
  await git(repo, "config", "user.name", "RepoCity Test");
  await git(repo, "config", "user.email", "test@repocity.local");
  await mkdir(join(repo, "src"));
  await writeFile(
    join(repo, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
  );
  await writeFile(
    join(repo, "src", "greeting.ts"),
    'export const greeting = "Hello, city!";\n',
  );
  await writeFile(
    join(repo, "src", "index.ts"),
    'export { greeting } from "@/greeting";\n',
  );
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "plant foundations");
  await git(repo, "tag", "v0.1.0");
  return repo;
}

test("parses build command options", () => {
  assert.deepEqual(
    parseArguments([
      "build",
      ".",
      "--out",
      "./city",
      "--ignore",
      "generated/",
      "--keyframe-interval",
      "25",
    ]),
    {
      command: "build",
      input: ".",
      outDir: "./city",
      ignorePatterns: ["generated/"],
      keyframeInterval: 25,
      quiet: false,
      help: false,
      version: false,
    },
  );
  assert.equal(
    defaultOutputDirectory("."),
    join(process.cwd(), `${basename(process.cwd())}.repocity`),
  );
});

test("builds and validates a complete static bundle", async () => {
  const repo = await createRepository();
  const outDir = await mkdtemp(join(tmpdir(), "repocity-cli-output-"));
  const result = await buildProject({ input: repo, outDir });

  assert.equal(result.bundle.entities.length, 2);
  assert.equal(result.bundle.relations.length, 1);
  assert.deepEqual(result.bundle.commits[0]?.tags, ["v0.1.0"]);
  assert.doesNotThrow(() => validateRepoCityBundle(result.bundle));

  const manifest = JSON.parse(
    await readFile(join(outDir, "manifest.json"), "utf8"),
  ) as { schemaVersion: string };
  const deltas = await readFile(join(outDir, "deltas.ndjson"), "utf8");
  assert.equal(manifest.schemaVersion, "0.1");
  assert.equal(deltas.trim().split("\n").length, 1);
});
