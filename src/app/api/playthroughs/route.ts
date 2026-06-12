import { getGame } from "@/lib/game-store";
import { createPlaythrough } from "@/lib/playthrough-store";
import { serializePlaythrough } from "@/lib/api-response";

export async function POST() {
  try {
    const { session, node } = createPlaythrough();

    return Response.json(serializePlaythrough(getGame(), session, node), {
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
