# 架构说明

## 路由结构

当前路由：

- `/`：首页，负责游戏发现。
- `/projects/[slug]`：玩家侧播放页。
- `/admin`：创作后台项目总览。
- `/admin?project=[slug]`：创作后台项目编辑页。

目标方向：

- 后续用 `/admin/projects/[slug]` 替代 query 参数形式的项目编辑入口。
- 迁移期间继续兼容 `/admin?project=[slug]`。

## 运行边界

首页只加载项目摘要：

- 当前页面：`src/app/page.tsx`
- 数据入口：`listProjectSummaries()`
- 数据类型：`ProjectSummary`

播放页加载一个项目并管理一次游玩状态：

- 当前页面：`src/app/projects/[slug]/page.tsx`
- UI 组件：`src/components/interactive-player.tsx`
- 运行时服务：`src/lib/playthrough-store.ts`
- 规则系统：`src/lib/story-rules.ts`

创作后台编辑项目数据：

- 路由：`src/app/admin/page.tsx`
- 项目总览：`src/components/admin-project-overview.tsx`
- 画布编辑器：`src/components/admin-canvas-editor.tsx`
- 后台 API：`src/app/api/admin/*`

存储运行时选择：

- 存在 `DATABASE_URL`：使用 PostgreSQL。
- 不存在 `DATABASE_URL`：使用本地 SQLite。

## 核心领域类型

当前领域模型文件：

- `src/lib/story-engine.ts`
- `src/lib/node-graph/*`

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

## 当前 API 分组

项目编辑：

- `/api/admin/game`
- `/api/admin/nodes`
- `/api/admin/nodes/[nodeCode]`
- `/api/admin/nodes/[nodeCode]/choices`
- `/api/admin/import`
- `/api/admin/export`
- `/api/admin/upload`

玩家运行时：

- `/api/playthroughs`
- `/api/playthroughs/[playthroughId]/node`
- `/api/playthroughs/[playthroughId]/choose`
- `/api/playthroughs/[playthroughId]/advance`
- `/api/playthroughs/[playthroughId]/result`

上传资源：

- `/api/uploads/[...path]`

## 目标模块方向

代码应逐步收敛到这些概念模块：

- `domain`：类型、校验、图结构检查、条件和动作规则。
- `services`：项目服务、游玩服务、发布服务。
- `storage`：SQLite 和 PostgreSQL 适配器，对外提供稳定接口。
- `runtime`：游玩状态流转逻辑。
- `admin`：后台编辑专用逻辑。
- `components/home`：首页发现 UI。
- `components/player`：玩家运行时 UI。
- `components/admin`：创作后台 UI。

## 稳定性规则

- 除非任务明确要求改变行为，否则重构必须保持现有行为。
- 大组件拆分时先保持原有 props 和页面行为不变。
- 存储迁移必须保证已有 SQLite 和 PostgreSQL 数据可读。
- 玩家公开路由不能依赖编辑器内部假设。
- `/api/admin/*` 可以保留到前端完成迁移后再调整。
