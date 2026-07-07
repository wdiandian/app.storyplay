"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectSummary } from "@/lib/story-engine";

type AdminProjectOverviewProps = {
  projects: ProjectSummary[];
};

async function requestCreateProject() {
  const response = await fetch("/api/admin/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create_project",
      title: "未命名 StoryPlay 项目",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { game?: { slug?: string }; error?: string }
    | null;

  if (!response.ok || !payload?.game?.slug) {
    throw new Error(payload?.error ?? "创建项目失败");
  }

  return payload.game.slug;
}

export function AdminProjectOverview({ projects }: AdminProjectOverviewProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderedProjects = [...projects].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return right.sortOrder - left.sortOrder;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  async function createProject() {
    setCreating(true);
    setError(null);

    try {
      const slug = await requestCreateProject();
      router.push(`/admin?project=${encodeURIComponent(slug)}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建项目失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(245,158,11,0.16),transparent_34%),linear-gradient(180deg,#f7f1e6_0%,#eee5d8_100%)] text-stone-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-stone-900/10 bg-white/76 p-6 shadow-[0_24px_90px_rgba(52,38,25,0.10)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.42em] text-amber-800">StoryPlay Studio</div>
            <h1 className="mt-4 text-4xl tracking-tight text-stone-950 sm:text-5xl">项目总览</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-700">
              先选择一个 StoryPlay 项目，再进入具体编辑器。项目配置、剧情树、片段和发布检查不再挤在入口页里。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-stone-950 px-5 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
              onClick={() => void createProject()}
              disabled={creating}
            >
              {creating ? "创建中..." : "新建项目"}
            </button>
            <Link
              href="/"
              className="rounded-full border border-stone-900/10 bg-white/60 px-5 py-3 text-sm text-stone-800 transition hover:border-stone-900/30"
            >
              查看前台
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {orderedProjects.map((project) => {
            const coverStyle = project.promoPosterUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.58)),url(${project.promoPosterUrl})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }
              : {
                  background:
                    "linear-gradient(135deg,rgba(245,158,11,0.24),rgba(68,64,60,0.74)),radial-gradient(circle_at_top_right,rgba(255,255,255,0.42),transparent_36%)",
                };

            return (
              <article
                key={project.slug}
                className="overflow-hidden rounded-[1.75rem] border border-stone-900/10 bg-white shadow-[0_18px_60px_rgba(52,38,25,0.08)]"
              >
                <div className="flex min-h-[260px] flex-col justify-end p-5 text-white" style={coverStyle}>
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/70">{project.slug}</div>
                  <h2 className="mt-3 line-clamp-2 text-2xl">{project.title || "未命名项目"}</h2>
                  <p className="mt-3 line-clamp-2 text-sm leading-7 text-white/78">
                    {project.tagline || "还没有填写一句话介绍。"}
                  </p>
                </div>

                <div className="grid gap-4 p-5">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-3 py-1 ${
                        project.listedOnHome ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {project.listedOnHome ? "首页展示" : "首页隐藏"}
                    </span>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
                      排序 {project.sortOrder}
                    </span>
                  </div>

                  <div className="text-xs leading-6 text-stone-500">
                    最近更新：{new Date(project.updatedAt).toLocaleString("zh-CN")}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin?project=${encodeURIComponent(project.slug)}`}
                      className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800"
                    >
                      进入编辑
                    </Link>
                    <Link
                      href={`/projects/${encodeURIComponent(project.slug)}`}
                      className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                    >
                      前台预览
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {!orderedProjects.length ? (
          <div className="mt-6 rounded-[2rem] border border-dashed border-stone-900/15 bg-white/60 px-6 py-12 text-center text-sm leading-7 text-stone-600">
            还没有项目。先新建一个项目，再进入编辑器配置宣传页和剧情树。
          </div>
        ) : null}
      </div>
    </main>
  );
}
