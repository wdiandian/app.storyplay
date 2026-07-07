import { exportGameData } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const projectSlug = new URL(request.url).searchParams.get("project")?.trim() || "";
    const game = await exportGameData(projectSlug);

    return new Response(JSON.stringify({ game }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="storyplay-export-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to export project",
      },
      { status: 500 },
    );
  }
}
