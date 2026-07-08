# StoryPlay App 文档

这里是当前项目重构和维护的工作文档入口。

## 当前有效文档

- [产品概览](./product-overview.md)：产品边界、用户角色和核心流程。
- [系统设计](./system-design.md)：三大页面、数据模型、发布流和技术模块的整体设计。
- [UI 设计规范](./ui-design-guidelines.md)：首页、播放页、创作后台的视觉方向、组件规则和响应式原则。
- [页面改造 Roadmap](./page-redesign-roadmap.md)：首页优先的页面改造阶段计划。
- [播放页与创作后台改造方案](./play-admin-redesign-plan.md)：播放页沉浸感和后台画布化的分析与方案。
- [创作后台画布 V2 方案](./creator-canvas-v2-plan.md)：当前主方案，定义导演台、画布对象、属性面板和创作模型演进。
- [节点图编辑器底层架构](./node-graph-editor-architecture.md)：当前技术主方案，定义 GraphDocument、节点、端口、连线和编译关系。
- [创作后台画布设计](./creator-canvas-design.md)：后台画布工作流和回忆、线索、回响编辑体系。
- [架构说明](./architecture.md)：路由、模块、数据、API 和存储边界。
- [代码盘点](./code-inventory.md)：当前路由、组件、API、数据层和主要技术债。
- [重构计划](./refactor-plan.md)：阶段性重构方向。
- [重构执行清单](./refactor-execution.md)：下一步如何执行、每步验收标准。
- [清理清单](./cleanup-inventory.md)：保留、归档、删除和待复核的内容。

## 历史归档

历史计划和阶段性开发记录放在 [archive](./archive/)。

归档文档只作为背景材料保留。除非当前有效文档明确引用，否则不要把归档内容当作当前计划或当前事实。

## 文档规则

- 产品文档统一使用中文。
- 当前文档描述“接下来要维护的系统形态”。
- 阶段性记录、旧方案、临时总结放入 `docs/archive/`。
- 部署命令放在根目录 `DEPLOY.md`。
- 不在多份文档中重复大段实现细节；需要引用时链接到负责该主题的文档。
