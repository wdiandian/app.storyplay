# 2026-06 开发更新

## 本轮范围

本轮按你的要求，只推进两部分：

- 阶段 1：后台编辑器可用性
- 阶段 2：规则系统落地

素材管理没有在这一轮做成完整资产库，仍然保持轻量 URL / 上传模式。

## 已完成

### 1. 后台编辑器从“预设表单”改成通用工作台

管理后台已重构为 5 个工作区：

- `项目`
- `素材`
- `流程`
- `场景`
- `选项`

这一轮重点解决了几个核心问题：

- 去掉了明显的预设剧集字段感
- 清理了主要可见乱码文案
- 空项目不再默认带“剧情树”错觉，而是先引导创建项目与首个场景
- 起始节点、宣传页、变量、场景、选项的结构关系更清晰

相关文件：

- [src/components/admin-story-editor.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/admin-story-editor.tsx)
- [src/data/sample-story.ts](/D:/自用素材/互动游戏/互动影游网站/app/src/data/sample-story.ts)

### 2. 分支图改成可用于排查结构问题

流程图现在除了展示跳转关系，还能直接提示结构风险：

- 起始节点
- 结局节点
- 孤立节点
- 缺出口节点
- 目标缺失的跳转

并且点击节点后，仍然可以直接切到场景编辑区。

相关文件：

- [src/components/branch-graph.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/branch-graph.tsx)

### 3. 规则系统已经打通到后台编辑

这轮不只是有规则模型，而是把后台配置也补上了。

现在可以在后台可视化配置：

- 节点结尾选项的 `conditions`
- 节点结尾选项的 `actions`
- 时间线事件的 `conditions`
- 时间线事件的 `actions`
- 时间线弹出选项自身的 `conditions`
- 时间线弹出选项自身的 `actions`

支持的条件操作符：

- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`
- `includes`
- `not_includes`

支持的动作类型：

- `set`
- `increment`
- `toggle`
- `append_tag`

相关文件：

- [src/lib/story-engine.ts](/D:/自用素材/互动游戏/互动影游网站/app/src/lib/story-engine.ts)
- [src/lib/story-rules.ts](/D:/自用素材/互动游戏/互动影游网站/app/src/lib/story-rules.ts)
- [src/components/admin-story-editor.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/admin-story-editor.tsx)

### 4. 前台运行时已真正消费这些规则

本轮顺手补通了前台对时间线规则的消费链路，避免出现“后台能配，前台不生效”。

当前已支持：

- 根据变量状态过滤节点选项
- 根据变量状态过滤时间线事件
- 时间线事件触发后执行动作并持久化
- 时间线中动态弹出的选项，也可携带条件和动作

相关文件：

- [src/components/interactive-player.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/interactive-player.tsx)
- [src/lib/playthrough-store.ts](/D:/自用素材/互动游戏/互动影游网站/app/src/lib/playthrough-store.ts)
- [src/app/api/playthroughs/[playthroughId]/choose/route.ts](/D:/自用素材/互动游戏/互动影游网站/app/src/app/api/playthroughs/[playthroughId]/choose/route.ts)

### 5. 玩家端体验完成第一轮升级

前台播放器不再只是“一个视频 + 一堆后台感很强的信息块”，这一轮做了第一版游戏化改造：

- 清理了玩家端主要可见乱码文案
- 宣传页、序章、主舞台、结局页的视觉结构更统一
- 选项区改成直接压在视频舞台上的沉浸式交互层
- 场景状态、变量快照、路径回声等信息重新整理
- 结局页强化了章节收束感

同时还顺手修了一处运行时稳定性问题：

- 时间线事件同步时，不再每次全量重置整个 UI
- 现在只同步 `playthrough` 状态，避免事件触发后把当前展示中的文本卡片、叠层或选择面板闪掉

相关文件：

- [src/components/interactive-player.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/interactive-player.tsx)

### 6. 玩家端体验完成第二轮打磨

在第一轮基础上，又继续做了一轮更偏“正式产品感”的整理：

- 再次清理玩家端残留乱码文案
- 选项点击时增加“已锁定”状态反馈
- 章节舞台的转场和视觉层次进一步统一
- 结局页补成更完整的结算结构，而不只是单块结尾文本
- 路径回声、变量快照、状态信息的阅读层级更清楚

这一轮没有改后台结构，仍然专注前台玩家体验。

相关文件：

- [src/components/interactive-player.tsx](/D:/自用素材/互动游戏/互动影游网站/app/src/components/interactive-player.tsx)

## 验证结果

已完成回归验证：

- `npm run lint`
- `npm run build`

两项均已通过。验证时间：2026-06-15。

## 当前状态判断

到这里，阶段 1 和阶段 2 的核心目标已经基本闭环：

- 后台不再只是某个作品的定制表单
- 已具备平台化编辑器的基础工作台形态
- 规则系统已从数据模型、存储、后台配置到前台运行时全链打通

但这还不是“成熟编辑器”，只是第一版可工作的骨架。

## 下一阶段建议

下一阶段建议按下面顺序推进：

1. 前台玩家体验升级
   前两轮已落地。下一轮重点可以继续打磨声音反馈、镜头级演出、移动端沉浸感和更强的结局回顾页。

2. 时间线编辑器继续可视化
   把更多常用事件从 `payload JSON` 中拆出来，减少手写 JSON。

3. 节点编辑进一步编辑器化
   增加批量复制节点、复制选项、快速跳转目标、节点模板等能力。

4. 轻量素材管理补第二版
   不做完整 DAM，但至少补素材缩略信息、用途标记、节点引用关系。

5. 多项目能力
   当前仍偏单项目存储结构，后续如果真要做平台，需要引入项目列表和项目切换层。
