import { addChoice, getGame } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ nodeCode: string }> },
) {
  const { nodeCode } = await context.params;
  const projectSlug = new URL(request.url).searchParams.get("project")?.trim() || "";
  const body = (await request.json()) as {
    code?: string;
    label?: string;
    hint?: string;
    targetNodeCode?: string;
  };

  try {
    const choice = await addChoice(projectSlug, nodeCode, {
      code: body.code ?? "",
      label: body.label ?? "",
      hint: body.hint ?? "",
      targetNodeCode: body.targetNodeCode ?? "",
    });

    return Response.json(
      {
        game: await getGame(projectSlug),
        choice,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to add choice",
      },
      { status: 400 },
    );
  }
}
