import { AdminProjectOverview } from "@/components/admin-project-overview";
import { AdminCanvasEditor } from "@/components/admin-canvas-editor";
import { getGame, listProjectSummaries } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await listProjectSummaries();

  if (!params.project) {
    return <AdminProjectOverview projects={projects} />;
  }

  const initialGame = await getGame(params.project);

  return <AdminCanvasEditor initialGame={initialGame} projects={projects} />;
}
