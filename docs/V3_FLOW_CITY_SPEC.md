# RepoCity V3 — Flow City / 可验证的软件城市模拟器

> 文档类型：完整 V3 目标规格 + 当前交付台账
> 当前交付：Flow Journey vertical prototype
> 完整目标：`0.3` 垂直切片，尚未达到完整 V3 Gate
> 历史基线：`repocity-spec.md` 与 `docs/V2_CITY_SIMULATION_SPEC.md`
> 研究背景：`docs/CITY_SIMULATION_RESEARCH.md`

## 当前交付状态

| 层级 | 状态 | 准确边界 |
|---|---|---|
| Flow Journey prototype | 已实现，当前分支质量门禁已通过 | Viewer 内的确定性路线/token 规划、HEAD 事实过滤、道路约束寻路、分步播放、模拟/推导标识、可暂停交通 cohort、8 类旅程设施、export X-ray 与路线证据卡 |
| V3 静态数据契约 | Planned | 尚未发布 `0.3` bundle schema；当前 flow plan 仍是 Viewer 内部 `0.1` |
| 离散事件模拟 | Planned | 当前只有统一、可冻结的 token 时钟和 request/response 方向；尚无 event queue、20 Hz reducer、correlation tree、真实 queue/join 或时间 seek |
| 宏观 Flow City | 部分原型 | Journey 中的文件楼会替换成城门、工厂、车站、海关、编组场、港口、规划中心和工地；背景仍是 V2 文件级城市，尚无 component L0 |
| 真实建筑内部 | 部分原型 | 有 export 时用真实 export 名称生成紧凑 X-ray；无 export 时明确显示“内部事实未采集”，尚无 function/room/call facts |
| Static Artifact River | 部分原型 | Golden Journey 的静态 Bundle 已由主角货船和陆路 feeder 跨河；河流与两岸地理仍来自 V2 阈值，尚非架构边界规划 |
| 完整 V3 Gate | 未完成 | 第 11.2–11.6 节与第 13 节全部通过后才可称为 V3 垂直切片 |

除非条目在“当前原型 Gate”中明确标为完成，本文中的 `必须`、性能预算、数据契约和
硬验收均表示完整 V3 的目标，而不是本次 prototype 已实现的能力。当前实现不得被
描述成完整离散事件模拟器、真实 symbol cutaway 或 observed runtime。

## 0. 决策摘要

RepoCity V3 不再以“把所有文件画成更精致的高楼”为目标，而是：

> 用一座持续运转、可跟随、可验证的城市，解释一个软件系统的结构、数据旅程和
> Git 演化。

人流、车辆、列车、货船、道路、建筑内部不是环境装饰，而是主要信息载体。每个
移动对象都必须能回答：

1. 它代表什么；
2. 从哪里来、到哪里去；
3. 为什么走这条路；
4. 当前处于哪个模块、文件或 symbol；
5. 它依据的是静态推导、场景模拟、真实运行、Git 事实还是测试事实。

V3 保留 RepoCity 的三个初衷：

- **空间记忆**：组件、模块和文件拥有稳定地址；
- **时间因果**：建设、翻修和拆除来自真实 Git 事件；
- **知识落点**：任何城市对象都能追溯到代码、关系、测试或 commit。

但产品成功顺序调整为：

1. 跟随一段可理解的数据旅程；
2. 从旅程理解系统边界、依赖方向、分叉、汇合和瓶颈；
3. 进入建筑看见真实内部结构；
4. 再自由探索整座城市和 Git 历史。

V2 的道路、渲染、HUD、回放和实例化基础可以复用；V2 的“文件塔海 + 随机巡游”
不再作为产品方向继续打磨。

## 1. 产品目标与核心问题

### 1.1 V3 必须帮助用户回答

- 一个输入如何从入口经过分析、转换、存储，最终变成界面结果？
- 哪些组件属于同一运行阶段，哪些由明确边界隔开？
- 哪些是公开接口，哪些调用绕过了公开接口？
- 哪个节点发生 fan-out、join、排队、重试、缓存或失败？
- 进入一个组件后，实际由哪些文件、export、class 或 function 完成工作？
- 修改当前对象会影响哪些调用方、测试和历史上共同变化的对象？
- 画面中的每条路线和每个数量，是事实、推导还是模拟？

如果城市不能比目录树和普通依赖图更快回答至少前三个问题，视觉完成度不算成功。

### 1.2 核心体验循环

```text
选择一个问题或场景
  → 镜头定位入口
    → 跟随一个主角数据单元
      → 在人行 / 车行 / 铁路 / 水运之间换乘
        → 进入一栋建筑查看内部处理
          → 在分叉、汇合或边界处暂停解释
            → 点击证据回到源码 / test / commit
              → 返回城市继续旅程或查看影响范围
```

默认落地页不先要求用户自由旋转一片陌生城市，而是提供：

- `仓库如何变成一座城市`：RepoCity 自身的 Golden Journey；
- `选择一个入口`：从真实 entry point 生成结构模拟；
- `查看当前 commit`：跟随施工和影响范围；
- `自由探索`：进入传统城市总览。

## 2. 事实、推导与模拟的证据契约

> 完整 V3 目标。当前 prototype 只实现 `simulated` 与 `inferred` 两种 provenance，
> 证据限于 import relation、路径启发式、城市落位和解释文字；route 证据卡已经
> 可点击，单个 agent 的证据卡以及 `observed`、`test`、`git` EvidenceRef 尚未
> 实现。

### 2.1 五种证据等级

| 等级 | 含义 | 可以表达 | 不可以声称 |
|---|---|---|---|
| `observed` | 来自实际运行 trace / telemetry | 调用顺序、真实次数、延迟、错误、并发 | 未被采集的分支或业务含义 |
| `test` | 来自一次可识别的测试执行、coverage 或测试 trace | 该测试走过的路径、通过/失败、覆盖关系 | 生产流量和生产可靠性 |
| `git` | 来自 commit、diff、rename、tag 和时间 | 建设、翻修、拆除、共同变化 | 运行调用和开发者意图 |
| `inferred` | 由 import、symbol reference、静态 call graph 或明确配置推导 | 可能路径、结构方向、公共边界 | 实际执行、频率、延迟 |
| `simulated` | 由确定性场景引擎在已知图上生成 | 可解释的请求旅程、排队、分叉、汇合 | 真实发生过或具有生产数量级 |

`simulated` 不是“随机装饰”。它必须有一个基础图和场景定义，并引用组成该路线的
`inferred`、`test` 或 `observed` 证据。

### 2.2 证据数据结构

```ts
type EvidenceKind =
  | "observed"
  | "test"
  | "git"
  | "inferred"
  | "simulated";

interface EvidenceRef {
  id: string;
  kind: EvidenceKind;
  label: string;
  source:
    | { type: "source"; path: string; symbol?: string; line?: number }
    | { type: "relation"; relationId: string }
    | { type: "commit"; sha: string; entityIds: string[] }
    | { type: "test"; testId: string; runId?: string }
    | { type: "trace"; traceId: string; spanId?: string }
    | { type: "scenario"; scenarioId: string; ruleId: string };
  confidence?: number;
  explanation: string;
}
```

### 2.3 强制呈现规则

- HUD 始终显示当前场景的主证据徽标：`模拟`、`静态推导`、`真实运行`、
  `测试路径` 或 `Git 事实`。
- 选择任意 agent、道路、房间或事件，都能打开证据卡。
- 一个路径只要包含 `inferred` 段，整条路径就不能显示为完全 `observed`。
- 没有 `observed` 证据时，不显示 `QPS`、`真实延迟`、`真实拥塞率`等名称。
- 模拟数量只表达相对强弱，图例必须写“模拟密度”，不能伪装成生产次数。
- 运行、测试、Git 使用不同时间轴；不得把 commit 时间当成调用时间。
- 颜色不是唯一编码。证据等级同时使用图标、线型、标签和 Inspector 文本。
- 所有推导都显示规则，例如：
  `apps/cli/src/bundle.ts 静态调用 analyzeGitRepository，因此推导此路段`。

## 3. 城市语义语法

### 3.1 空间和建筑

| 城市对象 | 软件含义 | 约束 |
|---|---|---|
| 城市 | repository / monorepo | 一个稳定 seed |
| 城区 | workspace、bounded context 或可验证的大型子系统 | 不按固定文件数量机械切分 |
| 街区 | package、目录簇或高内聚模块簇 | 可解释归属依据 |
| 地块 | 稳定组件地址 | rename 后优先保持 |
| 建筑 | 语义缩放后的 component、module 或 file | 远景不再“一文件一塔” |
| 建筑翼楼 | 文件或 symbol group | 只在中近景出现 |
| 楼层 | class、export group、pipeline stage | 必须来自真实结构 |
| 房间 | function、method、handler 或 task | 可跳转源码 |
| 建筑入口 | public export、route、CLI command、handler | 入口名称可见 |
| 装卸口 | import、storage、artifact 输入输出 | 显示方向 |
| 核心筒 / 电梯 | 跨层调用、共享 helper 或内部 dispatch | 不用于 LOC |
| 广场 / 枢纽 | fan-out、join、dispatcher、aggregator | 有事件发生才出现 |
| 施工设施 | Git diff / PR / commit | 只在 Git lens 激活 |

建筑高度不再直接等于 LOC。远景高度只辅助表达组件规模和中心性；内部楼层数必须
等于当前可见的结构分组数。立面窗格不得随机伪装成楼层。

### 3.2 道路、边界与设施

| 城市对象 | 软件含义 | 约束 |
|---|---|---|
| 人行走廊 | 同一建筑或同街区的局部调用 | 近景可见 |
| 普通道路 | 允许的同步结构走廊 | 聚合多条关系，不是一 import 一条路 |
| 单行道 | 只有单向调用的走廊 | 箭头与行驶方向一致 |
| 主干路 | 多个场景共享的高权重走廊 | 权重来源可追溯 |
| 公交 / 轻轨线 | 多场景反复经过的公共调用链 | 后续由场景统计生成 |
| 铁路 | build、test、analysis 等固定顺序 pipeline | 站点等于 stage |
| 高架 | 跨越多个层级或边界的长距离结构走廊 | 必须有起终点和坡道 |
| 河流 / 海峡 | process、runtime、trust 或 static-artifact 硬边界 | 无边界证据不强行出现 |
| 桥 | 明确允许的跨边界同步 API / adapter | 可展开到接口 |
| 闸门 / 海关 | schema validation、auth、contract check | 通过和拒绝都可见 |
| 港口 | serialization、queue、artifact store、event broker | 需要异步或静态产物证据 |
| 仓库 | cache、database、artifact storage | 读写入口分开 |
| 环岛 | dependency cycle 或 retry loop | 普通路口不得滥用 |
| 封闭匝道 | circuit breaker、feature gate 或失败路径 | 状态和来源必须明确 |

河流可以是可信的硬边界，但水本身不等于数据。数据必须由桥、渡轮或货船明确跨越。
如果一个边界禁止同步调用，地图应保留“没有桥”这一信息，而不是为了好看补桥。

### 3.3 人流与车辆

| Agent | 软件含义 | 典型行为 |
|---|---|---|
| 行人 | 建筑内部的 invocation / work item | 进门、排队、乘电梯、进房间 |
| 汽车 / 出租车 | 跨 module 的同步请求和返回 | 去程携带请求，回程携带结果 |
| 货车 | 文件、AST、bundle、数据库批量读写等大 payload | 装货、运输、卸货 |
| 公交 / 轻轨 | 多个请求共享的稳定公共路径 | 固定站点与班次 |
| 火车 | 有明确 stage 的 build / test / analysis pipeline | 车厢逐站加工 |
| 货船 | queue、event、batch、静态 artifact 跨边界传输 | 批量离港、积压、消费 |
| 无人机 | webhook、通知、遥测或外部单向信号 | 快速单向、越过道路 |
| 施工队 | commit 中的文件变化 | 搭建、翻修、拆除 |
| 检验人员 | test / validation / coverage | 进入被测房间，报告通过或失败 |

每个 Agent 不是一位虚构“居民”，而是一个可以追踪的数据或工作单元。为增强可读性，
主体可携带稳定编号、payload 图标和来源徽标。

### 3.4 可见的计算现象

- **fan-out**：一辆主请求车到达枢纽后生成多辆带相同 correlation ID 的子车；
- **join**：子车在广场不同入口等待，满足 join rule 后生成返回车；
- **queue**：agent 在港口、站台或入口形成有上限的可见队列；
- **backpressure**：队列增长、发车间隔变慢，不能只显示红色数字；
- **cache hit**：车辆在近端配送中心掉头快速返回；
- **cache miss**：车辆继续前往远端 storage；
- **retry**：失败车辆经明确回转匝道重新进入，显示尝试次数；
- **cycle**：一组车辆在异常环路中循环，路线与依赖 cycle 对应；
- **circuit break**：闸门关闭，后续车辆在入口快速返回；
- **error**：agent 停止、转入故障车道或返回错误；不得使用爆炸等无依据效果；
- **test failure**：检验人员挂出失败标记并指向断言或测试记录；
- **commit change**：施工队只操作本 commit 影响的建筑、道路或入口。

垂直切片至少实现 `fan-out`、`join`、`queue` 和同步返回。其他现象进入后续阶段，
除非 Golden Journey 的真实结构天然需要。

## 4. 离散事件模拟

> Planned。当前 prototype 的 `planFlowSimulation` 是确定性 journey
> planner；界面按站点推进，Renderer 使用循环动画表现 active leg。它尚未消费下述
> `FlowEvent`，也不提供真实 queue、join barrier、principal agent continuity、
> event seek 或 fixed-tick reducer。

### 4.1 原则

- 模拟是纯函数、确定性、可暂停、可单步和可重放的；
- 业务状态由离散事件推进，不在每帧运行智能体 AI；
- 车辆位置是相邻事件间的渲染插值，不是事实来源；
- 路径在场景编译时确定，播放期间不做全图寻路；
- 同 seed、同事实、同场景必须产生 byte-for-byte 相同的事件序列；
- 模拟时长服务于理解，不冒充真实延迟；
- `observed` 延迟只经过有标记的可视化归一化，不直接等于屏幕秒数。

### 4.2 静态场景图

```ts
type FlowNodeKind =
  | "entry"
  | "component"
  | "building"
  | "symbol"
  | "queue"
  | "storage"
  | "boundary"
  | "fan-out"
  | "join"
  | "exit";

interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  componentId: string;
  entityId?: string;
  symbolId?: string;
  label: string;
  evidence: string[];
}

type FlowMechanism =
  | "internal-call"
  | "sync-call"
  | "pipeline"
  | "artifact"
  | "async-message"
  | "storage-read"
  | "storage-write"
  | "return";

interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  mechanism: FlowMechanism;
  transport:
    | "pedestrian"
    | "car"
    | "truck"
    | "train"
    | "ship"
    | "drone";
  roadOrRouteId: string;
  evidence: string[];
  relativeWeight: number;
}

interface FlowScenario {
  id: string;
  title: string;
  description: string;
  entryNodeId: string;
  successNodeIds: string[];
  failureNodeIds: string[];
  nodeIds: string[];
  edgeIds: string[];
  seed: string;
  primaryEvidence: EvidenceKind;
}
```

### 4.3 事件契约

```ts
type FlowEvent =
  | { at: number; type: "spawn"; agentId: string; nodeId: string }
  | { at: number; type: "enter-node"; agentId: string; nodeId: string }
  | { at: number; type: "exit-node"; agentId: string; nodeId: string }
  | { at: number; type: "depart"; agentId: string; edgeId: string }
  | { at: number; type: "arrive"; agentId: string; edgeId: string }
  | { at: number; type: "enqueue"; agentId: string; queueId: string }
  | { at: number; type: "dequeue"; agentId: string; queueId: string }
  | {
      at: number;
      type: "fan-out";
      agentId: string;
      childAgentIds: string[];
      joinId: string;
    }
  | { at: number; type: "join-wait"; agentId: string; joinId: string }
  | {
      at: number;
      type: "join-release";
      joinId: string;
      resultAgentId: string;
    }
  | { at: number; type: "retry"; agentId: string; attempt: number }
  | { at: number; type: "fail"; agentId: string; reason: string }
  | { at: number; type: "complete"; agentId: string; nodeId: string };
```

每个 `agentId` 携带：

- `correlationId`：同一旅程中的父子关系；
- `payloadKind`：source、AST、fact、bundle、delta、render-plan 等；
- `evidenceIds`：本 agent 的证据；
- `transport`：当前表现形式；
- `principal`：是否为镜头可跟随的主角；
- `label`：面向用户的短名称，不暴露内部随机 ID。

### 4.4 编译与播放管线

```text
Repo / symbol / Git / test / trace facts
  → ArchitectureGraph
  → FlowScenarioCompiler
  → FlowScenario + EvidenceRefs
  → deterministic event queue
  → FlowPlaybackState
  → instanced agent renderer + HUD itinerary
```

模拟器建议作为纯包 `packages/flow-simulator`，不依赖 React、Three.js 或浏览器。
Viewer 只负责时钟控制、插值、选择和渲染。

## 5. 语义缩放与空间层次

> Planned。当前 prototype 只在原 V2 文件城市中弱化非旅程建筑并叠加路线；它尚未
> 改变文件级塔海布局，也没有实现 L0–L3 聚合/展开。

### 5.1 四级语义缩放

| 级别 | 典型镜头 | 显示内容 | 流动表达 |
|---|---|---|---|
| L0 City | 全城 | 5–30 个宏观组件、硬边界、主走廊 | 聚合光流、列车、船 |
| L1 District | 城区 | package、module、公共接口和主干路 | 车辆 cohort、站点和方向 |
| L2 Building | 建筑外部 | file / wing、入口、装卸口 | 单车、行人换乘 |
| L3 Cutaway | 建筑内部 | symbol floor、function room、内部调用 | 行人、电梯、队列 |

同一对象在不同级别聚合或展开，但地址和身份不变。镜头缩放不能重新排版城市。

### 5.2 远景不再渲染文件塔海

- L0 的建筑默认代表 component/package，不代表单个文件；
- 大型 component 使用校园、院落、厂房、车站、仓库等不同轮廓；
- 文件只在 L1/L2 展开为翼楼、低层组团或内部楼层；
- 高度不独占视觉编码；平面组织、入口数量、边界、设施和交通同样承载信息；
- 留出广场、港区、编组站、院落和绿色缓冲，形成可读负空间；
- 普通建筑不使用黑色顶盖 + 蓝色窗格的单一语法。

### 5.3 单体 Cutaway

本节描述完整 V3 的真实内部。当前 prototype 的 `BuildingFlowCutaway` 只绘制楼层环、
竖向活动 token 和入口人流，楼层仍来自 V2 building profile；产品文案只能称其为
`X-ray activity preview`，不能声称已经展示真实文件、symbol、房间或调用。

任意时刻最多打开一栋完整内部：

```text
Public entrance
  → dispatcher / validation lobby
    → symbol floors
      → function rooms
        → helper corridor / shared core
          → import loading dock / return exit
```

垂直切片最低要求：

- 至少展示一个真实 component 的 3 个以上文件或 symbol；
- 主角 agent 从真实 public entrance 进入；
- 至少经过两个真实内部处理节点；
- 切换成行人后走过房间、走廊或电梯；
- 从 import / output 侧离开并换乘跨组件交通；
- 点击房间可打开文件、symbol 和推导说明。

如果分析器无法可靠解析 function call，房间必须降级为 export 或文件级节点，并在
HUD 标为 `静态推导`；不得生成看似精确的虚构函数。

## 6. RepoCity Golden Journey

### 6.1 主题

首个内置场景：

> **一个仓库如何变成一座城市**

它使用 RepoCity 自身的真实组件和源码关系，既是产品导览，也是 V3 的端到端
验收 fixture。

### 6.2 地理上的“恍然大悟”

RepoCity 有一个真实而重要的架构边界：

- 西岸是 Node.js / CLI 编译城市；
- 东岸是浏览器 Viewer 城市；
- 两岸没有运行时服务调用；
- 二者只通过生成的 `project.repocity/` 静态产物交流。

完整 V3 计划使用一条 **Static Artifact River** 隔开两岸：

- 不建普通公路桥，因为 Viewer 不会直接调用 Git 或源码分析器；
- CLI 港口把 JSON、NDJSON 和 Markdown 装入货船；
- Viewer 港口卸载静态 bundle；
- 两岸海关使用同一 schema 契约验证货物；
- 河流和船因此同时解释进程边界、隐私边界与部署方式，而非为了好看出现。

**当前 prototype 状态：**这套语义地理尚未实现。当前河流、两岸和桥仍由 V2 的
仓库规模规则决定；Golden Journey 的 freight leg 也不保证经水路运输。因此当前
截图中的河、桥或船不能被解释为 Static Artifact Boundary。

### 6.3 真实路线

Golden Journey 必须以当前代码的实际编译和消费顺序为准：

1. `apps/cli/src/cli.ts` 解析仓库地址和参数，调用
   `apps/cli/src/bundle.ts` 的 `buildProject`；
2. `buildProject` 通过 `prepareRepository` 准备本地仓库或临时 clone；
3. `buildProject` 调用 `packages/git-analyzer` 的
   `analyzeGitRepository` 读取 commit、rename、文件内容和关系生命周期；
4. `git-analyzer` 在分析每个变化内容时，内部调用 `packages/code-analyzer`，
   提取 LOC、imports、exports、role 和 entry point；CLI 不直接同时调用两个
   analyzer；
5. 完整 analysis 返回 `buildProject` 后，`packages/city-compiler` 的
   `compileCity` 先确定 District、entity 和稳定地址；
6. `buildProject` 将 city entity、analysis relation、commit 和 delta 交给
   `packages/replay-engine` 的 `compileReplay`，生成 chapter、delta 和 keyframe；
7. `bundle.ts` 汇合 city 与 replay 结果，构造完整 bundle，并调用
   `packages/schema` 的 `validateRepoCityBundle` 做 producer-side runtime
   validation；Schema 海关位于 replay 编译之后，而不是 replay 之前；
8. `writeStaticBundle` 原子写出 JSON、NDJSON、Markdown 和 keyframe，形成
   `project.repocity/` 静态产物；
9. 浏览器侧 `app/lib/project-bundle.ts` 加载这些资源，并用同一 schema 对各资源
   再次验证；
10. `RepoCityApp` 将 entity、district 和 relation 交给
    `app/lib/living-city.ts` 的 `planLivingCity`；
11. `app/lib/viewer-replay.ts` 恢复当前 HEAD 或指定 commit 的可见状态；
12. `CityScene` 消费 city plan 与 replay frame，实例化最终 3D 城市。

简化关系图：

```text
cli.ts
  → bundle.ts / buildProject
    → git-analyzer
      → code-analyzer（git analysis 内部）
    → city-compiler
    → replay-engine
    → schema validation
    → static bundle writer
      ══ project.repocity/ boundary ══
        → project-bundle loader + schema validation
          → living-city + viewer-replay
            → CityScene
```

这条故事必须以当前仓库真实 import、函数或显式场景证据为依据。如果实现期间代码
路径发生变化，Golden Journey fixture 必须随之更新，不能保留过期剧情。

**当前 prototype 状态：**当前内置 Journey 使用八个路径 anchor
（CLI、code analyzer、git analyzer、schema、replay、Viewer、planner、scene）
生成简化结构模拟，并明确标记 `simulated`。它尚未包含 `bundle.ts`、
`city-compiler`、静态 writer/port，也把 analyzer 与 schema 的顺序简化成视觉
fan-out/join。因此它是导览原型，不满足本节的真实 Golden Journey Gate。

### 6.4 完整切片计划中的城市活动

- 建筑内部行人；
- 至少 6 辆同步调用汽车/货车，包含请求和返回方向；
- 一列表现 Git / analysis pipeline 的列车；
- 一艘承载静态 bundle 的货船；
- 一次 fan-out 和一次 join；
- 一个可见但不会长时间拖慢导览的港口队列；
- 一组与真实 commit 对应的施工队；
- 一个可跟随的主角 agent；
- 所有其他活动降为轻量 cohort，不能抢过主角信息。

当前 prototype 已能为 active leg 绘制 pedestrian、car、train-like transit、
freight 和 boat cohort；Golden 的 static Bundle leg 使用带 payload 标签的主角货船，
car token 区分 request / response，暂停会冻结统一 token 时钟。但它仍没有离散
event queue、真实 join-wait / queue reducer 或跨换乘连续的 principal agent 状态。

## 7. 交付边界

### 7.1 当前 Flow Journey prototype

本次交付是架在 V2 city plan 之上的 Viewer 垂直原型，范围刻意限制为：

- `app/lib/flow-simulation.ts` 根据现有 entity、import relation 和 city plan
  生成确定性 journey；
- 能识别 RepoCity 风格路径 anchor，并为其他仓库生成有限的静态 dependency
  journey；
- Journey 明确区分 `simulated` 和 `inferred`，所有 leg 具有 reason，已知 import
  leg 保留 relation ID；
- Viewer 新增 `流动` 模式、场景选择、播放/暂停、前后站点和按站聚焦；
- active leg 使用 pedestrian、car、transit、freight 或条件性 boat cohort 表现；
- 非当前 Journey 建筑被弱化，当前建筑显示通用 X-ray activity preview；
- 原有 `探索` 与 `回放` 模式继续存在，Journey 模式隐藏 V2 ambient traffic，避免
  把随机巡游误称为数据；
- planner 的确定性、输入重排稳定、连接性和 transport override 具有针对性单测；
- server-render shell 测试覆盖流动模式、结构模拟标签和 Journey 控件的存在。

该 prototype 证明“人流和车辆可以承担结构解释”这一交互方向，但它不证明完整
V3 的数据契约、城市地理、内部结构或离散事件语义已经完成。

### 7.2 完整 `0.3` V3 垂直切片（Planned）

1. 新 `0.3` 流动事实契约：components、symbols summary、evidence、scenarios、
   flow nodes/edges；
2. RepoCity 自身的 5–10 个宏观组件布局，而不是数百栋文件塔；
3. Static Artifact River、两岸港口和有语义的货船；
4. 纯函数离散事件模拟器，支持播放、暂停、单步、重置和确定性重放；
5. pedestrian、car/truck、train、ship 四类流动；
6. Golden Journey 的 fan-out、join、queue、request/return；
7. 一个真实建筑 cutaway；
8. 主角跟随相机、旅程 breadcrumb 和当前处理步骤；
9. 点击 agent / node / route 显示证据卡和源码入口；
10. `模拟 / 推导 / Git` 三类在 UI 中清晰可辨；
11. Git 时间轴与 Flow 时间轴分离；
12. Balanced 档性能、reduce-motion 和键盘基本操作；
13. 单元、集成、浏览器冒烟和至少一张视觉回归基线。

以上 13 项全部达到第 11.2–11.6 节的硬验收后，才能将状态从 prototype 更新为
V3 vertical slice。

### 7.3 可以延后，但数据模型必须容纳

- OpenTelemetry 等真实 `observed` trace；
- 测试运行 trace 和 coverage inspectors；
- cache hit/miss、retry、circuit breaker、error lane；
- 多条用户自定义 scenario；
- arbitrary repository 的完整 function-level call graph；
- 公交、轻轨、无人机和大型交通网络；
- 多个异步 broker、topic、queue 和复杂港区；
- 全仓库的多栋同时 cutaway；
- PR review、ownership、CODEOWNERS 和 co-change lens；
- 用户配置 architecture boundaries 和场景编辑器。

### 7.4 实施期间明确删除或降级

- 普通汽车绕 District 外框的无语义循环；
- 行人绕公园随机巡游并被暗示成数据；
- 由 entity 数量阈值凭空触发的高架和河流；
- 把每个文件都放进远景并映射为同类高塔；
- 随机窗户排数和 HUD 楼层数不一致；
- 永久显示全部 import 弧线；
- 没有 evidence 的港口、船、车辆和设施。

可保留少量纯氛围行人、车和树，但必须位于独立 `Ambient` 图层，默认弱化，图例明确
“环境，不代表代码事实”，并允许一键关闭。

## 8. 实施架构与阶段计划

### 8.1 包和边界

以下是完整 V3 的建议结构，不是当前 prototype 的目录清单。prototype 暂时位于
`app/lib/flow-simulation.ts` 与 `app/components/`，目的是先验证交互；进入真实
event reducer 和静态 `0.3` contract 时再下沉到 packages。

建议结构：

```text
packages/schema/
  V3 evidence / component / symbol / flow schemas

packages/code-analyzer/
  exported declarations / symbol summary / conservative call facts

packages/flow-simulator/
  scenario compiler / event queue / reducer / deterministic tests

app/lib/flow-city/
  golden scenario adapter / semantic layout / playback selectors

app/components/flow-city/
  FlowMobilityLayer / CutawayLayer / FlowHUD / FollowCamera
```

原则：

- CLI 仍是编译器，Viewer 不解析仓库源码；
- schema 是事实边界，模拟器不直接读取 React state；
- Renderer 不决定路线、证据或业务事件；
- React 只管理离散 UI 状态；
- agent 高频位置留在 typed arrays / refs；
- V1/V2 reader 继续可用，V3 使用显式 adapter，不原地篡改旧数据。

### 8.2 Phase 0 — 契约与基准

- [ ] 保存当前 V2 截图和性能数字作为反例基线；
- [ ] 定义五个用户理解任务和手工计时表；
- [ ] 固化 `EvidenceRef`、component、symbol summary、flow graph、scenario schema；
- [ ] 为 RepoCity 自身写 Golden Journey fixture；
- [ ] 明确每一段路线的源码或关系证据；
- [ ] 新增 schema cross-reference validation。

完成门槛：即使不渲染 3D，也能从 fixture 打印一份完整、有证据的旅程 itinerary。

### 8.3 Phase 1 — 离散事件内核

- [ ] 新建纯 `flow-simulator`；
- [ ] 编译 spawn、travel、queue、fan-out、join、return、complete 事件；
- [ ] 支持固定 seed、seek、pause、step、reset；
- [ ] 支持 principal agent 和 correlation tree；
- [ ] 针对顺序、join、不变量和确定性写单元测试；
- [ ] 将事件序列序列化为可调试文本。

完成门槛：相同输入产生完全相同事件流；任何 agent 都能输出它的起点、终点和证据。

### 8.4 Phase 2 — 宏观 Flow City

- [ ] 将 RepoCity 聚合成 5–10 个真实组件；
- [ ] 形成 CLI 西岸、Viewer 东岸和 Static Artifact River；
- [ ] 构建道路、铁路、水路和港口 route graph；
- [ ] 渲染实例化汽车/货车、列车和货船；
- [ ] 实现路线方向、request/return 和 transport 换乘；
- [ ] 实现主角跟随、相机舒适模式和聚合流量；
- [ ] 默认视图优先展示 Golden Journey，不再是塔海自由镜头。

完成门槛：关闭文字标签后，仍能从交通换乘看出“编译端 → 静态产物 → Viewer”的
主结构。

### 8.5 Phase 3 — 建筑内部

- [ ] 扩展 analyzer 的 export / symbol summary；
- [ ] 为一个真实组件构建 wing、floor、room、entrance、loading dock；
- [ ] 行人进入建筑并在至少两个真实节点间移动；
- [ ] 实现 cutaway、局部隔离和房间 picking；
- [ ] 证据卡链接 path / symbol / relation；
- [ ] 无可靠 call fact 时自动降级而非虚构。

完成门槛：用户可以从宏观车辆一路跟随到源码 symbol，再回到跨组件交通。

### 8.6 Phase 4 — Git 与解释闭环

- [ ] Git commit 触发对应建筑的施工队；
- [ ] Flow playback 和 Git replay 使用独立时钟与模式；
- [ ] Change Impact 显示直接调用方、相关测试和修改实体；
- [ ] Evidence HUD 完成筛选和图例；
- [ ] 补齐视觉回归、E2E、性能与可访问性检查。

完成门槛：用户不会把施工流误认成运行流，且任意活动都能打开证据。

### 8.7 后续 rollout

1. 从静态 call graph 自动生成更多 Scenario Simulation；
2. 接入 test trace，增加检验人员和测试线路；
3. 接入 OpenTelemetry，增加真实流量、延迟和错误 lens；
4. 根据真实异步设施增加 queue、broker、港区和水运；
5. 支持 architecture config、边界违规和“设计 vs 实际”对比；
6. 扩展到大型仓库的 L0–L3 语义缩放；
7. 增加 PR、ownership、co-change 和 release 运营视图。

每个阶段应独立 PR，通过当前阶段硬验收后再增加新的交通类型。

## 9. 性能策略

> 完整 V3 预算，当前 prototype 尚未测量或达到该 Gate。当前 Flow agent 使用独立
> React/Three group，并非下述最终实例化架构。

Balanced desktop 预算：

| 指标 | 垂直切片预算 |
|---|---:|
| 目标帧率 | 55–60 FPS，集显不低于 30 FPS |
| 模拟 tick | 固定 20 Hz |
| 模拟 reducer p95 | ≤ 2 ms / tick |
| agent 插值与矩阵更新 | ≤ 2 ms / frame |
| 主场景 draw calls | ≤ 140 |
| 含效果 draw calls | ≤ 240 |
| 可见动态 agent | ≤ 220 |
| principal agents | 1–8，独立高细节 |
| 单场景事件 | 默认 ≤ 10,000 |
| 首屏压缩新增资产 | ≤ 8 MB |

实现规则：

- 每类 agent 使用 `InstancedMesh` 或 `BatchedMesh`；
- 路线编译一次，位置用弧长查表和插值；
- 离散事件使用按时间排序的 queue，不遍历所有可能 agent；
- agent 到达后进入对象池，不销毁/重建 React component；
- 远景把大量 agent 聚合为光流、车厢或 cohort；
- 近景才展开单车、行人、payload 和房间；
- 只对主角和少量关键 agent 使用独立 Mesh、标签和阴影；
- 不引入刚体物理、逐车换道、全局碰撞或每帧 A*；
- 高频状态不写入 Zustand/React；
- 切换项目和场景时显式 dispose GPU 资源；
- DPR、阴影、agent 数和 cutaway 细节进入质量档。

降级顺序：

1. DPR、AO、bloom、水面反射；
2. ambient agents；
3. 次要 cohort 数量；
4. 非主角 agent LOD；
5. 阴影；
6. 最后才减少主角旅程的必要节点。

性能降级不能删除路线方向、证据标记和主要换乘，否则虽然帧率合格但产品失效。

## 10. 可访问性与可控性

> 完整 V3 Gate。当前 prototype 已支持按钮、Space、方向键、Esc 退出跟随，并在
> `prefers-reduced-motion` 下默认停止 JS 自动步进、agent 时钟和镜头跟随；仍没有
> Journey 速度、reset、两档舒适相机或完整屏幕阅读器 itinerary。

- `prefers-reduced-motion` 默认停止自动镜头，使用“下一步”按钮逐事件前进；
- 提供 `暂停`、`上一步`、`下一步`、`重新开始` 和速度控制；
- 跟随相机提供 `电影` 与 `舒适` 两档，舒适档不急转、不晃动、不自动俯冲；
- `Esc` 随时退出跟随或 cutaway；
- 键盘可以遍历场景、agent、节点和证据卡；
- 每个场景生成同步文本 itinerary，屏幕阅读器无需读取 Canvas 才能理解路径；
- agent 类型同时使用轮廓、图标、路线纹理和文字，不只使用颜色；
- simulated / inferred / observed 使用不同线型和徽标；
- 错误、等待和完成不只靠闪烁表达；
- 提供高对比主题和标签密度控制；
- 用户可关闭环境交通、动态灯光、天气和相机跟随；
- 选择一个动态对象后，即使暂停也能完整查看其来源、目的地和证据。

## 11. 验收

### 11.1 当前 Flow Journey prototype Gate

以下条目已经过当前实现的代码级核对；最终 lint、typecheck、unit、build 和浏览器检查
结果必须在交付 handoff 中单独报告，不能由本文替代。

- [x] Journey planner 是纯计算，对 entity / relation 输入排序不敏感；
- [x] RepoCity heuristic journey 标为 `simulated`，普通 import journey 标为
  `inferred`，界面没有把它们称为 observed runtime；
- [x] 每个 materialized step / leg 具有 evidence ID，leg 具有 reason；已知 import
  关系保留 relation ID；
- [x] Viewer 可在 `流动 / 探索 / 回放` 三个模式间切换；
- [x] Journey 支持播放、暂停、前一站、后一站、站点选择和按站聚焦；
- [x] active leg 能显示不同轮廓的 pedestrian、car、transit、freight 和条件性
  boat cohort；
- [x] car、freight 与 transit cohort 走确定性的 ground / bridge 最短路；道路不连通
  时 planner 拒绝该 Journey 并记录诊断，不在画面中伪造穿楼车流；
- [x] Journey 只使用 HEAD 仍可见的 entity 与 relation，已删除历史文件不会重新
  出现在当前数据旅程；
- [x] relation weight 映射为有上限的 cohort 数和路线强调度，HUD 同时明确标为
  “模拟密度”；
- [x] 渲染器直接消费 planner 的 token、方向、速度、delay、路径和 evidence ID；
  统一 token 时钟在暂停时冻结，不会跳位；
- [x] Golden static Bundle leg 仅在已有河流时使用带道路 feeder 的语义货船；无河
  城市自动降级为陆路货运；car cohort 至少包含 request 与 response 各一辆；
- [x] Journey 的 8 个 anchor 由 8 类功能设施替换，不再把主路线站点继续显示为
  同形文件塔；
- [x] X-ray 使用真实 export 名称；无 export 时明确降级，不生成虚构函数房间；
- [x] 路线可点击打开 evidence card，显示 provenance、证据标签、置信度和 reason；
- [x] `prefers-reduced-motion` 默认暂停自动步进和跟随；Esc 可退出跟随；
- [x] 跟随相机按当前 active route 的包围盒构图，而不是只追逐单个文件塔；
- [x] Journey 模式关闭原有 ambient cars / pedestrians / boats，避免两类流动混淆；
- [x] 当前站选择会落到真实 entity，并复用 Inspector 的文件路径、关系和源码入口；
- [x] flow planner 单测覆盖 curated journey、连接性、输入重排、悬空关系和 transport
  override；
- [x] server-render shell 测试覆盖流动入口、模拟标签和 Journey 控件。

当前 prototype Gate **不包含**：

- 离散 `FlowEvent` reducer、真实 queue/join/return、principal continuity；
- `0.3` bundle schema 与 CLI 产物；
- component 级 L0 城市与 Static Artifact River；
- function/room/call cutaway；
- 可 picking 的单个 agent EvidenceRef（route 已可 picking）；
- observed/test/git flow；
- 第 9 节性能数字、完整屏幕阅读器 itinerary 或持久视觉回归基线。

通过本节只允许称为 `Flow Journey vertical prototype`；不得称为完整 V3。

### 11.2 完整 V3：信息与诚实性

- [ ] 画面中 100% 的语义 agent 拥有 `EvidenceRef`；
- [ ] 没有 trace 时 UI 从不出现“真实流量、真实延迟”等措辞；
- [ ] 用户可在两次点击内从任意主路线回到源码、relation、test 或 commit；
- [ ] `Ambient` 与 `Data Flow` 可以独立关闭；
- [ ] 静态 import、模拟请求、Git 施工和测试流的视觉语言互不混淆；
- [ ] 每个河流、桥、高架、港口和铁路都能回答“为什么存在”；
- [ ] 没有可靠内部事实时 Cutaway 明确降级，不生成虚构函数房间。

### 11.3 完整 V3：Golden Journey

- [ ] 路线按第 6.3 节顺序覆盖 CLI、`buildProject`、git analyzer（内部 code
  analyzer）、city compiler、replay engine、schema validation、static writer、
  Viewer loader、living-city、viewer replay 和 CityScene；
- [ ] 至少发生一次 transport 换乘；
- [ ] 至少发生一次 fan-out、join 和 queue；
- [ ] 至少一段建筑内部行人路线可跟随；
- [ ] 至少一辆请求车具有可见返回旅程；
- [ ] Static Artifact River 上只有静态产物交通，不存在虚构的浏览器 → Git 直连；
- [ ] 用户在 45 秒内可以讲出“源码如何变成 Viewer 城市”的主流程；
- [ ] 任一步骤暂停后能说明输入、处理、输出和证据。

### 11.4 完整 V3：城市与视觉

- [ ] L0 只展示 5–30 个宏观组件，不是数百根文件柱；
- [ ] 至少五种宏观轮廓：校园、工厂/厂房、车站、港区、控制中心等；
- [ ] 建筑立面层数与内部结构一致；
- [ ] 交通不穿楼、不穿无通道水面、不悬空结束；
- [ ] request 与 return 方向可辨；
- [ ] 主角在城市总览、道路、港口和建筑内部之间连续换乘；
- [ ] 同一仓库、同一 seed 和同一事实保持稳定地址与路线；
- [ ] 关闭标签后，仍可从边界和交通读出编译端与 Viewer 端。

### 11.5 完整 V3：工程与性能

- [ ] schema 所有交叉引用经过 strict validation；
- [ ] 模拟事件在输入重排后仍保持确定性；
- [ ] seek 到任意时间与顺序应用事件结果一致；
- [ ] join 不提前释放，queue 不出现负长度，agent 不同时位于两个节点；
- [ ] typecheck、lint、unit、integration、production build 全部通过；
- [ ] 浏览器冒烟覆盖播放、暂停、单步、跟随、cutaway、证据卡；
- [ ] Balanced 档达到第 9 节预算；
- [ ] reduced-motion 和键盘路径通过人工检查；
- [ ] 项目或场景切换后没有旧 agent、旧 route 或 GPU 资源残留。

### 11.6 完整 V3：“恍然大悟”测试

让未参与开发的用户完成以下任务并记录时间：

1. 找出代码分析发生在哪里；
2. 解释 CLI 与 Viewer 为什么被河流隔开；
3. 跟随一个 source entity 到最终渲染；
4. 指出一次 fan-out 和结果重新汇合的位置；
5. 进入分析器建筑，找到实际处理该数据的文件或 symbol；
6. 判断当前路线是模拟还是真实运行；
7. 从一次 commit 找到受影响建筑。

通过标准：

- 至少 5/7 项无需开发者口头提示即可完成；
- 用户能说出至少一个仅通过城市获得的新理解；
- 用户不能把模拟密度误解为生产 QPS；
- 相比目录树 + 当前 Inspector，核心旅程任务更快或解释更完整。

## 12. 非目标

V3 垂直切片不做：

- 城市经济、税收、人口、住房、就业和市政经营；
- 持久居民、家庭、日程和个人生命周期；
- 玩家自由修路、分区或放置设施；
- 车辆刚体物理、真实驾驶、逐车道换道和事故模拟；
- 为了像游戏而添加没有软件语义的医院、警察、垃圾、机场或灾难；
- 把 LOC、复杂度和质量永久编码成高楼高度或颜色；
- 默认显示所有 import 关系；
- 全仓库 function-level 精确控制流；
- 没有采集依据的性能预测；
- 复刻《模拟城市》或《城市：天际线》的 UI、资产和玩法；
- 同时重写整个 analyzer、Viewer、Git replay 和渲染引擎。

视觉魅力是硬要求，但每项新增美术首先服务于尺度、边界、流动或因果。不能解释
软件的效果只能进入可关闭的 Ambient 层。

## 13. V3 垂直切片完成定义

> 这是完整 V3 的发布定义，不是当前 prototype 的完成声明。当前交付仅达到
> 第 11.1 节；下列条件仍为 Planned。

V3 首个切片只有在以下结果同时成立时才算完成：

1. 第一眼是一座有层次、有目的交通的城市，而不是带窗户的柱状图；
2. 用户可以跟随一个真实 RepoCity 数据单元跨越组件、建筑内部和静态产物边界；
3. 人、车、火车和船都承担清晰且不同的软件语义；
4. fan-out、join、queue 和返回路径通过运动即可读懂；
5. 建筑内部来自真实文件或 symbol，而非装饰楼层；
6. 所有语义活动都有证据、等级和解释；
7. 模拟足够生动，但不会冒充生产事实；
8. Git 施工与数据流彼此独立又能关联；
9. 切片满足确定性、性能、可访问性和测试预算；
10. 该模式能推广到其他仓库，而不是只为演示截图硬编码。

本切片通过后，再扩充整座城市、更多场景和真实运行 trace。未通过前，不以增加更多
楼型、车辆数量、天气、港口或装饰替代核心解释能力。
