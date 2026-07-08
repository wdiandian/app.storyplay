# 代码盘点

本文档记录当前代码结构和重构前的主要技术债。它不是最终架构，而是后续拆分工作的依据。

## 路由

页面路由：

- `src/app/page.tsx`：首页，展示 `listedOnHome` 的项目。
- `src/app/projects/[slug]/page.tsx`：播放页，加载指定项目并渲染 `InteractivePlayer`。
- `src/app/admin/page.tsx`：创作后台；无 project 参数时展示项目总览，有 project 参数时进入编辑器。

API 路由：

- `src/app/api/admin/game/route.ts`
- `src/app/api/admin/nodes/route.ts`
- `src/app/api/admin/nodes/[nodeCode]/route.ts`
- `src/app/api/admin/nodes/[nodeCode]/choices/route.ts`
- `src/app/api/admin/import/route.ts`
- `src/app/api/admin/export/route.ts`
- `src/app/api/admin/upload/route.ts`
- `src/app/api/playthroughs/route.ts`
- `src/app/api/playthroughs/[playthroughId]/node/route.ts`
- `src/app/api/playthroughs/[playthroughId]/choose/route.ts`
- `src/app/api/playthroughs/[playthroughId]/advance/route.ts`
- `src/app/api/playthroughs/[playthroughId]/result/route.ts`
- `src/app/api/uploads/[...path]/route.ts`

## 组件

当前主要组件：

- `src/components/admin-project-overview.tsx`：项目总览，约 167 行。
- `src/components/admin-canvas-editor.tsx`：创作后台节点图编辑器容器，负责项目加载、图状态、保存、上传和主操作。
- `src/components/node-graph-editor/*`：节点图子组件和 helper，包括节点库、React Flow 画布适配层、右侧 inspector、共享配置和类型。
- `src/components/interactive-player.tsx`：播放页运行时 UI，约 1763 行。

重点技术债：

- `AdminCanvasEditor` 已切到 `GraphDocument`，并已拆出 palette、canvas、inspector、geometry、config、types；后续可继续拆 toolbar、保存服务和节点字段编辑器。
- `GraphDocument` 当前通过 `StoryGame.authoringGraph` 附带保存，后续需要独立草稿/发布版本和迁移机制。
- 记录节点已经能编译为 `StoryGame.records`，播放页“剧情记录”会按当前节点和选择历史解锁显示。
- 条件、变量动作已经支持最小编辑，并可通过 `选项 -> 条件/变量变化 -> 场景/结局` 链路编译到运行时选项。
- 画布已切换到 `@xyflow/react`，基础缩放、平移、端口拖拽连线、框选、MiniMap 和 Controls 由 React Flow 承载；右侧 inspector 已展示发布检查，并可点击问题定位节点或连线。
- 素材节点已经能在画布中表达，但还没有完整编译进播放器运行模型。
- `InteractivePlayer` 同时包含 API 请求、payload 解析、运行时事件处理、视频控制、转场状态、结局展示和信息面板。

## 领域模型

当前领域模型集中在：

- `src/lib/story-engine.ts`
- `src/lib/node-graph/types.ts`
- `src/lib/node-graph/import-story-game.ts`
- `src/lib/node-graph/compile-story-game.ts`
- `src/lib/node-graph/validate-graph.ts`

主要类型：

- `StoryGame`
- `StoryNode`
- `StoryChoice`
- `TimelineEvent`
- `VariableDefinition`
- `GraphDocument`
- `GraphNode`
- `GraphPort`
- `GraphEdge`
- `ConditionRule`
- `VariableAction`
- `PlaythroughState`
- `ProjectSummary`

当前问题：

- Project 与 Game 的边界还不够清晰。
- 草稿版本和发布版本还没有区分。
- `StoryGame.authoringGraph` 是迁移期方案，用于保留后台完整画布；正式方案应拆成创作源文件和发布运行数据。
- 首页展示状态 `listedOnHome` 只能表达“是否展示”，不能表达完整发布流。

## 业务服务

项目编辑：

- `src/lib/game-store.ts`

运行时：

- `src/lib/playthrough-store.ts`

规则系统：

- `src/lib/story-rules.ts`

项目工具：

- `src/lib/project-utils.ts`

当前问题：

- `game-store.ts` 同时承担项目查询、创建、更新、节点操作、导入导出、删除等职责。
- `playthrough-store.ts` 是较清晰的运行时服务，可作为后续 runtime service 的基础。
- 发布检查已有 UI 入口，但仍未形成独立领域服务。

## 存储

存储入口：

- `src/lib/storage.ts`

SQLite：

- `src/lib/sqlite.ts`

PostgreSQL：

- `src/lib/postgres.ts`

当前机制：

- 存在 `DATABASE_URL` 时使用 PostgreSQL。
- 否则使用本地 SQLite。

当前问题：

- 存储文件仍包含旧结构兼容逻辑，短期必须保留。
- 后续需要明确哪些是迁移兼容代码，哪些是当前正式结构。

## 上传与资源

上传 API：

- `src/app/api/admin/upload/route.ts`

资源访问：

- `src/app/api/uploads/[...path]/route.ts`

当前问题：

- 资源系统仍是轻量本地上传/URL 模式。
- 尚未形成素材库、引用关系和资源清理机制。

## 重构优先级

P0：

- 统一文档和代码边界。
- 将 `AdminCanvasEditor` 的画布推导、对象属性面板和 API 请求拆成独立模块。
- 不改行为地拆分 `InteractivePlayer`。
- 增加发布检查的领域 helper。

P1：

- 拆出 `components/admin`、`components/player`、`components/home`。
- 拆出 `lib/domain`、`lib/services`、`lib/runtime`。
- 梳理 `/admin/projects/[slug]` 路由。

P2：

- 引入发布状态和可见性字段。
- 区分草稿版本和发布版本。
- 首页只读取已发布/已展示内容。
