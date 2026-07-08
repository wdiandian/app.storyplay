# 节点图编辑器底层架构

本文档定义 StoryPlay 创作后台的底层编辑模型。目标是把后台从“画布展示 + 属性面板”推进到真正的节点图编辑器：所有可创作对象都是节点，节点通过端口连接，最后由编译器生成播放器可运行的 `StoryGame`。

## 1. 设计结论

创作后台的底层不应该直接围绕 `StoryNode.choices` 和 `TimelineEvent` 编辑。

正确抽象应该是：

```text
GraphDocument
  ├─ GraphNode[]
  ├─ GraphEdge[]
  └─ GraphMeta

GraphDocument -> compile -> StoryGame
StoryGame -> import -> GraphDocument
```

其中：

- `GraphDocument` 是创作源文件。
- `StoryGame` 是播放器运行数据。
- 画布编辑器只理解节点、端口、边和属性。
- 播放器不需要理解创作画布。

当前实现状态：

- `src/lib/node-graph/*` 已定义图模型、默认端口、导入、编译和校验。
- `src/components/admin-canvas-editor.tsx` 已改为读取和编辑 `GraphDocument`。
- 后台保存时会把图文档编译为 `StoryGame`，并把完整图文档保存到 `StoryGame.authoringGraph`。
- 这是迁移期持久化方案，后续仍应拆出独立草稿图文档和发布运行数据。

## 2. 核心类型

### 2.1 GraphDocument

```ts
type GraphDocument = {
  id: string;
  projectSlug: string;
  title: string;
  version: number;
  viewport?: GraphViewport;
  nodes: GraphNode[];
  edges: GraphEdge[];
  variables: GraphVariable[];
  createdAt: string;
  updatedAt: string;
};
```

字段说明：

- `id`：图文档 ID。
- `projectSlug`：对应现有项目。
- `version`：图模型版本，便于后续迁移。
- `viewport`：用户上次编辑的位置、缩放。
- `nodes`：画布节点。
- `edges`：端口连线。
- `variables`：全局变量定义。

### 2.2 GraphNode

```ts
type GraphNode = {
  id: string;
  type: GraphNodeType;
  title: string;
  position: GraphPosition;
  size?: GraphSize;
  ports: GraphPort[];
  data: GraphNodeData;
};
```

节点设计原则：

- 节点是画布上的主要对象。
- 节点本身只持有自己的配置。
- 节点之间不能直接引用对方，必须通过 `GraphEdge` 连接。
- 节点的连接能力由 `ports` 决定。

### 2.3 GraphPort

```ts
type GraphPort = {
  id: string;
  nodeId: string;
  key: string;
  direction: "input" | "output";
  kind: GraphPortKind;
  label: string;
  accepts?: GraphPortKind[];
  multiple?: boolean;
  required?: boolean;
};
```

端口设计原则：

- 端口是连接的唯一入口。
- 连线必须从 output port 到 input port。
- `kind` 决定能否连接，例如剧情流、素材、记录解锁。
- `multiple` 决定一个端口是否允许多条边。

### 2.4 GraphEdge

```ts
type GraphEdge = {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  type: GraphEdgeType;
  label?: string;
  conditions?: ConditionRule[];
  actions?: VariableAction[];
};
```

边设计原则：

- 边表达“关系”，不是节点内部字段。
- 条件和变量动作优先挂在边上，而不是塞进节点。
- 选中边时，右侧属性面板编辑边的条件、动作和玩家侧文案。

## 3. 枚举定义

```ts
type GraphNodeType =
  | "start"
  | "scene"
  | "choice"
  | "option"
  | "condition"
  | "set_variable"
  | "record"
  | "ending"
  | "asset"
  | "timeline";

type GraphPortKind =
  | "flow"
  | "choice"
  | "condition"
  | "record"
  | "asset"
  | "timeline";

type GraphEdgeType =
  | "flow"
  | "choice"
  | "condition_true"
  | "condition_false"
  | "unlock_record"
  | "use_asset"
  | "timeline_event";
```

## 4. 节点类型

### 4.1 StartNode

用途：作品开始。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `out` | output | flow | 进入第一个场景 |

数据：

```ts
type StartNodeData = {
  title: string;
  intro?: string;
};
```

规则：

- 一个项目只能有一个 StartNode。
- `out` 必须连接到 `SceneNode.in` 或 `ConditionNode.in`。

### 4.2 SceneNode

用途：一段视频或一场戏。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | flow | 剧情进入 |
| `asset` | input | asset | 绑定视频素材 |
| `finished` | output | flow | 播放结束后的自然流向 |
| `choice` | output | choice | 进入选择组 |
| `unlock` | output | record | 解锁记录 |
| `timeline` | output | timeline | 场景内时间点 |

数据：

```ts
type SceneNodeData = {
  sceneCode: string;
  title: string;
  description?: string;
  transcript?: string;
  videoUrl?: string;
  memory?: MemoryConfig;
};
```

规则：

- `in` 可以接多个入口，表示多个剧情路径进入同一场景。
- `finished` 最多一条边。
- `choice` 可以连接一个或多个 ChoiceNode。
- `unlock` 可以连接多个 RecordNode。

### 4.3 ChoiceNode

用途：一组选项，表示某个选择时刻。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | choice | 来自场景或时间线 |
| `option_*` | output | choice | 动态选项端口 |

数据：

```ts
type ChoiceNodeData = {
  title?: string;
  prompt?: string;
  pausePlayback?: boolean;
  displayMode?: "overlay" | "bottom_sheet" | "full_screen";
};
```

规则：

- ChoiceNode 只表达“选择发生”。
- 单个选项不要塞在 ChoiceNode 内部，应该由 OptionNode 表达。
- 新增选项 = 新增 OptionNode 或动态创建 `option_*` 端口并连接到 OptionNode。

### 4.4 OptionNode

用途：单个玩家选项。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | choice | 来自 ChoiceNode |
| `out` | output | flow | 选中后进入下一对象 |
| `echo` | output | record | 选中后产生回响 |

数据：

```ts
type OptionNodeData = {
  code: string;
  label: string;
  hint?: string;
};
```

规则：

- OptionNode 必须从 ChoiceNode 进入。
- `out` 可以连接 SceneNode、ConditionNode、SetVariableNode 或 EndingNode。
- 条件和变量动作优先挂在 OptionNode 的输出边上。

### 4.5 ConditionNode

用途：根据变量或记录状态分流。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | flow | 进入判断 |
| `true` | output | flow | 条件成立 |
| `false` | output | flow | 条件不成立 |

数据：

```ts
type ConditionNodeData = {
  conditions: ConditionRule[];
  matchMode: "all" | "any";
};
```

规则：

- 条件节点不展示给玩家。
- `true` 和 `false` 最多各一条边。

### 4.6 SetVariableNode

用途：改变变量或状态。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | flow | 进入变量操作 |
| `out` | output | flow | 操作完成后继续 |

数据：

```ts
type SetVariableNodeData = {
  actions: VariableAction[];
};
```

规则：

- SetVariableNode 不展示给玩家。
- 可用于把复杂后果从 OptionNode 中拆出来。

### 4.7 RecordNode

用途：回忆、线索、回响。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `unlock` | input | record | 被场景、选择、时间线解锁 |
| `out` | output | flow | 可选，解锁后继续剧情流 |

数据：

```ts
type RecordNodeData = {
  recordType: "memory" | "clue" | "echo";
  title: string;
  body: string;
  lockedLabel?: string;
  visibleWhenLocked?: boolean;
};
```

规则：

- RecordNode 是玩家剧情记录的来源。
- 回忆可以由 SceneNode 自动生成，也可以手动覆盖。
- 线索和回响应优先显式建 RecordNode。

### 4.8 EndingNode

用途：结局。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | flow | 进入结局 |
| `unlock` | output | record | 结局解锁记录 |

数据：

```ts
type EndingNodeData = {
  code: string;
  title: string;
  description?: string;
  videoUrl?: string;
  endingTone: EndingTone;
};
```

规则：

- EndingNode 没有主要剧情出口。
- 可以解锁回忆、线索或回响。

### 4.9 AssetNode

用途：素材库中的视频、图片、音频。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `asset` | output | asset | 供场景或结局使用 |

数据：

```ts
type AssetNodeData = {
  assetType: "video" | "image" | "audio" | "subtitle";
  url: string;
  filename?: string;
  durationMs?: number;
};
```

规则：

- SceneNode 不直接维护素材文件时，应通过 AssetNode 引用。
- 第一阶段可以保留 `SceneNodeData.videoUrl`，后续再迁移到 AssetNode。

### 4.10 TimelineNode

用途：场景内某个时间点发生的事件。

端口：

| key | direction | kind | 说明 |
| --- | --- | --- | --- |
| `in` | input | timeline | 来自 SceneNode.timeline |
| `choice` | output | choice | 时间点触发选择 |
| `unlock` | output | record | 时间点解锁记录 |
| `jump` | output | flow | 时间点跳转 |

数据：

```ts
type TimelineNodeData = {
  atMs: number;
  eventType: "text" | "overlay" | "pause" | "choice" | "unlock_record" | "jump" | "actions";
  text?: string;
  pausePlayback?: boolean;
};
```

规则：

- TimelineNode 附属于某个 SceneNode。
- 可以在主画布上折叠显示，也可以进入场景子画布编辑。

## 5. 连接校验规则

基础规则：

1. output port 只能连接 input port。
2. `kind` 必须兼容。
3. `required` 端口在发布前必须有连接。
4. `multiple: false` 的端口最多一条边。
5. 禁止形成无法编译的死循环；允许剧情循环，但必须显式标记。

推荐兼容表：

| from kind | to kind | 是否允许 |
| --- | --- | --- |
| flow | flow | 允许 |
| choice | choice | 允许 |
| choice | flow | 通过 OptionNode 允许 |
| record | record | 允许 |
| asset | asset | 允许 |
| timeline | timeline | 允许 |
| timeline | choice | 允许 |
| timeline | record | 允许 |

## 6. 从 StoryGame 生成 GraphDocument

这是迁移期的反向导入。

规则：

1. `StoryGame` 生成一个 StartNode。
2. 每个 `StoryNode.nodeType === "video"` 生成一个 SceneNode。
3. 每个 `StoryNode.isEnding` 或 `nodeType === "ending"` 生成一个 EndingNode。
4. `startNodeCode` 生成 StartNode.out 到目标节点 in 的边。
5. `autoNextNodeCode` 生成 SceneNode.finished 到目标节点 in 的边。
6. 每组 `choices` 生成一个 ChoiceNode。
7. 每个 `StoryChoice` 生成一个 OptionNode。
8. ChoiceNode 连接到 OptionNode，OptionNode 连接到目标节点。
9. `timelineEvents` 生成 TimelineNode。
10. 节点描述可临时生成 Memory RecordNode。
11. choice hint 或 actions 可临时生成 Echo RecordNode。

示例：

```text
StoryNode A
  choices:
    - 去楼梯 -> B
    - 进电梯 -> C

生成：

SceneNode(A)
  -> ChoiceNode(A.choice_group)
      -> OptionNode(go_stairs) -> SceneNode(B)
      -> OptionNode(take_elevator) -> SceneNode(C)
```

## 7. GraphDocument 编译成 StoryGame

编译器职责：

1. 从 StartNode 找到第一条 flow 边，得到 `startNodeCode`。
2. SceneNode 和 EndingNode 编译成 `StoryNode`。
3. SceneNode.finished 的 flow 边编译成 `autoNextNodeCode`。
4. SceneNode 或 TimelineNode 连接的 ChoiceNode / OptionNode 编译成 `choices` 或 `timelineEvents.show_choice`。
5. ConditionNode 编译成 choice conditions 或 timeline conditions。
6. SetVariableNode 编译成 actions。
7. RecordNode 编译成 `StoryGame.records`，播放页剧情记录按节点访问和选择历史解锁。

当前编译限制：

- StartNode、SceneNode、ChoiceNode、OptionNode、EndingNode 已进入 `StoryGame` 编译链路。
- TimelineNode 会保留从旧运行数据导入的原始 `TimelineEvent`，新建时间点的完整编译仍待补齐。
- RecordNode 已写入 `StoryGame.records` 并被播放页剧情记录消费。
- AssetNode、ConditionNode、SetVariableNode 已作为画布节点保存到 `authoringGraph`，但暂不完整写入播放器运行模型。
- 播放器仍只读取 `StoryGame`，不直接读取 `GraphDocument`。

## 8. 第一版 UI 结构

### 8.1 左侧节点库

节点库不是项目菜单。

包含：

- 开始
- 场景
- 选择组
- 选项
- 条件
- 变量操作
- 记录
- 结局
- 素材
- 时间点

交互：

- 点击添加到画布。
- 后续支持拖拽添加。

### 8.2 中央画布

画布必须支持：

- 节点卡片。
- 节点端口。
- 端口拖线。
- 选中节点。
- 选中边。
- 删除节点。
- 删除边。
- 缩放和平移。

画布交互层已切换为 `@xyflow/react`：节点拖动、端口拖拽连线、缩放、平移、框选、MiniMap、Controls 由成熟画布库承载。StoryPlay 自己保留 `GraphDocument`、端口兼容规则、编译器、校验器和右侧属性面板。后续重点转向节点类型设计、复制粘贴、快捷键体系和发布时间轴能力。

### 8.3 右侧属性面板

右侧只编辑选中对象的属性：

- 选中节点：编辑节点 data。
- 选中端口：查看端口规则。
- 选中边：编辑条件、动作、文案。
- 未选中：显示图文档检查。

右侧不承担结构组织。

### 8.4 场景子画布 / 时间轴

选中 SceneNode 时可以打开二级编辑区：

- 视频时间轴。
- TimelineNode 标记。
- 时间点选择。
- 时间点解锁记录。
- 时间点变量动作。

第一版可以先折叠为“场景内事件”列表，后续再做真正时间轴。

## 9. 文件拆分建议

建议新增：

```text
src/lib/node-graph/types.ts
src/lib/node-graph/defaults.ts
src/lib/node-graph/import-story-game.ts
src/lib/node-graph/compile-story-game.ts
src/lib/node-graph/validate-graph.ts
src/components/node-graph-editor.tsx
src/components/node-graph-canvas.tsx
src/components/node-graph-node.tsx
src/components/node-graph-inspector.tsx
src/components/node-graph-palette.tsx
```

当前 `AdminCanvasEditor` 已承载节点图编辑器第一版，但仍应该被视为需要拆分的过渡实现。下一步应迁移到上述结构，降低单文件复杂度。

## 10. 实施路线

### 阶段 A：纯前端节点图模型

- 定义 `GraphDocument` 类型。
- 用现有 `StoryGame` 生成 GraphDocument。
- 画布显示节点、端口和边。
- 状态：已完成。

### 阶段 B：端口连线编辑

- 支持从 output port 拖到 input port。
- 支持删除边。
- 支持添加节点。
- 支持基础校验。
- 状态：已完成点击式连线，拖拽式连线待补。

### 阶段 C：编译保存

- GraphDocument 编译回 StoryGame。
- 保存调用现有 `/api/admin/import` 覆盖当前项目运行数据。
- 保证播放器不受影响。
- 状态：已完成第一版。

### 阶段 D：持久化 GraphDocument

- 迁移期通过 `StoryGame.authoringGraph` 保存图文档。
- 后端新增图文档存储。
- 发布时编译 StoryGame。
- 播放器读取发布后的运行数据。
- 状态：迁移期已完成，正式草稿/发布分离待补。

## 11. 当前判断

下一步不应继续堆叠单文件 `AdminCanvasEditor`。

应该做：

1. 拆分 `AdminCanvasEditor` 为节点图子组件。
2. 完善 ConditionNode、SetVariableNode 的编译规则。
3. 继续细化播放页“剧情记录”的树状展示和解锁动效。
4. 在 React Flow 适配层上增加复制粘贴和更完整的快捷键体系。

只有底层图模型正确，后续界面才不会再次退化成表单后台。
