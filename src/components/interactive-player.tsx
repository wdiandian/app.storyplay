"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { getAvailableChoices, matchesConditions } from "@/lib/story-rules";
import type {
  ConditionRule,
  TimelineEventType,
  VariableAction,
  VariableRuntimeValue,
} from "@/lib/story-engine";

type ChoicePayload = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
  conditions: ConditionRule[];
  actions: VariableAction[];
};

type HistoryPayload = {
  nodeCode: string;
  choiceCode: string;
  choiceLabel: string;
  targetNodeCode: string;
  chosenAt: string;
};

type TimelineEventPayload = {
  id: string;
  atMs: number;
  type: TimelineEventType;
  payload: Record<string, unknown>;
  conditions: ConditionRule[];
  actions: VariableAction[];
};

type NodePayload = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  nodeType: "video" | "ending";
  videoUrl: string;
  autoNextNodeCode: string | null;
  isEnding: boolean;
  endingTone: "truth" | "survival" | "tragedy" | null;
  choices: ChoicePayload[];
  timelineEvents: TimelineEventPayload[];
};

type PlaythroughPayload = {
  id: string;
  status: "in_progress" | "completed";
  currentNodeCode: string;
  history: HistoryPayload[];
  startedAt: string;
  finishedAt: string | null;
  variables: Record<string, VariableRuntimeValue>;
  triggeredEventIds: string[];
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
    promoText: string;
  };
  playthrough: PlaythroughPayload;
  node: NodePayload;
};

type RuntimeTextCard = {
  title: string;
  body: string;
};

type RuntimeChoiceState = {
  eventId: string;
  title: string;
  body: string;
  pauseVideo: boolean;
  choices: ChoicePayload[];
  sourceNodeCode: string;
};

type RuntimeOverlayState = {
  title: string;
  body: string;
  align: "top" | "center" | "bottom";
};

type RuntimeActionEntry = {
  id: string;
  label: string;
  detail: string;
};

const toneLabel: Record<NonNullable<NodePayload["endingTone"]>, string> = {
  truth: "真相结局",
  survival: "生存结局",
  tragedy: "悲剧结局",
};

const toneAccent: Record<NonNullable<NodePayload["endingTone"]>, string> = {
  truth: "from-sky-500/35 via-cyan-400/15 to-transparent",
  survival: "from-emerald-500/35 via-lime-400/15 to-transparent",
  tragedy: "from-rose-600/35 via-red-500/15 to-transparent",
};

const autoAdvanceDurationMs = 1200;
const playbackRates = [1, 1.25, 1.5, 2];

async function requestSession(path: string, init?: RequestInit): Promise<SessionPayload> {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getChoiceMood(choice: ChoicePayload, index: number) {
  const text = `${choice.label} ${choice.hint}`.toLowerCase();

  if (
    text.includes("危险") ||
    text.includes("强行") ||
    text.includes("冒险") ||
    text.includes("赌")
  ) {
    return {
      tag: "高风险",
      card: "border-rose-400/35 bg-rose-500/[0.10] hover:border-rose-300/60",
      dot: "bg-rose-300",
      glow: "shadow-[0_0_50px_rgba(244,63,94,0.16)]",
    };
  }

  if (
    text.includes("观察") ||
    text.includes("调查") ||
    text.includes("线索") ||
    text.includes("试探")
  ) {
    return {
      tag: "探索",
      card: "border-sky-400/35 bg-sky-500/[0.10] hover:border-sky-300/60",
      dot: "bg-sky-300",
      glow: "shadow-[0_0_50px_rgba(56,189,248,0.14)]",
    };
  }

  if (index === 0) {
    return {
      tag: "主路线",
      card: "border-amber-300/35 bg-amber-400/[0.10] hover:border-amber-200/60",
      dot: "bg-amber-200",
      glow: "shadow-[0_0_50px_rgba(251,191,36,0.16)]",
    };
  }

  return {
    tag: "分支",
    card: "border-white/12 bg-white/[0.05] hover:border-white/35",
    dot: "bg-stone-300",
    glow: "shadow-[0_0_40px_rgba(255,255,255,0.06)]",
  };
}

function getStringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function getChoicePresentation(choice: ChoicePayload) {
  const text = `${choice.label} ${choice.hint}`.toLowerCase();

  if (
    text.includes("危险") ||
    text.includes("强行") ||
    text.includes("冒险") ||
    text.includes("赌")
  ) {
    return {
      tag: "高风险",
      card: "border-rose-400/35 bg-rose-500/[0.10] hover:border-rose-300/60",
      dot: "bg-rose-300",
      glow: "shadow-[0_0_50px_rgba(244,63,94,0.16)]",
    };
  }

  if (
    text.includes("观察") ||
    text.includes("调查") ||
    text.includes("线索") ||
    text.includes("试探")
  ) {
    return {
      tag: "探索",
      card: "border-sky-400/35 bg-sky-500/[0.10] hover:border-sky-300/60",
      dot: "bg-sky-300",
      glow: "shadow-[0_0_50px_rgba(56,189,248,0.14)]",
    };
  }

  return {
    tag: "选项",
    card: "border-white/12 bg-white/[0.05] hover:border-white/35",
    dot: "bg-stone-300",
    glow: "shadow-[0_0_40px_rgba(255,255,255,0.06)]",
  };
}

function getBooleanValue(payload: Record<string, unknown>, key: string, fallback = false) {
  const value = payload[key];
  return typeof value === "boolean" ? value : fallback;
}

function getChoiceArrayValue(payload: Record<string, unknown>) {
  const value = payload.choices;

  if (!Array.isArray(value)) {
    return null;
  }

  const choices = value
    .map<ChoicePayload | null>((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const choice = entry as Record<string, unknown>;
      const code = typeof choice.code === "string" ? choice.code : "";
      const label = typeof choice.label === "string" ? choice.label : "";
      const hint = typeof choice.hint === "string" ? choice.hint : "";
      const targetNodeCode =
        typeof choice.targetNodeCode === "string" ? choice.targetNodeCode : "";
      const conditions = Array.isArray(choice.conditions)
        ? (choice.conditions as ConditionRule[])
        : [];
      const actions = Array.isArray(choice.actions)
        ? (choice.actions as VariableAction[])
        : [];

      if (!code || !label || !targetNodeCode) {
        return null;
      }

      return {
        code,
        label,
        hint,
        targetNodeCode,
        conditions,
        actions,
      } satisfies ChoicePayload;
    })
    .filter((choice): choice is ChoicePayload => Boolean(choice));

  return choices.length ? choices : null;
}

function normalizeChoicePayload(choice: {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
  conditions?: ConditionRule[];
  actions?: VariableAction[];
}): ChoicePayload {
  return {
    code: choice.code,
    label: choice.label,
    hint: choice.hint,
    targetNodeCode: choice.targetNodeCode,
    conditions: choice.conditions ?? [],
    actions: choice.actions ?? [],
  };
}

function getOverlayAlign(payload: Record<string, unknown>) {
  const align = getStringValue(payload, "align");

  if (align === "top" || align === "center" || align === "bottom") {
    return align;
  }

  return "center";
}

function getActionEntries(payload: Record<string, unknown>, eventId: string) {
  const rawActions = payload.actions;

  if (Array.isArray(rawActions)) {
    return rawActions
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const action = entry as Record<string, unknown>;
        const label = typeof action.label === "string" ? action.label : `Action ${index + 1}`;
        const detail =
          typeof action.detail === "string"
            ? action.detail
            : typeof action.type === "string"
              ? `type: ${action.type}`
              : JSON.stringify(action);

        return {
          id: `${eventId}_${index}`,
          label,
          detail,
        } satisfies RuntimeActionEntry;
      })
      .filter((entry): entry is RuntimeActionEntry => Boolean(entry));
  }

  const text = getStringValue(payload, "text") || getStringValue(payload, "label");

  if (!text) {
    return [];
  }

  return [
    {
      id: eventId,
      label: "运行时动作",
      detail: text,
    },
  ];
}

function getSceneStageLabel(step: number, node: NodePayload | null | undefined) {
  if (!node) {
    return "加载中";
  }

  if (node.isEnding) {
    return "终局";
  }

  if (step <= 1) {
    return "序章";
  }

  return `第 ${step} 幕`;
}

function getVariablePreview(
  variables: Record<string, VariableRuntimeValue>,
): Array<{ key: string; value: string }> {
  return Object.entries(variables)
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      value: String(value),
    }));
}

function getEndingSummary(history: HistoryPayload[]) {
  const latest = history.slice(-3);

  if (!latest.length) {
    return "你还没有做出关键分支选择。";
  }

  return latest.map((entry) => entry.choiceLabel).join(" / ");
}

function getInfoPanelTitle(tab: "history" | "state" | "actions") {
  if (tab === "history") {
    return "选择记录";
  }

  if (tab === "state") {
    return "作品信息";
  }

  return "提示记录";
}

export function InteractivePlayer() {
  const searchParams = useSearchParams();
  const previewNodeCode = searchParams.get("previewNode")?.trim() ?? "";
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromo, setShowPromo] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [infoTab, setInfoTab] = useState<"history" | "state" | "actions">("history");
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [transitionText, setTransitionText] = useState("序章");
  const [endingReveal, setEndingReveal] = useState(false);
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState<number | null>(null);
  const [videoFreezeFrame, setVideoFreezeFrame] = useState<string | null>(null);
  const [activeTextCard, setActiveTextCard] = useState<RuntimeTextCard | null>(null);
  const [runtimeChoices, setRuntimeChoices] = useState<RuntimeChoiceState | null>(null);
  const [runtimeOverlay, setRuntimeOverlay] = useState<RuntimeOverlayState | null>(null);
  const [runtimeActions, setRuntimeActions] = useState<RuntimeActionEntry[]>([]);
  const [triggeredEventIds, setTriggeredEventIds] = useState<string[]>([]);
  const [pendingChoiceCode, setPendingChoiceCode] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const promoVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousNodeCodeRef = useRef<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const endingTimerRef = useRef<number | null>(null);
  const autoAdvanceFrameRef = useRef<number | null>(null);
  const runtimeChoiceHandledRef = useRef(false);
  const isPreviewMode = Boolean(previewNodeCode);

  function applySession(nextSession: SessionPayload) {
    startTransition(() => {
      setSession(nextSession);
      setHasEnded(false);
      setVideoFailed(false);
      setError(null);
      setEndingReveal(false);
      setAutoAdvanceProgress(null);
      setVideoFreezeFrame(null);
      setActiveTextCard(null);
      setRuntimeChoices(null);
      setRuntimeOverlay(null);
      setRuntimeActions([]);
      setTriggeredEventIds([]);
      setPendingChoiceCode(null);
      runtimeChoiceHandledRef.current = false;
    });
  }

  function mergePlaythroughState(nextSession: SessionPayload) {
    startTransition(() => {
      setSession((current) =>
        current
          ? {
              ...current,
              playthrough: nextSession.playthrough,
            }
          : nextSession,
      );
    });
  }

  function captureVideoFreezeFrame(video: HTMLVideoElement) {
    if (!video.videoWidth || !video.videoHeight) {
      setVideoFreezeFrame(null);
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        setVideoFreezeFrame(null);
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setVideoFreezeFrame(canvas.toDataURL("image/jpeg", 0.92));
    } catch {
      setVideoFreezeFrame(null);
    }
  }

  function applyPlaybackRate(nextRate: number) {
    setPlaybackRate(nextRate);

    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }

    if (promoVideoRef.current) {
      promoVideoRef.current.playbackRate = nextRate;
    }
  }

  function cyclePlaybackRate() {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playbackRates.length : 0;
    applyPlaybackRate(playbackRates[nextIndex]);
  }

  function handleVideoEnded() {
    const video = videoRef.current;

    if (video) {
      captureVideoFreezeFrame(video);
      video.pause();
    }

    setHasEnded(true);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFreshPlaythrough() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSession = await requestSession("/api/playthroughs", {
          method: "POST",
          body: previewNodeCode ? JSON.stringify({ startNodeCode: previewNodeCode }) : undefined,
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
  }, [previewNodeCode]);

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

      if (audioRef.current) {
        audioRef.current.pause();
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
    const nextLabel = getSceneStageLabel(step, session?.node);

    setTransitionText(nextLabel);
    setTransitionVisible(true);

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setTransitionVisible(false);
    }, 1800);
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
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }

    if (promoVideoRef.current) {
      promoVideoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, session, showPromo]);

  async function handleDefaultChoice(choiceCode: string) {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    setPendingChoiceCode(choiceCode);

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
      setPendingChoiceCode(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRuntimeChoice(choice: ChoicePayload, sourceNodeCode: string) {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    setPendingChoiceCode(choice.code);

    try {
      const nextSession = await requestSession(
        `/api/playthroughs/${session.playthrough.id}/choose`,
        {
          method: "POST",
          body: JSON.stringify({
            runtimeChoice: choice,
            sourceNodeCode,
          }),
        },
      );

      applySession(nextSession);
    } catch (choiceError) {
      setError(choiceError instanceof Error ? choiceError.message : "提交时间线选项失败");
      setPendingChoiceCode(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    const node = session?.node;

    if (!video || !node || hasEnded) {
      return;
    }

    const activeNode = node;
    const activeSession = session;
    const playthroughId = session.playthrough.id;
    const sortedEvents = [...activeNode.timelineEvents].sort((left, right) => left.atMs - right.atMs);

    function playAudioEvent(payload: Record<string, unknown>) {
      const audioUrl = getStringValue(payload, "audioUrl") || getStringValue(payload, "url");

      if (!audioUrl) {
        return;
      }

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = audioUrl;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    }

    async function submitRuntimeChoice(choice: ChoicePayload, sourceNodeCode: string) {
      setIsSubmitting(true);
      setPendingChoiceCode(choice.code);

      try {
        const nextSession = await requestSession(
          `/api/playthroughs/${playthroughId}/choose`,
          {
            method: "POST",
            body: JSON.stringify({
              runtimeChoice: choice,
              sourceNodeCode,
            }),
          },
        );

        applySession(nextSession);
      } catch (choiceError) {
        setError(choiceError instanceof Error ? choiceError.message : "提交时间线选项失败");
        setPendingChoiceCode(null);
      } finally {
        setIsSubmitting(false);
      }
    }

    async function submitRuntimeEvent(event: TimelineEventPayload) {
      try {
        const nextSession = await requestSession(
          `/api/playthroughs/${playthroughId}/choose`,
          {
            method: "POST",
            body: JSON.stringify({
              runtimeEvent: event,
            }),
          },
        );

        mergePlaythroughState(nextSession);
      } catch {
        // Ignore event sync failures to keep playback uninterrupted.
      }
    }

    function handleTimelineUpdate() {
      if (!videoRef.current || runtimeChoiceHandledRef.current) {
        return;
      }

      const currentMs = videoRef.current.currentTime * 1000;

      for (const event of sortedEvents) {
        if (
          triggeredEventIds.includes(event.id) ||
          activeSession.playthrough.triggeredEventIds.includes(event.id) ||
          currentMs < event.atMs ||
          !matchesConditions(event.conditions, activeSession.playthrough.variables)
        ) {
          continue;
        }

        setTriggeredEventIds((current) => [...current, event.id]);
        void submitRuntimeEvent(event);

        if (event.type === "show_text") {
          const title = getStringValue(event.payload, "title") || "剧情提示";
          const body = getStringValue(event.payload, "text") || getStringValue(event.payload, "body");

          if (body) {
            setActiveTextCard({ title, body });
          }
        }

        if (event.type === "show_overlay") {
          const title = getStringValue(event.payload, "title") || "画面提示";
          const body = getStringValue(event.payload, "text") || getStringValue(event.payload, "body");

          if (body) {
            setRuntimeOverlay({
              title,
              body,
              align: getOverlayAlign(event.payload),
            });
          }
        }

        if (event.type === "pause") {
          if (videoRef.current) {
            captureVideoFreezeFrame(videoRef.current);
            videoRef.current.pause();
          }
        }

        if (event.type === "play_audio") {
          playAudioEvent(event.payload);
        }

        if (event.type === "show_choice") {
          const title = getStringValue(event.payload, "title") || "做出选择";
          const body = getStringValue(event.payload, "text") || "新的剧情分支已经出现。";
          const pauseVideo = getBooleanValue(event.payload, "pauseVideo", true);
          const runtimeEventChoices = getAvailableChoices(
            getChoiceArrayValue(event.payload) ?? activeNode.choices,
            activeSession.playthrough.variables,
          ).map(normalizeChoicePayload);

          if (runtimeEventChoices.length) {
            if (pauseVideo && videoRef.current) {
              captureVideoFreezeFrame(videoRef.current);
              videoRef.current.pause();
            }

            runtimeChoiceHandledRef.current = true;
            setRuntimeChoices({
              eventId: event.id,
              title,
              body,
              pauseVideo,
              choices: runtimeEventChoices,
              sourceNodeCode: activeNode.code,
            });
          }
        }

        if (event.type === "jump") {
          const targetNodeCode = getStringValue(event.payload, "targetNodeCode");

          if (targetNodeCode) {
            runtimeChoiceHandledRef.current = true;
            void submitRuntimeChoice(
              {
                code: `jump_${event.id}`,
                label: getStringValue(event.payload, "label") || "时间线跳转",
                hint: getStringValue(event.payload, "hint") || "",
                targetNodeCode,
                conditions: [],
                actions: event.actions,
              },
              activeNode.code,
            );
            return;
          }
        }

        if (event.type === "run_actions") {
          const entries = getActionEntries(event.payload, event.id);

          if (entries.length) {
            setRuntimeActions((current) => [...entries, ...current].slice(0, 8));
          }
        }
      }
    }

    video.addEventListener("timeupdate", handleTimelineUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimelineUpdate);
    };
  }, [session, triggeredEventIds, hasEnded]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (
      !hasEnded ||
      !session.node.autoNextNodeCode ||
      session.node.choices.length > 0 ||
      runtimeChoices
    ) {
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
  }, [hasEnded, runtimeChoices, session]);

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
          body: JSON.stringify({
            action: "restart",
            startNodeCode: previewNodeCode || undefined,
          }),
        },
      );

      applySession(nextSession);
      setShowPromo(!isPreviewMode);
      setShowInfoPanel(false);
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : "重新开始失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentNode = session?.node;
  const emptyProject = !session && isEmptyProjectError(error);
  const progressStep = (session?.playthrough.history.length ?? 0) + (currentNode ? 1 : 0);
  const defaultChoiceReady = Boolean(
    hasEnded && currentNode && currentNode.choices.length > 0 && !runtimeChoices,
  );
  const autoAdvanceReady = Boolean(
    hasEnded &&
      currentNode &&
      !currentNode.isEnding &&
      currentNode.choices.length === 0 &&
      currentNode.autoNextNodeCode &&
      !runtimeChoices,
  );
  const choiceBlock = runtimeChoices?.choices ?? currentNode?.choices ?? [];
  const choiceReady = Boolean(runtimeChoices || defaultChoiceReady);
  const freezeFrameVisible = Boolean(
    videoFreezeFrame && (hasEnded || Boolean(runtimeChoices?.pauseVideo)),
  );
  const sceneLabel = getSceneStageLabel(progressStep, currentNode);
  const endingAccent = currentNode?.endingTone ? toneAccent[currentNode.endingTone] : "";
  const overlayPositionClass =
    runtimeOverlay?.align === "top"
      ? "items-start pt-20"
      : runtimeOverlay?.align === "bottom"
        ? "items-end pb-20"
        : "items-center";
  const variablePreview = session ? getVariablePreview(session.playthrough.variables) : [];
  const endingSummary = getEndingSummary(session?.playthrough.history ?? []);

  if (emptyProject) {
    return (
      <main className="min-h-screen bg-[#060709] text-stone-100">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(194,65,12,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(234,179,8,0.1),_transparent_22%),linear-gradient(180deg,_#140f10_0%,_#060709_58%,_#030405_100%)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
            <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/10 bg-black/35 p-10 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.55em] text-amber-200/70">互动影游</p>
              <h1 className="mt-5 text-4xl text-stone-50 sm:text-5xl">项目尚未开始</h1>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-stone-300 sm:text-base">
                这个项目还没有起始片段，所以玩家暂时无法进入剧情。先去后台填写基础信息，并创建第一个片段。
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

  if (showPromo && session && !isPreviewMode) {
    return (
      <main className="min-h-screen bg-[#050608] text-stone-100">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,31,53,0.36),_transparent_25%),radial-gradient(circle_at_82%_16%,_rgba(245,158,11,0.18),_transparent_20%),linear-gradient(180deg,_#191317_0%,_#090a0c_48%,_#040506_100%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:32px_32px]" />

          <div className="relative mx-auto flex min-h-screen w-full max-w-[1720px] flex-col justify-center px-4 py-4 sm:px-6 lg:px-8">
            <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_420px]">
              <section className="relative flex flex-col overflow-hidden rounded-[2.8rem] border border-white/10 bg-black/40 shadow-[0_50px_180px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_12%,_rgba(255,255,255,0.08),_transparent_26%),linear-gradient(180deg,_rgba(0,0,0,0.08)_0%,_rgba(0,0,0,0.7)_100%)]" />
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
                    onLoadedMetadata={(event) => {
                      event.currentTarget.playbackRate = playbackRate;
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.12)_0%,_rgba(0,0,0,0.02)_42%,_rgba(0,0,0,0.56)_100%)]" />
                  <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6">
                    <div className="rounded-full border border-white/12 bg-black/38 px-3 py-1.5 text-[11px] uppercase tracking-[0.38em] text-amber-200/80 backdrop-blur-xl">
                      预告片
                    </div>
                  </div>
                </div>
                <div className="relative flex-1 px-6 pb-7 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
                  <div className="text-[11px] uppercase tracking-[0.46em] text-amber-200/72">
                    作品标题
                  </div>
                  <h1 className="mt-4 max-w-4xl break-words text-3xl leading-tight text-stone-50 sm:text-4xl lg:text-5xl">
                    {session.game.title}
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-8 text-stone-300 sm:text-base">
                    {session.game.tagline}
                  </p>
                </div>
              </section>

              <aside className="flex flex-col gap-4">
                <section className="rounded-[2.4rem] border border-white/10 bg-black/28 p-6 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.48em] text-amber-200/75">
                    预告说明
                  </div>
                  <h2 className="mt-4 break-words text-3xl leading-tight text-stone-50">
                    开始前先看一眼
                  </h2>
                  <p className="mt-4 text-sm leading-8 text-stone-300">
                    {session.game.promoText || session.game.tagline}
                  </p>
                </section>

                <section className="rounded-[2.4rem] border border-white/10 bg-black/28 p-6 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.45em] text-stone-500">
                    即将进入
                  </div>
                  <div className="mt-4 rounded-[1.7rem] border border-white/8 bg-white/[0.03] p-5">
                    <div className="text-xs uppercase tracking-[0.35em] text-stone-500">
                      {sceneLabel}
                    </div>
                    <div className="mt-3 break-words text-2xl leading-tight text-stone-50">
                      {currentNode?.title}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-300">
                      {currentNode?.description}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-amber-300/30 bg-amber-200/10 px-5 py-3 text-sm text-amber-50 transition hover:border-amber-200/60 hover:bg-amber-200/18"
                      onClick={() => setShowPromo(false)}
                    >
                      开始进入正片
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/12 bg-white/4 px-5 py-3 text-sm text-stone-200 transition hover:border-white/30 hover:bg-white/8"
                      onClick={() => {
                        const video = promoVideoRef.current;
                        if (video) {
                          if (video.paused) {
                            void video.play().catch(() => undefined);
                          } else {
                            video.pause();
                          }
                        }
                      }}
                    >
                      播放 / 暂停视频
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/12 bg-white/4 px-5 py-3 text-sm text-stone-200 transition hover:border-white/30 hover:bg-white/8"
                      onClick={cyclePlaybackRate}
                    >
                      倍速 {playbackRate}x
                    </button>
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030405] text-stone-100">
      <div className="relative isolate min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,31,53,0.24),_transparent_25%),radial-gradient(circle_at_80%_12%,_rgba(245,158,11,0.12),_transparent_18%),linear-gradient(180deg,_#141215_0%,_#08090b_42%,_#030405_100%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:30px_30px]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1880px] items-center justify-center px-0 py-0 sm:px-4 sm:py-4">
          <section className="relative w-full overflow-hidden rounded-none border-0 bg-black/55 shadow-[0_50px_180px_rgba(0,0,0,0.6)] sm:rounded-[2.6rem] sm:border sm:border-white/10">
            <div className="relative h-[100svh] w-full bg-black sm:h-[calc(100svh-2rem)] lg:h-[88vh]">
              {currentNode && !videoFailed ? (
                <>
                  <video
                    key={currentNode.code}
                    ref={videoRef}
                    className={`h-full w-full object-cover ${freezeFrameVisible ? "invisible" : ""}`}
                    src={currentNode.videoUrl}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    autoPlay
                    onLoadedMetadata={(event) => {
                      event.currentTarget.playbackRate = playbackRate;
                    }}
                    onEnded={handleVideoEnded}
                    onError={() => setVideoFailed(true)}
                  />
                  {freezeFrameVisible && videoFreezeFrame ? (
                    <Image
                      src={videoFreezeFrame}
                      alt=""
                      aria-hidden="true"
                      fill
                      unoptimized
                      className="absolute inset-0 object-cover"
                    />
                  ) : null}
                </>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(180,83,9,0.24),_transparent_36%),linear-gradient(180deg,_rgba(17,17,17,0.25)_0%,_rgba(5,5,6,0.85)_100%)]" />
              )}

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.38)_0%,_rgba(0,0,0,0.04)_22%,_rgba(0,0,0,0.82)_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_36%,_rgba(0,0,0,0.38)_100%)]" />
              {choiceReady ? (
                <div className="pointer-events-none absolute inset-0 z-[15] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.04)_0%,_rgba(0,0,0,0.2)_28%,_rgba(0,0,0,0.72)_100%)]" />
              ) : null}

              <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-amber-200/80 backdrop-blur">
                    {isPreviewMode ? "片段试玩" : sceneLabel}
                  </span>
                  {currentNode?.endingTone ? (
                    <span className="inline-flex rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-stone-200/80 backdrop-blur">
                      {toneLabel[currentNode.endingTone]}
                    </span>
                  ) : null}
                </div>

                <div className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2 pl-6 sm:max-w-none">
                  <button
                    type="button"
                    className="rounded-full border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-200 transition hover:border-white/35 hover:bg-white/8 sm:px-4 sm:text-sm"
                    onClick={() => setShowInfoPanel((current) => !current)}
                  >
                    {showInfoPanel ? "收起面板" : "展开面板"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-100 transition hover:border-white/35 hover:bg-white/8 disabled:opacity-50 sm:px-4 sm:text-sm"
                    onClick={handleRestart}
                    disabled={!session || isSubmitting}
                  >
                    重开
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-100 transition hover:border-white/35 hover:bg-white/8 sm:px-4 sm:text-sm"
                    onClick={cyclePlaybackRate}
                  >
                    倍速 {playbackRate}x
                  </button>
                </div>
              </div>

              <div className="pointer-events-none absolute left-4 top-20 z-20 max-w-[65vw] sm:left-6 sm:top-24 sm:max-w-none">
                <div className="rounded-[1.4rem] border border-white/10 bg-black/42 px-4 py-3 backdrop-blur-xl">
                  <div className="text-[11px] uppercase tracking-[0.38em] text-stone-400">当前片段</div>
                  <div className="mt-2 break-words text-lg leading-tight text-stone-50 sm:text-xl">
                    {currentNode?.title ?? "加载中"}
                  </div>
                    <div className="mt-2 text-xs text-stone-400">已推进到第 {progressStep} 段</div>
                </div>
              </div>

              {transitionVisible ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_0%,_rgba(0,0,0,0.48)_36%,_rgba(0,0,0,0.92)_100%)]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06)_0%,_transparent_18%,_rgba(0,0,0,0.42)_100%)]" />
                  <div className="relative px-6 text-center">
                    <div className="mx-auto h-px w-28 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                    <div className="mt-5 text-[11px] uppercase tracking-[0.7em] text-amber-200/72">
                     章节切换
                    </div>
                    <div className="mt-4 break-words text-4xl text-stone-50 sm:text-7xl animate-[cinema-rise_900ms_ease-out]">
                      {transitionText}
                    </div>
                    <div className="mx-auto mt-5 h-px w-28 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
                  </div>
                </div>
              ) : null}

              {videoFailed ? (
                <div className="absolute inset-0 flex items-end p-6">
                  <div className="max-w-xl rounded-[1.75rem] border border-white/10 bg-black/45 p-5 backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.45em] text-amber-200/70">
                      当前片段
                    </p>
                    <h2 className="mt-3 break-words text-3xl text-stone-50">
                      {currentNode?.title ?? "加载中"}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-300">
                      {currentNode?.description ?? "当前片段正在准备中。"}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeTextCard ? (
                <div className="absolute left-4 top-28 z-20 max-w-[calc(100vw-2rem)] sm:left-6 sm:top-32 sm:max-w-md">
                  <div className="rounded-[1.6rem] border border-white/12 bg-black/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200/75">
                          剧情提示
                        </p>
                        <div className="mt-3 break-words text-lg text-stone-50">
                          {activeTextCard.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-300 transition hover:border-white/30 hover:text-white"
                        onClick={() => setActiveTextCard(null)}
                      >
                        关闭
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-300">{activeTextCard.body}</p>
                  </div>
                </div>
              ) : null}

              {runtimeOverlay ? (
                <div className={`absolute inset-0 z-10 flex justify-center px-4 sm:px-6 ${overlayPositionClass}`}>
                  <div className="max-w-2xl rounded-[1.8rem] border border-white/12 bg-black/65 p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200/75">
                      剧情提示
                    </div>
                    <div className="mt-3 break-words text-2xl text-stone-50">{runtimeOverlay.title}</div>
                    <p className="mt-3 text-sm leading-8 text-stone-200">{runtimeOverlay.body}</p>
                    <button
                      type="button"
                      className="mt-5 rounded-full border border-white/10 px-4 py-2 text-sm text-stone-200 transition hover:border-white/30 hover:text-white"
                      onClick={() => setRuntimeOverlay(null)}
                    >
                      关闭提示
                    </button>
                  </div>
                </div>
              ) : null}

              {choiceReady && currentNode ? (
                <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-6">
                  <div className="mx-auto max-w-6xl">
                    <div className="mb-3 rounded-[1.6rem] border border-white/10 bg-black/58 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:mb-4 sm:rounded-[1.8rem] sm:px-5">
                      <div className="text-[11px] uppercase tracking-[0.45em] text-amber-200/75">
                        请选择下一步
                      </div>
                      <div className="mt-2 break-words text-xl text-stone-50 sm:text-2xl">
                        {runtimeChoices?.title || "做出你的下一步选择"}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-stone-300">
                        {runtimeChoices?.body || "剧情已经停在关键节点，接下来的方向由你决定。"}
                      </p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {choiceBlock.map((choice, index) => {
                        const mood = getChoicePresentation(choice);
                        const selected = pendingChoiceCode === choice.code;

                        return (
                          <button
                            key={choice.code}
                            type="button"
                            className={`group story-choice-enter rounded-[1.6rem] border px-4 py-4 text-left transition duration-200 disabled:opacity-50 sm:rounded-[2rem] sm:px-5 sm:py-5 ${mood.card} ${mood.glow} ${selected ? "scale-[0.985] border-amber-200/55 bg-amber-200/[0.12]" : ""}`}
                            style={{ animationDelay: `${index * 110}ms`, animationFillMode: "both" }}
                            onClick={() =>
                              runtimeChoices
                                ? void handleRuntimeChoice(choice, runtimeChoices.sourceNodeCode)
                                : void handleDefaultChoice(choice.code)
                            }
                            disabled={isSubmitting}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className={`h-2.5 w-2.5 rounded-full ${mood.dot}`} />
                                  <span className="text-[11px] uppercase tracking-[0.38em] text-stone-300">
                                    {selected ? "已锁定" : mood.tag}
                                  </span>
                                </div>
                                <div className="mt-4 break-words text-lg text-stone-50 sm:text-2xl">
                                  {choice.label}
                                </div>
                              </div>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-stone-300">
                                选项 {index + 1}
                              </span>
                            </div>

                            <p className="mt-4 text-sm leading-7 text-stone-300">
                              {choice.hint || "选择后将立刻进入下一段剧情。"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {autoAdvanceReady && currentNode ? (
                <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
                  <div className="mx-auto max-w-3xl rounded-[1.7rem] border border-sky-400/18 bg-black/72 px-5 py-4 text-sm text-sky-50 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        当前片段即将自动流转到 <span className="font-medium">{currentNode.autoNextNodeCode}</span>
                      </span>
                      <span className="text-xs uppercase tracking-[0.32em] text-sky-100/75">
                        自动衔接
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
              ) : null}

              {hasEnded && currentNode?.isEnding ? (
                <div
                  className={`absolute inset-x-0 bottom-0 z-20 px-4 pb-4 transition duration-500 sm:px-6 sm:pb-6 ${
                    endingReveal ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                  }`}
                >
                  <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.3rem] border border-white/10 bg-black/58 shadow-[0_26px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                    <div className={`absolute inset-0 bg-gradient-to-br ${endingAccent}`} />
                    <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_60%)]" />
                    <div className="relative grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="animate-[ending-reveal_700ms_ease-out]">
                        <p className="text-xs uppercase tracking-[0.48em] text-stone-300/80">
                          结局达成
                        </p>
                        <h3 className="mt-3 break-words text-4xl text-stone-50 sm:text-5xl">
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

                      <div className="rounded-[1.8rem] border border-white/10 bg-black/24 p-5 backdrop-blur animate-[ending-reveal_820ms_ease-out]">
                        <p className="text-xs uppercase tracking-[0.35em] text-stone-400">结算摘要</p>
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-2xl border border-white/8 bg-black/22 px-4 py-3">
                            <div className="text-xs text-stone-500">结局类型</div>
                            <div className="mt-1 text-sm text-stone-100">
                              {currentNode.endingTone ? toneLabel[currentNode.endingTone] : "结局"}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/22 px-4 py-3">
                            <div className="text-xs text-stone-500">你的选择</div>
                            <div className="mt-1 text-sm leading-6 text-stone-100">{endingSummary}</div>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-black/22 px-4 py-3">
                            <div className="text-xs text-stone-500">累计分支</div>
                            <div className="mt-1 text-sm text-stone-100">
                              {session?.playthrough.history.length ?? 0} 次选择
                            </div>
                          </div>
                          <button
                            type="button"
                            className="mt-2 rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm text-stone-100 transition hover:border-white/35 hover:bg-white/10"
                            onClick={handleRestart}
                          >
                            重新开始
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!choiceReady && !(hasEnded && currentNode?.isEnding) ? (
                <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-20 sm:px-6 sm:pb-24">
                  <div className="max-w-3xl">
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/42 px-4 py-3 backdrop-blur-xl">
                      <div className="text-[11px] uppercase tracking-[0.35em] text-stone-500">当前片段</div>
                      <div className="mt-2 break-words text-lg leading-tight text-stone-100">
                        {currentNode?.title ?? "加载中"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm text-stone-400">
                        {currentNode?.description || session?.game.tagline}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!choiceReady ? (
                <div className="absolute bottom-4 right-3 z-20 sm:bottom-6 sm:right-6">
                  <button
                    type="button"
                    className="rounded-full border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-300 transition hover:border-amber-200/40 hover:text-amber-100 disabled:opacity-50 sm:px-4 sm:text-sm"
                    onClick={() => {
                      const video = videoRef.current;

                      if (video) {
                        video.pause();
                        video.currentTime = Math.max(video.duration - 0.2, 0);
                        captureVideoFreezeFrame(video);
                      }

                      setHasEnded(true);
                    }}
                    disabled={!currentNode || isSubmitting}
                  >
                    跳过
                  </button>
                </div>
              ) : null}

              {showInfoPanel ? (
                <div className="absolute inset-0 z-30 flex justify-end">
                  <button
                    type="button"
                    aria-label="关闭信息面板"
                    className="absolute inset-0 bg-black/32"
                    onClick={() => setShowInfoPanel(false)}
                  />
                  <aside className="relative z-10 h-full w-[min(92vw,380px)] border-l border-white/10 bg-black/78 p-4 backdrop-blur-2xl">
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.35em] text-stone-500">
                            内容面板
                          </div>
                          <div className="mt-1 text-lg text-stone-100">{getInfoPanelTitle(infoTab)}</div>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-300 transition hover:border-white/30 hover:text-white"
                          onClick={() => setShowInfoPanel(false)}
                        >
                          关闭
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(["history", "state", "actions"] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            className={`rounded-full px-3 py-2 text-xs transition ${
                              infoTab === tab
                                ? "bg-white text-stone-900"
                                : "border border-white/10 bg-white/5 text-stone-300 hover:border-white/30"
                            }`}
                            onClick={() => setInfoTab(tab)}
                          >
                            {getInfoPanelTitle(tab)}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 flex-1 overflow-y-auto pr-1">
                        {infoTab === "history" ? (
                          <div className="grid gap-3">
                            {(session?.playthrough.history.length ?? 0) > 0 ? (
                              session?.playthrough.history.map((entry, index) => (
                                <div
                                  key={`${entry.nodeCode}-${entry.choiceCode}-${index}`}
                                  className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4"
                                >
                                  <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">
                                    第 {index + 1} 次选择
                                  </div>
                                  <div className="mt-2 text-sm text-stone-100">{entry.choiceLabel}</div>
                                  <div className="mt-2 text-sm leading-6 text-stone-400">剧情会根据这次选择继续展开。</div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-[1.5rem] border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                                这里会记录你已经做出的选择。当前还没有出现分支。
                              </div>
                            )}
                          </div>
                        ) : null}

                        {infoTab === "state" ? (
                          <div className="grid gap-4">
                            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.32em] text-stone-500">作品说明</div>
                              <p className="mt-3 text-sm leading-7 text-stone-300">
                                {session?.game.promoText || session?.game.tagline || "这里会显示作品背景、开场提示或玩法说明。"}
                              </p>
                            </div>

                            <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.32em] text-stone-500">关键记录</div>
                              <div className="mt-3 grid gap-2">
                                {variablePreview.length ? (
                                  variablePreview.map((entry) => (
                                    <div
                                      key={entry.key}
                                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm"
                                    >
                                      <span className="text-stone-400">{entry.key}</span>
                                      <span className="font-medium text-stone-100">{entry.value}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-stone-400">当前还没有新的关键记录。</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {infoTab === "actions" ? (
                          <div className="grid gap-3">
                            {runtimeActions.length ? (
                              runtimeActions.map((action) => (
                                <div
                                  key={action.id}
                                  className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-4"
                                >
                                  <div className="text-sm text-stone-100">{action.label}</div>
                                  <div className="mt-2 text-sm leading-7 text-stone-400">{action.detail}</div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-[1.5rem] border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                                当前还没有新的剧情提示。
                              </div>
                            )}
                          </div>
                        ) : null}

                      </div>
                    </div>
                  </aside>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {isLoading || isSubmitting || error ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 sm:bottom-6 sm:px-6">
            <div className="mx-auto max-w-2xl rounded-[1.6rem] border border-white/10 bg-black/60 px-5 py-4 text-sm text-stone-300 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {isLoading ? <p>正在进入作品...</p> : null}
              {!isLoading && isSubmitting ? <p>正在提交当前操作...</p> : null}
              {error ? <p className="text-rose-300">{error}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
