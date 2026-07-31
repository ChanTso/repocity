# RepoCity V4 — Semantic Metropolis / 语义都会

> 文档类型：完整 V4 目标规格 + 分阶段实施与验收合同
> 当前代码基线：V4 Semantic Metropolis foundation slice
> 本轮允许交付：**P0/P1 Semantic Foundation + Urban Fabric**
> 完整 V4 状态：**Planned，未交付**
> 历史文档：`repocity-spec.md`、`docs/V2_CITY_SIMULATION_SPEC.md`、
> `docs/V3_FLOW_CITY_SPEC.md`

## 0. 交付声明

P0 的目标不是宣称“已经做成《城市：天际线》”，而是停止继续在错误的文件柱体
底座上叠加装饰，并建立后续可以产生真正城市形态的语义、数据和渲染边界。

完成 P0 后，只允许使用以下描述：

> RepoCity 已建立 Semantic Metropolis 的组件聚合、真实 Golden Journey、语义边界
> 和多尺度场景基础。

在第 12 节完整 V4 Gate 全部通过前，禁止使用以下描述：

- “已达到《城市：天际线》或《模拟城市》的城市效果”；
- “完整城市模拟器”；
- “真实运行流量”，除非相应路线具有 `observed` trace；
- “真实建筑内部”，除非楼层、房间和移动节点来自可回溯的 symbol/function 事实；
- “完整 V4”或“V4 vertical slice”。

### 0.1 P0 本轮范围

P0 只负责打地基：

1. 建立 `repository → component → module/file → symbol/function` 的四级聚合身份；
2. 用仓库真实代码顺序重建 Golden Journey，删除当前为了八站导览而产生的错误顺序；
3. 建立所有地理、设施、道路和交通工具的 typed reason 与 `EvidenceRef`；
4. 为 Flow 模式建立独立的 component-scale 场景输入，不再把 V2 文件塔海当城市底座；
5. 建立确定、可测试、输入重排后稳定的 `SemanticMetropolisPlan`；
6. 提供 P0 白模或骨架视图时，必须诚实标记为 foundation，不以材质、灯光或少量
   车辆掩盖未完成的 P1–P5。

P0 不承诺完成道路车道、港口换乘动画、完整建筑套件、function-room cutaway、
全量 agent 模拟或最终电影级灯光。这些分别属于 P1–P5。

### 0.2 本轮实现状态（2026-07-31）

本轮交付是 **P0/P1 之间的可运行 foundation slice**，不是完整 P0，更不是完整 V4。
已实现：

- `SemanticCityPlan 0.4` 内部草案：HEAD 实体聚合为 5–20 个 component campuses，
  hard ceiling 为 30，ID 带 repository scope，输入重排后确定；
- 六类职责外形：civic、factory、laboratory、library、operations、port；Flow
  远景不再渲染 244 个 file towers；
- 显式 `ProjectBoundaryFact`：没有 typed water boundary 就没有水、港口或船；
  文件名、import 数量和旧 V2 河流都无权生成水运；
- 静态 import 只建立 structural corridor/road，不生成任何移动 agent，也不使用
  import weight 冒充车流；
- 显式 Journey token 才投影 mobility route；陆路可在已有 structural corridors
  上确定性多跳寻路，水路必须匹配 exact boundary、双 quay 和 terrain declaration；
- Golden Journey 已改为
  `prepare → git/code → compile → replay → producer schema → write → load/validate
  → living city → scene`；
- 六个 component campuses 已压缩成约 `51 × 48` 的连续滨水中心，不再分散复用旧
  district anchors；每个 component 以 5–10 个聚合翼楼、一个职责地标、院落、入口、
  屋顶设备和立面层次组成，明确禁止退回“一文件一栋楼”；
- 建筑高度来自 component breadth、public/external reach 与 architecture role 的归一化
  组合，并量化为至少五级城市天际线；LOC 不再直接决定高度；
- local / collector / arterial 三层道路已连入 14 条 shared macro carriers，并为每个
  component 提供零权重、无伪 relation 的 access corridor；人行道、绿带、码头岸壁、
  typed water 与树列共同形成连续城市街廓；
- Golden Journey 的 9 个 leg 已全部投影为 9 条合法 semantic routes：同 component
  使用园区步行环，跨 component 使用 feeder + shared carrier + transfer，多段水运只
  能通过 exact typed boundary 与两侧 quay；
- 人、车、货车与船只由当前 Journey leg 的显式 token 唯一生成，数量严格等于
  token 数，不再用 relation weight、log 放大或第二套 ambient renderer 伪造流量；
- 同一时刻只为 active step 展开一个职责地标/剖面，其他九站保留编号 beacon，
  避免为了展示十个特殊模型而掏空整座城市；缺少 symbol/function 事实时，剖面会
  明示“内部事实不可用”，不伪造房间或人员；
- 组件园区、组合建筑、道路、人行道、绿带、typed water 与 instanced scenario agents
  已接入 Flow mode；现有 Explore/Replay 保持原行为。

仍未完成，因此本轮不能勾选完整 P0：

- repository/component/module/file/symbol 的统一树、cross-reference validator 和完整
  evidence registry；
- 基于 workspace/package manifest 与 cohesion 的通用 component identity；当前聚合仍
  含 RepoCity fixture 的 district/path 先验；
- 完整 junction/lane/transfer event graph、港口陆水换乘、request/response correlation；
- 真实 symbol/function rooms 与跨 L0–L3 不重排的 semantic zoom；
- 大仓库 fixture、正式视觉回归、可理解性用户测试与第 12 节完整 Gate。

## 1. 核心反思：为什么当前仍然是“土地格子 + 柱体”

当前体验比 V2 多了路线、设施、船、车和证据，但这些改动主要是覆盖层。决定第一印象
的城市生成语法仍然没有变化：

- `app/lib/living-city.ts` 仍按 District 数量生成规则行列；
- 每个 District 仍按固定 `BLOCK_PITCH` 生成全覆盖的正交网格；
- 每个 development block 仍固定拆成四块 parcel；
- 每个 entity/file 仍生成一栋 `building-${entity.id}`；
- 建筑宽、深、楼层仍主要由 LOC、fan-in 阈值和稳定随机量决定；
- `entities.length >= 80` 就产生河流，`entities.length >= 180` 就产生高架；
- 每个 District 仍有一条无语义的外框汽车循环；
- Flow Journey 只压低背景楼并替换少数当前路线设施，244 个文件格子的空间节奏
  仍然控制整张画面。

因此目前的视觉阅读顺序是：

```text
规则棋盘
  → 重复黑盒楼
    → UI 和橙色路线
      → 很小的特殊设施、车或人
```

而一个有说服力的城市应当是：

```text
地形 / 海岸 / 天际线
  → 主中心、次中心和功能片区
    → 干道、支路、铁路、水路与节点
      → 街区组团和不同建筑类型
        → 车辆、人流、装卸和内部活动
          → 按需打开的数据证据
```

这不是“再多做几种柱体”可以解决的问题。必须把最底层的布局单位从 file parcel
改成 component ensemble，把道路从视觉分隔线改成城市骨架，把文件从远景建筑
改成近景翼楼或内部单元。

## 2. 三张参考图的层级拆解

三张图分别对应近景街道、街区交通和大都会全景。它们共同说明城市感不是靠单个
高精度模型，而是低频、中频和高频信息同时成立。

### 2.1 参考图一：街道与建筑近景

画面包含体育馆、办公楼、排屋、街口、车辆、行人和夜景。

| 可见层次 | 为什么像城市 | RepoCity 对应决策 |
|---|---|---|
| 大体量组合 | 体育馆不是一根柱体，而是裙房、开放层、屋顶平台、广告面、柱廊组成的综合体 | component 必须优先成为多翼 ensemble；禁止默认单盒 |
| 街道界面 | 建筑入口、店面、台阶、退线、停车和人行道都面向道路 | public API 必须有可达入口；装卸口必须接到正确 carrier |
| 连续街墙与断点 | 排屋形成连续界面，广场和院落形成有意义的空隙 | 文件可以成为连续翼楼；open space 不是每区固定复制的公园 |
| 多密度并置 | 高楼、中层办公、低层排屋和大型场馆同框 | 同一 component 内也需要主楼、翼楼、附属设施和院落层级 |
| 尺度参照 | 人、车、路灯、树和栏杆让建筑大小可信 | 数据 agent 必须足够可见；scenic props 提供尺度但不冒充代码事实 |
| 夜间光层次 | 天空和环境为冷色，窗、路灯、入口为暖色；远处通过雾和遮挡退后 | 默认照明需要环境光、方向光、局部 emissive 和 atmospheric depth |
| 活动有目的地 | 汽车沿车道，行人在入口和人行道，活动与建筑功能相连 | 禁止随机绕圈；agent 必须具有 origin、destination、carrier 和 reason |

关键结论：建筑外观的城市感主要来自**组合关系和街道关系**，不是窗户数量。

### 2.2 参考图二：街区、道路与立体交通

画面包含高密度中心、高架快速路、匝道、普通道路、环岛、水体和绿化。

| 可见层次 | 为什么像城市 | RepoCity 对应决策 |
|---|---|---|
| 道路有等级 | 高速、匝道、主干路和支路宽度、曲率、标线、速度感明显不同 | local / collector / arterial / rail / water 必须是不同 graph 和视觉语法 |
| 路网响应环境 | 道路绕水体和绿地，跨越处才使用桥或高架 | 先确定 semantic boundary，再铺设 carrier；禁止道路穿越未授权边界 |
| 立体关系 | 高架跨越地面道路，匝道完成真实上下连接 | 高架必须有起终点、净空、坡道和 typed reason，不能悬空装饰 |
| 密度梯度 | 枢纽附近高密，水边和边缘较低；不是全图同一层级 | urban intensity 来自 component breadth、public reach 和场景中心性 |
| 负空间 | 树冠、水面、坡地和道路留白让组团可辨 | L0 需要 30%–50% 地形/水/绿化/院落负空间 |
| 朝向和 frontage | 建筑沿道路与路口组织，而不是先铺格子再塞楼 | 道路必须先于 parcel/ensemble；所有主入口必须接 frontage |
| 交通给出尺度和状态 | 小车在不同道路上形成密度差，读者可立即看到主路 | L0 用流量聚合，L1 用 cohort，L2 才显示单 agent |

关键结论：道路不是城市之间的黑色缝隙，而是**决定形态、可达性和活动强度的骨架**。

### 2.3 参考图三：都会、海岸与整体身份

画面包含海湾、半岛、CBD、低层社区、桥、港口、码头、高速和外部连接。

| 可见层次 | 为什么像城市 | RepoCity 对应决策 |
|---|---|---|
| 地理先于建筑 | 海岸、半岛和水域先定义城市轮廓，建筑填充其后的可用空间 | runtime/trust/artifact boundary 必须先进入 planner，不能最后叠河 |
| 多中心 | 高楼中心、港区、低层居住片区和交通节点各有重心 | repository 可以是多中心 metropolis；deployable/component 是中心而非 file |
| 天际线层级 | 少数高点、若干中层组团、大量低层肌理形成分布 | 使用 few-large / some-medium / many-small，不得全图等权柱体 |
| 外部联系 | 大桥、航道、码头和高速明确连接城市外部 | CLI 输入、static artifact、external API 必须有 outside connection |
| 海岸设施适地 | 港口贴水、道路与堆场接驳、桥落在狭窄跨越处 | 港口必须同时满足水路、陆路 feeder 和 boundary reason |
| 大片负空间 | 海面和绿地让轮廓、中心和通道可读 | 不能让建筑填满地图；空白本身是构图和边界信息 |
| 关闭标签仍可读 | 不依赖常驻文字也能找到 CBD、海港、桥和片区 | RepoCity 关闭 HUD 后仍必须从形态读出 build-side 与 viewer-side |

关键结论：城市身份首先来自**地理、中心和网络的低频轮廓**，不是模型数量。

### 2.4 三种视觉频率

| 频率 | 城市内容 | 当前状态 | V4 决策 |
|---|---|---|---|
| 低频 | 地形、水域、天际线、中心/边缘、主交通廊道 | 规则长方板、直河、均匀楼海 | P1 重建 semantic geography 与 density field |
| 中频 | 街区、裙房、翼楼、院落、树冠、港区、站场、路口 | 大量重复 parcel 和单盒楼，几乎缺失 | P1/P2 建立 ensemble 与 road frontage |
| 高频 | 窗、灯、车、人、标线、栏杆、屋顶设备 | 有少量窗格和 props，但无法修正轮廓 | P4 才精修，不能先于低频和中频 |

最重要的制作纪律：

> 禁止用高频细节掩盖低频和中频结构仍然错误。

## 3. V4 的统一视觉语法

V4 只保留一套可以推理的语法：

| 视觉层 | 表达内容 | 不表达 |
|---|---|---|
| 空间包含与地理 | ownership、bounded context、runtime/trust/artifact boundary | 代码质量、团队价值 |
| 建筑和设施 | 静态结构、职责、public surface、storage/pipeline role | 实时调用次数 |
| 道路、轨道和水路 | 允许或被场景使用的 carrier corridor、协议和边界跨越方式 | 任意单条 import 的精确曲线 |
| 移动 agent | observed/test/simulated 的工作单元、payload、请求、返回和变更 | 没有 provenance 的随机“真实流量” |
| 颜色、线型和光效 | provenance、当前状态、选中和异常 | 对代码好坏的隐性评分 |

### 3.1 三类场景对象合同

每个对象必须属于以下一种类型：

1. **Data-bearing**
   - 映射具体代码、关系、事件、trace、test 或 commit；
   - 必须有稳定 ID 和 `EvidenceRef`；
   - 可以被选择并解释“为什么存在”。
2. **Navigation-bearing**
   - 为相机、寻路、车道、步道、入口和换乘提供物理连续性；
   - 可以由 planner 生成，但不能被文案声称为一条真实代码关系；
   - 与 Data-bearing corridor 必须有清楚的视觉差异或 Inspector 说明。
3. **Atmosphere-bearing**
   - 树、路灯、栏杆、非数据窗光、云、雾等纯场景内容；
   - 默认不可选，不计入任何数据指标；
   - 独立图层可关闭，不得遮挡主流程。

对象如果无法归类，就不应进入场景。

## 4. 四级语义缩放

同一对象跨尺度保持稳定身份和地址，只改变聚合表达。缩放不得触发重新布局。

| 级别 | 典型镜头 | 主要对象 | 移动表达 | 数量预算 |
|---|---|---|---|---|
| L0 Metropolis | 全城/都会 | repo、5–30 个 component/deployable 组团、硬边界、主廊道、外部联系 | 聚合流量、列车、船、主角 agent | 5–30 个主 ensemble |
| L1 District | 城区/街区 | package、module cluster、公共接口建筑、站点、港区、collectors | agent cohort、站点队列、方向 | 20–100 个可辨体块 |
| L2 Building | 单个设施外部 | file wings、入口、装卸口、院落、局部道路和步道 | 单车、行人、装卸与换乘 | 当前 component 内相关 files |
| L3 Cutaway | 建筑内部 | export/class floors、function rooms、corridor、queue、shared core | 单 work item、内部调用、返回 | 同时最多一个完整 cutaway |

### 4.1 聚合规则

- L0 绝不默认显示一文件一建筑；
- component/package 先成为 ensemble，文件在 L1/L2 才展开成翼楼、单元或房间；
- 只有满足明确语义规则的文件可以在 L1 独栋：
  - public entry point；
  - orchestrator/dispatcher；
  - schema/auth boundary；
  - storage/artifact writer/loader；
  - 有证据的高影响 hub；
- 单纯 LOC 大、fan-in 大或文件名特殊，不能独自触发 landmark；
- L3 没有 function call 事实时降级为 export/class/file room，并明确标为 inferred；
- LOD 切换使用 projected screen size + hysteresis，防止边界抖动；
- 地址、入口、边界、路线端点在所有 LOD 中保持一致。

### 4.2 体量而不是柱高

代码规模可以辅助“总结构体量”，但不得只映射为高度：

- footprint：component 拥有的 file/module breadth，经过 `log1p` 与上下限；
- wings：内部真实 module/file group；
- entrances：public API / command / handler group；
- loading bays：artifact、storage 或 bulk input/output；
- height tier：该 archetype 内的 structural reach，可由 public reach、scenario
  centrality 和 semantic depth 组成，并在 Inspector 解释；
- floors：只有在 L3 才等于真实 export/class/function grouping；
- facade、roof 和 props：由稳定主题与 archetype 选择，不是数据指标。

相同“总量”的组件也必须因职责不同呈现不同平面组织。

## 5. 软件到城市的严格映射

### 5.1 空间、建筑和节点

| 软件事实 | 城市映射 | 约束 |
|---|---|---|
| repository / monorepo | metropolitan region | 一个稳定 seed 和 outside boundary |
| deployable / runtime | city center、岸区或岛区 | 只有真实进程/部署边界才使用硬地理 |
| bounded context / workspace | district | 必须来自 manifest、配置或可解释聚类 |
| component / high-cohesion package | block、campus、facility ensemble | L0/L1 默认最小主建筑单位 |
| module/file group | wing、row、shed、podium section | L1/L2 展开 |
| individual file | wing/unit/room；少数语义文件可独栋 | 禁止默认 skyscraper |
| public export/API/command/route | main entrance、lobby、frontage | 必须面向可达 corridor |
| private/internal implementation | rear wing、restricted room | 不拥有虚构公共入口 |
| dispatcher/orchestrator | interchange hall、dispatch center | 只有真实 fan-out/join 才成为 node |
| schema/auth/contract check | inspection hall/customs gate | 显示 pass/reject 路径 |
| cache/database/artifact store | warehouse/storage campus | 读写入口分开 |
| docs/ADR | archive/library | 不把所有 Markdown 都建成公共地标 |
| test/validation | laboratory/inspection facility | 贴近被测 component 或测试 corridor |
| observable external endpoint | outside connection/terminal | 外部边缘方向必须稳定 |

### 5.2 建筑 archetype

P1 至少提供以下宏观形态，不允许退化成换颜色的 box：

| Archetype | 适用语义 | 必须具备的形态语法 |
|---|---|---|
| Gateway / Terminal | CLI、route、external entry | 门廊、候车/装卸前场、清楚的入口轴 |
| Analysis Works | parser、analyzer、transformer | 多跨厂房、处理翼、service yard、进出料口 |
| Civic Planning Complex | compiler、planner、orchestrator | 主楼 + 裙房 + 公共广场/调度大厅 |
| Rail / Replay Yard | ordered build/test/history pipeline | 轨道、站台、编组区、stage buildings |
| Inspection Facility | schema、auth、contract | 排队前场、检查门、通过/拒绝出口 |
| Logistics / Port | writer、loader、artifact/queue | 仓库、堆场、吊机/装卸口、陆水 feeder |
| Operations Center | viewer、runtime state、observability | 控制大厅、多个数据入口、面向最终城市 |
| Laboratory Campus | tests、validation、coverage | 低层实验楼、测试场、隔离区 |

### 5.3 道路、轨道和边界

| 城市对象 | 软件意义 | 生成条件 |
|---|---|---|
| pedestrian path | 同 component 内的局部 work item 路线 | L2/L3 可解析或场景明确 |
| local street | component 内部 carrier / navigation access | 不自动声称具体 import |
| collector | package 公共接口聚合走廊 | 多个 local 汇入同一 public boundary |
| arterial | 多场景共享的跨 component corridor | 具有多个独立 scenario 或明确 component reach |
| one-way lanes | 单向 request/event/artifact 方向 | direction evidence 明确 |
| return lane | 同步 response 或结果返回 | 与 request correlation 对应 |
| railway | ordered build/test/history pipeline | stage 顺序真实且稳定 |
| high-level bridge | 允许的同步 boundary crossing | 有接口/adaptor、落点和连接坡道 |
| river/strait | process、runtime、trust、static-artifact 硬边界 | 必须有 typed boundary evidence |
| harbor | serialization、queue、artifact transfer | 同时存在 land feeder、water route、receiver |
| warehouse | cache/database/artifact storage | read/write 行为或结构证据 |
| outside highway/terminal | external input/output | 外部连接有可追溯 endpoint |

道路 class 与交通量分开：

- road class 来自接口层级、跨域范围和场景共享程度；
- occupancy/vehicle count 只来自 `observed`、`test` 或明确标记的 `simulated`；
- import 数量只能说明静态可达性，不能冒充 QPS、延迟或拥堵；
- 多条 relation 应聚合进入 corridor，在选中时再展开；不能永久画一 edge 一条光带。

### 5.4 道路先行的生成顺序

```text
Architecture facts
  → component / boundary graph
    → stable district anchors
      → required public entrances and transfer nodes
        → typed carrier corridors
          → road/rail/water topology and junctions
            → frontage and blocks
              → facility ensembles and wings
                → atmosphere layer
```

禁止先把文件塞进格子，再沿格子边缘补道路。

道路 skeleton 的建议算法：

1. 用 ownership 与真实 architecture boundary 固定 district；
2. 用 cohesion 将同 component 的模块收拢，但不让 coupling 改变稳定地址；
3. 将 Golden Journey、public API 和跨 component 关系作为 required corridor；
4. 使用确定性 planar skeleton、junction 和 corridor bundling 减少交叉；
5. 依据跨区范围和 shared scenario betweenness 提升 collector/arterial；
6. 在硬边界处只保留合法 bridge、port、terminal；
7. 从道路 frontage 派生 block 与 ensemble；
8. 最后添加可关闭的 scenic service lanes 与 props。

### 5.5 Agent 与城市生命

| Agent | 软件意义 | 可见行为 |
|---|---|---|
| pedestrian/work item | component 内 invocation、task、function handoff | 入门、排队、走廊、房间、返回 |
| request car | 跨 component 同步请求 | 去程携带 request/correlation ID |
| response car | 同一同步调用的结果 | 相反方向返回，保留 correlation ID |
| truck | source tree、AST、bundle、bulk read/write | 装货、驶入 yard、卸货 |
| train | ordered history/build/test pipeline | 车厢逐 stage 加工，站台等待 |
| cargo ship | static artifact、queue、batch 跨硬边界 | 港口装箱、航道、卸货、陆路 feeder |
| drone/signal | webhook、telemetry、external notification | 单向、低 payload、明确外部连接 |
| construction crew | Git commit/diff | 只在 Git lens 操作受影响对象 |
| inspector | test/schema/validation | 进入真实检查点并显示结果 |

语义 agent 必须拥有：

```ts
interface SemanticAgent {
  id: string;
  correlationId: string;
  payloadType: string;
  provenance: "observed" | "test" | "git" | "inferred" | "simulated";
  sourceNodeId: string;
  targetNodeId: string;
  carrierRouteId: string;
  currentStageId: string;
  evidenceIds: string[];
}
```

完整 V4 的“活”必须来自：

- 可见 origin 和 destination；
- lane/track/water 上的物理连续路线；
- 停车、入门、装卸、排队和换乘；
- fan-out、join、backpressure、request/response 等可读现象；
- L0 流量聚合、L1 cohort、L2/L3 单 agent 的连续身份；
- 选择 agent 后可解释 payload、from/to、route reason 和 provenance。

纯氛围车辆和行人必须放在 `Ambient` 图层，不得混入 Data Flow 计数。

## 6. Golden Journey：真实 RepoCity 顺序

当前八站导览把 code analyzer 与 git analyzer 拆成并列阶段，把 schema 放到 replay
之前，省略 `buildProject`、`city-compiler`、static writer 和真实 Viewer loader。
即使标记为 simulated，它仍会教授错误的系统结构。V4 必须以仓库当前代码为准。

### 6.1 源码顺序

1. `apps/cli/src/cli.ts` 解析仓库地址和参数，调用
   `apps/cli/src/bundle.ts` 的 `buildProject`；
2. `buildProject` 通过 `prepareRepository` 准备本地仓库或临时 clone；
3. `buildProject` 调用 `packages/git-analyzer` 的
   `analyzeGitRepository`；
4. `git-analyzer` 在分析变化内容时内部调用 `packages/code-analyzer`；
5. analysis 返回后，`packages/city-compiler` 的 `compileCity`
   生成 District、entity 和稳定地址；
6. `packages/replay-engine` 的 `compileReplay` 根据 entity、relation、
   commit 和 delta 生成 chapter、delta 与 keyframe；
7. `bundle.ts` 汇合 city 和 replay，并由 `packages/schema` 的
   `validateRepoCityBundle` 做 producer-side validation；
8. `writeStaticBundle` 原子写出 JSON、NDJSON、Markdown 和 keyframe，
   形成 `project.repocity/`；
9. 浏览器 `app/lib/project-bundle.ts` 加载静态资源，并用同一 schema
   做 consumer-side validation；
10. `RepoCityApp` 将 entity、district、relation 交给
    `app/lib/living-city.ts`；
11. `app/lib/viewer-replay.ts` 恢复 HEAD 或目标 commit；
12. `CityScene` 消费 city plan 和 replay frame，实例化最终城市。

```text
cli.ts
  → bundle.ts / buildProject
    → prepareRepository
    → git-analyzer
      → code-analyzer（内部翼楼，不是并列外部站点）
    → city-compiler
    → replay-engine
    → producer schema validation
    → static bundle writer
      ══ project.repocity/ static artifact boundary ══
        → project-bundle loader + consumer schema validation
          → living-city + viewer-replay
            → CityScene
```

### 6.2 城市映射

| 真实阶段 | 城市表达 | 原因 |
|---|---|---|
| CLI | outside terminal / city gate | 接收外部仓库地址和参数 |
| `buildProject` | dispatch center | 编排后续多个真实阶段 |
| `prepareRepository` | inbound depot | 准备本地 source cargo |
| git-analyzer + 内部 code-analyzer | analysis works campus + processing wing | 是嵌套调用，不是假想并列车站 |
| city-compiler | civic planning complex | 决定 District、entity 和稳定地址 |
| replay-engine | time/replay rail yard | 按 commit 顺序生成 chapter/keyframe |
| producer schema validation | outbound inspection hall | 在 replay 之后检查完整 bundle |
| static writer | packing plant + export harbor | 将多种静态资源装箱输出 |
| `project.repocity/` | named cargo container / artifact shipment | 跨 build runtime 与 browser consumer |
| loader + consumer validation | import harbor + customs | 接收并再次校验静态资源 |
| living-city + viewer-replay | metropolitan operations center | 构造空间 plan 并恢复时间状态 |
| CityScene | 最终城市本体 | 不是又一栋“施工楼” |

### 6.3 Static Artifact Boundary

这是 RepoCity 最适合使用河流/海峡的真实理由：

- 西岸是 Node.js/CLI build-side；
- 东岸是 browser Viewer-side；
- Viewer 不会运行时回调 Git analyzer；
- 二者通过 `project.repocity/` 静态产物交流。

完整 V4 中：

- 没有普通同步公路从 Viewer 直达 Git/analyzer；
- writer 使用 truck/rail feeder 把 bundle 运到出口港；
- cargo ship 携带同一 correlation/container ID 跨水；
- Viewer 港口卸货，loader 通过短途 feeder 进入 operations center；
- producer 和 consumer 两端各有 schema inspection；
- 只有静态 artifact traffic 可以穿越这条水界。

如果未来仓库不存在可证明的 runtime/artifact boundary，planner 必须生成无河版本。

## 7. 明确禁止的映射

以下规则属于 hard failure，不是美术偏好。

### 7.1 结构与质量

- 禁止 `1 file = 1 high-rise`；
- 禁止 `LOC = building height`；
- 禁止 `language = district`；
- 禁止用颜色作为职责的唯一编码；
- 禁止 `churn = fire`、`bug = crime/slum/pollution`、
  `test failure = explosion`；
- 禁止用建筑破败程度评价代码、团队或开发者；
- 禁止随机窗格、屋顶设备或楼层线假装真实内部结构。

### 7.2 关系与流量

- 禁止 `import edge = observed call`；
- 禁止 `relation weight / edge count = QPS`；
- 禁止 `dependency cycle = physical roundabout`；
- 禁止把静态共址暗示成调用顺序；
- 禁止永久显示全量 import 弧线；
- 禁止随机汽车、行人、火车或船进入 Data Flow；
- 禁止 vehicle 穿楼、越过无路水面、悬空结束或无 feeder 传送；
- 禁止静态 artifact 用同步 request car 穿越 runtime hard boundary。

### 7.3 地理与设施

- 禁止按 entity 数量阈值生成河流、高架、桥、港口、铁路或机场；
- 禁止为“城市更丰富”添加没有 typed reason 的设施；
- 禁止水体存在但没有岸区、航道、码头和陆路连接；
- 禁止桥没有真实 boundary crossing、落点或坡道；
- 禁止每区固定复制一个同形公园；
- 禁止用规则矩形板边缘作为城市最终地平线。

### 7.4 证据与叙事

- 禁止模拟数据使用“真实吞吐、真实延迟、生产拥堵”文案；
- 禁止 Golden Journey 为凑固定站数改变实际顺序；
- 禁止把 `code-analyzer` 描述成 CLI 与 `git-analyzer` 并列调用；
- 禁止把 schema inspection 放到 replay 之前；
- 禁止无内部事实时生成看似精确的 function rooms；
- 禁止 commit 时间、simulation 时间与 runtime trace 时间混用。

## 8. 信息可读性与游戏体验

### 8.1 默认城市与 Info Views 分离

正常城市视图必须在关闭 HUD 后仍然成立。数据解释通过 lens 按需打开：

| Lens | 保留 | 弱化 |
|---|---|---|
| Architecture | component、public API、boundary、static dependency corridor | ambient traffic、Git 施工 |
| Flow | 当前 scenario、agents、queue、carrier occupancy | 非路线 wing 与无关标签 |
| Git | commit 施工、rename、创建/删除、co-change | 模拟请求 |
| Test | test route、inspection、coverage、failure point | 无关 traffic |
| Evidence | provenance、confidence、source path、typed reason | scenic props |

颜色不是唯一编码；同时使用 silhouette、icon、line style、label 和 Inspector。

### 8.2 五秒阅读目标

关闭标签时，用户应在五秒内指出：

1. build-side 与 viewer-side；
2. 两者为何被硬边界隔开；
3. 主要入口、分析组团、规划/回放组团和 Viewer 港区；
4. 一条主交通走廊；
5. 当前最活跃的节点。

打开 Flow lens 后，再用五秒指出：

1. 主角 payload 从哪里来、到哪里去；
2. 当前使用哪种 carrier；
3. 是否发生边界跨越或换乘；
4. 当前是 observed、test、inferred 还是 simulated。

### 8.3 镜头语法

V4 使用三种可重复镜头，而不是永远保持同一个高角度沙盘视角：

1. **Establishing shot**
   - 35°–55° 俯视；
   - 同时看见地平线/海岸、三个组团和主廊道；
   - 使用远近雾和阴影建立纵深。
2. **Follow shot**
   - 位于主角 agent 后上方或侧后方；
   - 镜头提前看向下一个 junction/transfer；
   - 在停车、装卸、过桥和入门时平滑切换，不瞬移。
3. **Cutaway shot**
   - 低角度 20°–35°；
   - 建筑外壳切开而不是整体透明柱；
   - 保留入口、街道和内部路线的空间关系。

昼夜切换必须实际改变天空、阴影、街灯、窗光和水面，不只是 HUD 时间文字。

## 9. 分阶段实施

### P0 — Semantic Foundation（本轮唯一允许交付）

目标：纠正数据模型、Golden Journey 和 Flow 场景输入，停止继续建设文件塔海。

- [ ] 定义 `SemanticMetropolisPlan 0.4`；
- [ ] 聚合 repository/component/module/file/symbol 四级身份；
- [ ] 建立 component、boundary、corridor、ensemble、journey 与 evidence schema；
- [ ] Golden Journey 使用第 6.1 节真实顺序；
- [ ] 用测试保证 code-analyzer 是 git-analyzer 内部节点；
- [ ] 用测试保证 schema 在 replay 之后；
- [ ] 用测试保证无 typed boundary 时没有河、桥、港口或船；
- [ ] Flow mode 不再以 file-level `planLivingCity` buildings 作为 L0 背景；
- [ ] L0 输出最多 30 个 semantic ensembles；
- [ ] 同 facts/seed 输入重排后 plan byte-for-byte 稳定；
- [ ] 所有语义对象都具有 reason/evidence 或明确的 navigation/atmosphere 类型；
- [ ] 文案和 README/PR 只称为 P0 foundation。

P0 可使用低多边形白模验证聚合、边界和位置；不需要假装完成 P1–P5 的城市美术。

### P1 — Metropolitan Form

目标：完成决定第一眼是否像城市的低频和中频结构。

- [ ] semantic coastline/terrain/negative space；
- [ ] build-side、planning/replay、viewer-side 三个主区域；
- [ ] few-large / some-medium / many-small 的 skyline distribution；
- [ ] 至少六种真正不同的 facility ensemble；
- [ ] road-first layout 和 frontage；
- [ ] local、collector、arterial 三类道路及真实 junction；
- [ ] 有证据时建立 Static Artifact River、两个港口和 feeder；
- [ ] 地图边缘延伸为 terrain/water/fog，不出现白色板边。

### P2 — Carrier Networks and City Life

目标：让道路、铁路和水路承担数据流动，而不是路线装饰。

- [ ] lane、track、seaway、pedestrian path 是可寻路 graph；
- [ ] request/response 方向和 correlation ID；
- [ ] source truck 与 history train 在真实 join 汇合；
- [ ] schema queue、packing、port transfer、ship、unload；
- [ ] 可见 fan-out、join、queue 和 backpressure；
- [ ] L0 aggregate、L1 cohort、L2 single-agent semantic LOD；
- [ ] pause、step、seek、replay 为确定性 event reducer；
- [ ] 任何车辆不穿楼、不离开 carrier。

### P3 — Building Ensembles and Cutaway

目标：让 component 内部结构可以通过建筑空间理解。

- [ ] Analyzer Works 至少包含 git-analyzer 主楼与 code-analyzer 内部翼楼；
- [ ] public entrance、restricted wing、loading/output bay；
- [ ] 至少三个真实 symbol/function rooms；
- [ ] work item 经过两个以上真实处理节点；
- [ ] 没有 function facts 时自动降级；
- [ ] 外部 agent 与内部 pedestrian 保持同一 correlation ID；
- [ ] 点击 room 在两次操作内回到源码与 evidence。

### P4 — Art Direction, Camera and Info Views

目标：达到参考图的城市完成度和信息分层。

- [ ] podium、wing、courtyard、yard、station、port 的 modular kit；
- [ ] sidewalks、crosswalks、trees、streetlights、barriers、roof equipment；
- [ ] day/night、sky、fog、water reflection、contact shadow、emissive windows；
- [ ] establishing/follow/cutaway 镜头；
- [ ] Architecture/Flow/Git/Test/Evidence lenses；
- [ ] HUD 隐藏后城市仍然可读；
- [ ] Ambient 和 Data Flow 独立开关。

### P5 — Scale, Performance and Generalization

目标：在真实大型仓库上保持稳定和可用。

- [ ] 1k、10k files fixtures 的 component aggregation；
- [ ] bundle schema migration 与 strict validation；
- [ ] WebGL resource lifecycle、project switch 和 long-run soak；
- [ ] performance tiers 和 reduced-motion；
- [ ] visual regression、browser smoke 和 user comprehension tests；
- [ ] 非 RepoCity 仓库缺少某类边界时优雅降级；
- [ ] 完整通过第 12 节才可称为 V4。

## 10. 建议数据合同

```ts
type SceneObjectContract = "data" | "navigation" | "atmosphere";

type MetropolisScale = "L0" | "L1" | "L2" | "L3";

interface SemanticMetropolisPlan {
  version: "0.4";
  seed: string;
  repositoryId: string;
  bounds: MetropolisBounds;
  components: SemanticComponent[];
  districts: SemanticDistrict[];
  boundaries: SemanticBoundary[];
  corridors: CarrierCorridor[];
  ensembles: FacilityEnsemble[];
  journeys: SemanticJourney[];
  evidence: EvidenceRef[];
  lod: LodContract;
}

interface SemanticComponent {
  id: string;
  parentId: string | null;
  kind: "repository" | "deployable" | "component" | "module" | "file" | "symbol";
  path?: string;
  responsibility?: string;
  publicSurfaceIds: string[];
  childIds: string[];
  evidenceIds: string[];
}

interface SemanticBoundary {
  id: string;
  kind: "runtime" | "process" | "trust" | "artifact";
  leftComponentIds: string[];
  rightComponentIds: string[];
  allowedCrossingIds: string[];
  evidenceIds: string[];
}

interface CarrierCorridor {
  id: string;
  contract: SceneObjectContract;
  kind:
    | "pedestrian"
    | "local-road"
    | "collector"
    | "arterial"
    | "rail"
    | "seaway";
  relationIds: string[];
  scenarioIds: string[];
  sourceNodeId: string;
  targetNodeId: string;
  direction: "forward" | "return" | "bidirectional";
  evidenceIds: string[];
}

interface FacilityEnsemble {
  id: string;
  componentId: string;
  archetype:
    | "gateway"
    | "analysis-works"
    | "planning-complex"
    | "replay-yard"
    | "inspection"
    | "logistics-port"
    | "operations-center"
    | "laboratory";
  massIds: string[];
  entranceIds: string[];
  loadingBayIds: string[];
  scaleRange: [MetropolisScale, MetropolisScale];
  evidenceIds: string[];
}
```

P0 schema validation 必须拒绝：

- data-bearing object 没有 evidence；
- boundary 没有 kind 或两侧 component；
- crossing 不属于对应 boundary；
- agent route carrier 类型与 payload/transport 不兼容；
- file 在 L0 以默认 independent building 输出；
- journey step 引用不存在的 component/source；
- current Golden Journey 顺序违反第 6.1 节。

## 11. 性能预算

性能目标以 Balanced 档、1920×1080、现代集成显卡或 Apple Silicon 笔记本为基线。
画质不能依赖为每栋楼、每辆车创建独立 React component/mesh。

### 11.1 运行预算

| 指标 | Balanced 目标 | Hard ceiling |
|---|---:|---:|
| L0 主 semantic ensembles | 5–30 | 30 |
| 同时可见详细 facility masses | ≤150 | 240 |
| draw calls | ≤180 | 260 |
| visible triangles | ≤1.2M | 2.0M |
| GPU texture budget | ≤128 MB | 192 MB |
| DOM/HTML labels | ≤30 | 60 |
| detailed semantic agents | ≤200 | 400 |
| aggregated/instanced agents | ≤1,000 | 2,000 |
| event simulation tick | 20 Hz | 不与 render FPS 绑定 |
| 单 tick CPU | P95 ≤4 ms | ≤8 ms |
| render frame | P95 ≤16.7 ms | P95 ≤33 ms |
| seek to event/keyframe | ≤50 ms | ≤150 ms |

### 11.2 编译与确定性 fixture

标准 fixture：

- 1,000 files；
- 80 components；
- 20,000 static relations；
- 2,000 flow events；
- 至少一个 artifact boundary；
- 至少 12 个 commits。

预算：

- JSON 已解析后生成 component graph + P0 plan：P95 ≤250 ms；
- 输入数组重排不改变 serialized plan；
- 5 分钟播放后 retained heap 不持续增长；
- project/journey 切换后旧 route、agent、geometry、material 可回收；
- offscreen L2/L3 对象不实例化详细 mesh；
- repeated facility parts、cars、people、trees、lights 使用 instancing；
- shader/material 变体受控，不为每个文件创建材质。

P0 不要求达到最终 agent 数，但不得选择会阻止 P2 达标的数据结构或 per-object
React 方案。

## 12. 验收：四张截图与动态标准

四张截图是完整 V4 Gate，不是 P0 的完成条件。P0 只需要交付 schema、测试和一张
明确标注 foundation 的 L0 白模诊断图。

所有正式截图使用 1920×1080、16:9；同时保留 HUD-on 信息图和 HUD-off 城市图。

### Screenshot A — Metropolis Overview

必须同时满足：

- 水、绿地、地形、院落等负空间占画面约 30%–50%；
- 一眼分出 build-side、planning/replay core、viewer waterfront 三个区域；
- L0 主 ensemble 为 5–30 个，不出现数百个 file pillars；
- 看见至少两个道路等级和一个真实外部联系；
- 有 boundary evidence 时看见 Static Artifact River；无 evidence 时无河；
- skyline 有少数主地标、中层组团和低层肌理；
- 关闭全部标签后仍能指出入口、分析区、港区和主廊道；
- 看不到白色地图板边；
- 主要建筑中同一种黑色矩形柱体不得占可辨体块的 20% 以上。

失败示例：只把 244 根楼压低、加一条河和三栋彩色 landmark。

### Screenshot B — District and Traffic

镜头 35°–45°，覆盖约三个街区，必须同时看见：

- arterial、collector、local 或 pedestrian path 中至少三种层级；
- 真实 junction、crosswalk/sidewalk、frontage、courtyard/yard；
- 至少一个 podium + wing ensemble，而不是独栋 box；
- 至少 15 个可见 Data Flow agents；
- car、truck、train、ship 中至少三种合法 carrier；
- request 与 response 方向可辨；
- 所有 agent 位于 lane、track、path 或 water；
- 没有 route 穿楼、切过 parcel、跨越无通道水面；
- UI 不遮挡画面主体，城市内容占可用画面至少 80%。

### Screenshot C — Static Artifact Port Transfer

必须在一张图或同一镜头连续帧中证明：

- writer feeder truck/rail 将 container 运入 outbound yard；
- cargo、crane/inspection、ship、inbound crane、loader feeder 形成连续链；
- 同一个 bundle/correlation ID 跨换乘保持一致；
- producer 和 consumer schema inspection 位于正确两端；
- 水面是 build/browser boundary，不是装饰河；
- Viewer 侧不存在直连 Git/analyzer 的普通桥或同步车辆；
- evidence card 可指出 artifact、source stage、target stage 和 provenance；
- queue 数量与 event state 一致。

### Screenshot D — Component Cutaway

必须同时满足：

- Analyzer 或另一真实 component 是多翼 facility；
- 主入口、git-analyzer 主处理区、code-analyzer 内部翼楼、output bay 可辨；
- 至少三个 room/floor 来自真实 file/export/class/function；
- 主角 work item 经过至少两个真实内部节点；
- 外部 vehicle 与内部 pedestrian 保持同一 correlation ID；
- 点击任一数据房间可回 source path 和 evidence；
- 没有随机窗格冒充楼层；
- 没有内部事实时 UI 明确降级，而不是补虚构房间。

### 12.1 动态验收

截图无法单独证明模拟正确，必须额外保存成对帧或短视频：

1. **Movement pair**
   - `t0` 与 `t+3s` 显示同一 agent/correlation ID；
   - agent 沿合法 carrier 前进；
   - source、target 和 payload 不变。
2. **Pause pair**
   - 暂停前后等待三秒；
   - semantic event state、agent progress 和 queue length 完全一致；
   - 仅 atmosphere（如水面或云）可按设置继续。
3. **Transfer continuity**
   - truck → crane/queue → ship → truck 换乘不更换 principal payload ID；
   - 每次换乘产生可回放 event。
4. **Request/response**
   - request 到达处理点后才生成对应 response；
   - response 走相反方向并保留 correlation ID。
5. **Semantic zoom**
   - L0 → L1 → L2 → L3 不重新排版；
   - component、entrance 和 agent 地址连续；
   - 不出现 file towers 突然从无意义位置弹出。
6. **Reduced motion**
   - 默认暂停自动跟随和电影镜头；
   - 仍可单步理解全部流程。

### 12.2 “恍然大悟”测试

让未参与开发的用户只看城市完成：

1. 找到源码分析发生的位置；
2. 说明 code-analyzer 为什么在 git-analyzer 园区内部；
3. 解释 build-side 与 Viewer 为什么被水界隔开；
4. 跟随一个 bundle 完成至少两次 carrier 换乘；
5. 指出 schema validation 为什么位于 replay 之后；
6. 进入一个 component 找到实际 export/function；
7. 判断当前流量是 observed、test 还是 simulated。

通过标准：

- 至少 6/7 项无需开发者提示；
- 45 秒内说出 RepoCity 主流程；
- 能说出至少一个从普通目录树不容易获得的新理解；
- 不把模拟密度误认为生产 QPS；
- 不把地理相邻误认为调用关系。

## 13. P0 与完整 V4 的 Gate 区别

| 能力 | P0 Foundation | 完整 V4 |
|---|---|---|
| component aggregation | 必须 | 必须 |
| 真实 Golden Journey | 必须 | 必须 |
| typed boundary/reason/evidence | 必须 | 必须 |
| Flow 不再使用 file tower L0 | 必须 | 必须 |
| 完整 terrain/coastline | 仅 schema/白模 | 必须 |
| road-first urban layout | 数据合同 | 必须 |
| 六种高完成度 ensemble | 可低模占位 | 必须 |
| lane/track/water simulation | 数据结构可容纳 | 必须 |
| transfer/fan-out/join/queue | 事件合同 | 必须 |
| function-room cutaway | 数据结构可容纳 | 必须 |
| cinematic camera/day-night | 非 P0 | 必须 |
| 四张正式截图 | 非 P0 | 必须 |
| Cities-like 完成度声明 | 禁止 | 仅完整 Gate 通过后可讨论 |

## 14. 调研来源

以下均为 Paradox Interactive / Cities: Skylines II 官方一手资料：

1. [Road Tools](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools)
   关键结论：道路有 small/medium/large/highway 层级；高架、桥、匝道、步行道、
   交叉口和专用车道具有真实连接与规则，不是装饰线。
2. [Traffic AI](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai)
   关键结论：城市生命来自有 origin/destination 的 agents、基于 road network
   的 path cost、车道选择和事件反应；Traffic Info View 与正常城市视图分离。
3. [Public & Cargo Transportation](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/public-cargo-transportation)
   关键结论：`Depot → Stops/Stations → Tracks/Roads → Lines` 是完整运输链；
   港口必须连接航道，并与 truck/rail feeder 共同工作。
4. [Zones & Signature Buildings](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings)
   关键结论：道路是骨架，zone 是城市主体；低、中、高密度和 mixed use 共同产生
   城市肌理，signature buildings 只是少数地标。
5. [City Services, Districts & Policies](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/city-services-districts-policies)
   关键结论：道路同时提供 buildable frontage、agent path 和基础网络；服务建筑、
   车辆与 District 之间存在实际作用关系。
6. [Economy & Production](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/economy-production)
   关键结论：城市活动来自资源生产链与 agent 决策，而不是随机动画；连接质量影响
   资源和服务移动。
7. [Citizen Simulation & Lifepath](https://www.paradoxinteractive.com/zh-CN/games/cities-skylines-ii/features/citizen-simulation-lifepath)
   关键结论：agents 的活动会改变交通、经济和设施状态；纯 cosmetic 内容与模拟
   内容应被明确区分。
8. [Cinematic Camera & Photo Mode](https://www.paradoxinteractive.com/zh-CN/games/cities-skylines-ii/features/cinematic-camera-photo-mode)
   关键结论：focal length、depth of field、weather、fog、atmosphere、time of day
   和 camera path 是城市呈现的一部分，不是最后一个简单滤镜。

## 15. 最终决策

RepoCity V4 不再追求“把文件楼做得更精致”，而是：

> 先把软件系统编译成一座具有地理、中心、边界、道路层级、功能组团和可追踪生命的
> 语义都会；文件和函数只在用户真正接近时，成为可进入、可解释、可回源码的建筑
> 内部。

P0 的成功不是截图已经像商业城市建造游戏，而是从此以后所有 P1–P5 工作都建立在
正确的 component-scale、真实架构顺序和 typed evidence 上，不再回到
“规则地块 + 文件柱体 + 装饰交通”的路线。
