# RepoCity 架构

RepoCity 把仓库分析和浏览器渲染彻底分开。CLI 是编译器：输入 Git 仓库，输出经过 schema 校验的静态数据包；Viewer 是播放器：只请求 JSON/NDJSON/Markdown，不执行 Git，也不解析源码。

```text
local path / public Git URL
          │
          ▼
  Git analyzer ─── commit、tag、rename、文件内容
          │
          ▼
  Code analyzer ── LOC、imports、exports、角色
          │
          ▼
  City compiler ── district、稳定坐标、视觉指标
          │
          ▼
  Replay engine ── delta、chapter、keyframe
          │
          ▼
  project.repocity/ (schemaVersion 0.1)
```

## 包边界

- `packages/code-analyzer`：纯源码分析。使用 TypeScript Compiler API 解析 `.js`、`.jsx`、`.ts`、`.tsx`；不执行用户代码。
- `packages/git-analyzer`：只通过参数化的本机 `git` 子进程读取历史。它维护路径到实体的状态机、内容哈希缓存和关系生命周期。
- `packages/city-compiler`：接收全历史实体并集，一次性确定 district 与坐标。回放中不重新布局。
- `packages/replay-engine`：验证并应用 delta，生成规则章节和每 50 commit 的 keyframe。
- `packages/schema`：静态包的唯一事实格式。CLI 写盘前对完整 bundle 做 Zod 校验。
- `apps/cli`：编排上述包、克隆公开 URL、原子写入数据文件和简短知识文档。

## 分析流程

### 1. 仓库准备

本地输入会先用 `git rev-parse` 校验。HTTP(S)、SSH 或 `git://` URL 被 clone 到系统临时目录，并在成功或失败后清理。CLI 不依赖 GitHub API，也不需要 token。

### 2. Git 历史

提交按 `git log --reverse --topo-order` 从旧到新处理。每个提交记录 SHA、父提交、作者、ISO 时间、标题和 tag。

普通提交和 merge commit 都比较“第一父提交 → 当前最终树”；根提交使用 `git diff-tree --root`。这样 merge 的 delta 描述主线状态真正发生的变化，不会把两条父分支重复播放。

`-M50%` 开启 Git rename 检测：

- add：用 `首次出现 SHA + path` 生成稳定实体 ID；
- rename：复用旧 ID，并把旧路径加入 aliases；
- delete：结束实体生命周期；
- delete 后同路径重新 add：生成新 ID；
- copy：创建新实体，原实体不变。

生命周期里的 `bornAt` 表示应用该 commit delta 后出现，`diedAt` 表示应用该 commit delta 时消失。

### 3. 代码事实

只分析四种扩展名。LOC 是非空物理行数；imports 包括 ESM import、re-export、`require()` 和静态字符串 dynamic import；exports 包括 ESM 与常见 CommonJS 写法。

内部依赖解析顺序：

1. 相对路径（含 TypeScript 中 `.js` specifier → `.ts/.tsx` 源文件）；
2. `tsconfig.json` 的 `baseUrl` 与 `paths`；
3. workspace package name 与 package entry；
4. 外部 npm 包不生成关系。

默认过滤 `.git`、`node_modules`、vendor、dist、build、coverage、框架缓存、minified/generated bundle；之后按顺序应用仓库根 `.gitignore`、`.repocityignore` 和 CLI `--ignore`。后出现的 `!pattern` 可以恢复文件。

角色由确定性路径规则得出：test、docs、config、script、source、other。入口文件由 `index/main/server/client/cli`、路由、bin 和框架配置等规则标记。解析结果按“内容哈希 + 扩展名”缓存，rename 或重复 blob 不会重复 AST 工作。

### 4. 关系与回放

每个 commit 应用文件变更后重新解析内部 import 指向，但不会重新解析未变化的 AST。关系以 source entity ID + target entity ID 标识，所以文件 rename 不会让关系闪断。

每个 delta 的顺序为：

1. spawn；
2. rename；
3. update（含依赖变化导致的 fan-in/fan-out 更新）；
4. remove；
5. relation add/remove。

城市布局使用全历史实体的 `maxMetrics`，因此新增、删除、rename 和 seek 都只改变运行状态，不改变地块坐标。

## 可扩展点

- 多语言应新增独立 analyzer，并映射到同一事实接口；不要让 Viewer 解析 AST。
- 更强的 rename/复制判断可替换 Git 的相似度策略，但必须保持实体 ID 可复现。
- AI 或 Wiki 只能写入 `knowledge/`，不可改写 commit、依赖、指标等事实层。
- 云端分析可把 CLI 放进 worker/queue，但静态 bundle 契约保持不变。
