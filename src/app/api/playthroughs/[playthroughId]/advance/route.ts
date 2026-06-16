import { serializePlaythrough } from "@/lib/api-response";
import { getGame } from "@/lib/game-store";
import {
  advancePlaythrough,
  restartPlaythrough,
  restartPlaythroughFromNode,
} from "@/lib/playthrough-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ playthroughId: string }> },
) {
  const { playthroughId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { action?: "restart"; startNodeCode?: string }
    | null;

  try {
    const result =
      body?.action === "restart"
        ? body.startNodeCode?.trim()
          ? await restartPlaythroughFromNode(playthroughId, body.startNodeCode)
          : await restartPlaythrough(playthroughId)
        : await advancePlaythrough(playthroughId);

    return Response.json(
      serializePlaythrough(await getGame(), result.session, result.node),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to advance playthrough",
      },
      { status: 400 },
    );
  }
}
