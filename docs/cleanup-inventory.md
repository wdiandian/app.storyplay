# 清理清单

本文档记录不属于当前干净项目形态的内容。

## 已在本地重新整理

历史计划和阶段性开发记录已移入 `docs/archive/`：

- `development-update-2026-06-15-to-06-16.md`
- `development-update-2026-06-editor-runtime.md`
- `editor-platform-plan.md`
- `frontend-rework-update-2026-06.md`
- `interactive-cinema-editor-next-phase.md`
- `interactive-cinema-editor-update-2026-06-16.md`
- `interactive-cinema-platform-roadmap.md`

这些文档只作为历史参考，不再作为当前规划入口。

## 已作为无关模板资源删除

create-next-app 默认 public SVG 未被应用引用，已从本地移除：

- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`

## 当前事实来源

- 项目入口：`README.md`
- 文档入口：`docs/README.md`
- 产品边界：`docs/product-overview.md`
- 架构说明：`docs/architecture.md`
- 代码盘点：`docs/code-inventory.md`
- 重构计划：`docs/refactor-plan.md`
- 重构执行清单：`docs/refactor-execution.md`
- 部署说明：`DEPLOY.md`

## 暂时保留

- `AGENTS.md`：当前 Next.js 版本相关的本地 agent 指令。
- `CLAUDE.md`：指向 `AGENTS.md`，无害，保留。
- `pnpm-lock.yaml`：来自之前本地工作，但当前部署使用 `npm ci`。
- `package-lock.json`：当前部署脚本需要。

## 后续复核

- 是否统一使用 npm，并删除 `pnpm-lock.yaml`。
- 是否完全用 `/admin/projects/[slug]` 替代 `/admin?project=[slug]`。
- 是否继续把 `AdminCanvasEditor` 中的画布推导、属性面板和 API 请求拆成独立模块。
- 播放页是否应读取发布快照，而不是可变草稿项目数据。
