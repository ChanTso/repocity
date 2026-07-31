# RepoCity / 零号城

> DeepWiki 让人读懂仓库；RepoCity 让人走进仓库。

RepoCity 把 JavaScript / TypeScript Git 仓库编译成一座坐标稳定的 3D
城市，并把提交历史变成城市从地基到天际线的建设回放。事实分析完全在本地完成；
Web Viewer 只读取经过 Zod 校验的静态数据包。

![RepoCity social preview](./public/og.png)

## 已实现

- 254 栋建筑的内置城市，以及 CLI 生成的真实 tiny Git fixture；
- 按 role/style 批次渲染的 Three.js `InstancedMesh`，不是一栋楼一个 Mesh；
- District 地块、常驻路牌、雾光、程序化建筑变体和 DPR 上限；
- 鼠标旋转/缩放/平移、实例 hover/select、双击或 `F` 聚焦；
- 文件、路径与导出符号搜索，右侧职责/指标/关系/历史 Inspector；
- 一阶依赖光带，只在选中实体时展开；
- 播放、暂停、拖动、0.5–4× 倍速、章节、release 与跟随施工镜头；
- 本地路径或公开 Git URL 分析，覆盖 add/modify/delete/rename/tag；
- 确定性 District + treemap/grid 布局、稳定实体 ID、delta 与 keyframe；
- schema、布局、回放、Git 分析、CLI 和渲染 HTML 测试。

## 快速开始

需要 Node.js 22+ 与本机 Git。

```bash
npm install
npm run dev
```

浏览器打开终端输出的本地地址。默认城市是完整产品演示；访问
`/?project=tiny` 会读取 `public/projects/tiny` 中由真实 5-commit Git
fixture 生成的数据包。

### 编译自己的仓库

```bash
npm run repocity -- build ./path/to/repository \
  --out ./public/projects/my-city
```

公开仓库也可以直接使用 URL：

```bash
npm run repocity -- build https://github.com/owner/repository.git \
  --out ./public/projects/my-city
```

构建完成后访问 `/?project=my-city`。输出只包含路径、指标、依赖、提交事实和
可选知识 Markdown，不包含完整源码。

### 重建 tiny fixture

```bash
npm run fixture:tiny
```

命令会打印一个临时 Git 仓库路径。它包含 5 个 commit、2 个 tag、rename、
add/delete、tsconfig alias 和 ignore 场景。

## 常用命令

```bash
npm run typecheck   # Viewer + 所有 workspace
npm run test:unit   # schema/layout/replay/analyzer/CLI
npm run build       # Cloudflare Worker 兼容生产构建
npm test            # 单测 + 生产构建 + SSR HTML 检查
npm run check       # lint + typecheck + 全测试
```

## 架构

```text
local Git / public URL
          │
          ▼
  git-analyzer + code-analyzer
          │
          ▼
     city-compiler
          │
          ▼
     replay-engine
          │
          ▼
  static .repocity bundle
          │
          ▼
  React + Three.js Viewer
```

Viewer 位于仓库根目录的 `@repocity/web`（以兼容 Sites/Vinext 部署）；
CLI 在 `apps/cli`，共享事实层位于 `packages/*`。

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 分析与实体身份
- [`docs/DATA_FORMAT.md`](./docs/DATA_FORMAT.md) — 静态数据包协议
- [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) — 成本模型和容量边界
- [`docs/CITY_SIMULATION_RESEARCH.md`](./docs/CITY_SIMULATION_RESEARCH.md) — 城市模拟化调研与取舍
- [`docs/V2_CITY_SIMULATION_SPEC.md`](./docs/V2_CITY_SIMULATION_SPEC.md) — V2 活城市规格与实施计划
- [`TASKS.md`](./TASKS.md) — PR 0–5 验收映射

## 隐私与安全

- 私有仓库默认只在本机通过参数化 `git` 子进程读取；
- 不执行目标仓库代码，也不加载 TypeScript 插件；
- 默认忽略 `.env`、证书、依赖、vendor、build、coverage 与生成产物；
- Web Viewer 不需要数据库、账号、GitHub API 或 LLM；
- AI/Wiki 后续只能作为 `knowledge/` 增强层，不能改写 Git 与依赖事实。

## 当前边界

- 只分析 `.js`、`.jsx`、`.ts`、`.tsx`；
- 推荐不超过约 2,000 个源码文件、500 个展示 commit；
- 当前原始历史都保留，超过 500 commit 的展示折叠仍是后续工作；
- export 名写入 entity knowledge Markdown；核心 schema 保存 export 数量；
- 桌面浏览器为完整交互目标，移动端提供可查看的紧凑布局。
