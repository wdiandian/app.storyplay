import { getGame } from "@/lib/game-store";
import { getCurrentNode } from "@/lib/playthrough-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ playthroughId: string }> },
) {
  const { playthroughId } = await context.params;

  try {
    const { session, node } = await getCurrentNode(playthroughId);
    const game = await getGame(session.gameSlug);

    if (!node.isEnding) {
      return Response.json(
        {
          error: "Current node is not an ending",
        },
        { status: 409 },
      );
    }

    return Response.json({
      game: {
        title: game.title,
      },
      result: {
        endingCode: node.code,
        endingTitle: node.title,
        endingTone: node.endingTone ?? null,
        description: node.description,
        transcript: node.transcript,
      },
      playthrough: {
        id: session.id,
        history: session.history,
        finishedAt: session.finishedAt ?? null,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to load result",
      },
      { status: 404 },
    );
  }
}
