import { blankStorySeed } from "@/data/sample-story";
import type { ProjectSummary, StoryGame } from "@/lib/story-engine";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createProjectSeed(input?: Partial<StoryGame>): StoryGame {
  const title = input?.title?.trim() || "未命名 StoryPlay 项目";
  const baseSlug = slugify(input?.slug?.trim() || title) || `project-${Date.now().toString(36)}`;
  const id = input?.id?.trim() || `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    ...structuredClone(blankStorySeed),
    id,
    slug: baseSlug,
    title,
    listedOnHome: input?.listedOnHome ?? true,
    sortOrder: input?.sortOrder ?? 0,
    tagline: input?.tagline?.trim() || "先填写基础信息，再搭建剧情结构与片段内容。",
    intro: input?.intro?.trim() || "这是一个新的 StoryPlay 项目。先配置入口页，再创建首个片段并搭建分支。",
    promoVideoUrl: input?.promoVideoUrl?.trim() || "",
    promoPosterUrl: input?.promoPosterUrl?.trim() || "",
    promoText: input?.promoText?.trim() || "",
    startNodeCode: input?.startNodeCode?.trim() || "",
    variables: input?.variables ? structuredClone(input.variables) : [],
    nodes: input?.nodes ? structuredClone(input.nodes) : [],
  };
}

export function summarizeProject(game: StoryGame, updatedAt: string): ProjectSummary {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    tagline: game.tagline,
    listedOnHome: game.listedOnHome,
    sortOrder: game.sortOrder,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    updatedAt,
  };
}
