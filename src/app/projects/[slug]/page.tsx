import { Suspense } from "react";
import { InteractivePlayer } from "@/components/interactive-player";
import { getProject } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await getProject(slug);

  return (
    <Suspense fallback={null}>
      <InteractivePlayer projectSlug={slug} />
    </Suspense>
  );
}
