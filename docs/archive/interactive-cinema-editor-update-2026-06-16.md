# StoryPlay编辑器开发更新

日期：2026-06-16

## 本轮完成

### 1. 后台补齐片段级核心操作

- 在片段编辑工作区增加了 `试玩当前片段`
- 保留并强化了 `复制片段`
- 增加了 `删除片段`

这意味着后台现在不只是“改表单”，而是开始具备真正的编辑器工作流。

### 2. 当前片段试玩链路已打通

- 前台支持通过 `/?previewNode=片段编码` 直接从指定片段开始
- 后台中的“试玩当前片段”按钮已经接到这条链路
- 在片段试玩模式下点击重开，会继续从该片段开始，而不是回到项目默认起点

这让创作者可以直接验证某一段内容，不需要每次从序章一路点过去。

### 3. 删除片段具备安全清理能力

删除片段时，系统会自动处理关联关系：

- 清理普通出口里指向该片段的目标
- 清理自动跳转里指向该片段的目标
- 清理时间线 `jump` 事件里指向该片段的目标
- 清理时间线 `show_choice` 事件中指向该片段的视频内选项
- 如果删除的是起始片段，会把起始片段回退到剩余第一个片段

同时加了一个保护：

- 如果项目只剩最后一个片段，则禁止删除

这样不会把项目删成无效结构。

### 4. 时间线编辑器继续向工具化推进

- 时间线事件卡片支持拖拽重排
- 仍保留上下移动
- 仍保留时间微调 `-0.2s / +0.2s / -1s / +1s`
- 仍保留复制事件
- 仍保留按触发时间自动排序

这一版还不是完整 NLE，但已经从“表单列表”进一步靠近“可操作时间线”。

### 5. 后台术语进一步通用化

这一轮继续清理了一批过于定制或不一致的用词，重点把：

- `场景` 逐步统一为 `片段`
- `目标场景` 统一为 `目标片段`
- 素材区、项目配置区、发布检查区的一部分文案改成更通用的平台表达

目标是让这套后台更像“StoryPlay编辑器”，而不是某个特定作品的配置页。

## 代码层改动点

主要涉及：

- [src/components/admin-story-editor.tsx](/D:/自用素材/互动游戏/StoryPlay网站/app/src/components/admin-story-editor.tsx)
- [src/components/interactive-player.tsx](/D:/自用素材/互动游戏/StoryPlay网站/app/src/components/interactive-player.tsx)
- [src/lib/game-store.ts](/D:/自用素材/互动游戏/StoryPlay网站/app/src/lib/game-store.ts)
- [src/lib/playthrough-store.ts](/D:/自用素材/互动游戏/StoryPlay网站/app/src/lib/playthrough-store.ts)
- [src/app/api/admin/nodes/[nodeCode]/route.ts](/D:/自用素材/互动游戏/StoryPlay网站/app/src/app/api/admin/nodes/[nodeCode]/route.ts)
- [src/app/api/playthroughs/route.ts](/D:/自用素材/互动游戏/StoryPlay网站/app/src/app/api/playthroughs/route.ts)
- [src/app/api/playthroughs/[playthroughId]/advance/route.ts](/D:/自用素材/互动游戏/StoryPlay网站/app/src/app/api/playthroughs/[playthroughId]/advance/route.ts)
- [src/app/page.tsx](/D:/自用素材/互动游戏/StoryPlay网站/app/src/app/page.tsx)

## 验证结果

- `npm run lint` 通过
- `npm run build` 通过

## 建议的下一阶段

优先级建议如下：

1. 片段目录编辑能力
2. 时间线可视化继续升级
3. 前台试玩模式显式化

### 1. 片段目录编辑能力

- 支持批量操作
- 支持章节手动分组
- 支持片段拖拽整理
- 支持更直观的“问题片段修复入口”

### 2. 时间线可视化继续升级

- 轨道吸附
- 更像剪辑软件的时间尺
- 事件条可视化长度
- 点击时间轨直接定位预览

### 3. 前台试玩模式显式化

- 在玩家端显示“片段试玩模式”
- 支持从后台带草稿参数直接试玩
- 支持只预览单段，不进入完整流程
