import { serializePlaythrough } from "@/lib/api-response";
import { getGame } from "@/lib/game-store";
import { chooseBranch, chooseTimelineBranch, triggerTimelineEvent } from "@/lib/playthrough-store";
import type { StoryChoice, TimelineEvent } from "@/lib/story-engine";

export async function POST(
  request: Request,
  context: { params: Promise<{ playthroughId: string }> },
) {
  const { playthroughId } = await context.params;
  const body = (await request.json()) as {
    choiceCode?: string;
    runtimeChoice?: StoryChoice;
    sourceNodeCode?: string;
    runtimeEvent?: TimelineEvent;
  };

  if (!body.choiceCode && !body.runtimeChoice && !body.runtimeEvent) {
    return Response.json({ error: "choiceCode, runtimeChoice or runtimeEvent is required" }, { status: 400 });
  }

  try {
    const { session, node } = body.runtimeEvent
      ? await triggerTimelineEvent(playthroughId, body.runtimeEvent)
      : body.runtimeChoice
        ? await chooseTimelineBranch(playthroughId, body.runtimeChoice, body.sourceNodeCode)
        : await chooseBranch(playthroughId, body.choiceCode as string);

    return Response.json(serializePlaythrough(await getGame(), session, node));
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to choose branch",
      },
      { status: 400 },
    );
  }
}
