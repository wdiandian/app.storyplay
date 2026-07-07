import { createNode, getGame } from "@/lib/game-store";
import type { EndingTone } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const projectSlug = new URL(request.url).searchParams.get("project")?.trim() || "";
  const body = (await request.json()) as {
    code?: string;
    title?: string;
    description?: string;
    transcript?: string;
    videoUrl?: string;
    nodeType?: "video" | "ending";
    autoNextNodeCode?: string | null;
    endingTone?: EndingTone | null;
  };

  try {
    const node = await createNode(projectSlug, {
      code: body.code ?? "",
      title: body.title ?? "",
      description: body.description ?? "",
      transcript: body.transcript ?? "",
      videoUrl: body.videoUrl ?? "",
      nodeType: body.nodeType ?? "video",
      autoNextNodeCode: body.autoNextNodeCode,
      endingTone: body.endingTone,
    });

    return Response.json(
      {
        game: await getGame(projectSlug),
        node,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to create node",
      },
      { status: 400 },
    );
  }
}
