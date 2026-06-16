import type { StoryGame } from "@/lib/story-engine";

export const blankStorySeed: StoryGame = {
  id: "game-generic-project",
  slug: "generic-project",
  title: "未命名互动影游项目",
  tagline: "先填写基础信息，再创建首个场景，逐步搭建完整分支结构。",
  intro:
    "这是一个空白项目。建议先完善项目标题、简介和宣传信息，再创建起始场景，随后补充节点内容、自动跳转和玩家选项。",
  promoVideoUrl:
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  promoPosterUrl: "",
  promoText: "这里可以放宣传视频、导语和封面说明，玩家进入序章前会先看到这一页。",
  startNodeCode: "",
  variables: [],
  nodes: [],
};
