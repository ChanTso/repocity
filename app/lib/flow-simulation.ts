import type {
  DemoEntity,
  DemoRelation,
  ProjectBoundaryFact,
} from "./demo-data";
import { findRoadPath, projectRoadAnchor } from "./flow-route";
import type { SemanticWaterBoundary } from "./semantic-city";
import type {
  CityPoint,
  LivingCityPlan,
  PlannedBuilding,
} from "./living-city";

/**
 * Pure, deterministic planning for the semantic traffic layer.
 *
 * The planner does not claim that an import is a runtime trace. Repository
 * journeys are explicitly marked as simulated, while paths backed by static
 * relations are marked as inferred. A future runtime adapter can add an
 * observed provenance without changing the renderer-facing route shapes.
 */

export const FLOW_SIMULATION_VERSION = "0.1" as const;

export type FlowTransportMode =
  | "pedestrian"
  | "car"
  | "transit"
  | "freight"
  | "boat";

export type FlowProvenance = "simulated" | "inferred";
export type FlowDirection = "forward" | "return";
export type FlowProgressPhase =
  | "queued"
  | "departing"
  | "in-transit"
  | "arriving";

export type FlowStepKind =
  | "entry"
  | "fan-out"
  | "process"
  | "join"
  | "transfer"
  | "destination";

export type FlowLegPhase =
  | "ingress"
  | "fan-out"
  | "transfer"
  | "join"
  | "egress"
  | "return";

export type FlowPayloadKind =
  | "source"
  | "history"
  | "schema"
  | "replay"
  | "bundle"
  | "city-plan"
  | "render-command"
  | "dependency";

export interface FlowPayload {
  kind: FlowPayloadKind;
  label: string;
}

export interface FlowEvidence {
  id: string;
  kind: "import-relation" | "path-heuristic" | "city-placement";
  provenance: FlowProvenance;
  confidence: "high" | "medium";
  label: string;
  reason: string;
  entityIds: string[];
  relationIds: string[];
  boundaryIds: string[];
}

export interface FlowStep {
  id: string;
  semanticKey: string;
  index: number;
  kind: FlowStepKind;
  entityId: string;
  buildingId: string;
  districtId: string;
  label: string;
  description: string;
  payload: FlowPayload;
  point: CityPoint;
  evidenceIds: string[];
}

export interface FlowRouteEndpoint {
  entityId: string;
  buildingId: string;
  districtId: string;
  point: CityPoint;
}

export interface FlowLeg {
  id: string;
  index: number;
  sourceStepId: string;
  targetStepId: string;
  sourceEntityId: string;
  targetEntityId: string;
  source: FlowRouteEndpoint;
  target: FlowRouteEndpoint;
  mode: FlowTransportMode;
  direction: FlowDirection;
  phase: FlowLegPhase;
  weight: number;
  relationIds: string[];
  provenance: FlowProvenance;
  points: CityPoint[];
  label: string;
  reason: string;
  evidenceIds: string[];
  artifactBoundaryId: string | null;
}

export interface FlowAgentToken {
  id: string;
  journeyId: string;
  legId: string;
  mode: FlowTransportMode;
  direction: FlowDirection;
  provenance: FlowProvenance;
  payload: FlowPayload;
  progress: number;
  progressPhase: FlowProgressPhase;
  speed: number;
  delay: number;
  evidenceIds: string[];
}

export interface FlowJourney {
  id: string;
  kind: "repository-pipeline" | "dependency-journey";
  title: string;
  summary: string;
  provenance: FlowProvenance;
  steps: FlowStep[];
  legs: FlowLeg[];
  tokens: FlowAgentToken[];
  evidence: FlowEvidence[];
}

export interface FlowSimulationDiagnostics {
  ignoredRelationIds: string[];
  missingBuildingEntityIds: string[];
  unroutableJourneyIds: string[];
}

export interface FlowSimulationPlan {
  version: typeof FLOW_SIMULATION_VERSION;
  journeys: FlowJourney[];
  defaultJourneyId: string | null;
  diagnostics: FlowSimulationDiagnostics;
}

type ArtifactWaterBoundary = Pick<
  SemanticWaterBoundary,
  | "id"
  | "outline"
  | "relationIds"
  | "boundaryFactIds"
  | "evidence"
>;

type ArtifactBoundaryFactReference = Pick<
  ProjectBoundaryFact,
  "id" | "sourceEntityId" | "targetEntityId" | "relationId"
>;

export interface PlanFlowSimulationInput {
  entities: readonly DemoEntity[];
  relations: readonly DemoRelation[];
  cityPlan: LivingCityPlan;
  /**
   * Override either a relation id or a `sourceId->targetId` pair.
   */
  modeOverrides?: Readonly<Record<string, FlowTransportMode>>;
  /**
   * Includes the repository pipeline when detected. Defaults to three.
   */
  maxJourneys?: number;
  /**
   * Maximum number of static dependency legs in a generated journey.
   * Defaults to eight.
   */
  maxLegsPerJourney?: number;
  /**
   * Explicit scenario cohort size per leg. Car legs use at least two tokens
   * so a request and response are both visible. When omitted, a fixed
   * mode-specific cohort is used; static import weight never becomes traffic.
   */
  tokensPerLeg?: number;
  /**
   * A typed semantic artifact boundary is the sole authority for boat
   * transport. Legacy V2 river geometry never enables water transport.
   */
  artifactWaterBoundary?:
    | ArtifactWaterBoundary
    | null;
  /**
   * All typed semantic water boundaries. Matching is endpoint/evidence based
   * and therefore independent of input order. The singular property above is
   * retained for callers compiled against the first Flow API.
   */
  artifactWaterBoundaries?: readonly ArtifactWaterBoundary[];
  /**
   * Exact fact endpoints let an aggregated water body select the fact that
   * belongs to a particular producer/consumer pair.
   */
  artifactBoundaryFacts?: readonly ArtifactBoundaryFactReference[];
}

interface JourneyDraftStep {
  key: string;
  entity: DemoEntity;
  kind: FlowStepKind;
  label: string;
  description: string;
  payload: FlowPayload;
}

interface JourneyDraftLeg {
  sourceKey: string;
  targetKey: string;
  mode?: FlowTransportMode;
  direction?: FlowDirection;
  phase: FlowLegPhase;
  weight: number;
  relationIds: string[];
  label: string;
  reason: string;
  artifactBoundaryId?: string;
}

interface JourneyDraft {
  id: string;
  kind: FlowJourney["kind"];
  title: string;
  summary: string;
  provenance: FlowProvenance;
  steps: JourneyDraftStep[];
  legs: JourneyDraftLeg[];
}

interface PlannerContext {
  cityPlan: LivingCityPlan;
  entityById: ReadonlyMap<string, DemoEntity>;
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>;
  validRelations: DemoRelation[];
  relationsByPair: ReadonlyMap<string, DemoRelation[]>;
  modeOverrides: Readonly<Record<string, FlowTransportMode>>;
  tokensPerLeg: number | undefined;
  artifactWaterBoundaries: readonly ArtifactWaterBoundary[];
  artifactBoundaryFactById: ReadonlyMap<
    string,
    ArtifactBoundaryFactReference
  >;
}

interface RepositoryAnchor {
  key:
    | "prepare"
    | "git"
    | "code"
    | "compiler"
    | "replay"
    | "producer-schema"
    | "writer"
    | "loader"
    | "living"
    | "scene";
  label: string;
  description: string;
  payload: FlowPayload;
  fragments: readonly string[];
}

const REPOSITORY_ANCHORS: readonly RepositoryAnchor[] = [
  {
    key: "prepare",
    label: "CLI / buildProject 编译城门",
    description:
      "CLI 接收输入，buildProject 调用 prepareRepository，准备本地或远程仓库。",
    payload: { kind: "source", label: "仓库输入" },
    fragments: [
      "apps/cli/src/cli.",
      "/cli/src/cli.",
      "apps/cli/src/bundle.",
      "/cli/src/bundle.",
      "buildproject",
      "repocity-cli",
      "apps/web/repo-shell-",
      "repo-shell",
    ],
  },
  {
    key: "git",
    label: "Git 历史分析厂",
    description:
      "analyzeGitRepository 按提交读取历史、重命名和实体生命周期，并负责调度源码分析。",
    payload: { kind: "history", label: "版本历史" },
    fragments: [
      "packages/git-analyzer/src/analyze.",
      "packages/git-analyzer/",
      "git-analyzer",
      "packages/analyzer/git-history",
      "git-history",
    ],
  },
  {
    key: "code",
    label: "Code Analyzer 内部翼楼",
    description:
      "Git analyzer 在处理每个提交时调用 code-analyzer 解析源码、导出与静态 import；它不是与 Git 并行的第二条主线。",
    payload: { kind: "source", label: "源码事实" },
    fragments: [
      "packages/code-analyzer/src/analyze.",
      "packages/code-analyzer/",
      "code-analyzer",
      "packages/analyzer/source-parser",
      "source-parser",
    ],
  },
  {
    key: "compiler",
    label: "City Compiler 规划院",
    description:
      "compileCity 将全历史文件事实编译为稳定 district、实体身份与布局。",
    payload: { kind: "city-plan", label: "稳定城市事实" },
    fragments: [
      "packages/city-compiler/src/layout.",
      "packages/city-compiler/",
      "city-compiler",
      "packages/core/district-layout",
      "district-layout",
    ],
  },
  {
    key: "replay",
    label: "Replay Engine 编组站",
    description:
      "compileReplay 将城市实体、关系、commit 和 delta 编成章节与 keyframe。",
    payload: { kind: "replay", label: "回放车厢" },
    fragments: [
      "packages/replay-engine/",
      "replay-engine",
      "packages/core/replay-clock",
      "replay-clock",
    ],
  },
  {
    key: "producer-schema",
    label: "Producer Schema 海关",
    description:
      "CLI 生产侧调用 validateRepoCityBundle，在写盘前验证完整 bundle 契约。",
    payload: { kind: "schema", label: "生产侧已验证事实" },
    fragments: [
      "packages/schema/src/index.",
      "packages/schema/",
      "/schema/src/",
      "packages/core/project-manifest",
      "project-manifest",
      "schema",
    ],
  },
  {
    key: "writer",
    label: "Static Bundle 出港仓",
    description:
      "writeStaticBundle 将 manifest、实体、关系、delta、keyframe 与知识文档原子写入静态目录。",
    payload: { kind: "bundle", label: "静态 Bundle" },
    fragments: [
      "apps/cli/src/bundle.",
      "/cli/src/bundle.",
      "writestaticbundle",
      "packages/analyzer/bundle-writer",
      "bundle-writer",
    ],
  },
  {
    key: "loader",
    label: "Project Bundle 入城港",
    description:
      "project-bundle loader 获取每项静态资源，并在消费侧再次执行独立 schema 校验。",
    payload: { kind: "bundle", label: "静态 Bundle" },
    fragments: [
      "app/lib/project-bundle.",
      "project-bundle",
      "apps/web/project-loader",
      "project-loader",
    ],
  },
  {
    key: "living",
    label: "Viewer 城市调度中心",
    description:
      "living-city 生成浏览器城市计划，viewer-replay 将当前 commit 的精确状态投影给场景。",
    payload: { kind: "city-plan", label: "城市计划" },
    fragments: [
      "app/lib/living-city.",
      "living-city",
      "app/lib/viewer-replay.",
      "viewer-replay",
      "apps/web/timeline",
      "timeline",
      "packages/core/relation-index",
      "relation-index",
    ],
  },
  {
    key: "scene",
    label: "三维施工现场",
    description: "消费城市计划并将它实例化为可探索的场景。",
    payload: { kind: "render-command", label: "渲染指令" },
    fragments: [
      "app/components/cityscene.",
      "app/components/city/cityscene.",
      "cityscene",
      "packages/renderer/city-scene",
      "city-scene",
    ],
  },
] as const;

const MODE_PAYLOADS: Record<FlowTransportMode, FlowPayload> = {
  pedestrian: { kind: "dependency", label: "局部调用" },
  car: { kind: "dependency", label: "同步请求" },
  transit: { kind: "dependency", label: "共享调用流" },
  freight: { kind: "bundle", label: "数据产物" },
  boat: { kind: "dependency", label: "异步消息" },
};

const MODE_SPEEDS: Record<FlowTransportMode, number> = {
  pedestrian: 0.72,
  car: 1.16,
  transit: 0.96,
  freight: 0.66,
  boat: 0.54,
};

const MODE_SCENARIO_COHORTS: Record<FlowTransportMode, number> = {
  pedestrian: 6,
  car: 2,
  transit: 4,
  freight: 3,
  boat: 2,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value!)));
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  const result = Math.round(value * scale) / scale;
  return Object.is(result, -0) ? 0 : result;
}

function clonePoint(value: CityPoint): CityPoint {
  return { x: round(value.x), z: round(value.z) };
}

function pointEqual(left: CityPoint, right: CityPoint): boolean {
  return left.x === right.x && left.z === right.z;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pairKey(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function relationOrder(left: DemoRelation, right: DemoRelation): number {
  return (
    compareText(left.sourceId, right.sourceId) ||
    compareText(left.targetId, right.targetId) ||
    right.weight - left.weight ||
    compareText(left.id, right.id)
  );
}

interface ArtifactBoundaryMatch {
  boundary: ArtifactWaterBoundary;
  factId: string;
}

function artifactBoundaryOrder(
  left: ArtifactWaterBoundary,
  right: ArtifactWaterBoundary,
): number {
  return (
    compareText(left.id, right.id) ||
    compareText(
      [...left.boundaryFactIds].sort(compareText).join("\u001f"),
      [...right.boundaryFactIds].sort(compareText).join("\u001f"),
    ) ||
    compareText(
      [...left.relationIds].sort(compareText).join("\u001f"),
      [...right.relationIds].sort(compareText).join("\u001f"),
    )
  );
}

function normalizedArtifactWaterBoundaries(
  input: PlanFlowSimulationInput,
): ArtifactWaterBoundary[] {
  const candidates = [
    ...(input.artifactWaterBoundaries ?? []),
    ...(input.artifactWaterBoundary ? [input.artifactWaterBoundary] : []),
  ].sort(artifactBoundaryOrder);
  const byId = new Map<string, ArtifactWaterBoundary>();
  for (const boundary of candidates) {
    if (!byId.has(boundary.id)) byId.set(boundary.id, boundary);
  }
  return [...byId.values()];
}

function artifactBoundaryFactMap(
  facts: readonly ArtifactBoundaryFactReference[],
): ReadonlyMap<string, ArtifactBoundaryFactReference> {
  const ordered = [...facts].sort(
    (left, right) =>
      compareText(left.id, right.id) ||
      compareText(left.sourceEntityId, right.sourceEntityId) ||
      compareText(left.targetEntityId, right.targetEntityId) ||
      compareText(left.relationId ?? "", right.relationId ?? ""),
  );
  const byId = new Map<string, ArtifactBoundaryFactReference>();
  for (const fact of ordered) {
    if (!byId.has(fact.id)) byId.set(fact.id, fact);
  }
  return byId;
}

function endpointMatchScore(
  sourceEntityId: string,
  targetEntityId: string,
  fact: ArtifactBoundaryFactReference,
): number {
  if (
    fact.sourceEntityId === sourceEntityId &&
    fact.targetEntityId === targetEntityId
  ) {
    return 600;
  }
  if (
    fact.sourceEntityId === targetEntityId &&
    fact.targetEntityId === sourceEntityId
  ) {
    return 550;
  }
  return 0;
}

function matchArtifactWaterBoundary(
  context: PlannerContext,
  sourceEntityId: string,
  targetEntityId: string,
  relationIds: readonly string[],
  requiredFactId?: string,
): ArtifactBoundaryMatch | null {
  const relationIdSet = new Set(relationIds);
  const candidates: Array<ArtifactBoundaryMatch & { score: number }> = [];

  for (const boundary of context.artifactWaterBoundaries) {
    const factIds = [...boundary.boundaryFactIds].sort(compareText);
    if (requiredFactId) {
      if (factIds.includes(requiredFactId)) {
        candidates.push({
          boundary,
          factId: requiredFactId,
          score: 10_000,
        });
      }
      continue;
    }

    const knownFacts = factIds
      .map((id) => context.artifactBoundaryFactById.get(id))
      .filter(
        (fact): fact is ArtifactBoundaryFactReference => Boolean(fact),
      );
    if (knownFacts.length > 0) {
      for (const fact of knownFacts) {
        const endpointScore = endpointMatchScore(
          sourceEntityId,
          targetEntityId,
          fact,
        );
        const relationScore =
          fact.relationId && relationIdSet.has(fact.relationId) ? 500 : 0;
        const score = Math.max(endpointScore, relationScore);
        if (score > 0) {
          candidates.push({ boundary, factId: fact.id, score });
        }
      }
      continue;
    }

    const boundaryEndpointMatch =
      boundary.evidence.entityIds.includes(sourceEntityId) &&
      boundary.evidence.entityIds.includes(targetEntityId);
    const relationOverlap = boundary.relationIds.reduce(
      (count, relationId) => count + Number(relationIdSet.has(relationId)),
      0,
    );
    const factId = factIds[0];
    if (factId && (boundaryEndpointMatch || relationOverlap > 0)) {
      candidates.push({
        boundary,
        factId,
        score: boundaryEndpointMatch ? 300 : 200 + relationOverlap,
      });
    }
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      compareText(left.factId, right.factId) ||
      artifactBoundaryOrder(left.boundary, right.boundary),
  );
  const selected = candidates[0];
  return selected
    ? { boundary: selected.boundary, factId: selected.factId }
    : null;
}

function uniqueRoutePoints(points: readonly CityPoint[]): CityPoint[] {
  const result: CityPoint[] = [];
  for (const candidate of points.map(clonePoint)) {
    if (!result.some((point) => pointEqual(point, candidate))) {
      result.push(candidate);
    }
  }
  return result;
}

function orthogonalRoute(
  start: CityPoint,
  end: CityPoint,
  mode: FlowTransportMode,
  artifactWaterBoundary:
    | Pick<SemanticWaterBoundary, "outline">
    | null,
  key: string,
): CityPoint[] {
  if (mode === "boat" && artifactWaterBoundary) {
    const outlineX = artifactWaterBoundary.outline.map(
      (candidate) => candidate.x,
    );
    const boundaryX =
      outlineX.length > 0
        ? (Math.min(...outlineX) + Math.max(...outlineX)) / 2
        : (start.x + end.x) / 2;
    return uniqueRoutePoints([
      start,
      { x: boundaryX, z: start.z },
      { x: boundaryX, z: end.z },
      end,
    ]);
  }

  if (start.x === end.x || start.z === end.z) {
    return uniqueRoutePoints([start, end]);
  }

  const horizontalFirst = stableHash(key) % 2 === 0;
  return uniqueRoutePoints([
    start,
    horizontalFirst
      ? { x: end.x, z: start.z }
      : { x: start.x, z: end.z },
    end,
  ]);
}

function roadConstrainedRoute(
  cityPlan: LivingCityPlan,
  source: PlannedBuilding,
  target: PlannedBuilding,
): CityPoint[] | null {
  const sourceAnchor = projectRoadAnchor(cityPlan, {
    roadId: source.frontage.roadId,
    point: source.frontage.point,
  });
  const targetAnchor = projectRoadAnchor(cityPlan, {
    roadId: target.frontage.roadId,
    point: target.frontage.point,
  });
  if (!sourceAnchor || !targetAnchor) return null;
  const roadPath = findRoadPath(cityPlan, sourceAnchor, targetAnchor);
  return roadPath
    ? uniqueRoutePoints([
        source.frontage.point,
        ...roadPath,
        target.frontage.point,
      ])
    : null;
}

function entityLabel(entity: DemoEntity): string {
  return entity.name || entity.path.split("/").at(-1) || entity.id;
}

function repositoryAnchorScore(
  entity: DemoEntity,
  anchor: RepositoryAnchor,
): number {
  const haystack = `${entity.path}\n${entity.name}`.toLowerCase();
  let best = 0;
  for (const [index, fragment] of anchor.fragments.entries()) {
    const position = haystack.indexOf(fragment);
    if (position < 0) continue;
    best = Math.max(best, 1_000 - index * 100 - Math.min(position, 80));
  }
  return best;
}

function findRepositoryAnchors(
  entities: readonly DemoEntity[],
): Map<RepositoryAnchor["key"], DemoEntity> | null {
  const result = new Map<RepositoryAnchor["key"], DemoEntity>();
  const claimed = new Set<string>();

  for (const anchor of REPOSITORY_ANCHORS) {
    const candidates = entities
      .map((entity) => ({
        entity,
        score: repositoryAnchorScore(entity, anchor),
      }))
      .filter((candidate) => candidate.score > 0 && !claimed.has(candidate.entity.id))
      .sort(
        (left, right) =>
          right.score - left.score ||
          compareText(left.entity.path, right.entity.path) ||
          compareText(left.entity.id, right.entity.id),
      );
    const selected = candidates[0]?.entity;
    if (!selected) return null;
    result.set(anchor.key, selected);
    claimed.add(selected.id);
  }

  return result;
}

function relationIdsForPair(
  context: PlannerContext,
  sourceId: string,
  targetId: string,
): string[] {
  return (
    context.relationsByPair.get(pairKey(sourceId, targetId))?.map(
      (relation) => relation.id,
    ) ?? []
  );
}

function repositoryJourneyDraft(
  entities: readonly DemoEntity[],
  context: PlannerContext,
): JourneyDraft | null {
  const anchors = findRepositoryAnchors(entities);
  if (!anchors) return null;
  const writer = anchors.get("writer")!;
  const loader = anchors.get("loader")!;
  const artifactBoundaryMatch = matchArtifactWaterBoundary(
    context,
    writer.id,
    loader.id,
    relationIdsForPair(context, writer.id, loader.id),
  );
  const artifactBoundaryFactId = artifactBoundaryMatch?.factId ?? null;

  const stepKinds: Record<RepositoryAnchor["key"], FlowStepKind> = {
    prepare: "entry",
    git: "process",
    code: "process",
    compiler: "process",
    replay: "process",
    "producer-schema": "process",
    writer: "transfer",
    loader: "transfer",
    living: "process",
    scene: "destination",
  };
  const steps = REPOSITORY_ANCHORS.map((anchor) => ({
    key: anchor.key,
    entity: anchors.get(anchor.key)!,
    kind: stepKinds[anchor.key],
    label: anchor.label,
    description: anchor.description,
    payload: anchor.payload,
  }));

  const edgeSpecs: Array<{
    source: RepositoryAnchor["key"];
    target: RepositoryAnchor["key"];
    mode: FlowTransportMode;
    phase: FlowLegPhase;
    label: string;
    reason: string;
    artifactBoundaryId?: string;
  }> = [
    {
      source: "prepare",
      target: "git",
      mode: "freight",
      phase: "ingress",
      label: "已准备仓库入厂",
      reason:
        "prepareRepository 完成后，buildProject 串行调用 analyzeGitRepository；这里不存在 CLI 到 code-analyzer 的并行支线。",
    },
    {
      source: "git",
      target: "code",
      mode: "pedestrian",
      phase: "transfer",
      label: "分析厂内部转运",
      reason:
        "code-analyzer 由 git-analyzer 在逐 commit 处理过程中内部调用，是同一分析阶段的后继翼楼。",
    },
    {
      source: "code",
      target: "compiler",
      mode: "freight",
      phase: "transfer",
      label: "分析事实送往规划院",
      reason:
        "analyzeGitRepository 返回实体、关系和历史事实后，buildProject 串行调用 compileCity。",
    },
    {
      source: "compiler",
      target: "replay",
      mode: "freight",
      phase: "transfer",
      label: "稳定城市事实编组",
      reason:
        "compileCity 的稳定实体与 layout 连同 commit、relation 和 delta 一起交给 compileReplay。",
    },
    {
      source: "replay",
      target: "producer-schema",
      mode: "freight",
      phase: "transfer",
      label: "完整 Bundle 生产侧验关",
      reason:
        "Replay chapters、delta 与 keyframe 完成后才组装完整 bundle，并调用 validateRepoCityBundle；Schema 校验不在 replay 之前。",
    },
    {
      source: "producer-schema",
      target: "writer",
      mode: "freight",
      phase: "transfer",
      label: "已验证 Bundle 写盘",
      reason:
        "只有生产侧 schema 校验通过的 RepoCityBundle 才交给 writeStaticBundle 原子写入静态目录。",
    },
    {
      source: "writer",
      target: "loader",
      mode: artifactBoundaryFactId ? "boat" : "freight",
      phase: "transfer",
      label: artifactBoundaryFactId
        ? "静态 Bundle 跨 Artifact 水界"
        : "静态 Bundle 陆路交付",
      reason: artifactBoundaryFactId
        ? `Typed artifact boundary fact ${artifactBoundaryFactId} 明确连接静态 writer 与浏览器 loader；只有该语义边界事实允许货船跨界。`
        : "没有 typed artifact water boundary；静态 Bundle 从 writer 到 project-bundle loader 使用陆路货运，旧 cityPlan 河流不授予水运能力。",
      ...(artifactBoundaryFactId
        ? { artifactBoundaryId: artifactBoundaryFactId }
        : {}),
    },
    {
      source: "loader",
      target: "living",
      mode: "car",
      phase: "transfer",
      label: "消费侧验证与城市规划请求",
      reason:
        "project-bundle loader 对每项资源做消费侧 schema 校验，再将可信 ViewerProject 交给 living-city 与 viewer-replay。",
    },
    {
      source: "living",
      target: "scene",
      mode: "pedestrian",
      phase: "egress",
      label: "场景施工与回放投影",
      reason:
        "living-city 的稳定计划和 viewer-replay 的当前 commit 状态在浏览器内传给 CityScene 实例化。",
    },
  ];

  const legs = edgeSpecs.map((edge) => {
    const source = anchors.get(edge.source)!;
    const target = anchors.get(edge.target)!;
    return {
      sourceKey: edge.source,
      targetKey: edge.target,
      mode: edge.mode,
      phase: edge.phase,
      weight: Math.max(
        1,
        ...(
          context.relationsByPair.get(pairKey(source.id, target.id)) ?? []
        ).map((relation) => relation.weight),
      ),
      relationIds: relationIdsForPair(context, source.id, target.id),
      label: edge.label,
      reason: edge.reason,
      ...(edge.artifactBoundaryId
        ? { artifactBoundaryId: edge.artifactBoundaryId }
        : {}),
    };
  });

  return {
    id: "journey-repocity-repository-to-city",
    kind: "repository-pipeline",
    title: "一个仓库如何变成一座城市",
    summary:
      "真实 buildProject 串行结构导览：从仓库准备、Git/Code 分析、城市与 replay 编译、双侧 schema 验证、静态写入和加载直到 CityScene；这是可解释模拟，不是运行 trace。",
    provenance: "simulated",
    steps,
    legs,
  };
}

function entryScore(
  entity: DemoEntity,
  incomingCount: number,
  outgoingCount: number,
): number {
  const path = entity.path.toLowerCase();
  const entryHint =
    /(?:^|\/)(?:cli|main|index|route|server|app)\.[cm]?[jt]sx?$/.test(path) ||
    path.includes("/entry");
  return (
    (incomingCount === 0 ? 10_000 : 0) +
    (entryHint ? 5_000 : 0) +
    outgoingCount * 100 +
    Math.max(0, entity.maxMetrics.fanOut)
  );
}

function dependencyJourneyDrafts(
  context: PlannerContext,
  maxJourneys: number,
  maxLegs: number,
): JourneyDraft[] {
  if (maxJourneys <= 0) return [];

  const outgoing = new Map<string, DemoRelation[]>();
  const incomingCount = new Map<string, number>();
  for (const relation of context.validRelations) {
    const relations = outgoing.get(relation.sourceId) ?? [];
    relations.push(relation);
    outgoing.set(relation.sourceId, relations);
    incomingCount.set(
      relation.targetId,
      (incomingCount.get(relation.targetId) ?? 0) + 1,
    );
  }
  for (const relations of outgoing.values()) {
    relations.sort(
      (left, right) =>
        right.weight - left.weight ||
        compareText(left.targetId, right.targetId) ||
        compareText(left.id, right.id),
    );
  }

  const starts = [...outgoing.keys()]
    .map((entityId) => context.entityById.get(entityId)!)
    .sort((left, right) => {
      const leftOutgoing = outgoing.get(left.id)?.length ?? 0;
      const rightOutgoing = outgoing.get(right.id)?.length ?? 0;
      return (
        entryScore(
          right,
          incomingCount.get(right.id) ?? 0,
          rightOutgoing,
        ) -
          entryScore(
            left,
            incomingCount.get(left.id) ?? 0,
            leftOutgoing,
          ) ||
        compareText(left.path, right.path) ||
        compareText(left.id, right.id)
      );
    });

  const signatures = new Set<string>();
  const drafts: JourneyDraft[] = [];
  for (const start of starts) {
    if (drafts.length >= maxJourneys) break;
    const visited = new Set([start.id]);
    const pathEntities = [start];
    const pathRelations: DemoRelation[] = [];
    let currentId = start.id;

    while (pathRelations.length < maxLegs) {
      const next = outgoing
        .get(currentId)
        ?.find((relation) => !visited.has(relation.targetId));
      if (!next) break;
      const target = context.entityById.get(next.targetId);
      if (!target) break;
      pathRelations.push(next);
      pathEntities.push(target);
      visited.add(target.id);
      currentId = target.id;
    }
    if (pathRelations.length === 0) continue;

    const signature = pathEntities.map((entity) => entity.id).join(">");
    if (signatures.has(signature)) continue;
    signatures.add(signature);

    const journeyNumber = drafts.length + 1;
    const steps: JourneyDraftStep[] = pathEntities.map((entity, index) => ({
      key: `step-${index + 1}`,
      entity,
      kind:
        index === 0
          ? "entry"
          : index === pathEntities.length - 1
            ? "destination"
            : "process",
      label: entityLabel(entity),
      description:
        index === 0
          ? "静态依赖旅程的入口。"
          : `由上一模块通过已分析的 import 关系抵达 ${entity.path}。`,
      payload: { kind: "dependency", label: "静态依赖" },
    }));
    const legs: JourneyDraftLeg[] = pathRelations.map((relation, index) => ({
      sourceKey: `step-${index + 1}`,
      targetKey: `step-${index + 2}`,
      phase:
        index === 0
          ? "ingress"
          : index === pathRelations.length - 1
            ? "egress"
            : "transfer",
      weight: Math.max(1, relation.weight),
      relationIds: [relation.id],
      label: `${entityLabel(pathEntities[index]!)} → ${entityLabel(
        pathEntities[index + 1]!,
      )}`,
      reason: `由静态 import 关系 ${relation.id} 推导；不等同于运行时调用。`,
    }));

    drafts.push({
      id: `journey-dependency-${journeyNumber}-${slug(start.id)}`,
      kind: "dependency-journey",
      title: `${entityLabel(start)} 的依赖旅程`,
      summary: `沿 ${pathRelations.length} 条静态 import 关系观察可能的结构流向。`,
      provenance: "inferred",
      steps,
      legs,
    });
  }

  return drafts;
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || stableHash(value).toString(16);
}

function inferredMode(
  draft: JourneyDraftLeg,
  source: DemoEntity,
  target: DemoEntity,
  relationWeight: number,
  context: PlannerContext,
): FlowTransportMode {
  const combined = `${source.path} ${target.path}`.toLowerCase();
  const sourceBuilding = context.buildingByEntityId.get(source.id)!;
  const targetBuilding = context.buildingByEntityId.get(target.id)!;
  const sameDistrict = source.districtId === target.districtId;
  const distance =
    Math.abs(sourceBuilding.x - targetBuilding.x) +
    Math.abs(sourceBuilding.z - targetBuilding.z);
  const asynchronous =
    /queue|event|message|broker|pubsub|kafka|stream|webhook/.test(combined);
  const freight =
    /bundle|artifact|build|compiler|compile|schema|storage|database|migration|file|git|analyzer/.test(
      combined,
    );
  const transit = /router|pipeline|replay|test|worker|bus/.test(combined);
  if (
    asynchronous &&
    boundaryAllowsBoat(draft, source, target, context)
  ) {
    return "boat";
  }
  if (freight) return "freight";
  if (transit || relationWeight >= 4) return "transit";
  if (sameDistrict && distance <= 24) return "pedestrian";
  return "car";
}

function boundaryAllowsBoat(
  draft: JourneyDraftLeg,
  source: DemoEntity,
  target: DemoEntity,
  context: PlannerContext,
): boolean {
  return Boolean(
    matchArtifactWaterBoundary(
      context,
      source.id,
      target.id,
      draft.relationIds,
      draft.artifactBoundaryId,
    ),
  );
}

function enforceBoatBoundary(
  requested: FlowTransportMode,
  draft: JourneyDraftLeg,
  source: DemoEntity,
  target: DemoEntity,
  context: PlannerContext,
): FlowTransportMode {
  return requested === "boat" &&
    !boundaryAllowsBoat(draft, source, target, context)
    ? "freight"
    : requested;
}

function resolveMode(
  draft: JourneyDraftLeg,
  source: DemoEntity,
  target: DemoEntity,
  context: PlannerContext,
): FlowTransportMode {
  for (const relationId of draft.relationIds) {
    const override = context.modeOverrides[relationId];
    if (override) {
      return enforceBoatBoundary(
        override,
        draft,
        source,
        target,
        context,
      );
    }
  }
  const pairOverride =
    context.modeOverrides[pairKey(source.id, target.id)];
  if (pairOverride) {
    return enforceBoatBoundary(
      pairOverride,
      draft,
      source,
      target,
      context,
    );
  }
  return enforceBoatBoundary(
    draft.mode ??
      inferredMode(draft, source, target, draft.weight, context),
    draft,
    source,
    target,
    context,
  );
}

function makeStepEvidence(
  journeyId: string,
  draft: JourneyDraft,
  step: JourneyDraftStep,
  index: number,
): FlowEvidence {
  return {
    id: `${journeyId}-evidence-step-${index + 1}`,
    kind:
      draft.provenance === "simulated"
        ? "path-heuristic"
        : "city-placement",
    provenance: draft.provenance,
    confidence: draft.provenance === "inferred" ? "high" : "medium",
    label:
      draft.provenance === "inferred"
        ? `城市实体 ${step.entity.path}`
        : `${step.label} 的职责映射`,
    reason:
      draft.provenance === "inferred"
        ? "该站点同时存在于实体目录和当前城市规划中。"
        : step.description,
    entityIds: [step.entity.id],
    relationIds: [],
    boundaryIds: [],
  };
}

function makeLegEvidence(
  journeyId: string,
  draft: JourneyDraft,
  leg: JourneyDraftLeg,
  source: DemoEntity,
  target: DemoEntity,
  index: number,
): FlowEvidence {
  return {
    id: `${journeyId}-evidence-leg-${index + 1}`,
    kind:
      leg.relationIds.length > 0
        ? "import-relation"
        : "path-heuristic",
    provenance: draft.provenance,
    confidence:
      leg.relationIds.length > 0 && draft.provenance === "inferred"
        ? "high"
        : "medium",
    label: leg.artifactBoundaryId
      ? `Artifact boundary ${leg.artifactBoundaryId}`
      : leg.relationIds.length > 0
        ? `${leg.relationIds.length} 条静态依赖`
        : `${source.path} 到 ${target.path} 的场景推演`,
    reason: leg.reason,
    entityIds: [source.id, target.id],
    relationIds: [...leg.relationIds].sort(compareText),
    boundaryIds: leg.artifactBoundaryId
      ? [leg.artifactBoundaryId]
      : [],
  };
}

function progressPhase(progress: number): FlowProgressPhase {
  if (progress === 0) return "queued";
  if (progress < 0.14) return "departing";
  if (progress > 0.86) return "arriving";
  return "in-transit";
}

/**
 * Sample one planned token on its current leg. The caller owns simulation
 * time, so pausing is simply holding the same value and is byte-stable.
 */
export function sampleFlowTokenProgress(
  token: Pick<
    FlowAgentToken,
    "delay" | "direction" | "progress" | "speed"
  >,
  simulationTime: number,
): number {
  const elapsed = Math.max(
    0,
    Math.max(0, simulationTime) - Math.max(0, token.delay),
  );
  const forwardProgress = Math.min(
    1,
    Math.max(
      0,
      token.progress + elapsed * Math.max(0, token.speed) * 0.5,
    ),
  );
  return token.direction === "return"
    ? 1 - forwardProgress
    : forwardProgress;
}

function makeTokens(
  journeyId: string,
  leg: FlowLeg,
  sourcePayload: FlowPayload,
  targetPayload: FlowPayload,
  explicitCount: number | undefined,
): FlowAgentToken[] {
  const requestedCount =
    explicitCount ?? MODE_SCENARIO_COHORTS[leg.mode];
  const count =
    leg.mode === "car" ? Math.max(2, requestedCount) : requestedCount;
  const hash = stableHash(`${journeyId}:${leg.id}`);
  const jitter = (hash % 71) / 1_000;

  return Array.from({ length: count }, (_, index) => {
    const isCarResponse =
      leg.mode === "car" &&
      (leg.direction === "return" || index === count - 1);
    const payload = isCarResponse ? targetPayload : sourcePayload;
    const tokenPayload =
      payload.kind === "dependency" ? MODE_PAYLOADS[leg.mode] : payload;
    const progress = round(
      isCarResponse || index === 0
        ? 0
        : Math.min(0.94, index / count + jitter),
      4,
    );
    return {
      id: `${leg.id}-token-${index + 1}`,
      journeyId,
      legId: leg.id,
      mode: leg.mode,
      direction: isCarResponse ? "return" : leg.direction,
      provenance: leg.provenance,
      payload: isCarResponse
        ? {
            ...tokenPayload,
            label: `${tokenPayload.label} · 响应`,
          }
        : tokenPayload,
      progress,
      progressPhase: progressPhase(progress),
      speed: round(
        MODE_SPEEDS[leg.mode] * (0.94 + ((hash >>> (index % 12)) % 13) / 100),
        3,
      ),
      delay: round(index * 0.18 + (hash % 17) / 100, 3),
      evidenceIds: [...leg.evidenceIds],
    };
  });
}

function materializeJourney(
  draft: JourneyDraft,
  context: PlannerContext,
): FlowJourney | null {
  const stepByKey = new Map<string, FlowStep>();
  const evidence: FlowEvidence[] = [];
  const steps = draft.steps.map((draftStep, index) => {
    const building = context.buildingByEntityId.get(draftStep.entity.id)!;
    const stepEvidence = makeStepEvidence(
      draft.id,
      draft,
      draftStep,
      index,
    );
    evidence.push(stepEvidence);
    const step: FlowStep = {
      id: `${draft.id}-step-${index + 1}`,
      semanticKey: draftStep.key,
      index,
      kind: draftStep.kind,
      entityId: draftStep.entity.id,
      buildingId: building.id,
      districtId: building.districtId,
      label: draftStep.label,
      description: draftStep.description,
      payload: { ...draftStep.payload },
      point: clonePoint(building.frontage.point),
      evidenceIds: [stepEvidence.id],
    };
    stepByKey.set(draftStep.key, step);
    return step;
  });

  let hasUnroutableLeg = false;
  const legs = draft.legs.map((draftLeg, index) => {
    const sourceStep = stepByKey.get(draftLeg.sourceKey)!;
    const targetStep = stepByKey.get(draftLeg.targetKey)!;
    const sourceEntity = context.entityById.get(sourceStep.entityId)!;
    const targetEntity = context.entityById.get(targetStep.entityId)!;
    const sourceBuilding = context.buildingByEntityId.get(sourceEntity.id)!;
    const targetBuilding = context.buildingByEntityId.get(targetEntity.id)!;
    const mode = resolveMode(
      draftLeg,
      sourceEntity,
      targetEntity,
      context,
    );
    const artifactBoundaryMatch =
      mode === "boat"
        ? matchArtifactWaterBoundary(
            context,
            sourceEntity.id,
            targetEntity.id,
            draftLeg.relationIds,
            draftLeg.artifactBoundaryId,
          )
        : null;
    const materializedDraftLeg: JourneyDraftLeg = {
      ...draftLeg,
      artifactBoundaryId: artifactBoundaryMatch?.factId,
    };
    const legEvidence = makeLegEvidence(
      draft.id,
      draft,
      materializedDraftLeg,
      sourceEntity,
      targetEntity,
      index,
    );
    evidence.push(legEvidence);
    const id = `${draft.id}-leg-${index + 1}`;
    const sourcePoint = clonePoint(sourceBuilding.frontage.point);
    const targetPoint = clonePoint(targetBuilding.frontage.point);
    const roadRoute =
      mode === "car" || mode === "freight" || mode === "transit"
        ? roadConstrainedRoute(
            context.cityPlan,
            sourceBuilding,
            targetBuilding,
          )
        : null;
    if (
      (mode === "car" || mode === "freight" || mode === "transit") &&
      !roadRoute
    ) {
      hasUnroutableLeg = true;
    }
    return {
      id,
      index,
      sourceStepId: sourceStep.id,
      targetStepId: targetStep.id,
      sourceEntityId: sourceEntity.id,
      targetEntityId: targetEntity.id,
      source: {
        entityId: sourceEntity.id,
        buildingId: sourceBuilding.id,
        districtId: sourceBuilding.districtId,
        point: sourcePoint,
      },
      target: {
        entityId: targetEntity.id,
        buildingId: targetBuilding.id,
        districtId: targetBuilding.districtId,
        point: targetPoint,
      },
      mode,
      direction: draftLeg.direction ?? "forward",
      phase: draftLeg.phase,
      weight: Math.max(1, round(draftLeg.weight)),
      relationIds: [...draftLeg.relationIds].sort(compareText),
      provenance: draft.provenance,
      points:
        roadRoute ??
        orthogonalRoute(
          sourcePoint,
          targetPoint,
          mode,
          artifactBoundaryMatch?.boundary ?? null,
          id,
        ),
      label: materializedDraftLeg.label,
      reason: materializedDraftLeg.reason,
      evidenceIds: [legEvidence.id],
      artifactBoundaryId: artifactBoundaryMatch?.factId ?? null,
    } satisfies FlowLeg;
  });
  if (hasUnroutableLeg) return null;

  const payloadByStep = new Map(steps.map((step) => [step.id, step.payload]));
  const tokens = legs.flatMap((leg) =>
    makeTokens(
      draft.id,
      leg,
      payloadByStep.get(leg.sourceStepId) ?? MODE_PAYLOADS[leg.mode],
      payloadByStep.get(leg.targetStepId) ?? MODE_PAYLOADS[leg.mode],
      context.tokensPerLeg,
    ),
  );

  return {
    id: draft.id,
    kind: draft.kind,
    title: draft.title,
    summary: draft.summary,
    provenance: draft.provenance,
    steps,
    legs,
    tokens,
    evidence,
  };
}

/**
 * Build renderer-ready semantic journeys from repository facts and a city plan.
 *
 * Output is stable under input reordering. Relations with unknown entities or
 * entities absent from the current city plan are reported and ignored.
 */
export function planFlowSimulation(
  input: PlanFlowSimulationInput,
): FlowSimulationPlan {
  const sortedEntities = [...input.entities].sort(
    (left, right) =>
      compareText(left.id, right.id) || compareText(left.path, right.path),
  );
  const entityById = new Map(
    sortedEntities.map((entity) => [entity.id, entity]),
  );
  const buildingByEntityId = new Map(
    input.cityPlan.buildings
      .slice()
      .sort((left, right) => compareText(left.entityId, right.entityId))
      .map((building) => [building.entityId, building]),
  );
  const missingBuildingEntityIds = sortedEntities
    .filter((entity) => !buildingByEntityId.has(entity.id))
    .map((entity) => entity.id);

  const ignoredRelationIds: string[] = [];
  const validRelations = [...input.relations]
    .sort(relationOrder)
    .filter((relation) => {
      const valid =
        entityById.has(relation.sourceId) &&
        entityById.has(relation.targetId) &&
        buildingByEntityId.has(relation.sourceId) &&
        buildingByEntityId.has(relation.targetId);
      if (!valid) ignoredRelationIds.push(relation.id);
      return valid;
    });
  const relationsByPair = new Map<string, DemoRelation[]>();
  for (const relation of validRelations) {
    const key = pairKey(relation.sourceId, relation.targetId);
    const group = relationsByPair.get(key) ?? [];
    group.push(relation);
    group.sort(relationOrder);
    relationsByPair.set(key, group);
  }

  const maxJourneys = clampInteger(input.maxJourneys, 3, 1, 12);
  const maxLegs = clampInteger(input.maxLegsPerJourney, 8, 1, 32);
  const tokensPerLeg =
    input.tokensPerLeg === undefined
      ? undefined
      : clampInteger(input.tokensPerLeg, 1, 1, 12);
  const artifactWaterBoundaries =
    normalizedArtifactWaterBoundaries(input);
  const context: PlannerContext = {
    cityPlan: input.cityPlan,
    entityById,
    buildingByEntityId,
    validRelations,
    relationsByPair,
    modeOverrides: input.modeOverrides ?? {},
    tokensPerLeg,
    artifactWaterBoundaries,
    artifactBoundaryFactById: artifactBoundaryFactMap(
      input.artifactBoundaryFacts ?? [],
    ),
  };

  const plannableEntities = sortedEntities.filter((entity) =>
    buildingByEntityId.has(entity.id),
  );
  const repositoryJourney = repositoryJourneyDraft(
    plannableEntities,
    context,
  );
  const dependencySlots = maxJourneys - (repositoryJourney ? 1 : 0);
  const drafts = [
    ...(repositoryJourney ? [repositoryJourney] : []),
    ...dependencyJourneyDrafts(context, dependencySlots, maxLegs),
  ];
  const journeys: FlowJourney[] = [];
  const unroutableJourneyIds: string[] = [];
  for (const draft of drafts) {
    const journey = materializeJourney(draft, context);
    if (journey) journeys.push(journey);
    else unroutableJourneyIds.push(draft.id);
  }

  return {
    version: FLOW_SIMULATION_VERSION,
    journeys,
    defaultJourneyId: journeys[0]?.id ?? null,
    diagnostics: {
      ignoredRelationIds: [...new Set(ignoredRelationIds)].sort(compareText),
      missingBuildingEntityIds,
      unroutableJourneyIds,
    },
  };
}
