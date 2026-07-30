# 分析与数据包性能

RepoCity 0.1 面向不超过约 2,000 个 JS/TS 文件、500 个展示 commit 的桌面体验。分析器可以读取更长历史，但当前会为每个原始 commit 生成 delta；大型仓库应先测量输出体积和构建时间。

## 当前成本模型

设：

- `C` 为 commit 数；
- `F` 为全历史唯一源码实体数；
- `ΔF` 为平均每 commit 变化文件数；
- `R` 为当前内部 import 数。

主要成本：

- Git diff 与内容读取：约 `O(C × ΔF)`；
- AST 解析：约 `O(unique content blobs)`，内容哈希命中时跳过；
- 每 commit 关系重解析：约 `O(F + R)`，但只做字符串路径解析，不重跑 AST；
- bundle schema 全量校验：约 `O(F + R + C)`；
- 城市布局：对实体和 district 做稳定排序，约 `O(F log F)`。

## 已采用的优化

- 通过本机 `git` 参数化调用，不下载 GitHub API 的逐文件数据。
- clone URL 只保留到本次构建结束，避免长期占用空间。
- AST 缓存键是 `扩展名 + 内容 SHA-256`；rename 和跨 commit 未变 blob共享结果。
- 只在 changed file 上读取内容。
- import 目标用 `Map<repoPath, entityId>` 查找。
- delta 使用 NDJSON，Viewer 可以流式解码而无需先构造一个超大数组。
- keyframe 默认每 50 commit 一个，将 seek 后需要重放的 delta 限制在小窗口。
- JSON 写入使用同目录临时文件 + rename，避免读取半写入文件。

## 默认保护

- 只接受 `.js`、`.jsx`、`.ts`、`.tsx`。
- 单文件默认最多 4 MiB；可用 `--max-file-mb` 调整。
- 默认排除依赖、vendor、build、coverage、cache、minified 和 generated 产物。
- Git 子进程不经过 shell，仓库路径和 revision:path 都作为独立参数。
- TypeScript 只构造 AST，不做 typecheck，不加载插件，也不执行仓库代码。

## 大仓库建议

1. 在 `.repocityignore` 排除 generated clients、vendored SDK、快照和大型 fixture。
2. 先在默认 4 MiB 上限构建，检查 warning，再有选择地提高。
3. 把输出放在仓库外或已 ignore 的目录，避免下一次构建把产物纳入历史。
4. Viewer 端先读取 manifest/districts，按需读取 relations、commits 和知识文档。
5. 关系线只展示 district 聚合或当前选中实体的一阶邻居，不全量绘制。

## 测量

推荐在目标仓库上记录：

```bash
/usr/bin/time -l node apps/cli/bin/repocity.mjs build ./repo --out /tmp/repo.repocity
du -sh /tmp/repo.repocity
wc -l /tmp/repo.repocity/deltas.ndjson
```

构建输出应同时观察 entity 数、commit 数、跳过文件 warning 和 keyframe 数。性能回归测试应固定 Git fixture 和 Node 主版本，比较 wall time、峰值 RSS 与 bundle 字节数，而不是只比较单个 AST 调用。

## 已知瓶颈与后续方向

- 当前每个 changed file 分别调用 `git show`。超长历史可改成持久 `git cat-file --batch`，减少进程启动。
- 每 commit 都重新解析 import 指向以保证 rename/alias 正确。可用“受影响路径反向索引”做增量关系更新。
- 0.1 未对超过 500 个 commit 做展示节点折叠；原始事实仍完整。后续可增加 displayed commit 映射，同时保留 raw commit 查询表。
- 静态 JSON 尚未压缩。HTTP 部署应启用 Brotli/Gzip；若大型项目仍超预算，可保持 schema 语义不变并增加分片索引。
