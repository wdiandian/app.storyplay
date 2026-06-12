import { AdminStoryEditor } from "@/components/admin-story-editor";
import { getGame } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <AdminStoryEditor initialGame={getGame()} />;
}
