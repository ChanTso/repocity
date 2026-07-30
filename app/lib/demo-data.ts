export type FileRole =
  | "source"
  | "test"
  | "docs"
  | "config"
  | "script"
  | "other";

export interface DemoDistrict {
  id: string;
  name: string;
  eyebrow: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
}

export interface DemoEntity {
  id: string;
  kind: "building";
  path: string;
  aliases: string[];
  name: string;
  extension: string;
  language: "typescript" | "javascript";
  role: FileRole;
  districtId: string;
  bornAt: number;
  diedAt?: number;
  maxMetrics: {
    loc: number;
    exports: number;
    fanIn: number;
    fanOut: number;
    churn: number;
  };
  layout: {
    x: number;
    z: number;
    width: number;
    depth: number;
    maxHeight: number;
    rotationY: number;
    styleVariant: number;
  };
  summary: string;
  exportNames: string[];
}

export interface DemoRelation {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "import";
  bornAt: number;
  diedAt?: number;
  weight: number;
}

export interface DemoCommit {
  index: number;
  sha: string;
  parents: string[];
  authorName: string;
  authoredAt: string;
  message: string;
  tags: string[];
  changedEntityIds: string[];
  chapterId: string;
  additions: number;
  deletions: number;
}

export interface DemoChapter {
  id: string;
  title: string;
  subtitle: string;
  start: number;
  end: number;
}

export interface DemoManifest {
  schemaVersion: "0.1";
  projectId: string;
  repo: {
    name: string;
    remoteUrl?: string;
    defaultBranch: string;
    headSha: string;
  };
  stats: {
    entityCount: number;
    districtCount: number;
    commitCount: number;
    displayedCommitCount: number;
  };
}

export interface ViewerProject {
  manifest: DemoManifest;
  districts: DemoDistrict[];
  entities: DemoEntity[];
  relations: DemoRelation[];
  commits: DemoCommit[];
  chapters: DemoChapter[];
}

const districtSeeds: Array<
  Omit<DemoDistrict, "width" | "depth"> & {
    width: number;
    depth: number;
    prefix: string;
    count: number;
    role: FileRole;
  }
> = [
  {
    id: "core",
    name: "核心引擎",
    eyebrow: "CORE ENGINE",
    x: -16,
    z: -11,
    width: 14,
    depth: 14,
    color: "#50d5b7",
    prefix: "packages/core",
    count: 46,
    role: "source",
  },
  {
    id: "renderer",
    name: "渲染港",
    eyebrow: "RENDER DOCK",
    x: 1,
    z: -12,
    width: 14,
    depth: 14,
    color: "#7aa7ff",
    prefix: "packages/renderer",
    count: 48,
    role: "source",
  },
  {
    id: "web",
    name: "交互中枢",
    eyebrow: "WEB QUARTER",
    x: 18,
    z: -8,
    width: 15,
    depth: 14,
    color: "#b49cff",
    prefix: "apps/web",
    count: 52,
    role: "source",
  },
  {
    id: "analyzer",
    name: "分析工坊",
    eyebrow: "ANALYZER YARD",
    x: -14,
    z: 9,
    width: 14,
    depth: 14,
    color: "#ff9a6c",
    prefix: "packages/analyzer",
    count: 42,
    role: "source",
  },
  {
    id: "tests",
    name: "检验园",
    eyebrow: "TEST GARDENS",
    x: 4,
    z: 10,
    width: 14,
    depth: 14,
    color: "#f5d76e",
    prefix: "tests",
    count: 38,
    role: "test",
  },
  {
    id: "docs",
    name: "知识岛",
    eyebrow: "KNOWLEDGE ISLE",
    x: 20,
    z: 11,
    width: 14,
    depth: 11,
    color: "#ec7fa9",
    prefix: "docs",
    count: 28,
    role: "docs",
  },
];

const fileStemByDistrict: Record<string, string[]> = {
  core: [
    "entity-registry",
    "stable-hash",
    "district-layout",
    "replay-clock",
    "keyframe-store",
    "relation-index",
    "project-manifest",
  ],
  renderer: [
    "city-scene",
    "building-batch",
    "district-ground",
    "camera-rig",
    "picking",
    "light-ribbon",
    "material-atlas",
  ],
  web: [
    "repo-shell",
    "inspector",
    "timeline",
    "command-palette",
    "project-loader",
    "search-index",
    "mode-switcher",
  ],
  analyzer: [
    "git-history",
    "blob-cache",
    "source-parser",
    "import-resolver",
    "rename-tracker",
    "bundle-writer",
    "role-classifier",
  ],
  tests: [
    "layout.spec",
    "replay.spec",
    "schema.spec",
    "analyzer.spec",
    "viewer.spec",
    "rename.fixture",
  ],
  docs: [
    "architecture",
    "data-format",
    "performance",
    "privacy",
    "contributing",
    "city-metaphor",
  ],
};

const summaries: Record<string, string> = {
  core: "维护城市实体身份与跨时间稳定状态，是回放一致性的事实来源。",
  renderer: "将静态城市数据编译为低开销的实例批次，并处理视角与拾取。",
  web: "连接搜索、检查器和时间轴，让代码事实在空间与时间中可操作。",
  analyzer: "从 Git 与 TypeScript 源码提取确定性的文件、依赖与变更事实。",
  tests: "守护布局稳定、实体延续和回放恢复等关键产品不变量。",
  docs: "记录数据协议、性能边界和城市隐喻的可解释规则。",
};

const commitMessages = [
  "init: lay the first foundations",
  "feat(schema): define the city contract",
  "feat(layout): map districts with stable coordinates",
  "feat(analyzer): read TypeScript modules",
  "feat(renderer): batch the first skyline",
  "feat(web): open the city explorer",
  "feat(search): fly from query to building",
  "refactor(core): rename identity-map to entity-registry",
  "feat(relations): illuminate local imports",
  "test: lock deterministic layouts",
  "feat(replay): compile construction deltas",
  "feat(timeline): add seek and playback",
  "perf(renderer): merge facade materials",
  "feat(camera): follow active construction",
  "docs: publish the city metaphor",
  "fix(replay): preserve renamed buildings",
  "release: light up Zero City",
  "chore: prepare the public observatory",
];

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function shortSha(index: number): string {
  return hash(`repocity-commit-${index}`).toString(16).padStart(8, "0");
}

export const demoDistricts: DemoDistrict[] = districtSeeds.map(
  ({ id, name, eyebrow, x, z, width, depth, color }) => ({
    id,
    name,
    eyebrow,
    x,
    z,
    width,
    depth,
    color,
  }),
);

export const demoEntities: DemoEntity[] = districtSeeds.flatMap((district) => {
  const stems = fileStemByDistrict[district.id];
  const columns = Math.ceil(Math.sqrt(district.count));

  return Array.from({ length: district.count }, (_, index) => {
    const seed = hash(`${district.id}:${index}`);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const stem = stems[index % stems.length];
    const extension =
      district.id === "docs"
        ? ".ts"
        : seed % 11 === 0
          ? ".js"
          : seed % 7 === 0
            ? ".tsx"
            : ".ts";
    const role: FileRole =
      index % 19 === 0
        ? "config"
        : index % 17 === 0
          ? "script"
          : district.role;
    const loc = 32 + (seed % 540);
    const bornAt = Math.min(15, Math.floor((index / district.count) * 17));
    const isRemoved = index > district.count - 3 && district.id !== "core";
    const numberedStem = `${stem}-${String(index + 1).padStart(2, "0")}`;
    const path = `${district.prefix}/${numberedStem}${extension}`;
    const exportCount = 1 + (seed % 6);

    return {
      id: `${district.id}-${hash(path).toString(36)}`,
      kind: "building" as const,
      path,
      aliases:
        district.id === "core" && index === 3
          ? ["packages/core/identity-map.ts"]
          : [],
      name: `${numberedStem}${extension}`,
      extension,
      language: extension === ".js" ? "javascript" : "typescript",
      role,
      districtId: district.id,
      bornAt,
      diedAt: isRemoved ? 16 : undefined,
      maxMetrics: {
        loc,
        exports: exportCount,
        fanIn: 1 + ((seed >>> 3) % 22),
        fanOut: 1 + ((seed >>> 7) % 12),
        churn: 2 + ((seed >>> 11) % 47),
      },
      layout: {
        x:
          district.x -
          district.width / 2 +
          1.5 +
          column * (district.width / columns),
        z:
          district.z -
          district.depth / 2 +
          1.5 +
          row * (district.depth / columns),
        width: 0.72 + (seed % 5) * 0.1,
        depth: 0.72 + ((seed >>> 4) % 5) * 0.1,
        maxHeight: 1.7 + Math.log1p(loc) * 0.8 + (seed % 4) * 0.35,
        rotationY: seed % 2 === 0 ? 0 : Math.PI / 2,
        styleVariant: seed % 4,
      },
      summary: summaries[district.id],
      exportNames: Array.from(
        { length: exportCount },
        (_, exportIndex) =>
          `${stem
            .split("-")
            .map((part, partIndex) =>
              partIndex === 0
                ? part
                : part.charAt(0).toUpperCase() + part.slice(1),
            )
            .join("")}${exportIndex === 0 ? "" : exportIndex + 1}`,
      ),
    };
  });
});

export const demoRelations: DemoRelation[] = demoEntities.flatMap(
  (entity, index) => {
    const localOffset = 1 + (hash(entity.id) % 5);
    const localTarget = demoEntities[(index + localOffset) % demoEntities.length];
    const crossTarget =
      index % 5 === 0
        ? demoEntities[(index + 79) % demoEntities.length]
        : undefined;

    return [
      {
        id: `rel-${entity.id}-${localTarget.id}`,
        sourceId: entity.id,
        targetId: localTarget.id,
        kind: "import" as const,
        bornAt: Math.max(entity.bornAt, localTarget.bornAt),
        weight: 1 + (hash(`${entity.id}:local`) % 4),
      },
      ...(crossTarget
        ? [
            {
              id: `rel-${entity.id}-${crossTarget.id}`,
              sourceId: entity.id,
              targetId: crossTarget.id,
              kind: "import" as const,
              bornAt: Math.max(entity.bornAt, crossTarget.bornAt),
              weight: 1,
            },
          ]
        : []),
    ];
  },
);

export const demoChapters: DemoChapter[] = [
  {
    id: "foundations",
    title: "荒地与地基",
    subtitle: "Schema 与稳定坐标奠定城市规则",
    start: 0,
    end: 4,
  },
  {
    id: "skyline",
    title: "天际线初成",
    subtitle: "Renderer 与 Web Explorer 接通",
    start: 5,
    end: 9,
  },
  {
    id: "memory",
    title: "城市学会记忆",
    subtitle: "Git 变化被编译为可寻址的回放",
    start: 10,
    end: 14,
  },
  {
    id: "lights",
    title: "零号城亮灯",
    subtitle: "Rename 一致性与首次发布",
    start: 15,
    end: 17,
  },
];

export const demoCommits: DemoCommit[] = commitMessages.map(
  (message, index) => {
    const chapter =
      demoChapters.find((item) => index >= item.start && index <= item.end) ??
      demoChapters[0];
    const changedEntityIds = demoEntities
      .filter(
        (entity, entityIndex) =>
          entity.bornAt === index ||
          entity.diedAt === index ||
          ((entityIndex * 7 + index * 13) % 71 === 0 && entity.bornAt <= index),
      )
      .slice(0, index === 16 ? 26 : 14)
      .map((entity) => entity.id);

    return {
      index,
      sha: shortSha(index),
      parents: index === 0 ? [] : [shortSha(index - 1)],
      authorName:
        index % 4 === 0
          ? "Lin Chen"
          : index % 3 === 0
            ? "Maya Ortiz"
            : "Zhuo Chen",
      authoredAt: new Date(
        Date.UTC(2025, 0, 9 + index * 19, 9 + (index % 7), 24),
      ).toISOString(),
      message,
      tags: index === 16 ? ["v0.1.0"] : [],
      changedEntityIds,
      chapterId: chapter.id,
      additions: 84 + (hash(`${index}:additions`) % 780),
      deletions: 12 + (hash(`${index}:deletions`) % 240),
    };
  },
);

export const demoManifest: DemoManifest = {
  schemaVersion: "0.1" as const,
  projectId: "repocity-demo",
  repo: {
    name: "repocity/zero-city",
    remoteUrl: "https://github.com/repocity/zero-city",
    defaultBranch: "main",
    headSha: demoCommits.at(-1)?.sha ?? "",
  },
  stats: {
    entityCount: demoEntities.length,
    districtCount: demoDistricts.length,
    commitCount: demoCommits.length,
    displayedCommitCount: demoCommits.length,
  },
};

export const demoProject: ViewerProject = {
  manifest: demoManifest,
  districts: demoDistricts,
  entities: demoEntities,
  relations: demoRelations,
  commits: demoCommits,
  chapters: demoChapters,
};

export function getEntityRelations(
  entityId: string,
  relations: readonly DemoRelation[] = demoRelations,
) {
  const outgoing = relations.filter(
    (relation) => relation.sourceId === entityId,
  );
  const incoming = relations.filter(
    (relation) => relation.targetId === entityId,
  );
  return { outgoing, incoming };
}

export function getEntityById(
  entityId?: string | null,
  entities: readonly DemoEntity[] = demoEntities,
) {
  return entities.find((entity) => entity.id === entityId);
}

export function getEntityHistory(
  entityId: string,
  entities: readonly DemoEntity[] = demoEntities,
  commits: readonly DemoCommit[] = demoCommits,
) {
  const entity = getEntityById(entityId, entities);
  if (!entity) return [];
  return commits.filter(
    (commit) =>
      commit.changedEntityIds.includes(entityId) ||
      commit.index === entity.bornAt ||
      commit.index === entity.diedAt,
  );
}
