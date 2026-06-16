import { getGame, resetGameToBlankProject, updateGameSettings } from "@/lib/game-store";
import type { VariableDefinition } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    game: await getGame(),
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    tagline?: string;
    intro?: string;
    promoVideoUrl?: string;
    promoPosterUrl?: string;
    promoText?: string;
    startNodeCode?: string;
    variables?: VariableDefinition[];
  };

  try {
    const game = await updateGameSettings(body);

    return Response.json({
      game,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update game settings",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: "reset_blank" }
    | null;

  if (body?.action !== "reset_blank") {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }

  try {
    const game = await resetGameToBlankProject();

    return Response.json({
      game,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reset blank project",
      },
      { status: 500 },
    );
  }
}
