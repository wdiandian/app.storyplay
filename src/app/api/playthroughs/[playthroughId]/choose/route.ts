import { serializePlaythrough } from "@/lib/api-response";
import { getGame } from "@/lib/game-store";
import { chooseBranch } from "@/lib/playthrough-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ playthroughId: string }> },
) {
  const { playthroughId } = await context.params;
  const body = (await request.json()) as { choiceCode?: string };

  if (!body.choiceCode) {
    return Response.json({ error: "choiceCode is required" }, { status: 400 });
  }

  try {
    const { session, node } = chooseBranch(playthroughId, body.choiceCode);

    return Response.json(serializePlaythrough(getGame(), session, node));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to choose branch",
      },
      { status: 400 },
    );
  }
}
