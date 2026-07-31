import type {
  DemoEntity,
  DemoRelation,
  ProjectBoundaryFact,
} from "./demo-data";
import type {
  CityBounds,
  CityPoint,
  LivingCityPlan,
  PlannedBuilding,
  PlannedDistrict,
} from "./living-city";

/**
 * A renderer-independent, component-first projection over the file-level
 * repository facts.
 *
 * File entities remain the canonical facts used by replay and inspectors.
 * This model only gives those facts stable semantic addresses inside a much
 * smaller set of component campuses.
 */

/**
 * Kept aligned with the component-first Semantic Metropolis contract. This is
 * independent of the canonical repository bundle schema, which remains 0.1.
 */
export const SEMANTIC_CITY_VERSION = "0.4" as const;
export const SEMANTIC_ACCESS_CLEARANCE = 1.15;

export type SemanticComponentKind =
  | "gateway"
  | "civic"
  | "factory"
  | "station"
  | "port"
  | "laboratory"
  | "library"
  | "operations"
  | "mixed-use";

export type SemanticRoadClass = "local" | "collector" | "arterial";
export type SemanticTransportMode =
  | "car"
  | "pedestrian"
  | "freight"
  | "transit"
  | "boat";
export type SemanticModeHint =
  | "local"
  | "sync"
  | "pipeline"
  | "artifact";

export interface SemanticEvidence {
  entityIds: string[];
  relationIds: string[];
  boundaryFactIds?: string[];
  provenance?: ProjectBoundaryFact["provenance"];
  reason: string;
}

export interface SemanticComponentMetrics {
  files: number;
  loc: number;
  exports: number;
  fanIn: number;
  fanOut: number;
  churn: number;
  internalRelationWeight: number;
  externalRelationWeight: number;
}

export interface SemanticComponentCluster {
  strategy: "district" | "path-fallback" | "district-overflow";
  key: string;
  parentDistrictIds: string[];
  /**
   * Reserved for the dependency-community phase. The first delivery groups at
   * workspace/district level and only uses deterministic path fallback to keep
   * a single-workspace city legible.
   */
  childClusterKeys: string[];
}

export interface SemanticComponent {
  id: string;
  label: string;
  districtId: string;
  districtIds: string[];
  architectureKind: SemanticComponentKind;
  anchorEntityId: string;
  entityIds: string[];
  campusId: string;
  metrics: SemanticComponentMetrics;
  cluster: SemanticComponentCluster;
  evidence: SemanticEvidence;
}

export interface SemanticFileSlot extends CityPoint {
  id: string;
  entityId: string;
  componentId: string;
  localX: number;
  localZ: number;
  width: number;
  depth: number;
  /**
   * The V2 building point remains available while FlowJourneyLayer still
   * resolves steps through LivingCityPlan.buildings.
   */
  legacyPoint: CityPoint;
}

export interface SemanticCampus extends CityPoint {
  id: string;
  componentId: string;
  districtId: string;
  label: string;
  kind: SemanticComponentKind;
  width: number;
  depth: number;
  height: number;
  color: string;
  orientation: number;
  active: boolean;
  anchorEntityId: string;
  entityIds: string[];
  evidence: SemanticEvidence;
  fileSlots: SemanticFileSlot[];
}

export type SemanticPortEdge = "north" | "east" | "south" | "west";

export interface SemanticCorridorPort extends CityPoint {
  id: string;
  componentId: string;
  campusId: string;
  edge: SemanticPortEdge;
  kind: "frontage" | "artifact-quay";
  boundaryFactIds: string[];
}

export interface SemanticEntityAddress {
  entityId: string;
  districtId: string;
  componentId: string;
  campusId: string;
  fileSlotId: string;
  worldPoint: CityPoint;
  legacyWorldPoint: CityPoint;
}

export interface SemanticCorridor {
  id: string;
  basis: "static-import" | "declared-boundary" | "component-access";
  sourceComponentId: string;
  targetComponentId: string;
  scope: "campus" | "city";
  roadClass: SemanticRoadClass;
  /**
   * Four or more stable X/Z points, directly consumable by Catmull-Rom or a
   * polyline fallback.
   */
  points: CityPoint[];
  weight: number;
  relationIds: string[];
  boundaryFactIds: string[];
  waterCrossing: boolean;
  modeHint: SemanticModeHint;
  sourcePort: SemanticCorridorPort;
  targetPort: SemanticCorridorPort;
  evidence: SemanticEvidence;
}

export interface SemanticRoad {
  id: string;
  corridorIds: string[];
  centerline: CityPoint[];
  width: number;
  lanes: number;
  level: "ground" | "elevated";
  surface: "ground" | "bridge";
  roadClass: SemanticRoadClass;
  evidenceRelationIds: string[];
}

export interface SemanticMobilityRoute {
  id: string;
  mode: SemanticTransportMode;
  points: CityPoint[];
  weight: number;
  componentIds: string[];
  evidenceRelationIds: string[];
}

export interface SemanticCoastline {
  side: "west" | "east";
  points: CityPoint[];
}

export interface SemanticWaterBoundary {
  id: string;
  riverId: string;
  outline: CityPoint[];
  coastlines: SemanticCoastline[];
  crossingCorridorIds: string[];
  relationIds: string[];
  boundaryFactIds: string[];
  evidence: SemanticEvidence;
}

export interface SemanticTerrain {
  bounds: CityBounds;
  waterBoundaries: SemanticWaterBoundary[];
}

export interface SemanticCityPlan {
  version: typeof SEMANTIC_CITY_VERSION;
  seed: string;
  bounds: CityBounds;
  terrain: SemanticTerrain;
  components: SemanticComponent[];
  campuses: SemanticCampus[];
  corridors: SemanticCorridor[];
  roads: SemanticRoad[];
  mobility: {
    routes: SemanticMobilityRoute[];
  };
  entityAddresses: Record<string, SemanticEntityAddress>;
  relationCorridorIds: Record<string, string>;
}

export interface PlanSemanticCityInput {
  cityPlan: LivingCityPlan;
  entities: readonly DemoEntity[];
  relations: readonly DemoRelation[];
  /**
   * Water and artifact ports are never inferred from filenames or import
   * direction. They require a declared, typed fact with exact entity IDs.
   */
  boundaryFacts?: readonly ProjectBoundaryFact[];
  /**
   * Component-level L0 remains intentionally bounded. Defaults match the first
   * vertical slice and are clamped to 1...30 for test fixtures.
   */
  minimumComponents?: number;
  maximumComponents?: number;
}

interface ComponentGroup {
  key: string;
  strategy: SemanticComponentCluster["strategy"];
  districtIds: string[];
  entities: DemoEntity[];
}

interface CampusDraft {
  component: SemanticComponent;
  district: PlannedDistrict | undefined;
  x: number;
  z: number;
  width: number;
  depth: number;
}

interface WaterfrontComponentPair {
  id: string;
  sourceComponentId: string;
  targetComponentId: string;
  sourceBank: "west" | "east";
  targetBank: "west" | "east";
}

type SemanticRiver = NonNullable<LivingCityPlan["geography"]["river"]>;

interface CorridorDraft {
  id: string;
  basis: SemanticCorridor["basis"];
  sourceComponentId: string;
  targetComponentId: string;
  relationIds: string[];
  boundaryFactIds: string[];
  relations: DemoRelation[];
  weight: number;
}

interface ValidatedBoundaryFact {
  fact: ProjectBoundaryFact;
  relation: DemoRelation | undefined;
}

const ENTRY_PATTERN =
  /(?:^|\/)(?:index|main|entry|cli|server|router|route|public-api)\.[^/]+$/i;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${stableHash(value).toString(16).padStart(8, "0")}`;
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  const result = Math.round(value * scale) / scale;
  return Object.is(result, -0) ? 0 : result;
}

function point(x: number, z: number): CityPoint {
  return { x: round(x), z: round(z) };
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value! : 0;
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(value!)));
}

function cloneBounds(bounds: CityBounds): CityBounds {
  return {
    x: bounds.x,
    z: bounds.z,
    width: bounds.width,
    depth: bounds.depth,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
  };
}

function groupOrder(left: ComponentGroup, right: ComponentGroup): number {
  return compareText(left.key, right.key);
}

function makeDistrictGroups(
  entities: readonly DemoEntity[],
): ComponentGroup[] {
  const grouped = new Map<string, DemoEntity[]>();
  for (const entity of [...entities].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const districtId = entity.districtId || "unassigned";
    const group = grouped.get(districtId) ?? [];
    group.push(entity);
    grouped.set(districtId, group);
  }

  return [...grouped.entries()]
    .map(([districtId, group]) => ({
      key: `district:${districtId}`,
      strategy: "district" as const,
      districtIds: [districtId],
      entities: group,
    }))
    .sort(groupOrder);
}

function commonDirectoryDepth(entities: readonly DemoEntity[]): number {
  if (entities.length === 0) return 0;
  const directories = entities.map((entity) =>
    entity.path.split("/").slice(0, -1),
  );
  const shortest = Math.min(...directories.map((segments) => segments.length));
  let depth = 0;
  while (
    depth < shortest &&
    directories.every((segments) => segments[depth] === directories[0]![depth])
  ) {
    depth += 1;
  }
  return depth;
}

function splitGroup(group: ComponentGroup): [ComponentGroup, ComponentGroup] | null {
  if (group.entities.length < 4) return null;
  const depth = commonDirectoryDepth(group.entities);
  const byRoot = new Map<string, DemoEntity[]>();
  for (const entity of group.entities) {
    const segments = entity.path.split("/");
    const root = segments[depth] ?? "__root__";
    const members = byRoot.get(root) ?? [];
    members.push(entity);
    byRoot.set(root, members);
  }

  const roots = [...byRoot.entries()].sort(([left], [right]) =>
    compareText(left, right),
  );
  let firstEntities: DemoEntity[] = [];
  let secondEntities: DemoEntity[] = [];
  let firstKey = "a";
  let secondKey = "b";

  if (roots.length >= 2) {
    const halves: [Array<[string, DemoEntity[]]>, Array<[string, DemoEntity[]]>] =
      [[], []];
    const totals = [0, 0];
    for (const entry of [...roots].sort(
      (left, right) =>
        right[1].length - left[1].length ||
        compareText(left[0], right[0]),
    )) {
      const target = totals[0]! <= totals[1]! ? 0 : 1;
      halves[target]!.push(entry);
      totals[target]! += entry[1].length;
    }
    firstEntities = halves[0]!.flatMap(([, members]) => members);
    secondEntities = halves[1]!.flatMap(([, members]) => members);
    firstKey = halves[0]!
      .map(([root]) => root)
      .sort(compareText)
      .join("+");
    secondKey = halves[1]!
      .map(([root]) => root)
      .sort(compareText)
      .join("+");
  }

  if (firstEntities.length < 2 || secondEntities.length < 2) {
    const ordered = [...group.entities].sort(
      (left, right) =>
        stableHash(left.id) - stableHash(right.id) ||
        compareText(left.id, right.id),
    );
    const pivot = Math.floor(ordered.length / 2);
    firstEntities = ordered.slice(0, pivot);
    secondEntities = ordered.slice(pivot);
    firstKey = stableId("partition", firstEntities[0]!.id);
    secondKey = stableId("partition", secondEntities[0]!.id);
  }

  const makeChild = (
    suffix: string,
    members: DemoEntity[],
  ): ComponentGroup => ({
    key: `${group.key}:sub:${suffix}`,
    strategy: "path-fallback",
    districtIds: [...group.districtIds],
    entities: members.sort((left, right) => compareText(left.id, right.id)),
  });
  return [
    makeChild(firstKey, firstEntities),
    makeChild(secondKey, secondEntities),
  ];
}

function ensureMinimumGroups(
  groups: readonly ComponentGroup[],
  minimum: number,
): ComponentGroup[] {
  const output = [...groups];
  while (output.length < minimum) {
    const candidates = output
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.entities.length >= 4)
      .sort(
        (left, right) =>
          right.group.entities.length - left.group.entities.length ||
          compareText(left.group.key, right.group.key),
      );
    const candidate = candidates[0];
    if (!candidate) break;
    const split = splitGroup(candidate.group);
    if (!split) break;
    output.splice(candidate.index, 1, ...split);
    output.sort(groupOrder);
  }
  return output;
}

function capGroups(
  groups: readonly ComponentGroup[],
  maximum: number,
): ComponentGroup[] {
  if (groups.length <= maximum) return [...groups];
  const ranked = [...groups].sort(
    (left, right) =>
      right.entities.length - left.entities.length ||
      compareText(left.key, right.key),
  );
  const retainedCount = maximum === 1 ? 0 : maximum - 1;
  const retained = ranked.slice(0, retainedCount);
  const overflow = ranked.slice(retainedCount);
  const districtIds = [
    ...new Set(overflow.flatMap((group) => group.districtIds)),
  ].sort(compareText);
  const entities = overflow
    .flatMap((group) => group.entities)
    .sort((left, right) => compareText(left.id, right.id));
  retained.push({
    key: `overflow:${districtIds.join("+")}`,
    strategy: "district-overflow",
    districtIds,
    entities,
  });
  return retained.sort(groupOrder);
}

function componentGroups(
  entities: readonly DemoEntity[],
  minimum: number,
  maximum: number,
): ComponentGroup[] {
  return capGroups(
    ensureMinimumGroups(makeDistrictGroups(entities), minimum),
    maximum,
  );
}

function anchorScore(entity: DemoEntity): number {
  const explicitEntry = ENTRY_PATTERN.test(entity.path) ? 1_000_000 : 0;
  const gatewayHint =
    /gateway|router|controller|handler|public|api/i.test(entity.path)
      ? 100_000
      : 0;
  return (
    explicitEntry +
    gatewayHint +
    finiteNonNegative(entity.maxMetrics.fanIn) * 1_000 +
    finiteNonNegative(entity.maxMetrics.fanOut) * 100 +
    finiteNonNegative(entity.maxMetrics.exports) * 10 +
    finiteNonNegative(entity.maxMetrics.loc)
  );
}

function selectAnchor(entities: readonly DemoEntity[]): DemoEntity {
  return [...entities].sort(
    (left, right) =>
      anchorScore(right) - anchorScore(left) ||
      compareText(left.id, right.id),
  )[0]!;
}

function architectureKind(
  entities: readonly DemoEntity[],
  hasDeclaredArtifactBoundary: boolean,
): SemanticComponentKind {
  const text = entities
    .map((entity) => `${entity.path} ${entity.name} ${entity.role}`)
    .join("\n")
    .toLowerCase();
  const roleCount = (role: DemoEntity["role"]) =>
    entities.filter((entity) => entity.role === role).length;
  const majority = Math.max(1, Math.ceil(entities.length * 0.45));

  if (roleCount("test") >= majority) return "laboratory";
  if (roleCount("docs") >= majority) return "library";
  if (
    /(?:^|[\s/_.-])(?:analy[sz](?:er|is)?|compiler|parser|transform|processor|resolver)(?:[\s/_.-]|$)/.test(
      text,
    )
  ) {
    return "factory";
  }
  if (
    /(?:^|[\s/_.-])(?:schema|contract|auth|policy|registry|core)(?:[\s/_.-]|$)/.test(
      text,
    )
  ) {
    return "civic";
  }
  if (roleCount("script") + roleCount("config") >= majority) {
    return "operations";
  }
  if (
    /(?:^|[\s/_.-])(?:pipeline|replay|git|history|worker|build|runner)(?:[\s/_.-]|$)/.test(
      text,
    )
  ) {
    return "station";
  }
  if (
    /(?:^|[\s/_.-])(?:viewer|renderer|scene|camera|ui)(?:[\s/_.-]|$)/.test(
      text,
    )
  ) {
    return "operations";
  }
  if (
    entities.some((entity) => ENTRY_PATTERN.test(entity.path)) ||
    /(?:^|[\s/_.-])(?:gateway|router|route|server|cli)(?:[\s/_.-]|$)/.test(
      text,
    )
  ) {
    return "gateway";
  }
  if (hasDeclaredArtifactBoundary) return "port";
  return "mixed-use";
}

function componentLabel(
  group: ComponentGroup,
  districtById: ReadonlyMap<string, PlannedDistrict>,
): string {
  if (group.strategy === "district" && group.districtIds.length === 1) {
    return (
      districtById.get(group.districtIds[0]!)?.name ??
      group.districtIds[0]!
    );
  }
  if (group.strategy === "district-overflow") {
    return `Shared city services · ${group.districtIds.length} workspaces`;
  }
  const paths = group.entities.map((entity) => entity.path.split("/"));
  const depth = commonDirectoryDepth(group.entities);
  const root = paths[0]?.[Math.max(0, depth - 1)];
  return root ? `${root} component` : `${group.districtIds[0]} component`;
}

function baseComponent(
  group: ComponentGroup,
  districtById: ReadonlyMap<string, PlannedDistrict>,
  repoScope: string,
  artifactBoundaryEntityIds: ReadonlySet<string>,
): SemanticComponent {
  const id = stableId("component", `${repoScope}:${group.key}`);
  const campusId = stableId("campus", `${repoScope}:${group.key}`);
  const anchor = selectAnchor(group.entities);
  const entityIds = group.entities
    .map((entity) => entity.id)
    .sort(compareText);
  return {
    id,
    label: componentLabel(group, districtById),
    districtId: anchor.districtId,
    districtIds: [...group.districtIds],
    architectureKind: architectureKind(
      group.entities,
      group.entities.some((entity) =>
        artifactBoundaryEntityIds.has(entity.id),
      ),
    ),
    anchorEntityId: anchor.id,
    entityIds,
    campusId,
    metrics: {
      files: entityIds.length,
      loc: group.entities.reduce(
        (sum, entity) => sum + finiteNonNegative(entity.maxMetrics.loc),
        0,
      ),
      exports: group.entities.reduce(
        (sum, entity) => sum + finiteNonNegative(entity.maxMetrics.exports),
        0,
      ),
      fanIn: group.entities.reduce(
        (sum, entity) => sum + finiteNonNegative(entity.maxMetrics.fanIn),
        0,
      ),
      fanOut: group.entities.reduce(
        (sum, entity) => sum + finiteNonNegative(entity.maxMetrics.fanOut),
        0,
      ),
      churn: group.entities.reduce(
        (sum, entity) => sum + finiteNonNegative(entity.maxMetrics.churn),
        0,
      ),
      internalRelationWeight: 0,
      externalRelationWeight: 0,
    },
    cluster: {
      strategy: group.strategy,
      key: group.key,
      parentDistrictIds: [...group.districtIds],
      childClusterKeys: [],
    },
    evidence: {
      entityIds,
      relationIds: [],
      reason:
        group.strategy === "district"
          ? "Files share the same compiler-assigned workspace or district."
          : group.strategy === "path-fallback"
            ? "A deterministic path partition keeps a single workspace legible at component scale."
            : "Small workspace groups were consolidated to preserve the L0 component budget.",
    },
  };
}

function updateComponentRelationMetrics(
  components: SemanticComponent[],
  relations: readonly DemoRelation[],
  entityComponentId: ReadonlyMap<string, string>,
): void {
  const componentById = new Map(
    components.map((component) => [component.id, component]),
  );
  for (const relation of relations) {
    const sourceId = entityComponentId.get(relation.sourceId);
    const targetId = entityComponentId.get(relation.targetId);
    if (!sourceId || !targetId) continue;
    const weight = Math.max(1, finiteNonNegative(relation.weight));
    const source = componentById.get(sourceId)!;
    const target = componentById.get(targetId)!;
    source.evidence.relationIds.push(relation.id);
    if (target !== source) target.evidence.relationIds.push(relation.id);
    if (sourceId === targetId) {
      source.metrics.internalRelationWeight += weight;
    } else {
      source.metrics.externalRelationWeight += weight;
      target.metrics.externalRelationWeight += weight;
    }
  }
  for (const component of components) {
    component.evidence.relationIds = [
      ...new Set(component.evidence.relationIds),
    ].sort(compareText);
  }
}

function componentLayoutScore(component: SemanticComponent): number {
  return (
    component.metrics.externalRelationWeight * 8 +
    component.metrics.fanIn * 3 +
    component.metrics.fanOut * 2 +
    component.metrics.exports +
    component.metrics.files * 12
  );
}

function componentLayoutOrder(
  left: SemanticComponent,
  right: SemanticComponent,
): number {
  return (
    componentLayoutScore(right) - componentLayoutScore(left) ||
    compareText(left.id, right.id)
  );
}

function normalizedLogMetric(
  value: number,
  values: readonly number[],
): number {
  const logged = values.map((candidate) =>
    Math.log2(Math.max(0, candidate) + 1),
  );
  const minimum = Math.min(...logged);
  const maximum = Math.max(...logged);
  if (maximum - minimum < 0.001) return 0.5;
  return (
    (Math.log2(Math.max(0, value) + 1) - minimum) /
    (maximum - minimum)
  );
}

function footprintScales(
  kind: SemanticComponentKind,
): { width: number; depth: number } {
  if (kind === "port") return { width: 1.38, depth: 0.78 };
  if (kind === "factory") return { width: 1.3, depth: 0.84 };
  if (kind === "station") return { width: 1.26, depth: 0.8 };
  if (kind === "laboratory") return { width: 1.22, depth: 1.04 };
  if (kind === "library") return { width: 1.14, depth: 0.96 };
  if (kind === "operations") return { width: 0.94, depth: 0.94 };
  if (kind === "gateway") return { width: 1.08, depth: 0.92 };
  return { width: 1, depth: 1 };
}

function campusFootprints(
  components: readonly SemanticComponent[],
): Map<string, { width: number; depth: number }> {
  const fileCounts = components.map(
    (component) => component.metrics.files,
  );
  return new Map(
    components.map((component) => {
      const breadth = normalizedLogMetric(
        component.metrics.files,
        fileCounts,
      );
      const base = 10.4 + breadth * 3.8;
      const scales = footprintScales(component.architectureKind);
      return [
        component.id,
        {
          width: round(
            Math.max(9.2, Math.min(19.6, base * scales.width)),
          ),
          depth: round(
            Math.max(8.6, Math.min(15.2, base * scales.depth)),
          ),
        },
      ];
    }),
  );
}

function alternatingOffset(index: number, pitch: number): number {
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return (index % 2 === 1 ? -1 : 1) * magnitude * pitch;
}

function nonCentralOffset(index: number, pitch: number): number {
  const magnitude = Math.floor(index / 2) + 1;
  return (index % 2 === 0 ? -1 : 1) * magnitude * pitch;
}

function componentBank(
  component: SemanticComponent,
  districtById: ReadonlyMap<string, PlannedDistrict>,
): "west" | "east" {
  const declaredBank = districtById.get(component.districtId)?.bank;
  if (declaredBank === "west" || declaredBank === "east") {
    return declaredBank;
  }
  return stableHash(`${component.id}:bank`) % 2 === 0 ? "west" : "east";
}

function compactCoreDrafts(
  components: readonly SemanticComponent[],
  districtById: ReadonlyMap<string, PlannedDistrict>,
  cityBounds: CityBounds,
): CampusDraft[] {
  if (components.length === 0) return [];
  const footprints = campusFootprints(components);
  if (components.length === 1) {
    const component = components[0]!;
    const footprint = footprints.get(component.id)!;
    return [
      {
        component,
        district: districtById.get(component.districtId),
        x: round(cityBounds.x),
        z: round(cityBounds.z),
        ...footprint,
      },
    ];
  }

  const ordered = [...components].sort(componentLayoutOrder);
  const maximumWidth = Math.max(
    ...[...footprints.values()].map((footprint) => footprint.width),
  );
  const maximumDepth = Math.max(
    ...[...footprints.values()].map((footprint) => footprint.depth),
  );
  const streetGap = 4.2;
  const columnPitch = maximumWidth + streetGap;
  const rowPitch =
    maximumDepth + SEMANTIC_ACCESS_CLEARANCE * 2 + 1.8;
  const rowsPerLayer = Math.min(
    5,
    Math.max(1, Math.ceil(ordered.length / 2)),
  );

  return ordered
    .map((component, index) => {
      const footprint = footprints.get(component.id)!;
      const pairIndex = Math.floor(index / 2);
      const layer = Math.floor(pairIndex / rowsPerLayer);
      const row = pairIndex % rowsPerLayer;
      const side = index % 2 === 0 ? -1 : 1;
      return {
        component,
        district: districtById.get(component.districtId),
        x: round(
          cityBounds.x +
            side *
              (maximumWidth / 2 +
                streetGap / 2 +
                layer * columnPitch),
        ),
        z: round(
          cityBounds.z + alternatingOffset(row, rowPitch),
        ),
        ...footprint,
      };
    })
    .sort((left, right) => compareText(left.component.id, right.component.id));
}

function waterfrontDrafts(
  components: readonly SemanticComponent[],
  districtById: ReadonlyMap<string, PlannedDistrict>,
  cityBounds: CityBounds,
  river: SemanticRiver,
  waterfrontPairs: readonly WaterfrontComponentPair[],
): CampusDraft[] {
  const ordered = [...components].sort(componentLayoutOrder);
  const footprints = campusFootprints(ordered);
  const maximumWidth = Math.max(
    ...[...footprints.values()].map((footprint) => footprint.width),
  );
  const maximumDepth = Math.max(
    ...[...footprints.values()].map((footprint) => footprint.depth),
  );
  const streetGap = 1.6;
  const rowPitch =
    maximumDepth + SEMANTIC_ACCESS_CLEARANCE * 2 + streetGap;
  const layerPitch = maximumWidth + 4.2;
  const waterfrontZ = new Map<string, number>();
  const waterfrontBank = new Map<string, "west" | "east">();
  for (const [index, pair] of [...waterfrontPairs]
    .sort((left, right) => compareText(left.id, right.id))
    .entries()) {
    const z = round(
      cityBounds.z + alternatingOffset(index, rowPitch),
    );
    if (!waterfrontZ.has(pair.sourceComponentId)) {
      waterfrontZ.set(pair.sourceComponentId, z);
      waterfrontBank.set(pair.sourceComponentId, pair.sourceBank);
    }
    if (!waterfrontZ.has(pair.targetComponentId)) {
      waterfrontZ.set(pair.targetComponentId, z);
      waterfrontBank.set(pair.targetComponentId, pair.targetBank);
    }
  }

  const inlandByBank = new Map<"west" | "east", SemanticComponent[]>([
    ["west", []],
    ["east", []],
  ]);
  for (const component of ordered) {
    if (!waterfrontZ.has(component.id)) {
      inlandByBank.get(componentBank(component, districtById))!.push(component);
    }
  }
  for (const group of inlandByBank.values()) {
    group.sort(componentLayoutOrder);
  }
  const inlandIndex = new Map<string, number>();
  for (const group of inlandByBank.values()) {
    group.forEach((component, index) => inlandIndex.set(component.id, index));
  }

  const riverMinX = river.x - river.width / 2;
  const riverMaxX = river.x + river.width / 2;
  // A continuous frontage terrace keeps every first-layer campus on the same
  // waterfront boulevard. Only typed artifact endpoints receive quays.
  const waterfrontGap = 2.5;
  const inlandRowsPerLayer = 4;
  return ordered
    .map((component) => {
      const footprint = footprints.get(component.id)!;
      const bank =
        waterfrontBank.get(component.id) ??
        componentBank(component, districtById);
      const side = bank === "west" ? -1 : 1;
      const shoreX = bank === "west" ? riverMinX : riverMaxX;
      const assignedWaterfrontZ = waterfrontZ.get(component.id);
      if (assignedWaterfrontZ !== undefined) {
        return {
          component,
          district: districtById.get(component.districtId),
          x: round(
            shoreX +
              side * (waterfrontGap + footprint.width / 2),
          ),
          z: assignedWaterfrontZ,
          ...footprint,
        };
      }

      const index = inlandIndex.get(component.id) ?? 0;
      const layer = Math.floor(index / inlandRowsPerLayer);
      const row = index % inlandRowsPerLayer;
      return {
        component,
        district: districtById.get(component.districtId),
        x: round(
          shoreX +
            side *
              (waterfrontGap +
                footprint.width / 2 +
                layer * layerPitch),
        ),
        z: round(
          cityBounds.z + nonCentralOffset(row, rowPitch),
        ),
        ...footprint,
      };
    })
    .sort((left, right) => compareText(left.component.id, right.component.id));
}

function campusDrafts(
  components: readonly SemanticComponent[],
  districtById: ReadonlyMap<string, PlannedDistrict>,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
  waterfrontPairs: readonly WaterfrontComponentPair[],
): CampusDraft[] {
  return river && waterfrontPairs.length > 0
    ? waterfrontDrafts(
        components,
        districtById,
        cityBounds,
        river,
        waterfrontPairs,
      )
    : compactCoreDrafts(components, districtById, cityBounds);
}

function buildingPoint(
  entityId: string,
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>,
  fallback: CityPoint,
): CityPoint {
  const building = buildingByEntityId.get(entityId);
  return building ? point(building.x, building.z) : point(fallback.x, fallback.z);
}

function fileSlots(
  draft: CampusDraft,
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>,
): SemanticFileSlot[] {
  const entityIds = [...draft.component.entityIds].sort(
    (left, right) =>
      stableHash(left) - stableHash(right) || compareText(left, right),
  );
  const innerWidth = Math.max(2.4, draft.width * 0.78);
  const innerDepth = Math.max(2.4, draft.depth * 0.78);
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt(entityIds.length * (innerWidth / innerDepth))),
  );
  const rows = Math.max(1, Math.ceil(entityIds.length / columns));
  const cellWidth = innerWidth / columns;
  const cellDepth = innerDepth / rows;

  return entityIds.map((entityId, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const localX =
      -innerWidth / 2 + column * cellWidth + cellWidth / 2;
    const localZ =
      -innerDepth / 2 + row * cellDepth + cellDepth / 2;
    return {
      id: `slot-${draft.component.id}-${stableHash(entityId).toString(16)}`,
      entityId,
      componentId: draft.component.id,
      x: round(draft.x + localX),
      z: round(draft.z + localZ),
      localX: round(localX),
      localZ: round(localZ),
      width: round(Math.max(0.22, cellWidth * 0.66)),
      depth: round(Math.max(0.22, cellDepth * 0.66)),
      legacyPoint: buildingPoint(
        entityId,
        buildingByEntityId,
        point(draft.x, draft.z),
      ),
    };
  });
}

function architectureHeightOffset(kind: SemanticComponentKind): number {
  if (kind === "operations") return 1.6;
  if (kind === "gateway") return 1.4;
  if (kind === "civic") return 1.3;
  if (kind === "station") return 0.8;
  if (kind === "mixed-use") return 0.2;
  if (kind === "port") return -1.2;
  if (kind === "laboratory") return -0.6;
  if (kind === "library") return -0.9;
  return 0;
}

function campusHeight(
  component: SemanticComponent,
  components: readonly SemanticComponent[],
): number {
  const fileCounts = components.map(
    (candidate) => candidate.metrics.files,
  );
  const publicReachValues = components.map(
    (candidate) =>
      candidate.metrics.exports +
      candidate.metrics.fanIn +
      candidate.metrics.fanOut,
  );
  const externalReachValues = components.map(
    (candidate) => candidate.metrics.externalRelationWeight,
  );
  const breadth = normalizedLogMetric(
    component.metrics.files,
    fileCounts,
  );
  const publicReach = normalizedLogMetric(
    component.metrics.exports +
      component.metrics.fanIn +
      component.metrics.fanOut,
    publicReachValues,
  );
  const externalReach = normalizedLogMetric(
    component.metrics.externalRelationWeight,
    externalReachValues,
  );
  const intensity =
    breadth * 0.32 + publicReach * 0.43 + externalReach * 0.25;
  // Height is a relative urban-intensity tier, never a direct LOC extrusion.
  return round(
    Math.max(
      4.8,
      Math.min(
        15.5,
        4.8 +
          intensity * 7.4 +
          architectureHeightOffset(component.architectureKind),
      ),
    ),
  );
}

function makeCampuses(
  components: readonly SemanticComponent[],
  districtById: ReadonlyMap<string, PlannedDistrict>,
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
  waterfrontPairs: readonly WaterfrontComponentPair[],
): SemanticCampus[] {
  return campusDrafts(
    components,
    districtById,
    cityBounds,
    river,
    waterfrontPairs,
  ).map((draft) => {
    const slots = fileSlots(draft, buildingByEntityId);
    return {
      id: draft.component.campusId,
      componentId: draft.component.id,
      districtId: draft.component.districtId,
      label: draft.component.label,
      kind: draft.component.architectureKind,
      x: draft.x,
      z: draft.z,
      width: draft.width,
      depth: draft.depth,
      height: campusHeight(draft.component, components),
      color: draft.district?.color ?? "#68b8a8",
      // Campus slots, frontage ports and access hubs currently share an
      // axis-aligned topology. Keep the rendered kit on that same transform
      // until the compiler rotates every address and port as one unit.
      orientation: 0,
      active: true,
      anchorEntityId: draft.component.anchorEntityId,
      entityIds: [...draft.component.entityIds],
      evidence: {
        entityIds: [...draft.component.evidence.entityIds],
        relationIds: [...draft.component.evidence.relationIds],
        reason: draft.component.evidence.reason,
      },
      fileSlots: slots,
    };
  });
}

function buildEntityAddresses(
  campuses: readonly SemanticCampus[],
  entityById: ReadonlyMap<string, DemoEntity>,
): Record<string, SemanticEntityAddress> {
  const entries = campuses.flatMap((campus) =>
    campus.fileSlots.map((slot) => {
      const entity = entityById.get(slot.entityId)!;
      return [
        slot.entityId,
        {
          entityId: slot.entityId,
          districtId: entity.districtId,
          componentId: campus.componentId,
          campusId: campus.id,
          fileSlotId: slot.id,
          worldPoint: point(slot.x, slot.z),
          legacyWorldPoint: point(slot.legacyPoint.x, slot.legacyPoint.z),
        } satisfies SemanticEntityAddress,
      ] as const;
    }),
  );
  entries.sort(([left], [right]) => compareText(left, right));
  return Object.fromEntries(entries);
}

function validateBoundaryFacts(
  boundaryFacts: readonly ProjectBoundaryFact[],
  entityById: ReadonlyMap<string, DemoEntity>,
  relationById: ReadonlyMap<string, DemoRelation>,
): ValidatedBoundaryFact[] {
  const ordered = [...boundaryFacts].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const duplicate = ordered.find(
    (fact, index) => fact.id === ordered[index - 1]?.id,
  );
  if (duplicate) {
    throw new Error(`Duplicate boundary fact id: ${duplicate.id}`);
  }

  return ordered.map((fact) => {
    if (!entityById.has(fact.sourceEntityId)) {
      throw new Error(
        `Unknown boundary source entity: ${fact.sourceEntityId}`,
      );
    }
    if (!entityById.has(fact.targetEntityId)) {
      throw new Error(
        `Unknown boundary target entity: ${fact.targetEntityId}`,
      );
    }
    if (fact.sourceEntityId === fact.targetEntityId) {
      throw new Error(
        `Boundary fact endpoints must differ: ${fact.id}`,
      );
    }

    const relation = fact.relationId
      ? relationById.get(fact.relationId)
      : undefined;
    if (fact.relationId && !relation) {
      throw new Error(`Unknown boundary relation: ${fact.relationId}`);
    }
    if (
      relation &&
      !(
        (relation.sourceId === fact.sourceEntityId &&
          relation.targetId === fact.targetEntityId) ||
        (relation.sourceId === fact.targetEntityId &&
          relation.targetId === fact.sourceEntityId)
      )
    ) {
      throw new Error(
        `Boundary relation ${relation.id} does not connect the declared endpoints`,
      );
    }
    if (fact.reason.trim().length === 0) {
      throw new Error(`Boundary fact requires a reason: ${fact.id}`);
    }
    return { fact, relation };
  });
}

function modeHintForRelations(
  relations: readonly DemoRelation[],
  entityById: ReadonlyMap<string, DemoEntity>,
  internal: boolean,
): SemanticModeHint {
  if (internal) return "local";
  const text = relations
    .flatMap((relation) => [
      entityById.get(relation.sourceId),
      entityById.get(relation.targetId),
    ])
    .filter((entity): entity is DemoEntity => Boolean(entity))
    .map((entity) => `${entity.path} ${entity.name} ${entity.role}`)
    .join("\n");
  if (/pipeline|replay|git|history|worker|build|test|runner/i.test(text)) {
    return "pipeline";
  }
  return "sync";
}

function boundaryFactCrossesRiver(
  fact: ProjectBoundaryFact,
  entityById: ReadonlyMap<string, DemoEntity>,
  districtById: ReadonlyMap<string, PlannedDistrict>,
): boolean {
  const source = entityById.get(fact.sourceEntityId);
  const target = entityById.get(fact.targetEntityId);
  if (!source || !target) return false;
  const sourceBank = districtById.get(source.districtId)?.bank;
  const targetBank = districtById.get(target.districtId)?.bank;
  if (
    sourceBank !== "west" && sourceBank !== "east" ||
    targetBank !== "west" && targetBank !== "east" ||
    sourceBank === targetBank
  ) {
    return false;
  }
  return fact.kind === "artifact" && fact.crossing === "water";
}

function waterBoundaryFactIds(
  cityPlan: LivingCityPlan,
  boundaryFacts: readonly ValidatedBoundaryFact[],
  entityById: ReadonlyMap<string, DemoEntity>,
  districtById: ReadonlyMap<string, PlannedDistrict>,
): Set<string> {
  if (!cityPlan.geography.river) return new Set();
  return new Set(
    boundaryFacts
      .filter(({ fact }) =>
        boundaryFactCrossesRiver(fact, entityById, districtById),
      )
      .map(({ fact }) => fact.id),
  );
}

function waterfrontComponentPairs(
  boundaryFacts: readonly ValidatedBoundaryFact[],
  waterFactIds: ReadonlySet<string>,
  entityComponentId: ReadonlyMap<string, string>,
  entityById: ReadonlyMap<string, DemoEntity>,
  districtById: ReadonlyMap<string, PlannedDistrict>,
): WaterfrontComponentPair[] {
  return boundaryFacts
    .filter(({ fact }) => waterFactIds.has(fact.id))
    .map(({ fact }) => {
      const sourceEntity = entityById.get(fact.sourceEntityId)!;
      const targetEntity = entityById.get(fact.targetEntityId)!;
      const sourceBank = districtById.get(sourceEntity.districtId)?.bank;
      const targetBank = districtById.get(targetEntity.districtId)?.bank;
      return {
        id: fact.id,
        sourceComponentId: entityComponentId.get(fact.sourceEntityId)!,
        targetComponentId: entityComponentId.get(fact.targetEntityId)!,
        sourceBank,
        targetBank,
      };
    })
    .filter(
      (
        pair,
      ): pair is WaterfrontComponentPair =>
        Boolean(pair.sourceComponentId) &&
        Boolean(pair.targetComponentId) &&
        pair.sourceComponentId !== pair.targetComponentId &&
        (pair.sourceBank === "west" || pair.sourceBank === "east") &&
        (pair.targetBank === "west" || pair.targetBank === "east"),
    )
    .sort((left, right) => compareText(left.id, right.id));
}

function corridorDrafts(
  relations: readonly DemoRelation[],
  entityComponentId: ReadonlyMap<string, string>,
  repoScope: string,
): CorridorDraft[] {
  const grouped = new Map<string, DemoRelation[]>();
  for (const relation of [...relations].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const sourceComponentId = entityComponentId.get(relation.sourceId);
    const targetComponentId = entityComponentId.get(relation.targetId);
    if (!sourceComponentId || !targetComponentId) continue;
    const key = `${sourceComponentId}->${targetComponentId}`;
    const group = grouped.get(key) ?? [];
    group.push(relation);
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .map(([key, group]) => {
      const [sourceComponentId, targetComponentId] = key.split("->") as [
        string,
        string,
      ];
      return {
        id: stableId("corridor", `${repoScope}:static-import:${key}`),
        basis: "static-import" as const,
        sourceComponentId,
        targetComponentId,
        relationIds: group.map((relation) => relation.id).sort(compareText),
        boundaryFactIds: [],
        relations: group,
        weight: round(
          group.reduce(
            (sum, relation) =>
              sum + Math.max(1, finiteNonNegative(relation.weight)),
            0,
          ),
        ),
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
}

function componentAccessCorridorDrafts(
  components: readonly SemanticComponent[],
  repoScope: string,
): CorridorDraft[] {
  return [...components]
    .sort((left, right) => compareText(left.id, right.id))
    .map((component) => ({
      id: stableId(
        "corridor",
        `${repoScope}:component-access:${component.id}`,
      ),
      basis: "component-access" as const,
      sourceComponentId: component.id,
      targetComponentId: component.id,
      relationIds: [],
      boundaryFactIds: [],
      relations: [],
      weight: 0,
    }));
}

function boundaryCorridorDrafts(
  boundaryFacts: readonly ValidatedBoundaryFact[],
  entityComponentId: ReadonlyMap<string, string>,
  repoScope: string,
): CorridorDraft[] {
  return boundaryFacts
    .map(({ fact, relation }) => {
      const sourceComponentId = entityComponentId.get(fact.sourceEntityId)!;
      const targetComponentId = entityComponentId.get(fact.targetEntityId)!;
      return {
        id: stableId(
          "corridor",
          `${repoScope}:declared-boundary:${fact.id}`,
        ),
        basis: "declared-boundary" as const,
        sourceComponentId,
        targetComponentId,
        relationIds: relation ? [relation.id] : [],
        boundaryFactIds: [fact.id],
        relations: relation ? [relation] : [],
        // This is a declared interface, not a runtime volume observation.
        weight: 0,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
}

const PORT_CLEARANCE = 0.55;
const PORT_EDGES: SemanticPortEdge[] = [
  "north",
  "east",
  "south",
  "west",
];

function edgeNormal(edge: SemanticPortEdge): CityPoint {
  if (edge === "north") return point(0, -1);
  if (edge === "east") return point(1, 0);
  if (edge === "south") return point(0, 1);
  return point(-1, 0);
}

function sideOfRiver(
  candidate: CityPoint,
  river: SemanticRiver,
): "west" | "east" {
  return candidate.x < river.x ? "west" : "east";
}

function networkSpineX(
  bank: "west" | "east",
  river: SemanticRiver,
): number {
  const shoreX =
    bank === "west"
      ? river.x - river.width / 2
      : river.x + river.width / 2;
  return round(shoreX + (bank === "west" ? -1.35 : 1.35));
}

function campusAccessHub(
  campus: SemanticCampus,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
): CityPoint {
  if (!river) return point(cityBounds.x, campus.z);
  return point(
    networkSpineX(sideOfRiver(campus, river), river),
    campus.z,
  );
}

function samePoint(left: CityPoint, right: CityPoint): boolean {
  return left.x === right.x && left.z === right.z;
}

function withoutConsecutiveDuplicates(
  points: readonly CityPoint[],
): CityPoint[] {
  const output: CityPoint[] = [];
  for (const candidate of points) {
    if (!samePoint(candidate, output.at(-1) ?? point(Infinity, Infinity))) {
      output.push(point(candidate.x, candidate.z));
    }
  }
  return output;
}

function spineRoutePoints(
  sourcePort: SemanticCorridorPort,
  targetPort: SemanticCorridorPort,
  sourceAccess: CityPoint,
  targetAccess: CityPoint,
  spineX: number,
  centerZ: number,
  key: string,
): CityPoint[] {
  const junctionOffset = 1.8;
  const north = point(spineX, centerZ - junctionOffset);
  const center = point(spineX, centerZ);
  const south = point(spineX, centerZ + junctionOffset);
  const increasing =
    sourceAccess.z < targetAccess.z ||
    (sourceAccess.z === targetAccess.z &&
      stableHash(`${key}:junction-direction`) % 2 === 0);
  return withoutConsecutiveDuplicates([
    sourcePort,
    sourceAccess,
    increasing ? north : south,
    center,
    increasing ? south : north,
    targetAccess,
    targetPort,
  ]);
}

function sharedNetworkPoints(
  sourcePort: SemanticCorridorPort,
  targetPort: SemanticCorridorPort,
  source: SemanticCampus,
  target: SemanticCampus,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
  key: string,
): CityPoint[] {
  const sourceAccess = campusAccessHub(source, cityBounds, river);
  const targetAccess = campusAccessHub(target, cityBounds, river);
  if (!river) {
    return spineRoutePoints(
      sourcePort,
      targetPort,
      sourceAccess,
      targetAccess,
      cityBounds.x,
      cityBounds.z,
      key,
    );
  }

  const sourceBank = sideOfRiver(source, river);
  const targetBank = sideOfRiver(target, river);
  const sourceSpineX = networkSpineX(sourceBank, river);
  const targetSpineX = networkSpineX(targetBank, river);
  if (sourceBank === targetBank) {
    return spineRoutePoints(
      sourcePort,
      targetPort,
      sourceAccess,
      targetAccess,
      sourceSpineX,
      cityBounds.z,
      key,
    );
  }

  const junctionOffset = 1.8;
  const sourceJunction = point(
    sourceSpineX,
    cityBounds.z +
      (sourceAccess.z <= cityBounds.z
        ? -junctionOffset
        : junctionOffset),
  );
  const targetJunction = point(
    targetSpineX,
    cityBounds.z +
      (targetAccess.z <= cityBounds.z
        ? -junctionOffset
        : junctionOffset),
  );
  return withoutConsecutiveDuplicates([
    sourcePort,
    sourceAccess,
    sourceJunction,
    point(sourceSpineX, cityBounds.z),
    point(targetSpineX, cityBounds.z),
    targetJunction,
    targetAccess,
    targetPort,
  ]);
}

function waterRoutePoints(
  sourcePort: SemanticCorridorPort,
  targetPort: SemanticCorridorPort,
): CityPoint[] {
  const dx = targetPort.x - sourcePort.x;
  const dz = targetPort.z - sourcePort.z;
  return [
    point(sourcePort.x, sourcePort.z),
    point(sourcePort.x + dx / 3, sourcePort.z + dz / 3),
    point(sourcePort.x + (dx * 2) / 3, sourcePort.z + (dz * 2) / 3),
    point(targetPort.x, targetPort.z),
  ];
}

function inferredPortEdge(
  campus: SemanticCampus,
  toward: CityPoint,
  key: string,
): SemanticPortEdge {
  const dx = toward.x - campus.x;
  const dz = toward.z - campus.z;
  if (Math.abs(dx) + Math.abs(dz) < 0.001) {
    return PORT_EDGES[stableHash(key) % PORT_EDGES.length]!;
  }
  const horizontalScore = Math.abs(dx) / Math.max(0.001, campus.width / 2);
  const verticalScore = Math.abs(dz) / Math.max(0.001, campus.depth / 2);
  if (horizontalScore >= verticalScore) return dx >= 0 ? "east" : "west";
  return dz >= 0 ? "south" : "north";
}

function corridorPort(
  campus: SemanticCampus,
  toward: CityPoint,
  corridorId: string,
  role: "source" | "target",
  kind: SemanticCorridorPort["kind"],
  boundaryFactIds: readonly string[],
  forcedEdge?: SemanticPortEdge,
): SemanticCorridorPort {
  const edge =
    forcedEdge ??
    inferredPortEdge(campus, toward, `${corridorId}:${role}:edge`);
  const halfWidth = campus.width / 2;
  const halfDepth = campus.depth / 2;
  const dx = toward.x - campus.x;
  const dz = toward.z - campus.z;
  let x = campus.x;
  let z = campus.z;

  if (edge === "east" || edge === "west") {
    const sign = edge === "east" ? 1 : -1;
    x += sign * (halfWidth + PORT_CLEARANCE);
    if (Math.abs(dx) > 0.001) {
      z += Math.max(
        -halfDepth * 0.72,
        Math.min(halfDepth * 0.72, dz * (halfWidth / Math.abs(dx))),
      );
    }
  } else {
    const sign = edge === "south" ? 1 : -1;
    z += sign * (halfDepth + PORT_CLEARANCE);
    if (Math.abs(dz) > 0.001) {
      x += Math.max(
        -halfWidth * 0.72,
        Math.min(halfWidth * 0.72, dx * (halfDepth / Math.abs(dz))),
      );
    }
  }

  return {
    id: stableId("port", `${corridorId}:${role}`),
    componentId: campus.componentId,
    campusId: campus.id,
    edge,
    kind,
    boundaryFactIds: [...boundaryFactIds].sort(compareText),
    ...point(x, z),
  };
}

function componentAccessPort(
  campus: SemanticCampus,
  corridorId: string,
  role: "source" | "target",
): SemanticCorridorPort {
  return {
    id: stableId("port", `${corridorId}:${role}`),
    componentId: campus.componentId,
    campusId: campus.id,
    edge: "north",
    kind: "frontage",
    boundaryFactIds: [],
    ...point(
      campus.x,
      campus.z - campus.depth / 2 - SEMANTIC_ACCESS_CLEARANCE,
    ),
  };
}

function shorelinePort(
  port: SemanticCorridorPort,
  campus: SemanticCampus,
  river: SemanticRiver,
): SemanticCorridorPort {
  const bank = sideOfRiver(campus, river);
  return {
    ...port,
    edge: bank === "west" ? "east" : "west",
    x: round(
      bank === "west"
        ? river.x - river.width / 2
        : river.x + river.width / 2,
    ),
    z: round(campus.z),
  };
}

function componentAccessLoopPoints(
  campus: SemanticCampus,
  port: SemanticCorridorPort,
): CityPoint[] {
  const minX =
    campus.x - campus.width / 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxX =
    campus.x + campus.width / 2 + SEMANTIC_ACCESS_CLEARANCE;
  const minZ =
    campus.z - campus.depth / 2 - SEMANTIC_ACCESS_CLEARANCE;
  const maxZ =
    campus.z + campus.depth / 2 + SEMANTIC_ACCESS_CLEARANCE;
  return [
    point(port.x, port.z),
    point(maxX, minZ),
    point(maxX, maxZ),
    point(minX, maxZ),
    point(minX, minZ),
    point(port.x, port.z),
  ];
}

function corridorPoints(
  sourcePort: SemanticCorridorPort,
  targetPort: SemanticCorridorPort,
  key: string,
  internal: boolean,
  source: SemanticCampus,
  target: SemanticCampus,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
  waterCrossing: boolean,
): CityPoint[] {
  if (!internal) {
    return waterCrossing && river
      ? waterRoutePoints(sourcePort, targetPort)
      : sharedNetworkPoints(
          sourcePort,
          targetPort,
          source,
          target,
          cityBounds,
          river,
          key,
        );
  }
  const sourceNormal = edgeNormal(sourcePort.edge);
  const targetNormal = edgeNormal(targetPort.edge);
  const loopClearance = 1.15;
  const sourceOuter = point(
    sourcePort.x + sourceNormal.x * loopClearance,
    sourcePort.z + sourceNormal.z * loopClearance,
  );
  const targetOuter = point(
    targetPort.x + targetNormal.x * loopClearance,
    targetPort.z + targetNormal.z * loopClearance,
  );
  const sourceIsNorthSouth =
    sourcePort.edge === "north" || sourcePort.edge === "south";
  const exteriorCorner = sourceIsNorthSouth
    ? point(targetOuter.x, sourceOuter.z)
    : point(sourceOuter.x, targetOuter.z);
  return [
    point(sourcePort.x, sourcePort.z),
    sourceOuter,
    exteriorCorner,
    targetOuter,
    point(targetPort.x, targetPort.z),
  ];
}

function makeCorridors(
  drafts: readonly CorridorDraft[],
  campusByComponentId: ReadonlyMap<string, SemanticCampus>,
  entityById: ReadonlyMap<string, DemoEntity>,
  boundaryFactById: ReadonlyMap<string, ProjectBoundaryFact>,
  waterFactIds: ReadonlySet<string>,
  cityBounds: CityBounds,
  river: SemanticRiver | null,
): SemanticCorridor[] {
  return drafts.map((draft) => {
    const source = campusByComponentId.get(draft.sourceComponentId)!;
    const target = campusByComponentId.get(draft.targetComponentId)!;
    const internal = source.id === target.id;
    const componentAccess = draft.basis === "component-access";
    const waterCrossing = draft.boundaryFactIds.some((id) =>
      waterFactIds.has(id),
    );
    const portKind =
      draft.basis === "declared-boundary"
        ? "artifact-quay"
        : "frontage";
    const internalSourceEdge = internal && !componentAccess
      ? PORT_EDGES[stableHash(`${draft.id}:loop`) % PORT_EDGES.length]
      : undefined;
    const internalTargetEdge = internalSourceEdge
      ? PORT_EDGES[
          (PORT_EDGES.indexOf(internalSourceEdge) + 1) % PORT_EDGES.length
        ]
      : undefined;
    const sourceToward =
      internal
        ? target
        : waterCrossing && river
          ? point(river.x, source.z)
          : campusAccessHub(source, cityBounds, river);
    const targetToward =
      internal
        ? source
        : waterCrossing && river
          ? point(river.x, target.z)
          : campusAccessHub(target, cityBounds, river);
    let sourcePort = componentAccess
      ? componentAccessPort(source, draft.id, "source")
      : corridorPort(
          source,
          sourceToward,
          draft.id,
          "source",
          portKind,
          draft.boundaryFactIds,
          internalSourceEdge,
        );
    let targetPort = componentAccess
      ? componentAccessPort(target, draft.id, "target")
      : corridorPort(
          target,
          targetToward,
          draft.id,
          "target",
          portKind,
          draft.boundaryFactIds,
          internalTargetEdge,
        );
    if (waterCrossing && river) {
      sourcePort = shorelinePort(sourcePort, source, river);
      targetPort = shorelinePort(targetPort, target, river);
    }
    const entityIds = [
      ...new Set(
        draft.basis === "declared-boundary"
          ? draft.boundaryFactIds.flatMap((id) => {
              const fact = boundaryFactById.get(id);
              return fact
                ? [fact.sourceEntityId, fact.targetEntityId]
                : [];
            })
          : componentAccess
            ? source.entityIds
            : draft.relations.flatMap((relation) => [
                relation.sourceId,
                relation.targetId,
              ]),
      ),
    ].sort(compareText);
    const boundaryFacts = draft.boundaryFactIds
      .map((id) => boundaryFactById.get(id))
      .filter((fact): fact is ProjectBoundaryFact => Boolean(fact));
    return {
      id: draft.id,
      basis: draft.basis,
      sourceComponentId: draft.sourceComponentId,
      targetComponentId: draft.targetComponentId,
      scope: internal ? "campus" : "city",
      roadClass:
        draft.basis === "static-import" && !internal
          ? "collector"
          : "local",
      points: componentAccess
        ? componentAccessLoopPoints(source, sourcePort)
        : corridorPoints(
            sourcePort,
            targetPort,
            draft.id,
            internal,
            source,
            target,
            cityBounds,
            river,
            waterCrossing,
          ),
      weight: draft.weight,
      relationIds: [...draft.relationIds],
      boundaryFactIds: [...draft.boundaryFactIds],
      waterCrossing,
      modeHint:
        draft.basis === "declared-boundary"
          ? "artifact"
          : componentAccess
            ? "local"
          : modeHintForRelations(
              draft.relations,
              entityById,
              internal,
            ),
      sourcePort,
      targetPort,
      evidence: {
        entityIds,
        relationIds: [...draft.relationIds],
        boundaryFactIds: [...draft.boundaryFactIds],
        provenance:
          boundaryFacts.length === 1
            ? boundaryFacts[0]!.provenance
            : undefined,
        reason:
          draft.basis === "declared-boundary"
            ? boundaryFacts
                .map((fact) => fact.reason)
                .join(" ")
            : componentAccess
              ? "A component access loop connects its real file addresses to shared frontage. It authorizes navigation geometry only, never a call, journey, or traffic volume."
            : internal
              ? "Static file imports aggregate into a local structural path; weight measures coupling only, never runtime traffic or occupancy."
              : "Static file imports aggregate into a component structural corridor; weight measures coupling only, never runtime traffic or occupancy.",
      },
    };
  });
}

function roadDimensions(roadClass: SemanticRoadClass): {
  width: number;
  lanes: number;
} {
  if (roadClass === "arterial") return { width: 4.4, lanes: 4 };
  if (roadClass === "collector") return { width: 3, lanes: 2 };
  return { width: 1.25, lanes: 1 };
}

interface SharedRoadDraft {
  start: CityPoint;
  end: CityPoint;
  corridorIds: Set<string>;
  componentIds: Set<string>;
  relationIds: Set<string>;
}

function orderedRoadSegment(
  start: CityPoint,
  end: CityPoint,
): { key: string; start: CityPoint; end: CityPoint } {
  const startKey = `${start.x.toFixed(3)},${start.z.toFixed(3)}`;
  const endKey = `${end.x.toFixed(3)},${end.z.toFixed(3)}`;
  return compareText(startKey, endKey) <= 0
    ? {
        key: `${startKey}|${endKey}`,
        start: point(start.x, start.z),
        end: point(end.x, end.z),
      }
    : {
        key: `${endKey}|${startKey}`,
        start: point(end.x, end.z),
        end: point(start.x, start.z),
      };
}

function corridorSpansRiver(
  corridor: SemanticCorridor,
  river: SemanticRiver | null,
): boolean {
  if (!river) return false;
  const minX = river.x - river.width / 2;
  const maxX = river.x + river.width / 2;
  const sourceSide =
    corridor.sourcePort.x < minX
      ? "west"
      : corridor.sourcePort.x > maxX
        ? "east"
        : "water";
  const targetSide =
    corridor.targetPort.x < minX
      ? "west"
      : corridor.targetPort.x > maxX
        ? "east"
        : "water";
  return (
    sourceSide !== "water" &&
    targetSide !== "water" &&
    sourceSide !== targetSide
  );
}

function makeRoads(
  corridors: readonly SemanticCorridor[],
  repoScope: string,
  river: SemanticRiver | null,
): SemanticRoad[] {
  const localRoads: SemanticRoad[] = [];
  const sharedSegments = new Map<string, SharedRoadDraft>();
  for (const corridor of [...corridors].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    if (
      (corridor.basis !== "static-import" &&
        corridor.basis !== "component-access") ||
      corridor.waterCrossing
    ) {
      continue;
    }
    if (corridor.scope === "campus") {
      const dimensions = roadDimensions("local");
      localRoads.push({
        id: stableId("road", `${repoScope}:local:${corridor.id}`),
        corridorIds: [corridor.id],
        centerline: corridor.points.map((candidate) =>
          point(candidate.x, candidate.z),
        ),
        width: dimensions.width,
        lanes: dimensions.lanes,
        level: "ground",
        surface: "ground",
        roadClass: "local",
        evidenceRelationIds: [...corridor.relationIds],
      });
      continue;
    }

    // A static import is structural reach, not permission to invent a bridge.
    // Cross-bank imports remain inspectable corridors, but receive no drivable
    // road until an explicit land crossing is declared.
    if (corridorSpansRiver(corridor, river)) continue;

    for (let index = 0; index < corridor.points.length - 1; index += 1) {
      const start = corridor.points[index]!;
      const end = corridor.points[index + 1]!;
      if (samePoint(start, end)) continue;
      const ordered = orderedRoadSegment(start, end);
      const draft = sharedSegments.get(ordered.key) ?? {
        start: ordered.start,
        end: ordered.end,
        corridorIds: new Set<string>(),
        componentIds: new Set<string>(),
        relationIds: new Set<string>(),
      };
      draft.corridorIds.add(corridor.id);
      draft.componentIds.add(corridor.sourceComponentId);
      draft.componentIds.add(corridor.targetComponentId);
      corridor.relationIds.forEach((id) => draft.relationIds.add(id));
      sharedSegments.set(ordered.key, draft);
    }
  }

  const sharedRoads = [...sharedSegments.entries()].map(([key, draft]) => {
    const length = Math.hypot(
      draft.end.x - draft.start.x,
      draft.end.z - draft.start.z,
    );
    const isSpineSegment =
      Math.abs(draft.end.x - draft.start.x) < 0.001 &&
      length >= 1.75;
    const roadClass: SemanticRoadClass =
      isSpineSegment &&
      draft.corridorIds.size >= 2 &&
      draft.componentIds.size >= 3
        ? "arterial"
        : "collector";
    const dimensions = roadDimensions(roadClass);
    return {
      id: stableId("road", `${repoScope}:shared:${key}`),
      corridorIds: [...draft.corridorIds].sort(compareText),
      centerline: [
        point(draft.start.x, draft.start.z),
        point(draft.end.x, draft.end.z),
      ],
      width: dimensions.width,
      lanes: dimensions.lanes,
      // Static reach can establish a road hierarchy, but never traffic volume,
      // congestion, elevation, or a bridge without a separately typed fact.
      level: "ground" as const,
      surface: "ground" as const,
      roadClass,
      evidenceRelationIds: [...draft.relationIds].sort(compareText),
    };
  });
  return [...localRoads, ...sharedRoads].sort((left, right) =>
    compareText(left.id, right.id),
  );
}

function makeWaterBoundaries(
  cityPlan: LivingCityPlan,
  corridors: readonly SemanticCorridor[],
  boundaryFacts: readonly ValidatedBoundaryFact[],
  waterFactIds: ReadonlySet<string>,
  repoScope: string,
): SemanticWaterBoundary[] {
  const river = cityPlan.geography.river;
  if (!river || waterFactIds.size === 0) return [];
  const relevantFacts = boundaryFacts.filter(({ fact }) =>
    waterFactIds.has(fact.id),
  );
  const boundaryFactIds = relevantFacts
    .map(({ fact }) => fact.id)
    .sort(compareText);
  const relationIds = relevantFacts
    .flatMap(({ relation }) => (relation ? [relation.id] : []))
    .sort(compareText);
  const entityIds = [
    ...new Set(
      relevantFacts.flatMap(({ fact }) => [
        fact.sourceEntityId,
        fact.targetEntityId,
      ]),
    ),
  ].sort(compareText);
  const crossingCorridorIds = corridors
    .filter(
      (corridor) =>
        corridor.waterCrossing &&
        corridor.boundaryFactIds.some((id) => waterFactIds.has(id)),
    )
    .map((corridor) => corridor.id)
    .sort(compareText);
  if (crossingCorridorIds.length === 0) return [];

  const minX = river.x - river.width / 2;
  const maxX = river.x + river.width / 2;
  const minZ = river.z - river.depth / 2;
  const maxZ = river.z + river.depth / 2;
  return [
    {
      id: stableId("water-boundary", `${repoScope}:${river.id}`),
      riverId: river.id,
      outline: [
        point(minX, minZ),
        point(maxX, minZ),
        point(maxX, maxZ),
        point(minX, maxZ),
        point(minX, minZ),
      ],
      coastlines: [
        {
          side: "west",
          points: [point(minX, minZ), point(minX, maxZ)],
        },
        {
          side: "east",
          points: [point(maxX, minZ), point(maxX, maxZ)],
        },
      ],
      crossingCorridorIds,
      relationIds,
      boundaryFactIds,
      evidence: {
        entityIds,
        relationIds,
        boundaryFactIds,
        provenance:
          relevantFacts.length === 1
            ? relevantFacts[0]!.fact.provenance
            : undefined,
        reason:
          "An existing river represents an explicitly declared cross-component artifact boundary. " +
          relevantFacts.map(({ fact }) => fact.reason).join(" "),
      },
    },
  ];
}

function semanticPlanSeed(
  repositorySeed: string,
  components: readonly SemanticComponent[],
  campuses: readonly SemanticCampus[],
  corridors: readonly SemanticCorridor[],
  boundaryFacts: readonly ValidatedBoundaryFact[],
): string {
  const componentSignature = [...components]
    .sort((left, right) => compareText(left.id, right.id))
    .map(
      (component) =>
        `${component.id}:${component.architectureKind}:${component.entityIds.join(",")}`,
    )
    .join("|");
  const layoutSignature = [...campuses]
    .sort((left, right) => compareText(left.id, right.id))
    .map(
      (campus) =>
        `${campus.id}:${campus.x},${campus.z},${campus.width},${campus.depth},${campus.orientation}`,
    )
    .join("|");
  const corridorSignature = [...corridors]
    .sort((left, right) => compareText(left.id, right.id))
    .map(
      (corridor) =>
        `${corridor.id}:${corridor.basis}:${corridor.sourceComponentId}->${corridor.targetComponentId}:` +
        `${corridor.boundaryFactIds.join(",")}:${corridor.points
          .map((candidate) => `${candidate.x},${candidate.z}`)
          .join(";")}`,
    )
    .join("|");
  const boundarySignature = [...boundaryFacts]
    .sort((left, right) => compareText(left.fact.id, right.fact.id))
    .map(
      ({ fact }) =>
        `${fact.id}:${fact.kind}:${fact.crossing}:${fact.sourceEntityId}->${fact.targetEntityId}:` +
        `${fact.relationId ?? ""}:${fact.provenance}:${fact.reason}`,
    )
    .join("|");
  return `semantic-${stableHash(
    [
      repositorySeed,
      componentSignature,
      layoutSignature,
      corridorSignature,
      boundarySignature,
    ].join("::"),
  )
    .toString(16)
    .padStart(8, "0")}`;
}

/**
 * Compile a stable component-scale city without replacing the canonical
 * file-level facts. Input ordering has no effect on the serialized output.
 */
export function planSemanticCity(
  input: PlanSemanticCityInput,
): SemanticCityPlan {
  const maximum = clampInteger(input.maximumComponents, 20, 1, 30);
  const minimum = Math.min(
    maximum,
    clampInteger(input.minimumComponents, 5, 1, 30),
  );
  const repoScope = input.cityPlan.seed;
  const entities = [...input.entities].sort(
    (left, right) =>
      compareText(left.id, right.id) || compareText(left.path, right.path),
  );
  const duplicateEntity = entities.find(
    (entity, index) => entity.id === entities[index - 1]?.id,
  );
  if (duplicateEntity) {
    throw new Error(`Duplicate entity id: ${duplicateEntity.id}`);
  }
  const entityById = new Map(
    entities.map((entity) => [entity.id, entity]),
  );
  const validRelations = [...input.relations]
    .filter(
      (relation) =>
        entityById.has(relation.sourceId) &&
        entityById.has(relation.targetId),
    )
    .sort(
      (left, right) =>
        compareText(left.id, right.id) ||
        compareText(left.sourceId, right.sourceId) ||
        compareText(left.targetId, right.targetId),
    );
  const duplicateRelation = validRelations.find(
    (relation, index) => relation.id === validRelations[index - 1]?.id,
  );
  if (duplicateRelation) {
    throw new Error(`Duplicate relation id: ${duplicateRelation.id}`);
  }
  const relationById = new Map(
    validRelations.map((relation) => [relation.id, relation]),
  );
  const boundaryFacts = validateBoundaryFacts(
    input.boundaryFacts ?? [],
    entityById,
    relationById,
  );
  const boundaryFactById = new Map(
    boundaryFacts.map(({ fact }) => [fact.id, fact]),
  );
  const artifactBoundaryEntityIds = new Set(
    boundaryFacts.flatMap(({ fact }) => [
      fact.sourceEntityId,
      fact.targetEntityId,
    ]),
  );

  const districtById = new Map(
    input.cityPlan.districts.map((district) => [
      district.id,
      district,
    ]),
  );
  const groups = componentGroups(entities, minimum, maximum);
  const components = groups.map((group) =>
    baseComponent(
      group,
      districtById,
      repoScope,
      artifactBoundaryEntityIds,
    ),
  );
  const entityComponentId = new Map<string, string>();
  groups.forEach((group, index) => {
    const component = components[index]!;
    for (const entity of group.entities) {
      entityComponentId.set(entity.id, component.id);
    }
  });
  updateComponentRelationMetrics(
    components,
    validRelations,
    entityComponentId,
  );
  const candidateWaterFactIds = waterBoundaryFactIds(
    input.cityPlan,
    boundaryFacts,
    entityById,
    districtById,
  );
  const waterfrontPairs = waterfrontComponentPairs(
    boundaryFacts,
    candidateWaterFactIds,
    entityComponentId,
    entityById,
    districtById,
  );
  const waterFactIds = new Set(
    waterfrontPairs.map((pair) => pair.id),
  );
  const authorizedRiver =
    waterfrontPairs.length > 0 ? input.cityPlan.geography.river : null;

  const buildingByEntityId = new Map(
    input.cityPlan.buildings.map((building) => [
      building.entityId,
      building,
    ]),
  );
  const campuses = makeCampuses(
    components,
    districtById,
    buildingByEntityId,
    input.cityPlan.bounds,
    authorizedRiver,
    waterfrontPairs,
  );
  const campusByComponentId = new Map(
    campuses.map((campus) => [campus.componentId, campus]),
  );
  const entityAddresses = buildEntityAddresses(campuses, entityById);
  const drafts = [
    ...corridorDrafts(validRelations, entityComponentId, repoScope),
    ...componentAccessCorridorDrafts(components, repoScope),
    ...boundaryCorridorDrafts(
      boundaryFacts,
      entityComponentId,
      repoScope,
    ),
  ].sort((left, right) => compareText(left.id, right.id));
  const corridors = makeCorridors(
    drafts,
    campusByComponentId,
    entityById,
    boundaryFactById,
    waterFactIds,
    input.cityPlan.bounds,
    authorizedRiver,
  );
  const relationCorridorEntries = corridors
    .filter((corridor) => corridor.basis === "static-import")
    .flatMap((corridor) =>
      corridor.relationIds.map(
        (relationId) => [relationId, corridor.id] as const,
      ),
    )
    .sort(([left], [right]) => compareText(left, right));
  const relationCorridorIds = Object.fromEntries(
    relationCorridorEntries,
  );
  const bounds = cloneBounds(input.cityPlan.bounds);
  const waterBoundaries = makeWaterBoundaries(
    input.cityPlan,
    corridors,
    boundaryFacts,
    waterFactIds,
    repoScope,
  );

  return {
    version: SEMANTIC_CITY_VERSION,
    seed: semanticPlanSeed(
      input.cityPlan.seed,
      components,
      campuses,
      corridors,
      boundaryFacts,
    ),
    bounds,
    terrain: {
      bounds: cloneBounds(bounds),
      waterBoundaries,
    },
    components,
    campuses,
    corridors,
    roads: makeRoads(corridors, repoScope, authorizedRiver),
    mobility: {
      // Static imports describe structure. Moving agents are projected only
      // from an explicit replay/scenario journey by the caller.
      routes: [],
    },
    entityAddresses,
    relationCorridorIds,
  };
}
