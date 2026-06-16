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
      promoText: game.promoText,
    },
    playthrough: {
      id: session.id,
      status: session.status,
      currentNodeCode: session.currentNodeCode,
      history: session.history,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt ?? null,
      variables: session.variables,
      triggeredEventIds: session.triggeredEventIds,
    },
    node: {
      code: node.code,
      title: node.title,
      description: node.description,
      transcript: node.transcript,
      nodeType: node.nodeType,
      videoUrl: node.videoUrl,
      autoNextNodeCode: node.autoNextNodeCode ?? null,
      isEnding: Boolean(node.isEnding),
      endingTone: node.endingTone ?? null,
      timelineEvents:
        node.timelineEvents?.map((event) => ({
          id: event.id,
          atMs: event.atMs,
          type: event.type,
          payload: event.payload,
          conditions: event.conditions ?? [],
          actions: event.actions ?? [],
        })) ?? [],
      choices:
        node.choices?.map((choice) => ({
          code: choice.code,
          label: choice.label,
          hint: choice.hint,
          targetNodeCode: choice.targetNodeCode,
          conditions: choice.conditions ?? [],
          actions: choice.actions ?? [],
        })) ?? [],
    },
  };
}
