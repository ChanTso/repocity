# Tiny TypeScript repository

这是 RepoCity 的确定性集成测试仓库。当前目录保存最终工作树；脚本会在一个新目录中重建完整 Git 历史，其中包含：

- 添加 TypeScript 文件与测试；
- `math.ts` → `arithmetic.ts` rename；
- 添加后删除 `legacy.ts`；
- `v0.1.0`、`v0.2.0` tag；
- tsconfig `@core/*` path alias；
- 应被排除的 `generated/` 目录。

生成可分析的临时仓库：

```bash
node ./scripts/create-history.mjs
```

脚本会打印新仓库路径，也可以传入一个尚不存在的目标目录：

```bash
node ./scripts/create-history.mjs /tmp/repocity-tiny
```

随后运行：

```bash
node ../../../apps/cli/bin/repocity.mjs build /tmp/repocity-tiny --out /tmp/tiny.repocity
```
