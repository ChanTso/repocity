/**
 * Shared, deterministic visual rules for the RepoCity scene.
 *
 * Keeping these rules outside of the React renderer makes replay seeking
 * predictable and gives the UI a single place from which to build its legend.
 */

export const CITY_BUILDING_ROLES = [
  "source",
  "test",
  "docs",
  "config",
  "script",
  "other",
] as const;

export type CityBuildingRole = (typeof CITY_BUILDING_ROLES)[number];

export interface CityRoleVisual {
  label: string;
  shortLabel: string;
  color: string;
  emissive: string;
  accent: string;
}

export const CITY_ROLE_VISUALS: Readonly<
  Record<CityBuildingRole, CityRoleVisual>
> = {
  source: {
    label: "Source",
    shortLabel: "SRC",
    color: "#55a99b",
    emissive: "#153d39",
    accent: "#7fe1cf",
  },
  test: {
    label: "Tests",
    shortLabel: "TST",
    color: "#d4a05f",
    emissive: "#432d16",
    accent: "#ffd18a",
  },
  docs: {
    label: "Docs",
    shortLabel: "DOC",
    color: "#7699c4",
    emissive: "#1b2f4d",
    accent: "#a9cbfa",
  },
  config: {
    label: "Config",
    shortLabel: "CFG",
    color: "#c97b6d",
    emissive: "#48211f",
    accent: "#f4aa9d",
  },
  script: {
    label: "Scripts",
    shortLabel: "RUN",
    color: "#9a7eb4",
    emissive: "#302341",
    accent: "#cdb1e6",
  },
  other: {
    label: "Other",
    shortLabel: "ETC",
    color: "#728594",
    emissive: "#202c35",
    accent: "#a8bac7",
  },
};

export const CITY_SCENE_COLORS = {
  background: "#071116",
  fog: "#071116",
  horizon: "#0b1a20",
  worldGround: "#09171b",
  districtGround: "#10282a",
  districtBorder: "#315457",
  districtLabel: "#a9c4bd",
  districtLabelMuted: "#68847f",
  selection: "#f6e4a8",
  hover: "#dff9ef",
  dependencyOut: "#6fe3d0",
  dependencyIn: "#f2b56f",
  shadow: "#020708",
} as const;

export interface CityVisualMetrics {
  loc: number;
  exports?: number;
  fanIn?: number;
  fanOut?: number;
}

export interface CityVisualEntity {
  id: string;
  kind?: "building";
  path: string;
  aliases?: readonly string[];
  name: string;
  extension?: string;
  language?: "typescript" | "javascript";
  role: CityBuildingRole;
  districtId: string;
  bornAt: number;
  diedAt?: number;
  summary?: string;
  maxMetrics: {
    loc: number;
    exports?: number;
    fanIn?: number;
    fanOut?: number;
    churn?: number;
  };
  currentMetrics?: CityVisualMetrics;
  layout: {
    x: number;
    z: number;
    width: number;
    depth: number;
    maxHeight: number;
    rotationY: number;
    styleVariant: number;
  };
}

export interface CityVisualRelation {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "import";
  bornAt: number;
  diedAt?: number;
  weight: number;
}

/**
 * An exact frame override supplied by a replay engine/keyframe.
 * `heightRatio` wins over `loc`; both are optional so callers can override
 * visibility without needing to duplicate metrics.
 */
export interface CityEntityFrameState {
  visible?: boolean;
  loc?: number;
  heightRatio?: number;
  modified?: boolean;
}

export interface ResolvedEntityVisualState {
  visible: boolean;
  heightRatio: number;
  height: number;
}

export interface CityBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  maxHeight: number;
  radius: number;
}

export interface CityDistrictInput {
  id: string;
  name?: string;
  label?: string;
  color?: string;
  entityCount?: number;
  x?: number;
  z?: number;
  width?: number;
  depth?: number;
  layout?: {
    x: number;
    z: number;
    width: number;
    depth: number;
  };
}

export interface ResolvedCityDistrict {
  id: string;
  name: string;
  color: string;
  entityCount: number;
  x: number;
  z: number;
  width: number;
  depth: number;
}

const DISTRICT_COLORS = [
  "#10282a",
  "#122630",
  "#16272b",
  "#18252d",
  "#102a27",
  "#19242a",
] as const;

export function normalizeCityRole(role: string): CityBuildingRole {
  return (CITY_BUILDING_ROLES as readonly string[]).includes(role)
    ? (role as CityBuildingRole)
    : "other";
}

export function stableCityHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function clampCityValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isEntityVisibleAtCommit(
  entity: Pick<CityVisualEntity, "bornAt" | "diedAt">,
  commitIndex?: number | null,
): boolean {
  if (commitIndex === undefined || commitIndex === null) {
    return entity.diedAt === undefined;
  }

  return (
    commitIndex >= entity.bornAt &&
    (entity.diedAt === undefined || commitIndex < entity.diedAt)
  );
}

export function isRelationVisibleAtCommit(
  relation: Pick<CityVisualRelation, "bornAt" | "diedAt">,
  commitIndex?: number | null,
): boolean {
  if (commitIndex === undefined || commitIndex === null) {
    return relation.diedAt === undefined;
  }

  return (
    commitIndex >= relation.bornAt &&
    (relation.diedAt === undefined || commitIndex < relation.diedAt)
  );
}

/**
 * Resolves replay visibility and height without making layout depend on time.
 *
 * Exact replay metrics are preferred. When a data bundle does not include
 * per-commit metrics, the deterministic fallback lets a new building establish
 * a small first storey and mature over its next few commits. This is a visual
 * approximation, not a code-quality score.
 */
export function resolveEntityVisualState(
  entity: CityVisualEntity,
  commitIndex?: number | null,
  frameState?: CityEntityFrameState,
): ResolvedEntityVisualState {
  const visible =
    frameState?.visible ??
    isEntityVisibleAtCommit(entity, commitIndex);
  const maxLoc = Math.max(1, entity.maxMetrics.loc);

  let heightRatio: number;
  if (frameState?.heightRatio !== undefined) {
    heightRatio = frameState.heightRatio;
  } else if (frameState?.loc !== undefined) {
    heightRatio = frameState.loc / maxLoc;
  } else if (
    (commitIndex === undefined || commitIndex === null) &&
    entity.currentMetrics
  ) {
    heightRatio = entity.currentMetrics.loc / maxLoc;
  } else if (commitIndex === undefined || commitIndex === null) {
    heightRatio = 1;
  } else {
    const age = Math.max(0, commitIndex - entity.bornAt);
    const growthTempo = 3.8 + (stableCityHash(entity.id) % 37) / 10;
    heightRatio = 0.3 + 0.7 * (1 - Math.exp(-age / growthTempo));
  }

  heightRatio = visible
    ? clampCityValue(heightRatio, 0.12, 1)
    : 0;

  return {
    visible,
    heightRatio,
    height: Math.max(0, entity.layout.maxHeight * heightRatio),
  };
}

export function getRoleBuildingColor(
  role: CityBuildingRole,
  styleVariant: number,
): string {
  const base = CITY_ROLE_VISUALS[normalizeCityRole(role)].color;
  const variation = ((Math.abs(styleVariant) % 5) - 2) * 0.035;
  return adjustHexLightness(base, variation);
}

export function calculateCityBounds(
  entities: readonly CityVisualEntity[],
): CityBounds {
  if (entities.length === 0) {
    return {
      minX: -10,
      maxX: 10,
      minZ: -8,
      maxZ: 8,
      centerX: 0,
      centerZ: 0,
      width: 20,
      depth: 16,
      maxHeight: 8,
      radius: 14,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let maxHeight = 1;

  for (const entity of entities) {
    const halfWidth = Math.max(0.1, entity.layout.width) / 2;
    const halfDepth = Math.max(0.1, entity.layout.depth) / 2;
    minX = Math.min(minX, entity.layout.x - halfWidth);
    maxX = Math.max(maxX, entity.layout.x + halfWidth);
    minZ = Math.min(minZ, entity.layout.z - halfDepth);
    maxZ = Math.max(maxZ, entity.layout.z + halfDepth);
    maxHeight = Math.max(maxHeight, entity.layout.maxHeight);
  }

  const width = Math.max(4, maxX - minX);
  const depth = Math.max(4, maxZ - minZ);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width,
    depth,
    maxHeight,
    radius: Math.max(8, Math.hypot(width, depth) / 2),
  };
}

export function resolveCityDistricts(
  entities: readonly CityVisualEntity[],
  districts?: readonly CityDistrictInput[],
): ResolvedCityDistrict[] {
  const entitiesByDistrict = new Map<string, CityVisualEntity[]>();
  for (const entity of entities) {
    const group = entitiesByDistrict.get(entity.districtId);
    if (group) group.push(entity);
    else entitiesByDistrict.set(entity.districtId, [entity]);
  }

  const supplied = new Map(districts?.map((district) => [district.id, district]));
  const districtIds = new Set<string>([
    ...entitiesByDistrict.keys(),
    ...(districts?.map((district) => district.id) ?? []),
  ]);

  return [...districtIds]
    .sort((left, right) => left.localeCompare(right))
    .map((id) => {
      const district = supplied.get(id);
      const group = entitiesByDistrict.get(id) ?? [];
      const explicitLayout = district?.layout;
      const explicitX = explicitLayout?.x ?? district?.x;
      const explicitZ = explicitLayout?.z ?? district?.z;
      const explicitWidth = explicitLayout?.width ?? district?.width;
      const explicitDepth = explicitLayout?.depth ?? district?.depth;
      const derived = boundsForDistrict(group);

      return {
        id,
        name: district?.label ?? district?.name ?? humanizeDistrictId(id),
        color:
          district?.color ??
          DISTRICT_COLORS[
            stableCityHash(id) % DISTRICT_COLORS.length
          ],
        entityCount: district?.entityCount ?? group.length,
        x: explicitX ?? derived.x,
        z: explicitZ ?? derived.z,
        width: Math.max(2, explicitWidth ?? derived.width),
        depth: Math.max(2, explicitDepth ?? derived.depth),
      };
    });
}

function boundsForDistrict(
  entities: readonly CityVisualEntity[],
): Pick<ResolvedCityDistrict, "x" | "z" | "width" | "depth"> {
  if (entities.length === 0) {
    return { x: 0, z: 0, width: 6, depth: 6 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const entity of entities) {
    minX = Math.min(
      minX,
      entity.layout.x - Math.max(0.1, entity.layout.width) / 2,
    );
    maxX = Math.max(
      maxX,
      entity.layout.x + Math.max(0.1, entity.layout.width) / 2,
    );
    minZ = Math.min(
      minZ,
      entity.layout.z - Math.max(0.1, entity.layout.depth) / 2,
    );
    maxZ = Math.max(
      maxZ,
      entity.layout.z + Math.max(0.1, entity.layout.depth) / 2,
    );
  }

  const padding = 1.7;
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    width: maxX - minX + padding * 2,
    depth: maxZ - minZ + padding * 2,
  };
}

function humanizeDistrictId(id: string): string {
  const segment = id.split("/").filter(Boolean).at(-1) ?? id;
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function adjustHexLightness(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex;

  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  );
  const target = amount >= 0 ? 255 : 0;
  const strength = Math.abs(amount);
  return `#${channels
    .map((channel) =>
      Math.round(channel + (target - channel) * strength)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
