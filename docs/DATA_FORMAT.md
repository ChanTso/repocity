# RepoCity 静态数据格式 0.1

CLI 输出一个可直接放到 CDN 或 `public/` 的目录：

```text
project.repocity/
├── manifest.json
├── districts.json
├── entities.json
├── relations.json
├── commits.json
├── chapters.json
├── deltas.ndjson
├── keyframes/
│   ├── 0000.json
│   └── 0050.json
└── knowledge/
    ├── repo.md
    └── entities/<entityId>.md
```

所有 JSON 使用 UTF-8。普通 JSON 带两个空格缩进；`deltas.ndjson` 每行恰好一个完整 `ReplayDelta`。schema 由 `packages/schema` 导出，版本固定为 `"0.1"`。

## manifest.json

```json
{
  "schemaVersion": "0.1",
  "projectId": "tiny-a1b2c3d4e5f60708",
  "repo": {
    "name": "tiny",
    "remoteUrl": "https://github.com/example/tiny",
    "defaultBranch": "main",
    "headSha": "0123456789abcdef"
  },
  "stats": {
    "entityCount": 4,
    "districtCount": 2,
    "commitCount": 5,
    "displayedCommitCount": 5
  },
  "files": {
    "districts": "districts.json",
    "entities": "entities.json",
    "relations": "relations.json",
    "commits": "commits.json",
    "chapters": "chapters.json",
    "deltas": "deltas.ndjson",
    "keyframesDir": "keyframes"
  }
}
```

`projectId` 对仓库名/remote 稳定，不随 HEAD 改变。`remoteUrl` 只有在能转换成 Web URL 时才出现。`commitCount` 保留原始 commit 数；当前 0.1 版本的 `displayedCommitCount` 等于 delta 数。

## entities.json

实体是逻辑文件，而不是某一时刻的路径。

- `id`：由首次出现的 commit/path 生成的稳定哈希。
- `path`：最后一次出现时的路径；存活实体即 HEAD 路径。
- `aliases`：按字典序排列的历史旧路径，不重复当前 `path`。
- `bornAt` / `diedAt`：commit index 生命周期；`diedAt` commit 应用后实体已不可见。
- `maxMetrics`：全历史最大 LOC、exports、fan-in、fan-out，以及累计 changed-line churn。
- `districtId` / `layout`：全历史只计算一次的稳定地块。

```json
{
  "id": "ent_abc123",
  "kind": "building",
  "path": "src/core/arithmetic.ts",
  "aliases": ["src/core/math.ts"],
  "name": "arithmetic.ts",
  "extension": ".ts",
  "language": "typescript",
  "role": "source",
  "districtId": "src-core",
  "bornAt": 0,
  "maxMetrics": {
    "loc": 12,
    "exports": 3,
    "fanIn": 2,
    "fanOut": 1,
    "churn": 24
  },
  "layout": {
    "x": 4,
    "z": 8,
    "width": 2.5,
    "depth": 2.5,
    "maxHeight": 12,
    "rotationY": 0,
    "styleVariant": 2
  }
}
```

`knowledge/entities/<entityId>.md` 补充当前 export 名、入口判断、历史路径和源码链接。这些是可选展示资料，不参与回放状态恢复。

## districts.json

每个 district 包含稳定矩形、颜色、权重和 entity ID 列表。monorepo 优先按 `apps/<name>`、`packages/<name>` 分区；其次按 `src/<name>`；tests/docs/scripts/config 会形成特殊区；其余进入 core。

## relations.json

0.1 只有 `kind: "import"`。一条关系连接两个逻辑实体，`weight` 至少为 1。rename 不结束关系；import 真正消失时才写 `diedAt`。如果同一关系后来恢复，会生成带新 `bornAt` 的新 relation ID，以准确表达多个生命周期。

## commits.json 与 chapters.json

commit index 从 0 连续递增，顺序为旧到新。每条 commit 保存 SHA、parents、author、ISO 8601 时间、标题、tags、受影响实体以及规则章节 ID。

章节只用于观看节奏；`mode: "rules"` 和 disclaimer 明确说明它不代表开发者原始意图。tag 会强制结束章节。

## deltas.ndjson

实体操作：

- `spawn`：实体出现，并带当时 RuntimeMetrics；
- `update`：严格携带 before/after，支持一致性检查和动画；
- `rename`：只改变路径，实体 ID 与坐标不变；
- `remove`：实体消失。

关系操作只有 `add` / `remove`，引用 `relations.json` 中定义。应用 delta 时实体操作先执行，关系操作后执行。

## keyframes

keyframe 是完整、可序列化的 `ReplayState`：

```json
{
  "commitIndex": 50,
  "entities": {
    "ent_abc123": {
      "entityId": "ent_abc123",
      "path": "src/core/arithmetic.ts",
      "metrics": { "loc": 12, "exports": 3, "fanIn": 2, "fanOut": 1 }
    }
  },
  "relationIds": ["rel_def456"]
}
```

文件名是零填充 commit index。Viewer seek 时读取不晚于目标的最近 keyframe，再顺序应用余下 delta；其结果必须与从空状态顺序播放一致。

## 兼容性

读取端必须先检查 `schemaVersion`。0.x 期间新增文件可忽略，但 schema 内对象采用 strict 校验，未知字段不会被静默当作事实。格式升级应输出新版本目录，避免原地混写。
