import Link from "next/link";
import { listProjectSummaries } from "@/lib/game-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = (await listProjectSummaries())
    .filter((project) => project.listedOnHome)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return right.sortOrder - left.sortOrder;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return (
    <main className="min-h-screen snap-y snap-mandatory overflow-y-auto bg-[#080705] text-stone-100">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/28 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group">
            <div className="text-[10px] uppercase tracking-[0.42em] text-amber-200/65">StoryPlay</div>
            <div className="mt-1 text-lg text-white transition group-hover:text-amber-100">精选作品</div>
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-amber-200/25 bg-amber-200/10 px-5 py-2.5 text-sm text-amber-100 transition hover:border-amber-200/45 hover:bg-amber-200/15"
          >
            发布游戏
          </Link>
        </div>
      </header>

      {projects.length ? (
        projects.map((project, index) => {
          const hasPromoVideo = Boolean(project.promoVideoUrl.trim());
          const poster = project.promoPosterUrl.trim();
          const fallbackStyle = poster
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(0,0,0,0.76),rgba(0,0,0,0.28) 54%,rgba(0,0,0,0.78)),url(${poster})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : {
                background:
                  "radial-gradient(circle_at_72%_18%,rgba(245,158,11,0.32),transparent_28%),linear-gradient(135deg,#160f0a_0%,#2d2119_52%,#080705_100%)",
              };

          return (
            <section
              key={project.slug}
              className="relative flex min-h-screen snap-start overflow-hidden border-b border-white/10"
              style={fallbackStyle}
            >
              {hasPromoVideo ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={project.promoVideoUrl}
                  poster={poster || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.42)_48%,rgba(0,0,0,0.78)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_68%,rgba(245,158,11,0.20),transparent_32%)]" />

              <div className="relative z-10 mx-auto flex w-full max-w-7xl items-end px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-20">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs text-amber-100">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.36em] text-stone-300/70">
                      {project.slug}
                    </span>
                  </div>
                  <h1 className="mt-6 text-5xl tracking-tight text-white sm:text-6xl lg:text-7xl">
                    {project.title || "未命名 StoryPlay"}
                  </h1>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-stone-200 sm:text-lg">
                    {project.tagline || "一部可以由玩家选择走向的 StoryPlay作品。"}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={`/projects/${encodeURIComponent(project.slug)}`}
                      className="rounded-full bg-white px-6 py-3 text-sm text-stone-950 transition hover:bg-amber-100"
                    >
                      进入作品
                    </Link>
                    <Link
                      href={`/admin?project=${encodeURIComponent(project.slug)}`}
                      className="rounded-full border border-white/18 bg-white/5 px-6 py-3 text-sm text-white transition hover:border-white/35 hover:bg-white/10"
                    >
                      管理项目
                    </Link>
                  </div>
                </div>
              </div>

              {index < projects.length - 1 ? (
                <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center text-xs uppercase tracking-[0.3em] text-white/50">
                  向下滑动
                </div>
              ) : null}
            </section>
          );
        })
      ) : (
        <section className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
            <div className="text-[11px] uppercase tracking-[0.42em] text-amber-200/65">StoryPlay</div>
            <h1 className="mt-5 text-4xl text-white">还没有展示中的项目</h1>
            <p className="mt-4 text-sm leading-7 text-stone-300">
              进入后台新建项目，并打开“首页展示”后，这里会以宣传片流的方式呈现作品。
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm text-stone-950 transition hover:bg-amber-100"
            >
              发布游戏
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
