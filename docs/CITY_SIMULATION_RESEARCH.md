# RepoCity V2 城市模拟化调研

> 调研日期：2026-07-30
> 目的：判断 RepoCity 如何在保留“空间记忆、时间因果、知识落点”的前提下，
> 获得《模拟城市》《城市：天际线》式的城市生命感。

## 结论

RepoCity 不应转型为市政经营游戏，而应成为：

> 由仓库事实驱动的“活城市观看器”：第一眼是一座可信的城市，第二眼能读懂
> 代码结构，继续观察能看见 Git 历史如何修建它。

城市感不是由设施数量决定，而来自一条连续因果链：

```text
地形与水系
  → 道路网络
    → 连续街区与临街地块
      → 有功能差异的建筑
        → 有目的地的人流、车流与物流
          → 施工、昼夜、声景与信息视图
```

《模拟城市》官方资料把道路、交通和 Sims 的流动视为模拟的循环系统；
《城市：天际线 II》也把道路定义为城市骨架、可建设分区和代理移动的基础。
因此，当前“先切矩形 District，再摆柱体”的生成顺序必须被替换。给原场景加几辆
汽车、树木和船只，只会得到带装饰的数据图，而不会变成城市。

## 值得借鉴的城市系统

### 1. 道路先于建筑

道路必须同时承担：

- 城市空间骨架；
- 街区和临街 parcel 的生成依据；
- 车辆、行人和服务活动的移动图；
- District 之间的连续连接；
- 结构关系流量的承载面。

RepoCity 不需要提供玩家修路工具，但编译器需要生成小路、collector、arterial、
高架、桥梁、人行道、路口、斑马线和少量停车空间。`import` 不应一条边变一条
道路；它只影响既有道路上的“结构流量”，选中实体时才展示可追溯路线。

参考：

- [Cities: Skylines II — Road Tools](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/road-tools)
- [EA — The Circulatory System of SimCity](https://www.ea.com/en-gb/news/simcity-circulatory-system)
- [SimCity 2013 官方手册](https://akamai.cdn.ea.com/eadownloads/u/f/manuals/GAME-SIMCITY/SimCity_2013.pdf)

### 2. 连续街区与密度过渡

可信城市不应由同尺度建筑平均铺满。需要有：

- 低、中、高密度的渐变；
- 核心区、普通街区、公共设施、工业/运维边缘；
- 沿主干路和枢纽增加的密度；
- 空地、公园、广场和水岸形成的负空间；
- 同 District 内统一、District 间受控变化的建筑主题。

LOC 只参与计算建筑容量，不能直接等于高度。高度还应受 centrality、道路等级、
District 中心距离和建筑 archetype 影响。

参考：

- [Cities: Skylines II — Zones & Signature Buildings](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings)

### 3. 交通必须有目的地

完整交通 AI、个体家庭和经济模拟没有必要，但移动对象不能全部随机巡游：

- 行人往返建筑入口、车站、广场和设施；
- 普通汽车沿道路循环，密度由城区规模和活跃度决定；
- 结构交通的起终点来自真实跨模块关系；
- 货车在构建设施、仓储和可识别的发布出口之间移动；
- 施工车辆只在回放当前变更附近出现；
- 车辆和行人使用轻量固定路线，不做刚体物理。

静态 import 只能称为“结构流量”或“引用流量”，不能冒充真实生产请求量。

参考：

- [Cities: Skylines II — Traffic AI](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai)
- [Cities: Skylines II — Public & Cargo Transportation](https://www.paradoxinteractive.com/zh-CN/games/cities-skylines-ii/features/public-cargo-transportation)

### 4. 默认城市视图与数据视图分离

默认画面应使用自然、可信的道路和建筑色彩。LOC、churn、fan-in、年龄、测试覆盖
等指标通过独立 Info View 展示，而不是让城市永久呈现为彩色柱状图。

建议的信息视图：

- 城市默认；
- 结构流量；
- 变更热度；
- 文件年龄；
- fan-in / fan-out；
- 测试与文档设施；
- 当前 commit 施工。

### 5. 模块化建筑和 Git 演进天然契合

建筑采用 `parcel → podium → body → setback → crown → roof props` 的语法：

- 文件出生：地基、框架、主体；
- LOC 增长：增层或扩建，而不是柱体拉伸；
- 新 export：增加入口、招牌或屋顶组件；
- 修改：脚手架、吊车、立面翻修；
- rename：地址与建筑身份不变；
- 删除：拆除或遗址；
- tag/release：城市灯光和交通事件。

程序化建筑研究长期使用道路图、地块和 shape grammar 分层生成城市与建筑；
Three.js 目前也提供 seeded layout → block → lot → sidewalk → building 的
`CityGenerator` 作为算法参考。但 RepoCity 需要自己的道路拓扑和代码语义，
不能直接套用其高楼网格。

参考：

- [Procedural Modeling of Cities](https://dl.acm.org/doi/10.1145/383259.383292)
- [Procedural Modeling of Buildings](https://doi.org/10.1145/1179352.1141931)
- [Three.js CityGenerator](https://threejs.org/docs/pages/CityGenerator.html)

## 河流、桥、高架和船的判断

### 水系

河流、湖泊和海湾首先是城市地理，不强行宣称“河流就是数据流”。它们用于：

- 形成两岸天际线、远近层次和城市边缘；
- 约束道路与 District 布局；
- 让桥、码头和水运具有真实空间原因；
- 为跨区依赖提供可解释的交通走廊。

地图模板必须由 repo seed 确定，同一仓库刷新后不改变。小仓库或无法形成两岸
结构的仓库应选择无水内陆模板。

### 桥与高架

- 道路或轨道跨水时才建桥；
- 大型城市的主干路交叉、跨越已有街区或铁路时才使用高架；
- 跨 District 关系权重决定桥梁/道路流量，不决定桥梁凭空出现；
- 高架和桥上的车辆沿同一 lane graph 行驶，不需要特殊物理。

参考：

- [Cities: Skylines II — Bridges](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/bridges-and-ports-dev-diary-bridges)

### 港口、船与渡轮

- 水域将两岸 District 分开且存在通勤需求时，可以有渡轮；
- 可发布 package、外部依赖或构建产物证据充分时，可以有货运港；
- release/publish 事件可触发货船离港；
- 没有水路时绝不生成船；
- 没有发布事实时不生成大型集装箱港。

参考：

- [Cities: Skylines II — Ports & Beyond](https://www.paradoxinteractive.com/games/cities-skylines-ii/news/bridges-and-ports-dev-diary-ports)

## 城市设施取舍

| 城市对象 | 代码语义 | 采用规则 |
|---|---|---|
| District | workspace/package/一级业务域 | 始终 |
| 街区 | 目录或稳定模块簇 | 始终 |
| 建筑 | 文件或小型强内聚文件簇 | 始终 |
| 主干路/支路 | 城市骨架与聚合结构流量 | 始终 |
| 地标 | entry point、public API、高 fan-in | 达到阈值 |
| 图书馆/研究院 | docs、spec、knowledge | 存在相关实体 |
| 质检中心 | tests、fixtures、validation | 存在相关实体 |
| 维护基地 | build、scripts、CI tooling | 存在相关实体 |
| 控制中心 | 根配置、workspace orchestration | 单仓库一个 |
| 通信塔/数据中心 | network、server、adapter、infra | 识别可靠 |
| 仓储/物流 | storage、database、artifact、cache | 识别可靠 |
| 港口/货船 | external dependency、publish/release | 有水且有事实 |
| 铁路/高架 | 大型仓库的高权重跨包走廊 | 满足规模和拓扑 |
| 公园/广场 | 必要负空间和尺度参照 | 少量程序化 |
| 行人/普通汽车 | 城市生命感，数量由事实指标影响 | 始终但明确为氛围 |

默认排除医院、墓园、监狱、垃圾场、油井、犯罪、灾难、财政、税率、居民生命史
等没有通用代码映射的系统。仓库业务本身与这些概念相关时，才允许作为业务主题
建筑出现。

## 建筑内外层次

### 外部

每栋建筑至少具有以下层次中的数项，而不是单一 Box：

```text
parcel
├── 退界、入口、车道、装卸区或前庭
├── 基座 / 裙房
├── 主体与 setback
├── 立面网格、窗格、雨棚和材质变化
├── 冠部
└── HVAC、天线、水箱、露台或地标标志
```

采用有限的高质量构件库和稳定 seed 组合，而非制作几百个独立模型。大多数普通
建筑共享少量 geometry/material，差异通过体量参数、调色板、立面属性和屋顶
构件形成。

### 内部

不做全城可进入室内。只为当前选中建筑提供 cutaway / X-ray：

- 外墙淡化或移除一侧；
- 楼层对应 export/class/function 分组；
- 核心筒表达模块骨架；
- 输入/输出侧表达 import/export；
- 始终最多一栋近景建筑显示完整内部。

这保留了“进入代码建筑”的惊喜，也不会为正常镜头看不到的几千栋室内付出成本。

## Web 3D 技术结论

### 生产主线

- 保留 React 19 + React Three Fiber 9 + Three.js WebGL2；
- 不把 WebGPU 迁移与城市重做绑在一起；
- 静态道路、河岸和 sidewalk 按空间 chunk 合并；
- 建筑按 `archetype × material × LOD` 批次；
- 树、灯、车、人、桥墩和屋顶设备使用 `InstancedMesh`；
- 只有少量独特 landmark 使用普通 glTF Mesh；
- 高频模拟状态留在 typed arrays/ref，不写进 React state 或 Zustand。

参考：

- [R3F Performance Pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [Three.js BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)
- [Three.js 大量对象优化](https://threejs.org/manual/en/optimize-lots-of-objects.html)

### 交通实现

首期不使用 Rapier 或真实车辆物理。道路编译时同时生成 directed lane graph；
agent 只保存 route、当前 edge、距离、速度和 seed。模拟固定 20 Hz，渲染在前后
状态间插值。行人使用 sidewalk graph，船使用 waterway graph。

大规模人群研究表明，全局导航与局部避让很快变得昂贵；RepoCity 的目标是视觉
可信而非个体智能，因此固定路线和有限 agent budget 更合适。

参考：

- [Continuum Crowds](https://grail.cs.washington.edu/projects/crowd-flows/continuum-crowds.pdf)
- [Optimal Reciprocal Collision Avoidance](https://gamma-web.iacs.umd.edu/ORCA/)

### 光照、水面和后处理

- 一个太阳 DirectionalLight 和一个 HemisphereLight；
- 路灯、窗灯、车灯主要使用 emissive，不创建大量 PointLight；
- 默认水面使用单一廉价 shader，高画质才考虑反射 render target；
- 默认只使用轻 AO、少量 bloom 和 tone mapping；
- 景深、tilt-shift 和强 vignette 只进入 Photo Mode；
- DPR、阴影、agent 数量和 LOD 距离需要质量档。

参考：

- [Three.js Water](https://threejs.org/docs/pages/Water.html)
- [Three.js Shadows](https://threejs.org/manual/en/shadows.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js GPU 资源释放](https://threejs.org/manual/en/how-to-dispose-of-objects.html)

## 对当前实现的审计结论

当前实现存在四个结构性问题：

1. `city-compiler` 使用 treemap 生成彼此分离的矩形 District；
2. `CityScene` 每个角色只有一个立方体 geometry；
3. Viewer 没有加载 `deltas.ndjson` 和 keyframe，真实 bundle 回放仍是近似状态；
4. 固定三栏 UI 显著压缩了 3D 画面。

可保留：

- code/git analyzer；
- stable entity ID 与 rename；
- Zod 数据协议；
- replay-engine；
- CLI 静态生成与隐私模型；
- 实例化、实例拾取、一阶依赖线和相机聚焦的思想。

需要重做：

- 城市规划、道路、block、parcel；
- 建筑语法和设施；
- 环境、交通、人流、水运；
- Viewer 的真实 replay 接入；
- 画布优先、可收起的游戏式 HUD。

## 研究后的产品护栏

- 借鉴城市语法和因果，不复制两款游戏的资产、UI、图标或音频；
- 环境对象和代码事实使用不同图例，避免错误解释；
- 静态 import 不冒充运行时调用；
- 水、船、高架和机场是条件能力，不是检查清单；
- 关闭船、人流和树木后，城市骨架仍必须成立；
- 首个垂直切片没有达到“第一眼像城市”前，不扩展设施目录。
