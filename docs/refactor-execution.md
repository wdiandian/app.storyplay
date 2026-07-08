# 重构执行清单

本文档定义接下来如何执行重构。原则是先稳定边界，再拆代码，再补能力。

## 总原则

- 先文档，后代码。
- 先拆结构，不改行为。
- 每次只处理一个明确边界。
- 每个可运行阶段都执行 `npm run build`。
- 当前阶段不主动同步仓库，除非明确要求。

## 当前阶段目标

阶段：Phase 1，结构整理。

目标：

- 保持现有页面和 API 行为不变。
- 明确首页、播放页、创作后台和基建的代码边界。
- 为后续发布流、项目版本和权限系统留下干净入口。

## Step 1：文档体系整理

状态：进行中。

任务：

- 中文化产品文档。
- 建立文档入口。
- 归档历史开发记录。
- 记录清理清单。
- 记录代码盘点。

验收：

- `README.md` 能说明项目是什么、怎么运行、看哪里。
- `docs/README.md` 能作为文档入口。
- 产品、架构、重构、清理、代码盘点文档互相不冲突。

## Step 2：创作后台画布 V2

状态：第一轮已落地。

目标文件：

- `src/components/admin-canvas-editor.tsx`

当前目标：

- 以 `GraphDocument` 作为创作后台源数据。
- 所有创作对象以节点、端口、连线表达。
- 支持节点库添加节点、React Flow 画布拖动节点、端口拖拽连线、选中节点/连线编辑属性。
- 保存时把 `GraphDocument` 编译为播放器可运行的 `StoryGame`。
- `StoryGame.authoringGraph` 保留完整后台画布，避免记录、素材、条件等创作节点刷新后丢失。

后续要补：

- 把 `AdminCanvasEditor` 继续拆成 toolbar、保存服务和节点字段编辑器。
- 增加框选和更完整的快捷键体系。
- 补齐条件、变量动作到播放器侧的编译规则。
- 增加画布级历史记录的持久化策略，避免刷新后丢失撤销栈。

已补：

- 节点库、中央画布、画布几何和共享类型已从 `AdminCanvasEditor` 拆出。
- 中央画布已切换为 `@xyflow/react` 适配层，不再继续维护自研 SVG 拖拽/缩放/平移底层。
- 右侧 inspector 已从 `AdminCanvasEditor` 拆出。
- RecordNode 已编译为 `StoryGame.records`。
- 播放页“剧情记录”已消费 `records`，按节点访问和选项历史解锁回忆、线索、回响。
- 条件节点和变量变化节点已有最小编辑能力。
- `选项 -> 条件/变量变化 -> 场景/结局` 链路已能编译为选项条件和变量动作。
- React Flow 画布已支持缩放、平移、框选、MiniMap、Controls，并把 viewport 保存到 `GraphDocument.viewport`。
- 右侧 inspector 已增加发布检查面板，错误和提醒可点击定位到对应节点或连线。
- 端口已支持拖拽连线并在输入端口松手建立连接。
- 后台已支持删除键删除选中节点/连线、Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Y 或 Ctrl/Cmd+Shift+Z 重做，并提供头部撤销/重做按钮。

验收：

- `/admin` 和 `/admin?project=[slug]` 可用。
- 节点、端口、连线是后台的一等对象。
- 保存后播放器仍读取 `StoryGame`，不需要理解后台画布。
- `npm run build` 通过。

## Step 3：播放器拆分准备

状态：待开始。

目标文件：

- `src/components/interactive-player.tsx`

准备拆出的内容：

- payload 类型。
- API 请求 helper。
- timeline payload 解析 helper。
- choice 展示状态 helper。
- scene presentation 常量。
- 信息面板、结局面板、选择面板等 UI 子组件。

第一轮不拆：

- 视频 ref 控制。
- 运行时主状态。
- 与 API 的实际交互顺序。

验收：

- `/projects/[slug]` 可用。
- 普通选择、自动跳转、时间线事件、结局行为不变。
- `npm run build` 通过。

## Step 4：领域校验 helper

状态：待开始。

目标：

- 从编辑器和分支图中抽出项目结构检查逻辑。
- 形成发布检查的基础。

建议文件：

- `src/lib/domain/project-validation.ts`
- `src/lib/domain/story-graph.ts`

初始检查项：

- 起始节点存在。
- 选择目标存在。
- 自动跳转目标存在。
- 时间线跳转目标存在。
- 时间线选择目标存在。
- 孤立节点可识别。
- 结局节点可识别。

验收：

- 后台可继续显示结构问题。
- 旧逻辑行为不变。
- `npm run build` 通过。

## Step 5：路由形态准备

状态：待开始。

目标：

- 新增 `/admin/projects/[slug]`，复用现有编辑器。
- 保留 `/admin?project=[slug]`。
- 项目总览的“进入编辑”逐步指向新路径。

验收：

- 两种编辑入口都可用。
- 不影响当前线上入口。
- `npm run build` 通过。

## 暂不处理

- 登录和权限。
- 正式发布流。
- 付费、额度、统计。
- 大规模 UI 改版。
- 数据库破坏性迁移。
- 与主站仓库合并。
