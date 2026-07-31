# RepoCity V2 — 活城市规格与实施计划

> 状态：V2 living-city vertical slice implemented
> V1：`repocity-spec.md` 保留为历史规格
> 研究依据：`docs/CITY_SIMULATION_RESEARCH.md`

## 0. 产品定义

RepoCity V2 是一个由代码与 Git 事实驱动的活城市观看器，不是市政经营游戏。

成功顺序必须是：

1. 第一眼看到一座连续、可信、有人活动的城市；
2. 第二眼理解 District、街区、设施和交通对应仓库结构；
3. 选择对象后回到文件、依赖、Diff 和知识说明；
4. 播放历史时理解城市为什么建设、翻修、扩张或拆除。

V1 的三个初衷保持不变：

- **空间记忆**：实体拥有稳定地址；
- **时间因果**：变化来自真实 commit；
- **知识落点**：城市对象最终落到代码事实。

## 1. V2 核心决策

### 必须做

- 道路先于街区，街区先于 parcel，parcel 先于建筑；
- 所有 District 属于一个连续城市，不再渲染为分离悬浮板；
- 至少具有小路、主干路、人行道、路口、斑马线和停车/装卸空间；
- 模块化建筑具有基座、主体、冠部、窗格、入口和屋顶设施；
- 形成低、中、高密度和至少五种可辨识轮廓；
- 具有数据驱动的地标和条件性公共设施；
- 实现轻量汽车、行人、服务/施工车辆；
- 满足水域条件时实现河流、桥、码头和渡轮/船；
- 大型仓库满足交通条件时实现高架道路；
- 实现昼夜、窗灯、路灯、车灯和城市环境层次；
- 默认画面像城市，指标通过 Info View 按需覆盖；
- Viewer 加载真实 replay delta，HEAD 和历史高度来自真实 LOC；
- 保持实体 ID、rename、地址和道路拓扑在回放期间稳定；
- 3D 画布成为主界面，Inspector 和导航改为可收起 HUD。

### 明确不做

- 经济、预算、税率、人口和土地价值模拟；
- 持久居民身份、家庭、工作和生命周期；
- 玩家自由修路、分区或经营城市；
- 车辆刚体物理和高精度碰撞；
- 医院、墓园、犯罪、垃圾、灾难等通用设施清单；
- 全城可进入室内；
- 永久显示所有 import 关系；
- 把静态 import 描述成生产流量；
- 复制《模拟城市》《城市：天际线》的资产或界面。

## 2. 城市语义

| 仓库事实 | 城市表达 |
|---|---|
| Repository | 城市 |
| workspace / package / 一级业务域 | District |
| 目录或稳定模块簇 | 街区 |
| 稳定文件实体 | parcel 上的建筑 |
| entry point / public API | 城市门户、车站或地标 |
| 高 fan-in | 枢纽或核心天际线 |
| 高 churn | 施工活动和窗灯活跃度 |
| 同 District import | 本地结构流量 |
| 跨 District import | 主干路/桥上的聚合结构流量 |
| docs / spec | 图书馆、研究院、展览馆 |
| tests / fixtures / validation | 质检中心、测试实验室 |
| scripts / build / CI | 维护或施工基地 |
| config / workspace root | 控制中心 |
| network / server / adapter | 通信塔或数据中心 |
| storage / database / cache | 仓储或物流设施 |
| publish / external dependency | 条件性港口或货运 |
| commit | 施工事件 |
| tag / release | 城市庆典、亮灯或运输事件 |

### 指标编码

- footprint：`log1p(max historical LOC)`，受 parcel 上限约束；
- floors：LOC 区间 + 建筑 archetype；
- skyline：fan-in、入口级别、道路等级和 District 中心度共同决定；
- facade theme：District；
- building archetype：语义角色；
- window activity：近期 churn；
- night occupancy：稳定 seed + activity；
- 结构交通量：聚合 relation 数量/权重；
- 施工强度：commit changed files 与真实 additions/deletions；
- 颜色永远不表示“代码质量”。

## 3. 条件性城市能力

### 地图模板

编译器从稳定 repo seed 选择模板：

1. compact inland：小仓库、少于 4 个 District；
2. river valley：至少 4 个 District 且至少 80 个 entity；
3. bay/coast：存在发布/外部连接语义；
4. green spine：不适合水域但需要中央分隔；
5. island group：只用于 package 边界天然分散且桥/渡轮有意义的仓库。

刷新和历史回放不允许更换模板。

当前垂直切片只实现 `compact inland` 和 `river valley`。`bay/coast`、`green
spine` 与 `island group` 保留为后续地图能力，本 PR 不以随机装饰模拟这些模板。

### 河流

启用条件：

- District ≥ 4 且 entity ≥ 80；
- 编译器能在两岸都放置有效 District；
- 正交道路能形成至少一处合理陆路连接。

河流本身只属于地理层。跨河桥承担的流量才表达代码关系。

### 桥

只在道路跨水时生成，至少一条连接保证全城拓扑连通。当前垂直切片使用固定安全
宽度；聚合结构流量驱动桥梁等级属于后续解释层。

### 高架

当前以 entity ≥ 180 作为大型城市阈值。未来可以增加“主干道跨越已有网络”或“跨
District 走廊显著高于平均流量”等事实条件。高架必须有坡道或明确的 outside
connection，不允许悬空结束。

### 船与港口

- 当前 river valley 且两岸都有 District：允许一条轻量船路；
- 后续存在 publish/external dependency 事实：允许货运码头和货船；
- 无 waterway graph：船数量必须为 0；
- 当前不以环境小艇代替未实现的港口语义。

### 机场

只有识别到可靠的远程部署工作流且地图规模足够时，才进入后续版本。tag 本身不足
以证明部署。

### 条件生成矩阵

下表是当前 `LivingCityPlan` 的可执行规则。阈值只控制首个垂直切片，后续可以增加
跨 District 流量、publish 或 deployment 等事实条件，但不得放宽“有理由才出现”
的原则。

| 能力 | 当前出现条件 | 明确不出现 | 语义与约束 |
|---|---|---|---|
| 河流 | District ≥ 4 且 entity ≥ 80 | 任一阈值不满足 | 仅作为地理层；两岸都必须有 District |
| 跨河桥 | 已生成河流，且两岸正交道路存在共享连接线 | 无河流 | 桥必须真实跨水并接入两岸地面道路；当前生成 1–2 座 |
| 船路 | 已生成河流，且东西两岸均有 District | 无 waterway 或只有单岸 | 当前是轻量河运路线，不表示 publish，也不承诺港口 |
| 高架 | entity ≥ 180 | entity < 180 | 沿既有道路走廊生成，并以 world boundary 作为 outside connection |
| 图书馆/研究设施 | `docs`、`spec`、`knowledge` 角色或路径 | 无对应事实 | 表达文档与知识，不代表代码质量 |
| 质检/测试设施 | `test`、`fixtures`、`validation` 角色或路径 | 无对应事实 | 表达测试资产，不把测试失败推断为事故 |
| 维护基地 | `script`、`build`、`CI/workflow` 角色或路径 | 无对应事实 | 表达构建与维护工具 |
| 控制中心 | `config`、`tooling` 或根级配置 | 无对应事实 | 表达仓库编排与配置 |
| 数据中心 | `network`、`server`、`adapter`、`infra` 角色或路径 | 无对应事实 | 只表达已识别的通信/基础设施模块 |
| 城市门户 | entry/public API 优先，其次为 District 内相对最高 fan-in | 无入口或中心性证据 | 每 District 最多 2 个，且仍对应真实实体 |
| 机场、完整港口、铁路 | 本 PR 不生成 | 当前全部输入 | 等可靠 deployment、publish 和大型跨区需求进入后续阶段 |

普通文件在没有设施证据时只选择普通建筑 archetype。医院、墓园、警察、垃圾、灾难
等设施不会作为“城市必备清单”自动补齐。

## 4. 确定性城市生成

### 4.1 编译顺序

```text
Repo facts + previous city plan
  → Urban Program 分类
  → Geography / buildable mask
  → District topology
  → arterial / collector / local roads
  → blocks / sidewalks
  → frontage parcels
  → building profiles / facilities
  → lane / pedestrian / waterway graphs
  → deterministic decorations
```

### 4.2 简单而有效的算法

首个 rollout 避免复杂 GIS boolean、运行时 CSG 和 force layout：

1. 按稳定 ID 排序输入事实，并生成与输入顺序无关的 seed；
2. 根据条件矩阵选择 inland 或 river 双岸布局；
3. 在统一宏观网格中相邻放置 District；
4. District 内先生成正交 arterial/local roads；
5. 道路之间形成矩形 block，每个开发 block 划分 frontage parcel；
6. entity 按稳定顺序映射到 parcel，seed 只控制可视变体；
7. 建筑入口绑定确定的 frontage road；
8. 公园占用独立 block，树和路灯使用稳定点位；
9. 汽车和行人使用连续正交 route；有 waterway 时单独生成 boat route；
10. 大型城市的高架复用地面走廊投影并连接 outside boundary。

跨 District MST、按结构流量增加走廊和更多地图模板属于静态编译器的下一阶段，
不应在 Renderer 中临时实现。

### 4.3 跨构建空间记忆

最终 V2 静态 city plan 编译器必须支持读取旧计划：

- rename 沿用 entityId 和 parcel；
- 既有 entity 优先锁定原地址；
- 新文件填充预留 parcel；
- 无空位时按 District 边缘扩张；
- 删除实体可保留地址和遗址记录；
- 只有显式“重新规划城市”才允许全量换址。

当前纯函数 planner 尚不接受 `previousCityPlan`，因此本 PR 只保证同一事实输入的确定
性，不把跨构建地址锁定标记为已完成。该能力必须在 CLI 输出 V2 静态计划前补齐。

## 5. 建筑系统

### 5.1 Archetype

首批至少包括：

- low-rise row / studio；
- mid-rise mixed block；
- office slab；
- office/residential tower；
- warehouse / industrial shed；
- library / research hall；
- test / quality laboratory；
- maintenance depot；
- control/data center；
- transit or gateway landmark。

### 5.2 组合语法

```text
Parcel
├── yard / forecourt / loading area
├── podium
├── primary mass
├── optional secondary mass
├── setbacks / terraces
├── facade grid
├── entrance / canopy
├── crown
└── roof units / tank / antenna / sign
```

使用共享 geometry/material 和少量 archetype，而不是一栋楼一个独立 React
组件。变体来自稳定 seed，重载后不变化。

### 5.3 立面与夜景

- 窗格通过立面 shader 或批次化实例生成；
- 不能每扇窗一个 React component；
- occupancy 使用 seed + churn；
- 路灯、窗灯、车灯主要使用 emissive；
- 只有少量 landmark 使用真实局部光源；
- 夜晚必须仍能读出道路、桥和 District 层次。

### 5.4 建筑内部

普通建筑仅提供廉价 interior card 或暗示。选中建筑进入单体 cutaway：

- 最多显示一个内部；
- 楼层映射公开符号分组；
- 核心筒表达内部模块骨架；
- import/export 分别从建筑两侧连接；
- Inspector 是主要阅读界面，不做第一人称室内漫游。

## 6. 城市移动系统

### 6.1 数据结构

```ts
type RouteAgent = {
  routeId: string;
  segmentIndex: number;
  distance: number;
  previousDistance: number;
  speed: number;
  targetSpeed: number;
  seed: number;
};
```

### 6.2 模拟

- 固定 20 Hz 更新；
- 60 Hz 渲染插值；
- route 在生成或 spawn 时计算；
- 同 lane 只做简单前车间距；
- 路口使用确定性信号相位；
- agent 到达终点后回收并复用；
- 不引入刚体物理；
- 不在每帧重新寻路；
- 每帧更新只触碰 typed arrays 和实例矩阵。

### 6.3 类型

- 普通汽车：城区循环；
- 货车：结构流量、build/package 活动；
- 公交/有轨电车：大型多 District 城市的共享走廊；
- 行人：建筑入口、设施、广场与车站；
- 施工车辆：当前 commit；
- 渡轮/船：条件性 waterway；
- 火车：后续大型仓库能力。

## 7. Git 回放

Viewer 必须加载 `deltas.ndjson` 和 keyframe index，使用 `replay-engine` 的
`seekReplay` 获得真实状态：

- HEAD = 最后 replay state；
- visible = 当前 state 是否包含实体；
- height ratio = current LOC / max historical LOC；
- active relation = replay relationIds；
- rename 更新标签，不移动 parcel；
- spawn 显示地基、框架和主体；
- update 显示脚手架、吊车、窗灯和施工车；
- remove 拆除或遗址；
- release 改变城市事件，不篡改建筑事实。

V2 manifest 需要显式 `replayIndex`，列出 keyframe 文件，避免 Viewer 猜测目录内容。

## 8. 数据契约 V2

V1 保持可读，新增 `"0.2"`：

当前 Viewer 侧纯函数入口为：

```ts
planLivingCity({
  entities,
  districts,
  relations,
  seed, // optional
}): LivingCityPlan
```

当前输出契约为：

```ts
interface LivingCityPlan {
  version: "0.2";
  seed: string;
  bounds: Bounds;
  geography: {
    river: RiverStrip | null;
  };
  districts: PlannedDistrict[];
  roads: RoadSegment[];
  bridges: PlannedBridge[];
  blocks: CityBlock[];
  parcels: CityParcel[];
  buildings: PlannedBuilding[];
  parks: PlannedPark[];
  props: CityProp[];
  mobility: {
    carRoutes: MobilityRoute[];
    pedestrianRoutes: MobilityRoute[];
    boatRoutes: MobilityRoute[];
  };
}
```

`RoadSegment` 显式区分 `roadClass: arterial | local`、`level: ground |
elevated` 和 `surface: ground | bridge`。`PlannedBuilding` 必须携带
`entityId`、District/block/parcel、archetype、facility、floors、footprint、height
和 frontage road。Renderer 只消费这些事实，不自行决定城市布局。

manifest 新增：

- `files.cityPlan`；
- `files.replayIndex`；
- `headMetrics`；
- `entryPoint`；
- 轻量 symbol summary；
- commit additions/deletions/filesChanged；
- 可解释 traits。

实现策略：

- 固化 V1 schema；
- V2 使用 discriminated union；
- Viewer 提供 V1 → V2 内存 adapter；
- CLI 新产物输出 V2；
- `layout` 最终从 entity fact 移到 `cityPlan`。

首个视觉切片允许在 Viewer 中用纯函数生成临时 CityPlan，但 API 必须与未来静态
编译结果一致，不得再次把布局逻辑散落在 React 组件中。

## 9. Viewer 与 HUD

- Canvas 占据整个 workspace；
- 顶栏缩小为仓库、搜索、模式与时间；
- District 导航默认收起；
- Inspector 作为右侧抽屉；
- 时间轴为底部浮动面板；
- Info View 使用游戏式图层切换；
- 提供隐藏 HUD 的电影视图；
- 相机支持城市总览、自由轨道、聚焦和跟随施工；
- 移动端隐藏高级面板，保留查看、选择、时间轴和质量降级。

## 10. 渲染架构

```text
app/components/city/
  CityCanvas.tsx
  SceneEnvironment.tsx
  TerrainLayer.tsx
  WaterLayer.tsx
  RoadLayer.tsx
  BuildingLayer.tsx
  FacilityLayer.tsx
  PropsLayer.tsx
  MobilityLayer.tsx
  ReplayEffectsLayer.tsx
  SelectionLayer.tsx
  CameraRig.tsx

app/lib/city/
  compile-living-city.ts
  geography.ts
  road-plan.ts
  parcels.ts
  building-profile.ts
  mobility.ts
```

当前垂直切片的纯函数实现位于 `app/lib/living-city.ts`；拆分到上述目录必须保持
`LivingCityPlan` API 兼容，不能借重构改变地址。

原则：

- 城市编译是纯函数；
- 场景层只消费计划；
- React 管理离散 UI 状态；
- 高频动画留在 refs/typed arrays；
- 静态 geometry 不在 render 内重复生成；
- 项目切换显式 dispose GPU 资源；
- 大 batch 按空间 chunk 拆分，保持视锥裁剪有效。

## 11. 性能预算

Balanced desktop 目标：

| 指标 | 预算 |
|---|---:|
| 目标帧率 | 55–60 FPS，集显不低于 30 |
| DPR | 自适应 1.0–1.5 |
| 主场景 draw calls | ≤ 120 |
| 含阴影/效果总 calls | ≤ 250 |
| 可见三角形 | ≤ 1.5M |
| 汽车 | 150–300 |
| 行人 | 250–700 |
| 船 | 0–6，取决于地图 |
| sim + matrix update | ≤ 3ms/frame |
| 首屏压缩 3D 资产 | ≤ 12MB |

降级顺序：

1. DPR；
2. 水面反射、AO、bloom；
3. 阴影分辨率；
4. agent 数量；
5. Near LOD 距离；
6. 最后才隐藏街景设施。

## 12. 测试与不变量

### 城市编译

- 同 seed 同输入 byte-for-byte 一致；
- 输入顺序变化不影响输出；
- rename 后 parcel 和地址不变（静态编译器阶段）；
- replay seek 不改变道路与 parcel；
- building 必须位于 parcel；
- parcel 必须位于 block；
- 普通道路不得穿建筑或水面；
- bridge 必须跨越 water；
- 所有 District 都连接到道路网络；
- waterway 不存在时船数量为 0；
- mobility route 必须连续；
- 旧 CityPlan 重编译时既有实体不换址（静态编译器阶段）。

### 事实与回放

- 每个 commit 的实体状态与 `seekReplay` 相同；
- HEAD 等于最后 state；
- rename、relation 生命周期和真实 LOC 不丢失；
- V1 adapter 与 V2 bundle 均通过交叉引用校验。

### 渲染与产品

- 建筑、车辆、行人和树木使用固定批次数量；
- 选中、hover、聚焦和搜索保持 entity mapping；
- 河流/桥/高架满足触发条件；
- Info View 图例明确；
- 隐藏 HUD 后，截图首先被判断为城市；
- 关闭 agents、船和装饰后，道路—街区—建筑结构仍成立；
- 30–50 栋垂直切片达到标准前不扩展全部设施。

## 13. 当前垂直切片与后续 rollout

### 13.1 已完成的规划基线

- [x] `LivingCityPlan` 纯函数 API 与 `"0.2"` 计划结构；
- [x] 连续 world bounds、相邻 District、正交 arterial/local roads；
- [x] block → frontage parcel → building 的单向编译；
- [x] 条件性河流、跨河桥、高架和船路；
- [x] 普通建筑、六类语义设施、公园、树和路灯点位；
- [x] car/pedestrian/boat 的连续 route；
- [x] 输入重排不改变输出；
- [x] bounds、包含关系、建筑避开河/道路、条件触发和 route 连续测试。

这部分是 Renderer 的唯一布局来源。场景组件不得再次创建另一套坐标、河流或道路
规则。

### 13.2 本 PR 合并门槛

本 PR 只承诺以下三个产品结果：

1. **城市观感**：Viewer 消费 `LivingCityPlan`，形成连续道路—街区—建筑结构、
   多种 archetype、条件性河桥高架、街景、昼夜和可收起 HUD；
2. **轻量交通**：汽车、行人和条件性船沿预计算 route 移动，使用固定预算和实例化
   渲染，不实现交通经营或高精度 AI；
3. **真实回放**：可见性、历史 LOC、relation 生命周期和施工状态来自真实
   delta/keyframe，不能用随机动画代替 Git 事实。

合并前必须同时满足：

- [ ] V1 bundle 经 adapter 生成计划，项目切换不会残留旧计划；
- [ ] 城市层全部消费 planner 输出，关闭 props/agents 后城市结构仍成立；
- [ ] HEAD 与任意 seek 的实体状态和 `replay-engine` 一致；
- [ ] 小仓库和大型演示仓库分别验证条件矩阵；
- [ ] hover、选择、聚焦、搜索、Inspector 与 entityId 映射不回退；
- [ ] targeted test、typecheck、lint、production build 和浏览器冒烟通过。

### 13.3 本 PR 不承诺

- 经济、预算、税收、人口、就业和土地价值；
- 持久市民、家庭、生命周期和个人目的地模拟；
- 刚体车辆、碰撞、逐车道换道和完整交通信号 AI；
- 玩家建设、修路、分区和经营玩法；
- 全城可进入室内或完整楼层建模；
- 机场、完整港口、铁路、复杂天气与灾难；
- 生产运行时调用追踪；当前交通表达静态结构关系。

选中建筑的 cutaway、复杂公共交通和更完整内部结构只有在基础城市观感与真实回放
稳定后才进入后续阶段。

### 13.4 后续阶段

1. **真实回放闭环**：固化 replay index、HEAD/seek、rename 和 relation 生命周期；
2. **垂直切片渲染**：模块化立面、河桥高架、街景、昼夜、Canvas-first HUD；
3. **移动完善**：货车、施工车、信号相位、agent budget 与性能指标；
4. **解释层**：结构流量 Info View、release 事件、单体 cutaway；
5. **静态 V2 bundle**：CLI 生成计划、读取旧计划锁定地址、V1 adapter；
6. **性能与发布**：空间 chunk、LOD、自适应质量、视觉回归、移动端降级。

每个阶段使用独立、可审查的 GitHub PR；不得用尚未接入事实的装饰提前勾选后续能力。

## 14. 首个垂直切片验收

- 6–8 个连续街区；
- 40–60 栋可辨识建筑；
- 至少五种天际线轮廓；
- 一条有空间原因的河或海岸；
- 一座桥和一段有理由的高架；
- 一处小型水岸设施；
- 汽车、行人、施工车和条件性船；
- docs、tests、build/CI、entry point 四类设施；
- 昼夜切换；
- 真实 commit 施工回放；
- HUD 可隐藏；
- 第一眼必须是城市，而不是地块上的柱体。

## 15. 完成定义

V2 的完成标准不是“把功能列表勾完”，而是同时满足：

1. 城市结构在关闭装饰后仍然成立；
2. 显眼设施都能解释出现原因；
3. 代码事实与城市艺术化严格分层；
4. Git 回放完全由真实状态驱动；
5. 视觉上达到主流城市模拟游戏的层次语言，但保持原创；
6. 2,000 建筑仍可查看和交互；
7. 文档、测试、CLI、Viewer 和静态 bundle 形成闭环。
