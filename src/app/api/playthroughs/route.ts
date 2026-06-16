import { getGame } from "@/lib/game-store";
import { createPlaythrough, createPlaythroughFromNode } from "@/lib/playthrough-store";
import { serializePlaythrough } from "@/lib/api-response";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { startNodeCode?: string }
    | null;

  try {
    const { session, node } = body?.startNodeCode?.trim()
      ? await createPlaythroughFromNode(body.startNodeCode)
      : await createPlaythrough();

    return Response.json(serializePlaythrough(await getGame(), session, node), {
      status: 201,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to create playthrough",
      },
      { status: 400 },
    );
  }
}
