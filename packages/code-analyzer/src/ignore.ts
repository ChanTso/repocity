import { extname, posix } from "node:path";

import {
  SOURCE_EXTENSIONS,
  type IgnoreRule,
  type SourceExtension,
} from "./types.js";

export const DEFAULT_IGNORE_PATTERNS = [
  ".git/",
  ".hg/",
  ".svn/",
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  ".turbo/",
  ".cache/",
  ".parcel-cache/",
  ".vite/",
  ".wrangler/",
  "tmp/",
  "temp/",
  "*.min.js",
  "*.min.jsx",
  "*.bundle.js",
  "*.generated.js",
  "*.generated.ts",
  "*.generated.tsx",
] as const;

export function normalizeRepoPath(filePath: string): string {
  return posix
    .normalize(filePath.replaceAll("\\", "/").replace(/^\.\/+/, ""))
    .replace(/^\/+/, "");
}

function globFragment(pattern: string): string {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;

    if (character === "*") {
      if (pattern[index + 1] === "*") {
        while (pattern[index + 1] === "*") {
          index += 1;
        }
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (character === "?") {
      source += "[^/]";
      continue;
    }

    if ("\\^$+?.()|{}[]".includes(character)) {
      source += `\\${character}`;
    } else {
      source += character;
    }
  }

  return source;
}

export function compileIgnoreRule(rawRule: string): IgnoreRule | null {
  let value = rawRule.trim();
  if (!value || value.startsWith("#")) {
    return null;
  }

  let negated = false;
  if (value.startsWith("!")) {
    negated = true;
    value = value.slice(1);
  }

  if (value.startsWith("\\#") || value.startsWith("\\!")) {
    value = value.slice(1);
  }

  const directoryOnly = value.endsWith("/");
  if (directoryOnly) {
    value = value.slice(0, -1);
  }

  const anchored = value.startsWith("/");
  if (anchored) {
    value = value.slice(1);
  }

  if (!value) {
    return null;
  }

  const hasSlash = value.includes("/");
  const fragment = globFragment(value);
  const prefix = anchored || hasSlash ? "^" : "(?:^|/)";
  const suffix = directoryOnly || !hasSlash ? "(?:/.*)?$" : "(?:/.*)?$";

  return {
    pattern: value,
    negated,
    regex: new RegExp(`${prefix}${fragment}${suffix}`),
  };
}

export class IgnoreMatcher {
  readonly rules: IgnoreRule[];

  constructor(patterns: readonly string[] = []) {
    this.rules = [...DEFAULT_IGNORE_PATTERNS, ...patterns]
      .map(compileIgnoreRule)
      .filter((rule): rule is IgnoreRule => rule !== null);
  }

  ignores(filePath: string): boolean {
    const normalizedPath = normalizeRepoPath(filePath);
    let ignored = false;

    for (const rule of this.rules) {
      if (rule.regex.test(normalizedPath)) {
        ignored = !rule.negated;
      }
    }

    return ignored;
  }
}

export function parseIgnoreFile(contents: string): string[] {
  return contents.split(/\r?\n/);
}

export function isSourceFile(filePath: string): filePath is `${string}${SourceExtension}` {
  return SOURCE_EXTENSIONS.includes(extname(normalizeRepoPath(filePath)) as SourceExtension);
}

export function shouldAnalyzePath(
  filePath: string,
  matcher: IgnoreMatcher = new IgnoreMatcher(),
): boolean {
  return isSourceFile(filePath) && !matcher.ignores(filePath);
}
