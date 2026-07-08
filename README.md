# StoryPlay App

StoryPlay App 是部署在 `app.storyplay.cc` 的附属互动影游项目。

它与主站 AI 实时生成项目分开维护。本项目聚焦“手工制作的分支影游”和“创作后台”：

- 创作者在创作后台编辑游戏；
- 玩家在首页发现已展示的游戏；
- 玩家进入播放页，通过视频节点和分支选择完成一次游玩。

## 主要板块

- 首页：`/`
- 播放页：`/projects/[slug]`
- 创作后台：`/admin`
- 当前项目编辑入口：`/admin?project=[slug]`

## 本地开发

```bash
npm ci
npm run dev
```

## 验证

```bash
npm run build
```

## 部署

部署说明见 [DEPLOY.md](./DEPLOY.md)。

当前线上服务：

- 域名：`app.storyplay.cc`
- PM2 进程：`storyplay-app`
- 本机端口：`3001`
- 服务器目录：`/var/www/storyplay-app/app`

## 文档

从 [docs/README.md](./docs/README.md) 开始阅读。

