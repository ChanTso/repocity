import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { defaultOutputDirectory, buildProject } from "./bundle.js";

const HELP = `RepoCity — turn a JavaScript/TypeScript Git history into a city

Usage:
  repocity build <local-path-or-public-git-url> --out <directory>

Options:
  -o, --out <directory>           Static bundle output directory
  --ignore <pattern>              Add a gitignore-style pattern (repeatable)
  --keyframe-interval <number>    Keyframe cadence (default: 50)
  --chapter-size <number>         Maximum commits per chapter (default: 12)
  --max-file-mb <number>          Per-file analysis limit (default: 4)
  -q, --quiet                     Hide progress output
  -h, --help                      Show this help
  -v, --version                   Show the CLI version

Examples:
  repocity build . --out ./public/projects/local
  repocity build https://github.com/owner/repo.git --out ./repo.repocity
`;

interface ParsedArguments {
  command?: string;
  input?: string;
  outDir?: string;
  ignorePatterns: string[];
  keyframeInterval?: number;
  chapterSize?: number;
  maxFileBytes?: number;
  quiet: boolean;
  help: boolean;
  version: boolean;
}

function positiveInteger(name: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function positiveNumber(name: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  const parsed: ParsedArguments = {
    ignorePatterns: [],
    quiet: false,
    help: false,
    version: false,
  };
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    switch (argument) {
      case "-h":
      case "--help":
        parsed.help = true;
        break;
      case "-v":
      case "--version":
        parsed.version = true;
        break;
      case "-q":
      case "--quiet":
        parsed.quiet = true;
        break;
      case "-o":
      case "--out": {
        const value = args[++index];
        if (!value) throw new Error(`${argument} requires a directory.`);
        parsed.outDir = value;
        break;
      }
      case "--ignore": {
        const value = args[++index];
        if (!value) throw new Error("--ignore requires a pattern.");
        parsed.ignorePatterns.push(value);
        break;
      }
      case "--keyframe-interval":
        parsed.keyframeInterval = positiveInteger(argument, args[++index]);
        break;
      case "--chapter-size":
        parsed.chapterSize = positiveInteger(argument, args[++index]);
        break;
      case "--max-file-mb":
        parsed.maxFileBytes = Math.floor(
          positiveNumber(argument, args[++index]) * 1024 * 1024,
        );
        break;
      default:
        if (argument.startsWith("-")) {
          throw new Error(`Unknown option: ${argument}`);
        }
        positional.push(argument);
    }
  }

  [parsed.command, parsed.input] = positional;
  if (positional.length > 2) {
    throw new Error(`Unexpected argument: ${positional[2]}`);
  }
  return parsed;
}

function progressLine(
  message: string,
  current: number | undefined,
  total: number | undefined,
): string {
  if (current === undefined || total === undefined) {
    return `  ${message}`;
  }
  return `  [${String(current).padStart(String(total).length, " ")}/${total}] ${message}`;
}

export async function run(args: readonly string[]): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArguments(args);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    console.error(HELP);
    return 2;
  }

  if (parsed.version) {
    console.log("repocity 0.1.0");
    return 0;
  }
  if (parsed.help || args.length === 0) {
    console.log(HELP);
    return 0;
  }
  if (parsed.command !== "build" || !parsed.input) {
    console.error("Error: expected `repocity build <repository>`.\n");
    console.error(HELP);
    return 2;
  }

  const outDir = parsed.outDir ?? defaultOutputDirectory(parsed.input);
  if (!parsed.quiet) {
    console.log(`\nRepoCity · ${parsed.input}`);
  }

  try {
    const result = await buildProject({
      input: parsed.input,
      outDir,
      ignorePatterns: parsed.ignorePatterns,
      ...(parsed.keyframeInterval
        ? { keyframeInterval: parsed.keyframeInterval }
        : {}),
      ...(parsed.chapterSize ? { chapterSize: parsed.chapterSize } : {}),
      ...(parsed.maxFileBytes ? { maxFileBytes: parsed.maxFileBytes } : {}),
      ...(!parsed.quiet
        ? {
            onProgress(progress: {
              message: string;
              current?: number;
              total?: number;
            }) {
              console.log(
                progressLine(progress.message, progress.current, progress.total),
              );
            },
          }
        : {}),
    });
    if (!parsed.quiet) {
      const { stats } = result.bundle.manifest;
      console.log(
        `\nBuilt ${stats.entityCount} buildings from ${stats.commitCount} commits.`,
      );
      console.log(`Output: ${result.outDir}`);
      if (result.warnings.length > 0) {
        console.warn(
          `${result.warnings.length} file${result.warnings.length === 1 ? "" : "s"} skipped:`,
        );
        for (const warning of result.warnings.slice(0, 10)) {
          console.warn(`  • ${warning}`);
        }
      }
    }
    return 0;
  } catch (error) {
    console.error(
      `\nBuild failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  process.exitCode = await run(args);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  await main();
}
