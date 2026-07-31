# RepoCity / 零号城 — 3D 代码城市与 Git 成长回放

> 面向 Codex 的可执行实现规格。目标是先做出一个稳定、可解释、可回放的 3D 仓库浏览器，而不是先做一个大型 DeepWiki 克隆。
>
> **2026-07-31 规格路由：** 本文保留原始 MVP 产品合同；城市生成、组件聚合、
> 语义道路、可追溯人流/车流/船运与后续实施 Gate，以
> [`docs/V4_SEMANTIC_METROPOLIS_SPEC.md`](docs/V4_SEMANTIC_METROPOLIS_SPEC.md)
> 为当前权威规格。两者冲突时，V4 对 Flow / Semantic Metropolis 场景优先。

## 0. 一句话定位

**DeepWiki 让人“读懂一个仓库”，RepoCity 让人“走进一个仓库”，并把 Git 历史变成一部城市从荒地到建成的纪录片。**

产品核心不是“把文件画成很多立方体”，而是三件事：

1. **空间记忆**：同一个模块始终在同一个地方，用户能记住它在城里的位置。
2. **时间因果**：用户能看到建筑何时出现、为什么变化、由哪个 commit/PR 引入。
3. **知识落点**：点击任何建筑，都能回到代码、Diff、Wiki 说明和依赖关系。

---

## 1. MVP 决策

### 1.1 MVP 必须做

- 输入本地 Git 仓库路径，或公开 Git URL。
- 首期只支持 JavaScript / TypeScript：`.js`、`.jsx`、`.ts`、`.tsx`。
- 将仓库当前状态编译成一座可探索的 3D 城市。
- 将 Git 历史编译成可播放、暂停、拖动、倍速和跳转的城市建设回放。
- 点击建筑查看：文件路径、职责、LOC、导出符号、依赖、被依赖、关键提交、源码链接。
- 支持“探索模式”和“回放模式”。
- 输出静态项目数据包，Web Viewer 只负责读取和渲染。
- 核心分析和回放不依赖 LLM；AI 只作为可选知识增强层。

### 1.2 MVP 明确不做

- 不做第三人称人物、碰撞、物理、NPC、任务系统。
- 不做多语言 AST。
- 不做私有仓库云端授权、账号系统、支付、队列服务。
- 不做完整 RAG/聊天系统。
- 不为每个 symbol 建一个可进入房间。
- 不同时显示所有 import/call 边，避免“意大利面图”。
- 不追求照片级画质；采用程序化、低多边形、卡通描边风格。

### 1.3 首期容量边界

- 推荐演示仓库：不超过 2,000 个源码文件、500 个展示 commit。
- 超过 500 个 commit 时进行分段聚合，但保留原 commit 可查询。
- 默认桌面浏览器优先；移动端只保证能查看，不保证完整交互。

---

## 2. 产品界面

```text
┌─────────────────────────────────────────────────────────────────────┐
│ RepoCity | 仓库/分支 | 搜索 | [探索] [回放] | 视图过滤 | 设置          │
├──────────────────────────────────────────────┬──────────────────────┤
│                                              │ 右侧 Inspector       │
│                                              │                      │
│                 3D 城市主画布                 │ 文件 / 模块说明       │
│                                              │ 指标 / 依赖 / 历史     │
│                                              │ [打开源码] [看 Diff]  │
│                                              │                      │
├──────────────────────────────────────────────┴──────────────────────┤
│ 时间轴：章节 | commit 点 | 播放/暂停 | 速度 | 日期 | 当前 commit 信息    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 探索模式

- 查看仓库 HEAD 的完整城市。
- 鼠标拖动旋转，滚轮缩放，右键平移。
- Hover 建筑显示名称和一句摘要。
- 单击选中，右侧打开 Inspector。
- 双击或按 `F` 聚焦建筑。
- 搜索文件、模块、导出符号后，相机飞到目标。
- 选择建筑时只显示它的一阶依赖和被依赖关系。

### 2.2 回放模式

- 城市从空地开始，按 Git 历史逐步建成。
- 新文件：地基出现，建筑向上生长。
- 修改文件：脚手架、脉冲或窗灯闪烁，不重复拆建。
- 删除文件：建筑淡出并拆除，可选择保留“遗址”轮廓。
- 重命名文件：保持原地和实体 ID，仅更新名称；必要时用短距离搬迁动画。
- 新依赖：连接光带生长。
- 删除依赖：连接光带收回。
- tag/release：城市整体亮灯，时间轴显示里程碑。
- “跟随施工”开启时，相机自动聚焦当前变更区域；关闭后用户自由观察。

### 2.3 两种历史表达

- **真实历史**：忠实展示 Git commit 顺序。
- **导演模式**：把琐碎 commit 聚合成章节，生成更适合观看的叙事；必须标注“AI/规则聚合，不等同于真实开发意图”。

---

## 3. 城市隐喻映射

| 代码概念 | 城市概念 | MVP 表达 |
|---|---|---|
| Repository | 城市 | 整个场景 |
| Workspace / package / 一级业务目录 | 区域 District | 独立地块、路牌和地面颜色 |
| 文件或小型文件簇 | 建筑 Building | 程序化建筑 |
| 导出 API / entry point | 地标 / 入口 | 屋顶标志、广场或高亮入口 |
| import / dependency | 连接光带 | 默认聚合，选中时展开 |
| 文件新增 | 开工 | 地基与生长动画 |
| 文件修改 | 翻修 | 脚手架、脉冲、窗灯 |
| 文件删除 | 拆除 | 淡出、坍塌或遗址 |
| commit | 施工事件 | 时间轴节点 |
| release/tag | 城市里程碑 | 城市亮灯、烟花或钟声 |
| tests | 检验设施 | 建筑类型或盾牌标识 |
| docs | 图书馆/说明馆 | 低矮公共建筑样式 |
| config/infra | 公用设施 | 工业或基础设施样式 |

### 3.1 指标编码

不要把“高楼”等同于“代码质量”。所有编码都要在图例中写清楚。

- 建筑占地：`log1p(max LOC)`。
- 建筑当前高度：`current LOC / max historical LOC`。
- 屋顶地标等级：依赖中心性或被依赖数量。
- 建筑颜色：语言或文件角色，而不是质量。
- 窗灯活跃度：最近一段时间的变更频率。
- 连接粗细：聚合依赖权重。

---

## 4. 最关键的布局原则：坐标永远稳定

时间回放最容易失败的地方，是每个 commit 都重新跑一次图布局，导致建筑在城市里瞬移。

### 4.1 正确算法

1. 扫描全部目标历史，构建“曾经出现过的实体并集”。
2. 追踪 rename，给每个逻辑文件分配稳定 `entityId`。
3. 计算每个实体在整个历史中的 `maxLOC`、出生 commit、死亡 commit。
4. 用全历史并集一次性生成最终地块和坐标。
5. 回放时只改变：可见性、高度、材质状态、标签和依赖线；不重新排版。

### 4.2 District 规则

首期采用确定性目录规则，不做 LLM 聚类：

1. 如果存在 `apps/*` 或 `packages/*`，则第二级目录为 District。
2. 否则如果存在 `src/*`，则 `src` 下一级目录为 District。
3. 根目录源码进入 `core` District。
4. `tests`、`docs`、`scripts`、`config` 可作为特殊 District。
5. `node_modules`、构建产物、缓存、vendor、二进制资源全部忽略。

### 4.3 地块算法

- District 使用确定性的 squarified treemap 分配矩形地块。
- District 面积按其全部实体的 `maxLOC` 加权。
- District 内部按稳定哈希排序，将建筑放入规则网格或 packed rectangles。
- 不使用 force-directed layout 作为主布局。
- 道路只是视觉分隔；真实依赖用光带/高架线单独表达。

---

## 5. 系统架构

```text
Local Git / Public Git URL
          │
          ▼
┌──────────────────────┐
│ Repo Analyzer CLI    │
│ clone / git history  │
│ JS/TS AST / metrics  │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ City Compiler        │
│ entity identity      │
│ district + layout    │
│ style + metric map   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Replay Compiler      │
│ commit deltas        │
│ keyframes / chapters │
└──────────┬───────────┘
           ▼
      static bundle
           │
           ▼
┌──────────────────────┐       ┌──────────────────────┐
│ Web Viewer           │◄─────►│ Knowledge Adapter    │ optional
│ Three.js / WebGL     │       │ markdown/wiki/LLM    │
└──────────────────────┘       └──────────────────────┘
```

### 5.1 重要决策

- **分析器和 Viewer 解耦。** Viewer 只吃稳定 JSON 数据，不直接读 Git。
- **先静态生成，后云端服务。** MVP 不需要数据库、队列和账号。
- **事实层和 AI 层分离。** 文件、依赖、commit、Diff 是确定性事实；摘要、章节标题、职责说明是可选生成内容。
- **不绑定某一个 DeepWiki 实现。** 用 Adapter 接入外部 Wiki 结果。

---

## 6. Monorepo 结构

```text
repocity/
├── apps/
│   ├── web/                    # Next.js + React + Three.js Viewer
│   └── cli/                    # Node CLI: analyze/build
├── packages/
│   ├── schema/                 # Zod schema + shared TypeScript types
│   ├── git-analyzer/           # git history, rename, diff, tag
│   ├── code-analyzer/          # JS/TS imports, exports, metrics
│   ├── city-compiler/          # districts, stable layout, visual encoding
│   ├── replay-engine/          # deltas, keyframes, seek/playback
│   ├── renderer/               # Three.js scene, instancing, picking
│   └── knowledge-adapter/      # optional wiki/markdown interface
├── fixtures/
│   ├── tiny-ts-repo/           # 有 rename/add/delete/tag 的小仓库
│   └── medium-ts-repo/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_FORMAT.md
│   └── PERFORMANCE.md
├── pnpm-workspace.yaml
└── turbo.json
```

建议采用 TypeScript、pnpm workspace、Turborepo。Viewer 可用 React Three Fiber 管理 React 与 Three.js 的生命周期，但底层数据结构和渲染批次必须保持与 React 组件数量解耦。

---

## 7. 静态数据包

```text
project.repocity/
├── manifest.json
├── entities.json
├── relations.json
├── commits.json
├── chapters.json
├── deltas.ndjson
├── keyframes/
│   ├── 0000.json
│   ├── 0050.json
│   └── ...
└── knowledge/
    ├── repo.md
    └── entities/<entityId>.md
```

### 7.1 核心类型

```ts
export type EntityId = string;
export type CommitIndex = number;

export interface RepoManifest {
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
  files: {
    entities: string;
    relations: string;
    commits: string;
    chapters: string;
    deltas: string;
    keyframesDir: string;
  };
}

export interface CityEntity {
  id: EntityId;
  kind: "building";
  path: string;
  aliases: string[];
  name: string;
  extension: string;
  language: "typescript" | "javascript";
  role: "source" | "test" | "docs" | "config" | "script" | "other";
  districtId: string;
  bornAt: CommitIndex;
  diedAt?: CommitIndex;
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
}

export interface Relation {
  id: string;
  sourceId: EntityId;
  targetId: EntityId;
  kind: "import";
  bornAt: CommitIndex;
  diedAt?: CommitIndex;
  weight: number;
}

export interface CommitMeta {
  index: CommitIndex;
  sha: string;
  parents: string[];
  authorName: string;
  authoredAt: string;
  message: string;
  tags: string[];
  changedEntityIds: EntityId[];
  chapterId?: string;
}

export interface ReplayDelta {
  commitIndex: CommitIndex;
  entityChanges: Array<
    | { op: "spawn"; entityId: EntityId; metrics: RuntimeMetrics }
    | { op: "update"; entityId: EntityId; before: RuntimeMetrics; after: RuntimeMetrics }
    | { op: "remove"; entityId: EntityId }
    | { op: "rename"; entityId: EntityId; beforePath: string; afterPath: string }
  >;
  relationChanges: Array<
    | { op: "add"; relationId: string }
    | { op: "remove"; relationId: string }
  >;
}

export interface RuntimeMetrics {
  loc: number;
  exports: number;
  fanIn: number;
  fanOut: number;
}
```

所有 JSON 必须经过 `packages/schema` 的 Zod 校验。

---

## 8. Git 与代码分析算法

### 8.1 Git 历史

优先调用本机 `git`，不要在 MVP 中依赖 GitHub API。

需要提取：

- commit SHA、父 commit、作者、时间、message。
- tag。
- 每个 commit 的新增、修改、删除、rename。
- rename 相似度和旧/新路径。
- 每个变更文件在该 commit 的内容。

推荐命令思路：

```bash
git log --reverse --date=iso-strict --find-renames --name-status --format=...
git show <sha>:<path>
git diff-tree --root --no-commit-id --name-status -r -M <sha>
```

### 8.2 稳定实体 ID

- 新增文件：创建 UUIDv5 或稳定哈希 ID。
- rename：沿用原实体 ID，将新路径加入 `aliases`。
- 删除后原路径出现新内容：若内容相似度不足，则创建新实体 ID。
- 合并 commit：以最终树状态为准生成 delta，避免重复应用父分支变化。

### 8.3 JS/TS 分析

对每个出现过的源码内容计算：

- LOC：去掉空行后的物理行数即可，首期不做复杂 SLOC。
- 静态 imports：相对路径、workspace alias、tsconfig path alias。
- exports 数量和名称。
- 是否是 entry point：`main`、`bin`、路由入口、`index.*`、框架配置可用规则识别。
- 文件角色：source/test/docs/config/script。

解析缓存键为 `blob SHA` 或内容哈希，避免同一内容重复解析。

### 8.4 Commit 聚合

原始 commit 全部保留；展示层生成 `displayed commits`：

- tag/release 强制形成章节边界。
- merge commit 可形成章节边界。
- 时间间隔大于阈值可形成章节边界。
- 连续小型格式化/依赖锁文件变更可折叠。
- 每个章节最多显示约 20 个节点，其余仍可在详情中展开。

---

## 9. Three.js 渲染实现

### 9.1 视觉方向

- 低多边形、纸雕/模型城市感。
- 低饱和背景，建筑按角色使用有限色板。
- 透视相机 FOV 约 35–45，形成接近等距视角的效果。
- 一个 Hemisphere/Ambient Light 加一个 Directional Light。
- 只给地面和少量建筑开启阴影。
- 选中对象使用轮廓或边缘高亮；不要给全城做昂贵描边。
- 天空、雾和昼夜切换可以作为 P2，不进入首个可用版本。

### 9.2 性能规则

- 同一风格建筑必须使用 `InstancedMesh`。
- 不允许“一个建筑一个 React 组件 + 一个 Mesh”。
- 建筑只保留少量程序化变体，通过稳定哈希选型。
- 远景只显示 District 和建筑体块；近景才显示屋顶、窗户和标签。
- District 标签常驻，建筑标签仅 hover/selected 时显示。
- `devicePixelRatio` 上限建议 1.5。
- 关系线默认不全量渲染；只渲染 District 聚合关系和选中节点的局部关系。
- 时间轴 seek 不重建整个 Three.js Scene，只更新实例矩阵、颜色和可见状态。

### 9.3 Picking

- 建筑实例使用 `Raycaster` 获取 `instanceId`。
- 建立 `batchId + instanceId -> entityId` 映射。
- Hover 与 selected 分离，selected 状态写入全局 store。

### 9.4 动画状态

每个实例维护：

```ts
interface BuildingRuntimeState {
  visible: boolean;
  currentHeight: number;
  targetHeight: number;
  activityPulse: number;
  construction: number;
  demolition: number;
  selected: boolean;
}
```

在 render loop 中做阻尼插值，不为每个实例创建独立动画库对象。

---

## 10. 回放引擎

### 10.1 状态恢复

- 每 50 个展示 commit 生成一个 keyframe。
- 拖动时间轴时找到最近的前置 keyframe，再应用少量 delta。
- 必须保证“顺序播放到 commit N”和“直接 seek 到 commit N”得到相同状态。

### 10.2 事件时长

```ts
const duration = clamp(
  0.45 + changedEntities * 0.04 + relationChanges * 0.015,
  0.45,
  2.8,
);
```

- 倍速只改变播放时钟，不改变事件顺序。
- 大 commit 先聚焦 District，再批量生长。
- 文档/锁文件变更可降级为轻微脉冲，不抢镜。

### 10.3 Cinematic Camera

- 收集当前 commit 变更建筑的 bounding box。
- 变更集中在一个 District 时聚焦该区域。
- 跨多个 District 时切换到城市概览。
- 用户一旦手动拖动，自动跟随暂停 5 秒或直到重新开启。

---

## 11. Knowledge Adapter

MVP 的城市和回放必须在没有 AI 的情况下完整工作。

```ts
export interface KnowledgeAdapter {
  getRepoOverview(projectId: string): Promise<KnowledgeDoc | null>;
  getEntityDoc(projectId: string, entityId: string): Promise<KnowledgeDoc | null>;
  search(projectId: string, query: string): Promise<KnowledgeSearchHit[]>;
}

export interface KnowledgeDoc {
  title: string;
  summary: string;
  sourcePaths: string[];
  generatedBy?: string;
  generatedAt?: string;
}
```

可选实现：

1. `MarkdownKnowledgeAdapter`：读取静态 Markdown。
2. `DeepWikiOpenAdapter`：以后适配开源 DeepWiki 生成结果。
3. `OpenDeepWikiAdapter`：以后适配其文档或 MCP/API。
4. `LocalLLMAdapter`：按用户选择生成摘要。

任何 AI 生成内容都必须显示来源路径和“AI 生成”标记。

---

## 12. 开发里程碑与 PR 切分

### PR 0 — 工程骨架与 Schema

- monorepo、lint、typecheck、test。
- Zod schema。
- fixture 数据包。
- `pnpm dev` 显示空场景和 UI 壳。

验收：所有包可构建；fixture 通过 schema 校验。

### PR 1 — 静态 3D 城市

- District 地面。
- Instanced building batches。
- Orbit/Map controls。
- hover、select、focus、Inspector。
- 搜索并飞到目标。

验收：使用手写 fixture 显示不少于 200 栋建筑；交互无报错。

### PR 2 — 当前仓库分析器

- CLI 输入本地仓库。
- ignore 规则。
- JS/TS 文件、LOC、imports、exports、角色。
- District 与稳定布局。
- 输出静态 bundle。

验收：

```bash
pnpm repocity build ./fixtures/tiny-ts-repo --out ./apps/web/public/projects/tiny
pnpm dev
```

可在 Viewer 打开 `tiny` 城市。

### PR 3 — Git 历史与实体身份

- commit、tag、add/modify/delete/rename。
- rename 保持 entity ID。
- blob 解析缓存。
- deltas 与 keyframes。

验收：fixture 中的 rename 建筑不瞬移、不重生。

### PR 4 — 回放播放器

- play/pause、scrub、speed、chapter markers。
- spawn/update/remove/rename/relation 动画。
- 自动跟随相机。
- commit 详情和 Diff 链接。

验收：顺序播放与直接 seek 的最终状态完全一致。

### PR 5 — 性能和视觉打磨

- LOD、实例批次、标签策略、DPR 限制。
- 加载进度、空状态、错误边界。
- 低多边形材质和有限色板。
- Playwright 关键路径测试。

验收：1,000 栋建筑 fixture 可顺畅探索；没有每建筑一个 mesh 的实现。

### PR 6 — 可选 Wiki 接入

- Markdown Adapter。
- Repo 与 entity 文档面板。
- 来源路径和 AI 标识。

---

## 13. 测试清单

### 单元测试

- 相同输入生成完全相同的坐标。
- 路径 rename 后 entity ID 不变。
- 删除后重新创建不同内容生成新 ID。
- tsconfig alias 被正确解析。
- ignore 规则排除 `node_modules`、dist、build、coverage、锁文件等。
- keyframe + delta 恢复状态与顺序重放相同。
- schema 拒绝非法 bundle。

### 集成测试

- CLI 能分析 fixture 并生成 bundle。
- Viewer 能加载 bundle。
- 点击实例能打开正确实体。
- 搜索结果相机能聚焦目标。
- 时间轴拖动后 UI commit 信息和场景状态一致。

### E2E

- 打开项目。
- 选择一个建筑。
- 进入回放。
- 播放到 rename commit。
- 拖到删除 commit。
- 返回 HEAD。
- 页面无 console error。

---

## 14. 安全与隐私

- 默认本地分析，私有代码不离开机器。
- 忽略 `.env`、密钥、证书、二进制、vendor 和生成目录。
- Viewer 数据包不包含完整源码，只包含指标、路径、摘要和可选短片段。
- 生成 Wiki/LLM 内容前必须显式确认提供商和上传范围。
- 公开部署项目必须允许用户检查 bundle 内容。

---

## 15. Codex Master Prompt

将下面内容作为首轮任务交给 Codex：

```text
你正在实现一个名为 RepoCity / 零号城的 TypeScript monorepo。

目标：把一个 JS/TS Git 仓库编译成可探索的 3D 城市，并把 Git 历史编译成城市建设回放。先完成无 AI、无账号、静态数据包驱动的 MVP。

请先完整阅读仓库根目录的 repocity-codex-spec.md，然后执行以下流程：

1. 在 TASKS.md 中写出 PR 0 到 PR 5 的实施清单、依赖关系和验收命令。
2. 只实现 PR 0 和 PR 1，不要提前实现 Git 分析器。
3. 使用 pnpm workspace + TypeScript。
4. apps/web 使用 React；Three.js 场景可以使用 React Three Fiber，但建筑必须按类型用 InstancedMesh 批量渲染，禁止一个建筑一个 Mesh/React 组件。
5. packages/schema 使用 Zod，并为 fixture 数据写 schema validation tests。
6. 创建至少 200 栋建筑的确定性 fixture，包含多个 District、角色、颜色和依赖关系。
7. 实现：城市地面、程序化建筑、相机控制、hover、select、focus、搜索、右侧 Inspector、底部静态时间轴壳。
8. 布局必须确定性；同一 fixture 每次生成的坐标完全相同。
9. 添加 Vitest 单元测试和 Playwright 的最小 E2E。
10. 完成后运行 lint、typecheck、test、build，并把命令与结果写入 IMPLEMENTATION_REPORT.md。

非目标：
- 不做人物、物理、NPC。
- 不做 LLM、聊天或 DeepWiki 接口。
- 不做云端任务和数据库。
- 不做移动端专项适配。
- 不做所有依赖边常驻显示。

交付时请输出：
- 新增/修改文件清单。
- 架构说明。
- 运行方式。
- 测试结果。
- 已知限制。
- 下一 PR 的具体建议，但不要自动开始下一 PR。
```

PR 0–1 验收后，再让 Codex 按规格逐个完成 PR 2、PR 3、PR 4、PR 5。不要一次性要求它同时完成分析器、回放和视觉打磨。

---

## 16. 成功标准

首个公开 Demo 不需要“像游戏一样能玩很久”，而要让用户在 30 秒内理解三件事：

1. 这座城就是这个仓库。
2. 我能记住某个模块在城市的哪个位置。
3. 拖动时间轴时，我能看懂项目是怎样一步步长出来的。

做到这三点，RepoCity 就不是 3D 装饰，而是一种新的代码库理解界面。
