import { deleteNodeByCode, getGame, updateNodeDetails } from "@/lib/game-store";
import type {
  ConditionRule,
  EndingTone,
  StoryChoice,
  TimelineEvent,
  VariableAction,
} from "@/lib/story-engine";

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
    choices?: Array<StoryChoice & { conditions?: ConditionRule[]; actions?: VariableAction[] }>;
    timelineEvents?: Array<TimelineEvent & { conditions?: ConditionRule[]; actions?: VariableAction[] }>;
  };

  try {
    const node = await updateNodeDetails(nodeCode, body);

    return Response.json({
      game: await getGame(),
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ nodeCode: string }> },
) {
  const { nodeCode } = await context.params;

  try {
    const game = await deleteNodeByCode(nodeCode);

    return Response.json({
      game,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete node",
      },
      { status: 400 },
    );
  }
}
