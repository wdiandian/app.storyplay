import type { StoryGame } from "@/lib/story-engine";

export const blankStorySeed: StoryGame = {
  id: "game-generic-project",
  slug: "generic-project",
  title: "未命名互动内容项目",
  tagline: "先填写基础信息，再创建第一个节点，逐步搭建完整分支结构。",
  intro:
    "这是一个空白项目。建议先确定项目名称、摘要和说明，再创建起始节点，之后继续补充节点内容、自动流转和用户选择。",
  promoVideoUrl:
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  promoPosterUrl: "",
  promoTitle: "宣传片",
  promoText: "这里可以放作品宣传视频、导语和封面说明，用户进入序章前会先看到这一页。",
  startNodeCode: "",
  nodes: [],
};
