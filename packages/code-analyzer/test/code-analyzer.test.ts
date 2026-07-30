import assert from "node:assert/strict";
import test from "node:test";

import {
  IgnoreMatcher,
  analyzeSource,
  resolveImports,
  shouldAnalyzePath,
} from "../src/index.js";

test("analyzes JS/TS metrics, imports, exports, and roles", () => {
  const analysis = analyzeSource(
    "src/math.ts",
    `
      import type { Config } from "@/config";
      export { clamp } from "./clamp";
      export const sum = (a: number, b: number) => a + b;
      export default function average(values: number[]) {
        return values.reduce(sum, 0) / values.length;
      }
    `,
  );

  assert.equal(analysis.language, "typescript");
  assert.equal(analysis.role, "source");
  assert.deepEqual(analysis.exportNames, ["clamp", "default", "sum"]);
  assert.equal(analysis.loc, 6);
  assert.deepEqual(
    analysis.imports.map(({ specifier }) => specifier),
    ["./clamp", "@/config"],
  );
});

test("applies defaults and ordered gitignore negations", () => {
  const matcher = new IgnoreMatcher(["generated/", "!generated/keep.ts"]);

  assert.equal(shouldAnalyzePath("node_modules/a.ts", matcher), false);
  assert.equal(shouldAnalyzePath("generated/drop.ts", matcher), false);
  assert.equal(shouldAnalyzePath("generated/keep.ts", matcher), true);
  assert.equal(shouldAnalyzePath("src/image.png", matcher), false);
});

test("resolves relative files, directory indexes, and tsconfig aliases", () => {
  const files = [
    {
      id: "entry",
      path: "src/index.ts",
      imports: [
        { kind: "import" as const, specifier: "./utils.js" },
        { kind: "import" as const, specifier: "@/feature" },
      ],
    },
    { id: "utils", path: "src/utils.ts", imports: [] },
    { id: "feature", path: "src/feature/index.ts", imports: [] },
  ];

  const relations = resolveImports(files, {
    baseUrl: "",
    aliases: [{ pattern: "@/*", targets: ["src/*"] }],
    workspacePackages: [],
  });

  assert.deepEqual(
    relations.map(({ sourceId, targetId }) => [sourceId, targetId]),
    [
      ["entry", "feature"],
      ["entry", "utils"],
    ],
  );
});
