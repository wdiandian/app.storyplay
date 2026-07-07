import { AdminProjectOverview } from "@/components/admin-project-overview";
import { AdminStoryEditor } from "@/components/admin-story-editor";
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

  return <AdminStoryEditor initialGame={initialGame} projects={projects} />;
}
