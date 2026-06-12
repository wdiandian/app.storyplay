import type { PlaythroughState, StoryGame, StoryNode } from "@/lib/story-engine";

export function serializePlaythrough(
  game: StoryGame,
  session: PlaythroughState,
  node: StoryNode,
) {
  return {
    game: {
      id: game.id,
      slug: game.slug,
      title: game.title,
      tagline: game.tagline,
      intro: game.intro,
      promoVideoUrl: game.promoVideoUrl,
      promoPosterUrl: game.promoPosterUrl,
      promoTitle: game.promoTitle,
      promoText: game.promoText,
    },
    playthrough: {
      id: session.id,
      status: session.status,
      currentNodeCode: session.currentNodeCode,
      history: session.history,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt ?? null,
    },
    node: {
      code: node.code,
      title: node.title,
      description: node.description,
      transcript: node.transcript,
      nodeType: node.nodeType,
      videoUrl: node.videoUrl,
      posterUrl: node.posterUrl ?? null,
      autoNextNodeCode: node.autoNextNodeCode ?? null,
      isEnding: Boolean(node.isEnding),
      endingTone: node.endingTone ?? null,
      choices:
        node.choices?.map((choice) => ({
          code: choice.code,
          label: choice.label,
          hint: choice.hint,
          targetNodeCode: choice.targetNodeCode,
        })) ?? [],
    },
  };
}
