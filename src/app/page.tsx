import Link from "next/link";
import { listProjectSummaries } from "@/lib/game-store";
import type { ProjectSummary } from "@/lib/story-engine";

export const dynamic = "force-dynamic";

function getProjectMedia(project: ProjectSummary) {
  const video = project.promoVideoUrl.trim();
  const poster = project.promoPosterUrl.trim();

  return {
    video,
    poster,
    hasVideo: Boolean(video),
    hasPoster: Boolean(poster),
  };
}

function formatUpdatedAt(value: string) {
  if (!value) {
    return "最近更新";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "最近更新";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ProjectMedia({
  project,
  className,
  priority = false,
}: {
  project: ProjectSummary;
  className: string;
  priority?: boolean;
}) {
  const media = getProjectMedia(project);

  if (media.hasVideo) {
    return (
      <video
        className={className}
        src={media.video}
        poster={media.poster || undefined}
        autoPlay={priority}
        muted
        loop
        playsInline
        preload={priority ? "auto" : "metadata"}
      />
    );
  }

  if (media.hasPoster) {
    return <img className={className} src={media.poster} alt="" />;
  }

  return (
    <div
      className={`${className} bg-[linear-gradient(135deg,#24211d_0%,#4a332c_46%,#101010_100%)]`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_24%,rgba(224,68,46,0.38),transparent_34%)]" />
      <div className="absolute bottom-8 left-8 right-8 text-xs uppercase tracking-[0.32em] text-white/45">
        StoryPlay
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: ProjectSummary; index: number }) {
  return (
    <article className="group overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md">
      <Link href={`/projects/${encodeURIComponent(project.slug)}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-stone-900">
          <ProjectMedia
            project={project}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.44))]" />
          <div className="absolute left-3 top-3 rounded-md border border-white/18 bg-black/38 px-2.5 py-1 text-xs text-white backdrop-blur">
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
            <span className="truncate">{project.slug}</span>
            <span className="shrink-0">{formatUpdatedAt(project.updatedAt)}</span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-stone-950">
            {project.title || "未命名 StoryPlay"}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-[3rem] text-sm leading-6 text-stone-600">
            {project.tagline || "一部可以由玩家选择走向的互动影游作品。"}
          </p>
          <div className="mt-4 inline-flex items-center rounded-md bg-stone-950 px-3 py-2 text-sm text-white transition group-hover:bg-[#e0442e]">
            进入作品
          </div>
        </div>
      </Link>
    </article>
  );
}

export default async function Home() {
  const projects = (await listProjectSummaries())
    .filter((project) => project.listedOnHome)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return right.sortOrder - left.sortOrder;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
  const featuredProject = projects[0];
  const otherProjects = projects.slice(1);
  const listedProjects = otherProjects.length ? otherProjects : projects;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-stone-950">
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#f7f4ef]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group min-w-0">
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#e0442e]">StoryPlay</div>
            <div className="mt-1 truncate text-base font-semibold text-stone-950 transition group-hover:text-[#c93422]">
              互动影游
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="#games"
              className="hidden rounded-md px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-200/70 hover:text-stone-950 sm:inline-flex"
            >
              发现作品
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
            >
              创作后台
            </Link>
          </nav>
        </div>
      </header>

      {featuredProject ? (
        <>
          <section className="relative min-h-[78svh] overflow-hidden bg-stone-950 text-white">
            <ProjectMedia
              project={featuredProject}
              className="absolute inset-0 h-full w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.48)_46%,rgba(0,0,0,0.18)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.72))]" />

            <div className="relative z-10 mx-auto flex min-h-[78svh] max-w-7xl items-end px-4 pb-12 pt-24 sm:px-6 lg:px-8">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[#e0442e] px-3 py-1.5 text-xs font-medium text-white">
                    本期精选
                  </span>
                  <span className="text-xs uppercase tracking-[0.24em] text-white/68">
                    {featuredProject.slug}
                  </span>
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  {featuredProject.title || "未命名 StoryPlay"}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-stone-100 sm:text-lg">
                  {featuredProject.tagline || "一部可以由玩家选择走向的互动影游作品。"}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/projects/${encodeURIComponent(featuredProject.slug)}`}
                    className="rounded-md bg-white px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-[#fff0eb]"
                  >
                    开始游玩
                  </Link>
                  <Link
                    href="#games"
                    className="rounded-md border border-white/22 bg-white/8 px-5 py-3 text-sm text-white backdrop-blur transition hover:border-white/42 hover:bg-white/14"
                  >
                    浏览作品
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section id="games" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#e0442e]">Discover</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950 sm:text-3xl">发现互动影游</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-stone-600">
                选择一个作品进入播放页，根据剧情节点和分支选择推进故事。
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listedProjects.map((project, index) => (
                <ProjectCard key={project.slug} project={project} index={index} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="mx-auto flex min-h-[calc(100svh-73px)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-[#e0442e]">StoryPlay</div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-stone-950 sm:text-5xl">
              还没有展示中的项目
            </h1>
            <p className="mt-5 text-base leading-8 text-stone-600">
              进入创作后台新建项目，并打开首页展示后，这里会展示可游玩的互动影游作品。
            </p>
            <Link
              href="/admin"
              className="mt-7 inline-flex rounded-md bg-stone-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-[#e0442e]"
            >
              进入创作后台
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
