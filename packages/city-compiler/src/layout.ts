import {
  CityEntitySchema,
  DistrictSchema,
  type CityEntity,
  type District,
  type DistrictLayout,
  type EntityRole,
  type Language,
  type MaxMetrics,
} from "../../schema/src/index.js";

export type CityBounds = DistrictLayout;

export interface EntitySource {
  id?: string;
  /**
   * A rename-chain identity supplied by the analyzer. When omitted, the oldest
   * alias is used, then the current path.
   */
  identityKey?: string;
  path: string;
  aliases?: readonly string[];
  name?: string;
  extension?: string;
  language?: Language;
  role?: EntityRole;
  districtId?: string;
  bornAt: number;
  diedAt?: number;
  maxMetrics: MaxMetrics;
}

export interface CompileCityInput {
  entities: readonly EntitySource[];
  bounds?: CityBounds;
  districtPadding?: number;
}

export interface CompiledCity {
  districts: District[];
  entities: CityEntity[];
  bounds: CityBounds;
}

interface WeightedRect {
  id: string;
  weight: number;
}

interface AreaRect extends WeightedRect {
  area: number;
}

const DISTRICT_COLORS = [
  "#5b8def",
  "#8b6cef",
  "#3fb7a3",
  "#e39b46",
  "#df6b78",
  "#53a65e",
  "#b06fd3",
  "#3f9cbd",
] as const;

const SPECIAL_SEGMENTS: Record<string, string> = {
  test: "tests",
  tests: "tests",
  __tests__: "tests",
  doc: "docs",
  docs: "docs",
  script: "scripts",
  scripts: "scripts",
  config: "config",
  configs: "config",
  ".config": "config",
};

export function normalizeRepoPath(path: string): string {
  const normalized = path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(`Path must be repository-relative: ${path}`);
  }
  return normalized;
}

function canonicalValue(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("stableStringify only accepts finite numbers");
      }
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
      return '"__undefined__"';
    case "bigint":
      return JSON.stringify(`${value.toString()}n`);
    case "object": {
      const object = value as object;
      if (ancestors.has(object)) {
        throw new TypeError("stableStringify cannot serialize cycles");
      }
      ancestors.add(object);
      let result: string;
      if (Array.isArray(value)) {
        result = `[${value
          .map((item) => canonicalValue(item, ancestors))
          .join(",")}]`;
      } else {
        const record = value as Record<string, unknown>;
        result = `{${Object.keys(record)
          .sort()
          .map(
            (key) =>
              `${JSON.stringify(key)}:${canonicalValue(record[key], ancestors)}`,
          )
          .join(",")}}`;
      }
      ancestors.delete(object);
      return result;
    }
    default:
      throw new TypeError(`Unsupported stableStringify value: ${typeof value}`);
  }
}

export function stableStringify(value: unknown): string {
  return canonicalValue(value, new Set());
}

/**
 * Browser-safe FNV-1a. Math.imul keeps all operations in an unsigned 32-bit
 * lane, avoiding engine-dependent floating-point overflow.
 */
export function stableHash(value: unknown): number {
  const text = typeof value === "string" ? value : stableStringify(value);
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function stableHashHex(value: unknown): string {
  const canonical = typeof value === "string" ? value : stableStringify(value);
  const first = stableHash(canonical);
  const second = stableHash(`repocity:${canonical}`);
  return `${first.toString(16).padStart(8, "0")}${second
    .toString(16)
    .padStart(8, "0")}`;
}

export function createEntityId(identityKey: string): string {
  return `entity_${stableHashHex(normalizeRepoPath(identityKey))}`;
}

function districtSlug(key: string): string {
  if (key === "core" || Object.values(SPECIAL_SEGMENTS).includes(key)) {
    return key;
  }
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findSpecialDistrict(segments: readonly string[]): string | undefined {
  for (const segment of segments.slice(0, -1)) {
    const special = SPECIAL_SEGMENTS[segment.toLowerCase()];
    if (special) {
      return special;
    }
  }
  const filename = segments.at(-1)?.toLowerCase() ?? "";
  if (
    /(?:^|[._-])(test|spec)\.[cm]?[jt]sx?$/.test(filename) ||
    filename === "vitest.config.ts" ||
    filename === "vite.config.ts" ||
    filename === "eslint.config.js"
  ) {
    return filename.includes("test") || filename.includes("spec")
      ? "tests"
      : "config";
  }
  return undefined;
}

export function assignDistricts(
  paths: readonly string[],
): Record<string, string> {
  const normalizedPaths = paths.map(normalizeRepoPath);
  const hasWorkspaceDistricts = normalizedPaths.some((path) => {
    const segments = path.split("/");
    return (
      (segments[0] === "apps" || segments[0] === "packages") &&
      segments.length >= 3
    );
  });
  const hasSrcDistricts =
    !hasWorkspaceDistricts &&
    normalizedPaths.some((path) => path.startsWith("src/"));

  return Object.fromEntries(
    normalizedPaths.map((path) => {
      const segments = path.split("/");
      let key: string;
      if (
        hasWorkspaceDistricts &&
        (segments[0] === "apps" || segments[0] === "packages") &&
        segments.length >= 3
      ) {
        key = `${segments[0]}/${segments[1]}`;
      } else {
        const special = findSpecialDistrict(segments);
        if (special) {
          key = special;
        } else if (
          hasSrcDistricts &&
          segments[0] === "src" &&
          segments.length >= 3
        ) {
          key = `src/${segments[1]}`;
        } else {
          key = "core";
        }
      }
      return [path, districtSlug(key)];
    }),
  );
}

function worstAspectRatio(row: readonly AreaRect[], side: number): number {
  if (row.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const sum = row.reduce((total, item) => total + item.area, 0);
  const largest = Math.max(...row.map((item) => item.area));
  const smallest = Math.min(...row.map((item) => item.area));
  const sideSquared = side * side;
  return Math.max(
    (sideSquared * largest) / (sum * sum),
    (sum * sum) / (sideSquared * smallest),
  );
}

function layoutTreemapRow(
  row: readonly AreaRect[],
  remaining: CityBounds,
  output: Map<string, DistrictLayout>,
): CityBounds {
  const area = row.reduce((sum, item) => sum + item.area, 0);
  if (remaining.width >= remaining.depth) {
    const stripWidth = area / remaining.depth;
    let cursor = remaining.z;
    for (const item of row) {
      const depth = item.area / stripWidth;
      output.set(item.id, {
        x: remaining.x,
        z: cursor,
        width: stripWidth,
        depth,
      });
      cursor += depth;
    }
    return {
      x: remaining.x + stripWidth,
      z: remaining.z,
      width: Math.max(0, remaining.width - stripWidth),
      depth: remaining.depth,
    };
  }

  const stripDepth = area / remaining.width;
  let cursor = remaining.x;
  for (const item of row) {
    const width = item.area / stripDepth;
    output.set(item.id, {
      x: cursor,
      z: remaining.z,
      width,
      depth: stripDepth,
    });
    cursor += width;
  }
  return {
    x: remaining.x,
    z: remaining.z + stripDepth,
    width: remaining.width,
    depth: Math.max(0, remaining.depth - stripDepth),
  };
}

/**
 * Deterministic Bruls-style squarified treemap. Items are sorted by weight and
 * stable ID first, so input traversal order cannot affect district rectangles.
 */
export function squarifiedTreemap(
  items: readonly WeightedRect[],
  bounds: CityBounds,
): Map<string, DistrictLayout> {
  if (
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.z) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.depth) ||
    bounds.width <= 0 ||
    bounds.depth <= 0
  ) {
    throw new RangeError("treemap bounds must have a positive finite area");
  }
  if (items.length === 0) {
    return new Map();
  }

  const sorted = [...items]
    .map((item) => ({ ...item, weight: Math.max(1, item.weight) }))
    .sort(
      (left, right) =>
        right.weight - left.weight ||
        stableHash(left.id) - stableHash(right.id) ||
        left.id.localeCompare(right.id),
    );
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const totalArea = bounds.width * bounds.depth;
  const pending: AreaRect[] = sorted.map((item) => ({
    ...item,
    area: (item.weight / totalWeight) * totalArea,
  }));

  const output = new Map<string, DistrictLayout>();
  let remaining = { ...bounds };
  let row: AreaRect[] = [];
  while (pending.length > 0) {
    const next = pending[0]!;
    const side = Math.max(
      Number.EPSILON,
      Math.min(remaining.width, remaining.depth),
    );
    if (
      row.length === 0 ||
      worstAspectRatio([...row, next], side) <= worstAspectRatio(row, side)
    ) {
      row.push(next);
      pending.shift();
    } else {
      remaining = layoutTreemapRow(row, remaining, output);
      row = [];
    }
  }
  if (row.length > 0) {
    layoutTreemapRow(row, remaining, output);
  }
  return output;
}

function extensionOf(path: string): string {
  const filename = path.split("/").at(-1)!;
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot).toLowerCase() : ".ts";
}

function languageOf(extension: string): Language {
  return extension === ".js" || extension === ".jsx"
    ? "javascript"
    : "typescript";
}

function roleOf(path: string): EntityRole {
  const segments = path.toLowerCase().split("/");
  const filename = segments.at(-1)!;
  if (
    findSpecialDistrict(segments) === "tests" ||
    /(?:^|[._-])(test|spec)\.[cm]?[jt]sx?$/.test(filename)
  ) {
    return "test";
  }
  if (segments.some((segment) => segment === "docs" || segment === "doc")) {
    return "docs";
  }
  if (
    segments.some(
      (segment) => segment === "config" || segment === "configs",
    ) ||
    filename.includes(".config.")
  ) {
    return "config";
  }
  if (
    segments.some(
      (segment) => segment === "script" || segment === "scripts",
    )
  ) {
    return "script";
  }
  return "source";
}

function districtName(id: string): string {
  const special: Record<string, string> = {
    core: "Core",
    tests: "Test Labs",
    docs: "Knowledge Quarter",
    scripts: "Automation Yard",
    config: "Utilities",
  };
  return (
    special[id] ??
    id
      .split("-")
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join(" ")
  );
}

function placeDistrictEntities(
  sources: readonly Omit<CityEntity, "layout">[],
  districtLayout: DistrictLayout,
  padding: number,
  globalMaxLoc: number,
): CityEntity[] {
  const ordered = [...sources].sort(
    (left, right) =>
      stableHash(left.id) - stableHash(right.id) ||
      left.id.localeCompare(right.id),
  );
  const safePadding = Math.min(
    padding,
    districtLayout.width * 0.18,
    districtLayout.depth * 0.18,
  );
  const innerWidth = Math.max(0.01, districtLayout.width - safePadding * 2);
  const innerDepth = Math.max(0.01, districtLayout.depth - safePadding * 2);
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt(ordered.length * (innerWidth / innerDepth))),
  );
  const rows = Math.max(1, Math.ceil(ordered.length / columns));
  const cellWidth = innerWidth / columns;
  const cellDepth = innerDepth / rows;
  const logMax = Math.max(1, Math.log1p(globalMaxLoc));

  return ordered.map((source, ordinal) => {
    const column = ordinal % columns;
    const row = Math.floor(ordinal / columns);
    const locRatio = Math.log1p(source.maxMetrics.loc) / logMax;
    const footprintRatio = 0.5 + locRatio * 0.34;
    const variant = stableHash(`${source.id}:style`) % 8;
    const rotationQuarter = stableHash(`${source.id}:rotation`) % 4;
    const widthBias = 0.88 + (stableHash(`${source.id}:width`) % 13) / 100;
    const depthBias = 0.88 + (stableHash(`${source.id}:depth`) % 13) / 100;

    return CityEntitySchema.parse({
      ...source,
      layout: {
        x:
          districtLayout.x +
          safePadding +
          column * cellWidth +
          cellWidth / 2,
        z:
          districtLayout.z +
          safePadding +
          row * cellDepth +
          cellDepth / 2,
        width: Math.max(0.05, cellWidth * footprintRatio * widthBias),
        depth: Math.max(0.05, cellDepth * footprintRatio * depthBias),
        maxHeight: 3.5 + locRatio * 25,
        rotationY: rotationQuarter * (Math.PI / 2),
        styleVariant: variant,
      },
    });
  });
}

export function compileCity(input: CompileCityInput): CompiledCity {
  const bounds = input.bounds ?? {
    x: -64,
    z: -44,
    width: 128,
    depth: 88,
  };
  if (input.entities.length === 0) {
    return { districts: [], entities: [], bounds };
  }
  const normalizedPaths = input.entities.map((entity) =>
    normalizeRepoPath(entity.path),
  );
  const assignedDistricts = assignDistricts(normalizedPaths);
  const seenIds = new Set<string>();

  const baseEntities: Array<Omit<CityEntity, "layout">> = input.entities.map(
    (source, index) => {
      const path = normalizedPaths[index]!;
      const aliases = [...new Set((source.aliases ?? []).map(normalizeRepoPath))]
        .filter((alias) => alias !== path)
        .sort();
      const id =
        source.id ??
        createEntityId(source.identityKey ?? aliases[0] ?? source.path);
      if (seenIds.has(id)) {
        throw new Error(`Duplicate entity identity: ${id}`);
      }
      seenIds.add(id);
      const extension = (source.extension ?? extensionOf(path)).toLowerCase();
      return {
        id,
        kind: "building",
        path,
        aliases,
        name: source.name ?? path.split("/").at(-1)!,
        extension,
        language: source.language ?? languageOf(extension),
        role: source.role ?? roleOf(path),
        districtId: source.districtId ?? assignedDistricts[path]!,
        bornAt: source.bornAt,
        diedAt: source.diedAt,
        maxMetrics: { ...source.maxMetrics },
      };
    },
  );

  const grouped = new Map<string, Array<Omit<CityEntity, "layout">>>();
  for (const entity of baseEntities) {
    const existing = grouped.get(entity.districtId) ?? [];
    existing.push(entity);
    grouped.set(entity.districtId, existing);
  }
  const weights = [...grouped.entries()].map(([id, entities]) => ({
    id,
    weight: entities.reduce(
      (sum, entity) => sum + Math.max(1, entity.maxMetrics.loc),
      0,
    ),
  }));
  const districtLayouts = squarifiedTreemap(weights, bounds);
  const globalMaxLoc = Math.max(
    1,
    ...baseEntities.map((entity) => entity.maxMetrics.loc),
  );
  const districtPadding = input.districtPadding ?? 1.4;

  const districts: District[] = weights
    .map(({ id, weight }) => {
      const entityIds = grouped
        .get(id)!
        .map((entity) => entity.id)
        .sort(
          (left, right) =>
            stableHash(left) - stableHash(right) || left.localeCompare(right),
        );
      return DistrictSchema.parse({
        id,
        name: districtName(id),
        entityIds,
        weight,
        color: DISTRICT_COLORS[stableHash(id) % DISTRICT_COLORS.length],
        layout: districtLayouts.get(id)!,
      });
    })
    .sort(
      (left, right) =>
        stableHash(left.id) - stableHash(right.id) ||
        left.id.localeCompare(right.id),
    );

  const entities = districts.flatMap((district) =>
    placeDistrictEntities(
      grouped.get(district.id)!,
      district.layout,
      districtPadding,
      globalMaxLoc,
    ),
  );

  return {
    districts,
    entities,
    bounds: { ...bounds },
  };
}
