import { getGame, updateNode } from "@/lib/game-store";
import type { EndingTone, StoryChoice } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ nodeCode: string }> },
) {
  const { nodeCode } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    transcript?: string;
    videoUrl?: string;
    nodeType?: "video" | "ending";
    autoNextNodeCode?: string | null;
    endingTone?: EndingTone | null;
    choices?: StoryChoice[];
  };

  try {
    const node = updateNode(nodeCode, body);

    return Response.json({
      game: getGame(),
      node,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to update node",
      },
      { status: 400 },
    );
  }
}
