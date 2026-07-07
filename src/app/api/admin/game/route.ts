import {
  createBlankProject,
  deleteProjectBySlug,
  getGame,
  listProjectSummaries,
  resetGameToBlankProject,
  updateGameSettings,
} from "@/lib/game-store";
import type { VariableDefinition } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

function getProjectSlug(request: Request) {
  return new URL(request.url).searchParams.get("project")?.trim() || undefined;
}

export async function GET(request: Request) {
  const projectSlug = getProjectSlug(request);

  return Response.json({
    game: await getGame(projectSlug),
    projects: await listProjectSummaries(),
  });
}

export async function PATCH(request: Request) {
  const projectSlug = getProjectSlug(request);
  const body = (await request.json()) as {
    title?: string;
    slug?: string;
    tagline?: string;
    listedOnHome?: boolean;
    sortOrder?: number;
    intro?: string;
    promoVideoUrl?: string;
    promoPosterUrl?: string;
    promoText?: string;
    startNodeCode?: string;
    variables?: VariableDefinition[];
  };

  try {
    const game = await updateGameSettings(projectSlug ?? "", body);

    return Response.json({
      game,
      projects: await listProjectSummaries(),
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
  const projectSlug = getProjectSlug(request);
  const body = (await request.json().catch(() => null)) as
    | { action?: "reset_blank" | "create_project" | "delete_project"; title?: string }
    | null;

  if (
    body?.action !== "reset_blank" &&
    body?.action !== "create_project" &&
    body?.action !== "delete_project"
  ) {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }

  try {
    if (body?.action === "delete_project") {
      const projects = await deleteProjectBySlug(projectSlug ?? "");
      const nextProject = projects[0];

      return Response.json({
        game: nextProject ? await getGame(nextProject.slug) : await getGame(),
        projects,
      });
    }

    const game =
      body?.action === "create_project"
        ? await createBlankProject({ title: body.title?.trim() || "未命名 StoryPlay 项目" })
        : await resetGameToBlankProject(projectSlug ?? "");

    return Response.json({
      game,
      projects: await listProjectSummaries(),
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
