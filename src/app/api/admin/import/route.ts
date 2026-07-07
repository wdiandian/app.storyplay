import { importGameData } from "@/lib/game-store";
import type { StoryGame } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const projectSlug = new URL(request.url).searchParams.get("project")?.trim() || "";
    const body = (await request.json()) as { game?: StoryGame };

    if (!body.game) {
      return Response.json({ error: "game is required" }, { status: 400 });
    }

    const game = await importGameData(projectSlug, body.game);

    return Response.json({
      game,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to import project",
      },
      { status: 400 },
    );
  }
}
