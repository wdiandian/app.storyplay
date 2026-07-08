# 重构计划

## 1. 产品边界

本项目是附属的 StoryPlay App，与主站 AI 实时生成项目分开维护。

核心产品闭环：

1. 创作者在创作后台编辑游戏。
2. 玩家在首页发现游戏。
3. 玩家进入播放页游玩指定游戏。

项目按四个板块组织：

- 首页：游戏发现。
- 播放页：游戏运行时和玩家体验。
- 创作后台：游戏编辑和发布。
- 基建：数据模型、API、存储、上传、部署、校验和未来权限。

## 2. 当前路由

已实现路由：

- `/`：首页，展示 `listedOnHome` 的项目。
- `/projects/[slug]`：播放页，启动指定项目的播放器。
- `/admin`：创作后台项目总览。
- `/admin?project=[slug]`：指定项目的编辑器。

目标路由方向：

- `/`：公开游戏发现。
- `/projects/[slug]`：公开播放页。
- `/admin`：创作后台项目总览。
- `/admin/projects/[slug]`：项目编辑器。

迁移期间保留 `/admin?project=[slug]` 兼容。

## 3. 首页

职责：

- 展示可玩或已发布游戏。
- 呈现标题、简介、海报、宣传视频和进入操作。
- 弱化创作者/管理入口。

首页只使用项目摘要数据，不加载完整游戏图。

当前来源：

- `src/app/page.tsx`
- `listProjectSummaries()`
- `ProjectSummary`

后续可考虑字段：

- `visibility`：`public | unlisted | private`
- `publishStatus`：`draft | published`
- `category`
- `tags`
- `coverUrl`
- `publishedAt`
- `playCount`

## 4. 播放页

职责：

- 按 slug 加载一个游戏。
- 创建或恢复游玩状态。
- 渲染当前节点。
- 处理选择、自动跳转、时间线事件、条件、动作和结局。
- 为玩家提供可理解的错误状态。

当前来源：

- `src/app/projects/[slug]/page.tsx`
- `src/components/interactive-player.tsx`
- `src/lib/playthrough-store.ts`
- `src/lib/story-rules.ts`

重要边界：

- 玩家后续应游玩“已发布版本”，而不是实时变化的草稿。
- 创作者预览可以继续使用草稿数据。

## 5. 创作后台

职责：

- 管理项目。
- 编辑项目设置和展示信息。
- 编辑节点、分支、变量、条件、时间线事件和结局。
- 导入/导出项目。
- 在项目展示到首页前做发布检查。

当前来源：

- `src/app/admin/page.tsx`
- `src/components/admin-project-overview.tsx`
- `src/components/admin-canvas-editor.tsx`
- `src/app/api/admin/*`

目标组件拆分：

- `components/admin/project-overview.tsx`
- `components/admin/project-settings-panel.tsx`
- `components/admin/node-list-panel.tsx`
- `components/admin/node-editor-panel.tsx`
- `components/admin/choice-editor.tsx`
- `components/admin/timeline-editor.tsx`
- `components/admin/variable-editor.tsx`
- `components/admin/publish-checklist.tsx`
- `components/admin/import-export-panel.tsx`

发布检查应包括：

- 存在起始节点。
- 每个选择目标都存在。
- 每个自动跳转目标都存在。
- 结局节点完整。
- 必要的视频 URL 或媒体资源存在。
- 条件引用的变量存在。
- 时间线事件 payload 合法。
- 孤立节点在发布前对创作者可见。

## 6. 基建

当前来源：

- `src/lib/story-engine.ts`：领域类型。
- `src/lib/game-store.ts`：项目编辑操作。
- `src/lib/playthrough-store.ts`：运行时操作。
- `src/lib/storage.ts`：存储适配选择。
- `src/lib/sqlite.ts`：本地 SQLite 存储。
- `src/lib/postgres.ts`：PostgreSQL 存储。
- `src/app/api/*`：API 路由。

目标方向：

- `lib/domain`：类型、校验、图检查、规则计算。
- `lib/services`：项目服务、游玩服务、发布服务。
- `lib/storage`：SQLite/PostgreSQL 适配器。
- `lib/runtime`：运行时状态流转。
- `lib/admin`：后台编辑专用逻辑。

API 方向：

- `/api/projects`
- `/api/projects/[slug]`
- `/api/projects/[slug]/nodes`
- `/api/projects/[slug]/publish`
- `/api/playthroughs`
- `/api/uploads`

当前先保留 `/api/admin/*`，直到前端迁移完成。

## 7. 重构阶段

### Phase 1：只整理结构，不改行为

- 建立更清晰的 admin、runtime、domain、storage 目录。
- 拆分大组件，但保持 UI 行为不变。
- 保持现有路由可用。
- 每个有意义的步骤后运行 `npm run build`。

### Phase 2：数据模型清理

- 明确 Project/Game/Node/Choice/Playthrough 的职责。
- 增加校验 helper。
- 为发布状态和可见性预留字段。
- 保持已有存储数据兼容。

### Phase 3：创作后台拆分

- 把 `AdminCanvasEditor` 拆成画布层、对象属性面板、数据适配器和 API action。
- 把编辑器 helper 从组件中移出。
- 增加项目健康检查/发布清单。
- 优化项目总览和项目切换。

### Phase 4：播放页稳定化

- 从 `InteractivePlayer` 抽出运行时状态流转逻辑。
- 标准化运行时 API payload。
- 改善空项目、缺失节点、缺失视频和结局状态。
- 明确预览模式。

### Phase 5：首页产品化

- 首页只展示已发布/已上架项目。
- 增加分类、标签、排序和空状态。
- 保持首页不依赖编辑器内部数据。

## 8. 立即下一步

从 Phase 1 开始。

先不改变行为，只拆结构和明确边界，同时保留：

- `/`
- `/projects/[slug]`
- `/admin`
- `/admin?project=[slug]`
- 现有 API 路由
- 当前 SQLite/PostgreSQL 存储行为
