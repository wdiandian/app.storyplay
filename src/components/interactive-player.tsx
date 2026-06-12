"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

type ChoicePayload = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
};

type HistoryPayload = {
  nodeCode: string;
  choiceCode: string;
  choiceLabel: string;
  targetNodeCode: string;
  chosenAt: string;
};

type NodePayload = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  nodeType: "video" | "ending";
  videoUrl: string;
  posterUrl: string | null;
  autoNextNodeCode: string | null;
  isEnding: boolean;
  endingTone: "truth" | "survival" | "tragedy" | null;
  choices: ChoicePayload[];
};

type PlaythroughPayload = {
  id: string;
  status: "in_progress" | "completed";
  currentNodeCode: string;
  history: HistoryPayload[];
  startedAt: string;
  finishedAt: string | null;
};

type SessionPayload = {
  game: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    intro: string;
    promoVideoUrl: string;
    promoPosterUrl: string;
    promoTitle: string;
    promoText: string;
  };
  playthrough: PlaythroughPayload;
  node: NodePayload;
};

const toneLabel: Record<NonNullable<NodePayload["endingTone"]>, string> = {
  truth: "真相结局",
  survival: "生还结局",
  tragedy: "悲剧结局",
};

const toneAccent: Record<NonNullable<NodePayload["endingTone"]>, string> = {
  truth: "from-sky-500/30 via-cyan-400/15 to-transparent",
  survival: "from-emerald-500/30 via-lime-400/15 to-transparent",
  tragedy: "from-rose-600/35 via-red-500/15 to-transparent",
};

const autoAdvanceDurationMs = 1200;

async function requestSession(
  path: string,
  init?: RequestInit,
): Promise<SessionPayload> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as SessionPayload | { error: string };

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "Unknown API error");
  }

  return payload;
}

function isEmptyProjectError(message: string | null) {
  return message === "Project has no start node";
}

function getChoiceMood(choice: ChoicePayload, index: number) {
  const text = `${choice.label} ${choice.hint}`.toLowerCase();

  if (text.includes("危险") || text.includes("强行") || text.includes("赌")) {
    return {
      tag: "高风险",
      card: "border-rose-400/25 bg-rose-500/[0.08] hover:border-rose-300/45",
      dot: "bg-rose-300",
    };
  }

  if (text.includes("观察") || text.includes("调查") || text.includes("线索")) {
    return {
      tag: "探索",
      card: "border-sky-400/25 bg-sky-500/[0.08] hover:border-sky-300/45",
      dot: "bg-sky-300",
    };
  }

  if (index === 0) {
    return {
      tag: "主路径",
      card: "border-amber-300/25 bg-amber-400/[0.08] hover:border-amber-200/45",
      dot: "bg-amber-200",
    };
  }

  return {
    tag: "分支",
    card: "border-white/12 bg-white/[0.04] hover:border-white/30",
    dot: "bg-stone-300",
  };
}

export function InteractivePlayer() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showPromo, setShowPromo] = useState(true);
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [transitionText, setTransitionText] = useState("序章");
  const [endingReveal, setEndingReveal] = useState(false);
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promoVideoRef = useRef<HTMLVideoElement | null>(null);
  const previousNodeCodeRef = useRef<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const endingTimerRef = useRef<number | null>(null);
  const autoAdvanceFrameRef = useRef<number | null>(null);

  function applySession(nextSession: SessionPayload) {
    startTransition(() => {
      setSession(nextSession);
      setHasEnded(false);
      setVideoFailed(false);
      setError(null);
      setEndingReveal(false);
      setAutoAdvanceProgress(null);
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFreshPlaythrough() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSession = await requestSession("/api/playthroughs", {
          method: "POST",
        });

        if (cancelled) {
          return;
        }

        setSession(nextSession);
        setHasEnded(false);
        setVideoFailed(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "启动试玩失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFreshPlaythrough();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      if (endingTimerRef.current) {
        window.clearTimeout(endingTimerRef.current);
      }

      if (autoAdvanceFrameRef.current) {
        window.cancelAnimationFrame(autoAdvanceFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nodeCode = session?.node.code;

    if (!nodeCode) {
      return;
    }

    if (previousNodeCodeRef.current === nodeCode) {
      return;
    }

    previousNodeCodeRef.current = nodeCode;

    const step = (session?.playthrough.history.length ?? 0) + 1;
    const nextLabel = session?.node.isEnding ? "终局降临" : step <= 1 ? "序章" : `第 ${step} 幕`;

    setTransitionText(nextLabel);
    setTransitionVisible(true);

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setTransitionVisible(false);
    }, 1450);
  }, [session]);

  useEffect(() => {
    if (!hasEnded || !session?.node.isEnding) {
      return;
    }

    if (endingTimerRef.current) {
      window.clearTimeout(endingTimerRef.current);
    }

    endingTimerRef.current = window.setTimeout(() => {
      setEndingReveal(true);
    }, 260);
  }, [hasEnded, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (!hasEnded || !session.node.autoNextNodeCode || session.node.choices.length > 0) {
      if (autoAdvanceFrameRef.current) {
        window.cancelAnimationFrame(autoAdvanceFrameRef.current);
        autoAdvanceFrameRef.current = null;
      }

      return;
    }

    const playthroughId = session.playthrough.id;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.max(0, 100 - (elapsed / autoAdvanceDurationMs) * 100);
      setAutoAdvanceProgress(progress);

      if (elapsed < autoAdvanceDurationMs) {
        autoAdvanceFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    autoAdvanceFrameRef.current = window.requestAnimationFrame(animate);

    const timer = window.setTimeout(() => {
      async function advanceAutomatically() {
        setIsSubmitting(true);

        try {
          const nextSession = await requestSession(
            `/api/playthroughs/${playthroughId}/advance`,
            {
              method: "POST",
              body: JSON.stringify({}),
            },
          );

          applySession(nextSession);
        } catch (advanceError) {
          setError(advanceError instanceof Error ? advanceError.message : "自动流转失败");
        } finally {
          setIsSubmitting(false);
        }
      }

      void advanceAutomatically();
    }, autoAdvanceDurationMs);

    return () => {
      window.clearTimeout(timer);

      if (autoAdvanceFrameRef.current) {
        window.cancelAnimationFrame(autoAdvanceFrameRef.current);
        autoAdvanceFrameRef.current = null;
      }
    };
  }, [hasEnded, session]);

  async function handleChoice(choiceCode: string) {
    if (!session) {
      return;
    }

    setIsSubmitting(true);

    try {
      const nextSession = await requestSession(
        `/api/playthroughs/${session.playthrough.id}/choose`,
        {
          method: "POST",
          body: JSON.stringify({ choiceCode }),
        },
      );

      applySession(nextSession);
    } catch (choiceError) {
      setError(choiceError instanceof Error ? choiceError.message : "提交选项失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestart() {
    if (!session) {
      return;
    }

    setIsSubmitting(true);

    try {
      const nextSession = await requestSession(
        `/api/playthroughs/${session.playthrough.id}/advance`,
        {
          method: "POST",
          body: JSON.stringify({ action: "restart" }),
        },
      );

      applySession(nextSession);
      setShowPromo(true);
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : "重新开始失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentNode = session?.node;
  const emptyProject = !session && isEmptyProjectError(error);
  const progressStep = (session?.playthrough.history.length ?? 0) + (currentNode ? 1 : 0);
  const choiceReady = Boolean(hasEnded && currentNode && currentNode.choices.length > 0);
  const autoAdvanceReady = Boolean(
    hasEnded &&
      currentNode &&
      !currentNode.isEnding &&
      currentNode.choices.length === 0 &&
      currentNode.autoNextNodeCode,
  );

  const sceneLabel = useMemo(() => {
    if (!currentNode) {
      return "载入场景";
    }

    if (currentNode.isEnding) {
      return "终局场景";
    }

    if (progressStep <= 1) {
      return "序章";
    }

    return `第 ${progressStep} 幕`;
  }, [currentNode, progressStep]);

  const endingAccent = currentNode?.endingTone ? toneAccent[currentNode.endingTone] : "";

  if (emptyProject) {
    return (
      <main className="min-h-screen bg-[#060709] text-stone-100">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(194,65,12,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(234,179,8,0.1),_transparent_22%),linear-gradient(180deg,_#140f10_0%,_#060709_58%,_#030405_100%)]" />
          <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08)_0%,_transparent_100%)] opacity-30" />

          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
            <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/10 bg-black/35 p-10 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.55em] text-amber-200/70">Interactive Cinema</p>
              <h1 className="mt-5 font-serif text-4xl text-stone-50 sm:text-5xl">项目尚未开场</h1>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-stone-300 sm:text-base">
                这个作品还没有创建起始节点，所以玩家视角暂时无法进入剧情。先去后台填写基础信息，并创建第一个场景，用户端才会出现真正的互动体验。
              </p>
              <a
                href="/admin"
                className="mt-8 inline-flex rounded-full border border-white/15 bg-white/6 px-6 py-3 text-sm text-stone-100 transition hover:border-amber-200/50 hover:bg-amber-200/10 hover:text-amber-100"
              >
                打开后台开始创建
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (showPromo && session) {
    return (
      <main className="min-h-screen bg-[#050608] text-stone-100">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,31,53,0.32),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(245,158,11,0.16),_transparent_18%),linear-gradient(180deg,_#171214_0%,_#0b0c0e_45%,_#040506_100%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px]" />

          <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.5em] text-amber-200/70">Feature Trailer</p>
                <h1 className="mt-3 font-serif text-4xl text-stone-50 sm:text-5xl">{session.game.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">{session.game.tagline}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm text-stone-100 transition hover:border-amber-200/50 hover:bg-amber-200/10 hover:text-amber-100"
                  onClick={() => setShowPromo(false)}
                >
                  进入序章
                </button>
              </div>
            </header>

            <section className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_380px]">
              <section className="overflow-hidden rounded-[2.4rem] border border-white/10 bg-black/40 shadow-[0_40px_140px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.38em] text-stone-400">
                  <span>宣传片</span>
                  <span>CG Preview</span>
                </div>

                <div className="relative aspect-[16/9] bg-black">
                  <video
                    ref={promoVideoRef}
                    className="h-full w-full object-cover"
                    src={session.game.promoVideoUrl || currentNode?.videoUrl}
                    poster={session.game.promoPosterUrl || undefined}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    autoPlay
                    loop
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.18)_0%,_rgba(0,0,0,0.06)_36%,_rgba(0,0,0,0.75)_100%)]" />
                </div>
              </section>

              <aside className="grid gap-4">
                <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.45em] text-amber-200/75">
                  {session.game.promoTitle || "宣传片"}
                </p>
                <h2 className="mt-4 font-serif text-3xl text-stone-50">先看片，再进故事</h2>
                <p className="mt-4 text-sm leading-8 text-stone-300">
                  {session.game.promoText || session.game.intro}
                </p>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.45em] text-stone-500">即将进入</p>
                  <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-stone-500">{sceneLabel}</div>
                    <div className="mt-2 text-2xl text-stone-50">{currentNode?.title}</div>
                    <p className="mt-3 text-sm leading-7 text-stone-300">{currentNode?.description}</p>
                  </div>

                  <button
                    type="button"
                    className="mt-5 w-full rounded-full border border-amber-300/25 bg-amber-200/10 px-5 py-3 text-sm text-amber-50 transition hover:border-amber-200/55 hover:bg-amber-200/18"
                    onClick={() => setShowPromo(false)}
                  >
                    正式进入剧情
                  </button>
                </section>
              </aside>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050608] text-stone-100">
      <div className="relative isolate min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,31,53,0.28),_transparent_26%),radial-gradient(circle_at_85%_18%,_rgba(245,158,11,0.14),_transparent_20%),linear-gradient(180deg,_#171214_0%,_#0b0c0e_45%,_#040506_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.5em] text-amber-200/70">Interactive Cinema</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="font-serif text-3xl text-stone-50 sm:text-4xl">
                  {session?.game.title ?? "互动影游"}
                </h1>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-stone-300">
                  {sceneLabel}
                </span>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
                {session?.game.tagline ?? "正在载入作品信息..."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
                <div className="text-[11px] uppercase tracking-[0.35em] text-stone-500">进度</div>
                <div className="mt-1 text-stone-100">已推进 {progressStep} 个场景</div>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-100 transition hover:border-white/35 hover:bg-white/5 disabled:opacity-50"
                onClick={handleRestart}
                disabled={!session || isSubmitting}
              >
                重新开局
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-stone-300 transition hover:border-amber-200/40 hover:text-amber-100"
                onClick={() => setShowDebug((current) => !current)}
              >
                {showDebug ? "隐藏调试层" : "显示调试层"}
              </button>
            </div>
          </header>

          <section className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
            <div className="grid gap-4">
              <section className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-black/40 shadow-[0_40px_140px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_34%)]" />
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-[11px] uppercase tracking-[0.38em] text-stone-400">
                  <span>主舞台</span>
                  <span>{currentNode?.nodeType === "ending" ? "ending" : "scene"}</span>
                </div>

                <div className="relative aspect-[16/9] bg-black">
                  {currentNode && !videoFailed ? (
                    <video
                      key={currentNode.code}
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      src={currentNode.videoUrl}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      autoPlay
                      onEnded={() => setHasEnded(true)}
                      onError={() => setVideoFailed(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(180,83,9,0.24),_transparent_36%),linear-gradient(180deg,_rgba(17,17,17,0.25)_0%,_rgba(5,5,6,0.85)_100%)]" />
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.3)_0%,_rgba(0,0,0,0.05)_30%,_rgba(0,0,0,0.65)_100%)]" />

                  {transitionVisible && (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[radial-gradient(circle,_rgba(255,255,255,0.16)_0%,_rgba(0,0,0,0.62)_48%,_rgba(0,0,0,0.88)_100%)]">
                      <div className="animate-[fade-in_220ms_ease-out] text-center">
                        <div className="text-[11px] uppercase tracking-[0.7em] text-amber-200/70">
                          Chapter Transition
                        </div>
                        <div className="mt-4 font-serif text-4xl text-stone-50 sm:text-6xl">
                          {transitionText}
                        </div>
                      </div>
                    </div>
                  )}

                  {videoFailed && (
                    <div className="absolute inset-0 flex items-end p-6">
                      <div className="max-w-xl rounded-[1.75rem] border border-white/10 bg-black/45 p-5 backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.45em] text-amber-200/70">
                          Fallback Scene
                        </p>
                        <h2 className="mt-3 font-serif text-3xl text-stone-50">
                          {currentNode?.title ?? "载入中"}
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-stone-300">
                          {currentNode?.description ?? "当前场景正在准备中。"}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentNode && (
                    <div className="pointer-events-none absolute left-6 top-6">
                      <div className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.38em] text-amber-200/80 backdrop-blur">
                        {sceneLabel}
                      </div>
                    </div>
                  )}

                  {choiceReady && currentNode && (
                    <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
                      <div className="mx-auto max-w-5xl rounded-[2rem] border border-amber-300/20 bg-[linear-gradient(180deg,_rgba(10,10,10,0.28)_0%,_rgba(10,10,10,0.72)_26%,_rgba(10,10,10,0.92)_100%)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-5">
                        <div className="grid gap-3 lg:grid-cols-2">
                          {currentNode.choices.map((choice, index) => {
                            const mood = getChoiceMood(choice, index);

                            return (
                              <button
                                key={choice.code}
                                type="button"
                                className={`group rounded-[1.6rem] border px-4 py-4 text-left transition duration-200 disabled:opacity-50 ${mood.card} animate-[fade-in_260ms_ease-out]`}
                                style={{ animationDelay: `${index * 90}ms`, animationFillMode: "both" }}
                                onClick={() => void handleChoice(choice.code)}
                                disabled={isSubmitting}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <span className={`h-2.5 w-2.5 rounded-full ${mood.dot}`} />
                                      <span className="text-[11px] uppercase tracking-[0.38em] text-stone-300">
                                        {mood.tag}
                                      </span>
                                    </div>
                                    <div className="mt-3 text-lg text-stone-50 sm:text-xl">
                                      {choice.label}
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-stone-300">
                                    选项 {index + 1}
                                  </span>
                                </div>

                                <p className="mt-3 text-sm leading-7 text-stone-300">
                                  {choice.hint || "选择后将立刻进入下一段剧情。"}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {autoAdvanceReady && currentNode && (
                    <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
                      <div className="mx-auto max-w-3xl rounded-[1.6rem] border border-sky-400/18 bg-black/70 px-5 py-4 text-sm text-sky-50 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            当前场景即将自动流转到{" "}
                            <span className="font-medium">{currentNode.autoNextNodeCode}</span>
                          </span>
                          <span className="text-xs uppercase tracking-[0.32em] text-sky-100/75">
                            Auto
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-sky-300 transition-[width] duration-75"
                            style={{ width: `${autoAdvanceProgress ?? 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 border-t border-white/10 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.38em] text-stone-500">当前场景</p>
                        <h2 className="mt-3 font-serif text-3xl text-stone-50">{currentNode?.title}</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
                          {currentNode?.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-300 transition hover:border-amber-200/40 hover:text-amber-100 disabled:opacity-50"
                        onClick={() => {
                          const video = videoRef.current;

                          if (video) {
                            video.pause();
                            video.currentTime = Math.max(video.duration - 0.2, 0);
                          }

                          setHasEnded(true);
                        }}
                        disabled={!currentNode || isSubmitting}
                      >
                        跳过当前场景
                      </button>
                    </div>

                    <div className="mt-6 border-t border-white/8 pt-5">
                      <p className="text-xs uppercase tracking-[0.38em] text-stone-500">场景文本</p>
                      <p className="mt-4 text-sm leading-8 text-stone-200">
                        {currentNode?.transcript || "当前场景尚未填写文本内容。"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.38em] text-stone-500">剧情状态</p>
                    <div className="mt-4 grid gap-3 text-sm text-stone-300">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                        <span>当前节点</span>
                        <span className="font-medium text-stone-100">{currentNode?.code ?? "loading"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                        <span>玩家状态</span>
                        <span className="font-medium text-stone-100">
                          {currentNode?.isEnding ? "已抵达结局" : hasEnded ? "等待下一步" : "场景进行中"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                        <span>历史选择</span>
                        <span className="font-medium text-stone-100">
                          {session?.playthrough.history.length ?? 0} 次
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {hasEnded && currentNode?.isEnding && (
                <section
                  className={`relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-black/40 p-6 shadow-[0_26px_90px_rgba(0,0,0,0.35)] transition duration-500 ${
                    endingReveal ? "translate-y-0 scale-100 opacity-100" : "translate-y-5 scale-[0.985] opacity-0"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${endingAccent}`} />
                  <div className="relative">
                    <p className="text-xs uppercase tracking-[0.48em] text-stone-300/80">Ending Reached</p>
                    <h3 className="mt-3 font-serif text-4xl text-stone-50 sm:text-5xl">
                      {currentNode.title}
                    </h3>
                    <p className="mt-3 text-sm text-stone-300">
                      {currentNode.endingTone ? toneLabel[currentNode.endingTone] : "结局"}
                    </p>
                    <div className="mt-5 h-px w-24 bg-white/20" />
                    <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-200">
                      {currentNode.transcript}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <aside className="grid gap-4">
              <section className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.4em] text-stone-500">作品导语</p>
                <p className="mt-4 text-sm leading-8 text-stone-300">
                  {session?.game.intro || "这里将展示作品的世界观、开场提示或玩法导语。"}
                </p>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.4em] text-stone-500">路径回声</p>
                  <span className="text-xs text-stone-500">{session?.playthrough.history.length ?? 0} 条记录</span>
                </div>

                <div className="mt-4 grid gap-3">
                  {session?.playthrough.history.length ? (
                    session.playthrough.history.map((entry, index) => (
                      <div
                        key={`${entry.nodeCode}-${entry.choiceCode}-${index}`}
                        className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">
                          Step {index + 1}
                        </div>
                        <div className="mt-2 text-sm text-stone-100">
                          {entry.nodeCode} {"->"} {entry.targetNodeCode}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-stone-400">{entry.choiceLabel}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                      这里会记录玩家已做出的选择。当前尚未产生分支路径。
                    </div>
                  )}
                </div>
              </section>

              {showDebug && (
                <section className="rounded-[2rem] border border-amber-300/18 bg-amber-400/[0.05] p-5 backdrop-blur-xl">
                  <p className="text-xs uppercase tracking-[0.4em] text-amber-200/75">Debug Layer</p>
                  <div className="mt-4 grid gap-3 text-sm text-stone-300">
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <div className="text-stone-500">Playthrough ID</div>
                      <div className="mt-1 break-all text-stone-100">
                        {session?.playthrough.id ?? "尚未创建"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <div className="text-stone-500">状态</div>
                      <div className="mt-1 text-stone-100">{session?.playthrough.status ?? "loading"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                      <div className="text-stone-500">媒体地址</div>
                      <div className="mt-1 break-all text-stone-100">{currentNode?.videoUrl ?? "无"}</div>
                    </div>
                  </div>
                </section>
              )}

              {(isLoading || isSubmitting || error) && (
                <section className="rounded-[2rem] border border-white/10 bg-black/35 p-5 text-sm text-stone-300">
                  {isLoading && <p>正在进入作品...</p>}
                  {!isLoading && isSubmitting && <p>正在提交当前抉择...</p>}
                  {error && <p className="text-rose-300">{error}</p>}
                </section>
              )}
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}
