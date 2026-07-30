# RepoCity / 零号城 — 实施报告

## 交付结论

本项目已按照 `repocity-spec.md` 完成可运行的 MVP：它可以把本地
JavaScript / TypeScript Git 仓库或公开 Git URL 编译为静态 RepoCity
数据包，并在浏览器中以稳定坐标的 3D 城市呈现当前代码结构及 Git 建设历史。

实现以确定性事实为核心，不执行被分析仓库的代码，也不依赖数据库、账号系统或
LLM。Viewer 与分析器通过 Zod 校验的静态协议完全解耦。

## 已交付模块

### 3D Viewer

- 254 栋建筑的内置演示城市，以及真实 Git fixture 生成的可切换项目；
- 基于 React Three Fiber 的程序化低多边形城市；
- 按文件角色批次渲染的 `InstancedMesh`、实例级拾取和 DPR 上限；
- 稳定 District 地块、常驻路牌、雾、灯光和程序化建筑变体；
- hover、选中、双击或 `F` 聚焦、旋转、缩放和平移；
- 文件路径、名称和导出符号搜索；
- 概览、依赖、被依赖、指标与历史 Inspector；
- 只为当前实体展示一阶依赖光带，避免全图连线噪声；
- 探索与回放模式、拖动、播放/暂停、0.5–4× 倍速、章节和 release 标记；
- 新增、生长、修改脉冲、删除拆除、依赖生命周期与跟随施工镜头；
- 桌面完整布局和移动端紧凑查看布局；
- 与站点视觉一致的定制社交分享图。

### 本地分析与静态编译

- TypeScript Compiler API 驱动的 JS/TS AST 分析；
- LOC、import、export、文件角色、入口与路径别名解析；
- 参数化 Git 子进程、提交历史、tag、first-parent merge 状态与 blob 缓存；
- add、modify、delete、copy、rename（`-M50%`）历史追踪；
- rename 前后保持实体 ID，删除后重建分配新实体 ID；
- 全历史实体并集上的稳定哈希、确定性 District、squarified treemap 与网格布局；
- delta、每 50 commit keyframe、章节和任意时间点 seek；
- 本地路径和公开 Git URL 输入；
- 原子写入可托管的静态 RepoCity 数据包；
- schema 与跨文件引用完整性校验。

### CLI

```bash
npm run repocity -- build ./path/to/repository \
  --out ./public/projects/my-city
```

公开仓库同样支持：

```bash
npm run repocity -- build https://github.com/owner/repository.git \
  --out ./public/projects/my-city
```

输出包含 manifest、entities、relations、commits、chapters、NDJSON deltas、
keyframes 和可选 knowledge Markdown，不包含完整源码。

## 规格映射

| 规格目标 | 实施位置 |
|---|---|
| 稳定实体身份与 rename | `packages/git-analyzer`、`packages/city-compiler` |
| JS/TS 事实分析 | `packages/code-analyzer` |
| Zod 数据契约 | `packages/schema` |
| delta、keyframe、seek | `packages/replay-engine` |
| 静态数据包 CLI | `apps/cli` |
| 3D 城市与 Inspector | `app/components` |
| 真实历史回放 | `RepoCityApp`、`CityScene` |
| tiny Git 验收仓库 | `fixtures/tiny-ts-repo`、`public/projects/tiny` |

根目录保留 Viewer，是为了兼容 Vinext / Cloudflare Worker / Sites 运行时；
CLI 和共享事实层仍按 monorepo workspace 划分。项目使用 Sites 模板原生的 npm
workspaces，避免再叠加一套包管理与构建系统。

## 验证结果

最终执行 `npm run check`，全部通过：

- ESLint：0 error，0 warning；
- TypeScript：Viewer、CLI 和全部共享 package 通过；
- 单元测试：28 项通过；
- 生产构建：Vinext / Cloudflare Worker 构建通过；
- 生产输出 SSR 检查：2 项通过；
- 合计：30 项自动化测试通过。

测试覆盖 schema 边界、布局确定性、稳定 ID、回放 seek、AST 分析、路径别名、
Git rename/delete/tag、CLI 导出、数据包加载错误及生产 HTML。

此外，内置 tiny fixture 已生成一个包含 5 个 commit、2 个 tag、rename、
add/delete、tsconfig alias 与 ignore 场景的真实 Git 仓库，并成功编译到
`public/projects/tiny`。

## 性能策略

- 建筑按角色分批实例化，React 组件数量不随建筑数量线性增长；
- District 和实体布局只编译一次，回放不重新布局；
- 依赖线按选择即时缩小到一阶邻域；
- 静态数据文件并行加载，manifest 先行并全量校验；
- replay keyframe 限制随机 seek 的重放长度；
- 渲染像素比设置上限，阴影和视觉效果保持克制。

## 当前边界

- 只分析 `.js`、`.jsx`、`.ts`、`.tsx`；
- 推荐不超过 2,000 个源码文件和约 500 个展示 commit；
- 原始历史完整保留，但超过 500 commit 的导演式自动折叠仍属于后续功能；
- export 名写入实体 knowledge Markdown，核心 schema 保存 export 数量；
- 桌面端是完整交互目标，移动端以查看为主；
- AI/Wiki 仍是可选增强层，不会覆盖确定性 Git 与依赖事实。

## 运行与验收

```bash
npm install
npm run dev
npm run check
```

默认地址展示完整产品演示；`/?project=tiny` 加载真实 CLI 数据包。
