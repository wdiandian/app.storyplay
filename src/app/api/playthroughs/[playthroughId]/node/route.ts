import { serializePlaythrough } from "@/lib/api-response";
import { getGame } from "@/lib/game-store";
import { getCurrentNode } from "@/lib/playthrough-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ playthroughId: string }> },
) {
  const { playthroughId } = await context.params;

  try {
    const { session, node } = getCurrentNode(playthroughId);

    return Response.json(serializePlaythrough(getGame(), session, node));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load current node",
      },
      { status: 404 },
    );
  }
}
