"use client";

import Image from "next/image";
import Link from "next/link";
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

type RecordPayload = {
  id: string;
  recordType: "memory" | "clue" | "echo";
  title: string;
  body: string;
  lockedLabel: string;
  visibleWhenLocked: boolean;
  unlockNodeCodes: string[];
  unlockChoiceCodes: string[];
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
    records: RecordPayload[];
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

type SceneStage = "opening" | "middle" | "ending";

type ScenePresentation = {
  stage: SceneStage;
  label: string;
  eyebrow: string;
  title: string;
  helper: string;
  mainBackground: string;
  ambientBackground: string;
  frameClassName: string;
  videoOverlayClassName: string;
  vignetteClassName: string;
  badgeClassName: string;
  titlePanelClassName: string;
  choiceShellClassName: string;
  choiceEyebrowClassName: string;
  choicePrompt: string;
  choiceHelper: string;
  transitionBackground: string;
  transitionLineClassName: string;
  transitionTextClassName: string;
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
const scenePresentations: Record<SceneStage, ScenePresentation> = {
  opening: {
    stage: "opening",
    label: "开场",
    eyebrow: "片头建立",
    title: "序幕开启",
    helper: "先进入人物、世界观和第一组关键关系。",
    mainBackground: "min-h-screen bg-[#050608] text-stone-100",
    ambientBackground:
      "bg-[radial-gradient(circle_at_18%_12%,_rgba(245,158,11,0.26),_transparent_24%),radial-gradient(circle_at_80%_16%,_rgba(14,165,233,0.14),_transparent_20%),linear-gradient(180deg,_#18110c_0%,_#08090b_42%,_#030405_100%)]",
    frameClassName:
      "relative w-full overflow-hidden rounded-none border-0 bg-black/52 shadow-[0_50px_180px_rgba(120,53,15,0.34)] sm:rounded-[2.8rem] sm:border sm:border-amber-200/12",
    videoOverlayClassName:
      "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(12,8,3,0.48)_0%,_rgba(0,0,0,0.02)_28%,_rgba(0,0,0,0.78)_100%)]",
    vignetteClassName:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_38%,_transparent_34%,_rgba(69,26,3,0.22)_72%,_rgba(0,0,0,0.56)_100%)]",
    badgeClassName:
      "inline-flex rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-amber-100 backdrop-blur",
    titlePanelClassName:
      "rounded-[1.5rem] border border-amber-200/16 bg-black/38 px-4 py-3 shadow-[0_18px_60px_rgba(245,158,11,0.10)] backdrop-blur-xl",
    choiceShellClassName:
      "mb-3 rounded-[1.6rem] border border-amber-200/18 bg-black/58 px-4 py-4 shadow-[0_20px_60px_rgba(245,158,11,0.12)] backdrop-blur-xl sm:mb-4 sm:rounded-[1.8rem] sm:px-5",
    choiceEyebrowClassName: "text-[11px] uppercase tracking-[0.45em] text-amber-100/80",
    choicePrompt: "序幕分歧",
    choiceHelper: "这是玩家第一次介入剧情，选项会决定后续进入哪条片段。",
    transitionBackground:
      "bg-[radial-gradient(circle,_rgba(245,158,11,0.18)_0%,_rgba(0,0,0,0.46)_36%,_rgba(0,0,0,0.9)_100%)]",
    transitionLineClassName: "bg-gradient-to-r from-transparent via-amber-200/70 to-transparent",
    transitionTextClassName:
      "mt-4 break-words text-4xl text-amber-50 sm:text-7xl animate-[cinema-rise_900ms_ease-out]",
  },
  middle: {
    stage: "middle",
    label: "中段",
    eyebrow: "剧情推进",
    title: "分支进行中",
    helper: "持续推进剧情，注意每次选择造成的路径变化。",
    mainBackground: "min-h-screen bg-[#030405] text-stone-100",
    ambientBackground:
      "bg-[radial-gradient(circle_at_top,_rgba(164,31,53,0.24),_transparent_25%),radial-gradient(circle_at_80%_12%,_rgba(245,158,11,0.12),_transparent_18%),linear-gradient(180deg,_#141215_0%,_#08090b_42%,_#030405_100%)]",
    frameClassName:
      "relative w-full overflow-hidden rounded-none border-0 bg-black/55 shadow-[0_50px_180px_rgba(0,0,0,0.6)] sm:rounded-[2.6rem] sm:border sm:border-white/10",
    videoOverlayClassName:
      "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.38)_0%,_rgba(0,0,0,0.04)_22%,_rgba(0,0,0,0.82)_100%)]",
    vignetteClassName:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_36%,_rgba(0,0,0,0.38)_100%)]",
    badgeClassName:
      "inline-flex rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-amber-200/80 backdrop-blur",
    titlePanelClassName:
      "rounded-[1.4rem] border border-white/10 bg-black/42 px-4 py-3 backdrop-blur-xl",
    choiceShellClassName:
      "mb-3 rounded-[1.6rem] border border-white/10 bg-black/58 px-4 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:mb-4 sm:rounded-[1.8rem] sm:px-5",
    choiceEyebrowClassName: "text-[11px] uppercase tracking-[0.45em] text-amber-200/75",
    choicePrompt: "请选择下一步",
    choiceHelper: "剧情已经停在关键节点，接下来的方向由你决定。",
    transitionBackground:
      "bg-[radial-gradient(circle,_rgba(255,255,255,0.14)_0%,_rgba(0,0,0,0.48)_36%,_rgba(0,0,0,0.92)_100%)]",
    transitionLineClassName: "bg-gradient-to-r from-transparent via-amber-200/70 to-transparent",
    transitionTextClassName:
      "mt-4 break-words text-4xl text-stone-50 sm:text-7xl animate-[cinema-rise_900ms_ease-out]",
  },
  ending: {
    stage: "ending",
    label: "结局",
    eyebrow: "终局结算",
    title: "命运落点",
    helper: "进入结局段，系统会汇总本轮路径和关键选择。",
    mainBackground: "min-h-screen bg-[#020305] text-stone-100",
    ambientBackground:
      "bg-[radial-gradient(circle_at_50%_12%,_rgba(56,189,248,0.22),_transparent_24%),radial-gradient(circle_at_18%_18%,_rgba(244,63,94,0.16),_transparent_22%),linear-gradient(180deg,_#050b12_0%,_#050506_48%,_#010203_100%)]",
    frameClassName:
      "relative w-full overflow-hidden rounded-none border-0 bg-black/62 shadow-[0_50px_190px_rgba(14,165,233,0.18)] sm:rounded-[2.8rem] sm:border sm:border-sky-200/12",
    videoOverlayClassName:
      "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(3,7,18,0.42)_0%,_rgba(0,0,0,0.04)_24%,_rgba(2,6,23,0.86)_100%)]",
    vignetteClassName:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(8,47,73,0.2)_68%,_rgba(0,0,0,0.62)_100%)]",
    badgeClassName:
      "inline-flex rounded-full border border-sky-200/18 bg-sky-200/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-sky-100 backdrop-blur",
    titlePanelClassName:
      "rounded-[1.5rem] border border-sky-200/14 bg-black/45 px-4 py-3 shadow-[0_18px_70px_rgba(56,189,248,0.10)] backdrop-blur-xl",
    choiceShellClassName:
      "mb-3 rounded-[1.6rem] border border-sky-200/16 bg-black/64 px-4 py-4 shadow-[0_20px_60px_rgba(56,189,248,0.10)] backdrop-blur-xl sm:mb-4 sm:rounded-[1.8rem] sm:px-5",
    choiceEyebrowClassName: "text-[11px] uppercase tracking-[0.45em] text-sky-100/80",
    choicePrompt: "最后抉择",
    choiceHelper: "这一步会收束当前路线，并决定最终呈现的结局结果。",
    transitionBackground:
      "bg-[radial-gradient(circle,_rgba(56,189,248,0.18)_0%,_rgba(0,0,0,0.52)_34%,_rgba(0,0,0,0.94)_100%)]",
    transitionLineClassName: "bg-gradient-to-r from-transparent via-sky-200/70 to-transparent",
    transitionTextClassName:
      "mt-4 break-words text-4xl text-sky-50 sm:text-7xl animate-[cinema-rise_900ms_ease-out]",
  },
};

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

function getVisitedNodeCodes(history: HistoryPayload[], currentNode: NodePayload | null | undefined) {
  const codes = new Set<string>();

  for (const entry of history) {
    codes.add(entry.nodeCode);
    codes.add(entry.targetNodeCode);
  }

  if (currentNode) {
    codes.add(currentNode.code);
  }

  return codes;
}

function getChosenChoiceCodes(history: HistoryPayload[]) {
  return new Set(history.map((entry) => entry.choiceCode));
}

function isRecordUnlocked(
  record: RecordPayload,
  history: HistoryPayload[],
  currentNode: NodePayload | null | undefined,
) {
  const visitedNodeCodes = getVisitedNodeCodes(history, currentNode);
  const chosenChoiceCodes = getChosenChoiceCodes(history);
  const hasUnlockRules = record.unlockNodeCodes.length > 0 || record.unlockChoiceCodes.length > 0;

  if (!hasUnlockRules) {
    return false;
  }

  return (
    record.unlockNodeCodes.some((code) => visitedNodeCodes.has(code)) ||
    record.unlockChoiceCodes.some((code) => chosenChoiceCodes.has(code))
  );
}

function getExplicitRecordEntries({
  records,
  recordType,
  history,
  currentNode,
}: {
  records: RecordPayload[];
  recordType: RecordPayload["recordType"];
  history: HistoryPayload[];
  currentNode: NodePayload | null | undefined;
}) {
  const metaByType: Record<RecordPayload["recordType"], { unlocked: string; locked: string }> = {
    memory: { unlocked: "回忆已解锁", locked: "未解锁回忆" },
    clue: { unlocked: "线索已解锁", locked: "未解锁线索" },
    echo: { unlocked: "回响已解锁", locked: "未解锁回响" },
  };

  return records
    .filter((record) => record.recordType === recordType)
    .flatMap((record) => {
      const unlocked = isRecordUnlocked(record, history, currentNode);

      if (!unlocked && !record.visibleWhenLocked) {
        return [];
      }

      return [
        {
          id: record.id,
          title: record.title,
          body: unlocked ? record.body : record.lockedLabel || "继续推进剧情后解锁。",
          meta: unlocked ? metaByType[recordType].unlocked : metaByType[recordType].locked,
          locked: !unlocked,
        },
      ];
    });
}

function getMemoryEntries(history: HistoryPayload[], currentNode: NodePayload | null | undefined) {
  const entries: Array<{
    id: string;
    label: string;
    title: string;
    detail: string;
    nodeCode: string;
    active: boolean;
  }> = [];

  if (!history.length && currentNode) {
    return [
      {
        id: `current-${currentNode.code}`,
        label: "当前片段",
        title: currentNode.title || currentNode.code,
        detail: currentNode.description || "故事刚刚开始，新的分支还没有被解开。",
        nodeCode: currentNode.code,
        active: true,
      },
    ];
  }

  history.forEach((entry, index) => {
    if (index === 0) {
      entries.push({
        id: `node-${entry.nodeCode}`,
        label: "起点",
        title: entry.nodeCode,
        detail: "你从这里进入了本轮故事。",
        nodeCode: entry.nodeCode,
        active: false,
      });
    }

    entries.push({
      id: `choice-${entry.nodeCode}-${entry.choiceCode}-${index}`,
      label: `分支 ${index + 1}`,
      title: entry.choiceLabel,
      detail: `通向 ${entry.targetNodeCode}`,
      nodeCode: entry.targetNodeCode,
      active: false,
    });
  });

  if (currentNode && entries.every((entry) => entry.nodeCode !== currentNode.code || !entry.active)) {
    entries.push({
      id: `current-${currentNode.code}`,
      label: currentNode.isEnding ? "当前结局" : "当前位置",
      title: currentNode.title || currentNode.code,
      detail: currentNode.description || "你已经抵达这个片段。",
      nodeCode: currentNode.code,
      active: true,
    });
  }

  return entries;
}

function getClueEntries({
  session,
  currentNode,
  activeTextCard,
  runtimeOverlay,
  variablePreview,
}: {
  session: SessionPayload | null;
  currentNode: NodePayload | null | undefined;
  activeTextCard: RuntimeTextCard | null;
  runtimeOverlay: RuntimeOverlayState | null;
  variablePreview: Array<{ key: string; value: string }>;
}) {
  const entries: Array<{ id: string; title: string; body: string; meta: string }> = [];

  if (session?.game.promoText || session?.game.tagline) {
    entries.push({
      id: "opening",
      title: "开场线索",
      body: session.game.promoText || session.game.tagline,
      meta: "进入作品后解锁",
    });
  }

  if (currentNode?.description) {
    entries.push({
      id: `node-${currentNode.code}`,
      title: currentNode.title || "当前片段",
      body: currentNode.description,
      meta: "当前片段",
    });
  }

  if (activeTextCard?.body) {
    entries.push({
      id: `text-${activeTextCard.title}`,
      title: activeTextCard.title,
      body: activeTextCard.body,
      meta: "剧情提示",
    });
  }

  if (runtimeOverlay?.body) {
    entries.push({
      id: `overlay-${runtimeOverlay.title}`,
      title: runtimeOverlay.title,
      body: runtimeOverlay.body,
      meta: "画面提示",
    });
  }

  variablePreview.forEach((entry, index) => {
    entries.push({
      id: `state-${entry.key}`,
      title: `隐藏状态 ${index + 1}`,
      body: `${entry.key} 变为 ${entry.value}`,
      meta: "状态线索",
    });
  });

  return entries;
}

function getEchoEntries({
  history,
  runtimeActions,
  lastChoiceLabel,
}: {
  history: HistoryPayload[];
  runtimeActions: RuntimeActionEntry[];
  lastChoiceLabel: string | null;
}) {
  const entries: Array<{ id: string; title: string; body: string; meta: string }> = [];

  if (lastChoiceLabel) {
    entries.push({
      id: "last-choice",
      title: "刚刚做出的选择",
      body: lastChoiceLabel,
      meta: "当前回响",
    });
  }

  runtimeActions.forEach((action) => {
    entries.push({
      id: action.id,
      title: action.label,
      body: action.detail,
      meta: "剧情回响",
    });
  });

  history.slice(-4).reverse().forEach((entry, index) => {
    entries.push({
      id: `history-${entry.nodeCode}-${entry.choiceCode}-${index}`,
      title: entry.choiceLabel,
      body: `这次选择把故事推向 ${entry.targetNodeCode}。`,
      meta: "选择后果",
    });
  });

  return entries;
}

function getInfoPanelTitle(tab: "history" | "state" | "actions") {
  if (tab === "history") {
    return "回忆";
  }

  if (tab === "state") {
    return "线索";
  }

  return "回响";
}

export function InteractivePlayer({ projectSlug }: { projectSlug?: string }) {
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
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [lastChoiceLabel, setLastChoiceLabel] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
      setIsVideoPaused(false);
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

  function handleVideoEnded() {
    const video = videoRef.current;

    if (video) {
      captureVideoFreezeFrame(video);
      video.pause();
    }

    setHasEnded(true);
    setIsVideoPaused(true);
  }

  function startStory() {
    setShowPromo(false);
    setIsVideoPaused(false);

    window.setTimeout(() => {
      void videoRef.current?.play().catch(() => {
        setIsVideoPaused(true);
      });
    }, 40);
  }

  function toggleVideoPlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play().then(() => setIsVideoPaused(false)).catch(() => setIsVideoPaused(true));
      return;
    }

    video.pause();
    setIsVideoPaused(true);
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFreshPlaythrough() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSession = await requestSession("/api/playthroughs", {
          method: "POST",
          body: JSON.stringify({
            projectSlug,
            startNodeCode: previewNodeCode || undefined,
          }),
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
  }, [previewNodeCode, projectSlug]);

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

  async function handleDefaultChoice(choiceCode: string) {
    if (!session) {
      return;
    }

    const selectedChoice = session.node.choices.find((choice) => choice.code === choiceCode);

    setIsSubmitting(true);
    setPendingChoiceCode(choiceCode);
    setLastChoiceLabel(selectedChoice?.label ?? null);

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
    setLastChoiceLabel(choice.label);

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
            setIsVideoPaused(true);
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
              setIsVideoPaused(true);
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

          setLastChoiceLabel(null);
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

      setLastChoiceLabel(null);
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
  const sceneStage: SceneStage = currentNode?.isEnding
    ? "ending"
    : progressStep <= 1
      ? "opening"
      : "middle";
  const scenePresentation = scenePresentations[sceneStage];
  const endingAccent = currentNode?.endingTone ? toneAccent[currentNode.endingTone] : "";
  const overlayPositionClass =
    runtimeOverlay?.align === "top"
      ? "items-start pt-20"
      : runtimeOverlay?.align === "bottom"
        ? "items-end pb-20"
        : "items-center";
  const variablePreview = session ? getVariablePreview(session.playthrough.variables) : [];
  const endingSummary = getEndingSummary(session?.playthrough.history ?? []);
  const historyEntries = session?.playthrough.history ?? [];
  const explicitMemoryEntries = getExplicitRecordEntries({
    records: session?.game.records ?? [],
    recordType: "memory",
    history: historyEntries,
    currentNode,
  });
  const explicitClueEntries = getExplicitRecordEntries({
    records: session?.game.records ?? [],
    recordType: "clue",
    history: historyEntries,
    currentNode,
  });
  const explicitEchoEntries = getExplicitRecordEntries({
    records: session?.game.records ?? [],
    recordType: "echo",
    history: historyEntries,
    currentNode,
  });
  const memoryEntries = getMemoryEntries(historyEntries, currentNode);
  const clueEntries = [
    ...explicitClueEntries,
    ...getClueEntries({
      session,
      currentNode,
      activeTextCard,
      runtimeOverlay,
      variablePreview,
    }),
  ];
  const echoEntries = [
    ...explicitEchoEntries,
    ...getEchoEntries({
      history: historyEntries,
      runtimeActions,
      lastChoiceLabel,
    }),
  ];

  if (emptyProject) {
    return (
      <main className="min-h-screen bg-[#060709] text-stone-100">
        <div className="relative isolate min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(194,65,12,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(234,179,8,0.1),_transparent_22%),linear-gradient(180deg,_#140f10_0%,_#060709_58%,_#030405_100%)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
            <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/10 bg-black/35 p-10 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.55em] text-amber-200/70">StoryPlay</p>
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

  return (
    <main className={scenePresentation.mainBackground}>
      <div className="relative isolate min-h-screen overflow-hidden">
        <div className={`absolute inset-0 ${scenePresentation.ambientBackground}`} />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:30px_30px]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1880px] items-center justify-center px-0 py-0 sm:px-4 sm:py-4">
          <section className={scenePresentation.frameClassName}>
            <div className="relative h-[100svh] w-full bg-black sm:h-[calc(100svh-2rem)] lg:h-[88vh]">
              {currentNode && !videoFailed ? (
                <>
                  <video
                    key={currentNode.code}
                    ref={videoRef}
                    className={`h-full w-full object-cover ${freezeFrameVisible ? "invisible" : ""}`}
                    src={currentNode.videoUrl}
                    muted={isMuted}
                    playsInline
                    preload="metadata"
                    autoPlay={!showPromo}
                    onLoadedMetadata={(event) => {
                      event.currentTarget.muted = isMuted;
                    }}
                    onPlay={() => setIsVideoPaused(false)}
                    onPause={() => setIsVideoPaused(true)}
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

              <div className={scenePresentation.videoOverlayClassName} />
              <div className={scenePresentation.vignetteClassName} />
              {choiceReady ? (
                <div className="pointer-events-none absolute inset-0 z-[15] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.05)_0%,_rgba(0,0,0,0.34)_28%,_rgba(0,0,0,0.86)_100%)]" />
              ) : null}

              {showPromo && session && !isPreviewMode ? (
                <div className="absolute inset-0 z-40 flex items-end bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.56)_48%,rgba(0,0,0,0.28)_100%)] px-5 pb-10 pt-24 sm:px-8 lg:px-12 lg:pb-14">
                  <div className="max-w-4xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-md bg-[#e0442e] px-3 py-1.5 text-xs font-medium text-white">
                        StoryPlay
                      </span>
                      <span className="text-xs uppercase tracking-[0.28em] text-stone-300/80">
                        互动影游
                      </span>
                    </div>
                    <h1 className="mt-6 max-w-4xl break-words text-4xl font-semibold leading-tight text-stone-50 sm:text-5xl lg:text-6xl">
                      {session.game.title}
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-stone-200 sm:text-lg">
                      {session.game.promoText || session.game.tagline}
                    </p>
                    {currentNode ? (
                      <div className="mt-6 max-w-2xl border-l border-white/22 pl-4">
                        <div className="text-xs uppercase tracking-[0.32em] text-amber-200/78">
                          即将进入
                        </div>
                        <div className="mt-2 text-xl text-stone-50">{currentNode.title}</div>
                        <p className="mt-2 line-clamp-2 text-sm leading-7 text-stone-300">
                          {currentNode.description || session.game.tagline}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="rounded-md bg-white px-5 py-3 text-sm font-medium text-stone-950 transition hover:bg-[#fff0eb]"
                        onClick={startStory}
                      >
                        进入故事
                      </button>
                      <Link
                        href="/"
                        className="rounded-md border border-white/18 bg-white/8 px-5 py-3 text-sm text-white backdrop-blur transition hover:border-white/36 hover:bg-white/14"
                      >
                        返回大厅
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 transition duration-300 sm:px-6 sm:pt-6 ${showPromo && !isPreviewMode ? "opacity-0" : "opacity-100"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={scenePresentation.badgeClassName}>
                    {isPreviewMode ? "片段试玩" : sceneLabel}
                  </span>
                  <span className="hidden rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-stone-200/78 backdrop-blur sm:inline-flex">
                    {scenePresentation.eyebrow}
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
                    className="rounded-md border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-200 transition hover:border-white/35 hover:bg-white/8 sm:px-4 sm:text-sm"
                    onClick={toggleVideoPlayback}
                    disabled={!currentNode || isSubmitting || choiceReady}
                  >
                    {isVideoPaused ? "播放" : "暂停"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-200 transition hover:border-white/35 hover:bg-white/8 sm:px-4 sm:text-sm"
                    onClick={toggleMute}
                    disabled={!currentNode}
                  >
                    {isMuted ? "开声" : "静音"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-200 transition hover:border-white/35 hover:bg-white/8 sm:px-4 sm:text-sm"
                    onClick={() => setShowInfoPanel((current) => !current)}
                  >
                    {showInfoPanel ? "收起" : "回忆"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/12 bg-black/40 px-3 py-2 text-xs text-stone-100 transition hover:border-white/35 hover:bg-white/8 disabled:opacity-50 sm:px-4 sm:text-sm"
                    onClick={handleRestart}
                    disabled={!session || isSubmitting}
                  >
                    重开
                  </button>
                </div>
              </div>

              {transitionVisible ? (
                <div className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center ${scenePresentation.transitionBackground}`}>
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06)_0%,_transparent_18%,_rgba(0,0,0,0.42)_100%)]" />
                  <div className="relative px-6 text-center">
                    <div className={`mx-auto h-px w-28 ${scenePresentation.transitionLineClassName}`} />
                    <div className="mt-5 text-[11px] uppercase tracking-[0.7em] text-amber-200/72">
                      {scenePresentation.eyebrow}
                    </div>
                    <div className={scenePresentation.transitionTextClassName}>
                      {transitionText}
                    </div>
                    {lastChoiceLabel ? (
                      <div className="mx-auto mt-5 max-w-xl rounded-md border border-white/12 bg-black/34 px-4 py-3 text-sm leading-7 text-stone-200 backdrop-blur">
                        你的选择：{lastChoiceLabel}
                      </div>
                    ) : null}
                    <div className={`mx-auto mt-5 h-px w-28 ${scenePresentation.transitionLineClassName}`} />
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
                <div className="absolute inset-0 z-20 flex items-end px-3 pb-4 pt-24 sm:px-6 sm:pb-6">
                  <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end">
                    <div className="story-choice-enter rounded-lg border border-white/12 bg-black/64 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-6">
                      <div className={scenePresentation.choiceEyebrowClassName}>
                        剧情暂停
                      </div>
                      <div className="mt-3 break-words text-2xl font-semibold leading-tight text-stone-50 sm:text-3xl">
                        {runtimeChoices?.title || currentNode.title || "做出你的下一步选择"}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-stone-300">
                        {runtimeChoices?.body || scenePresentation.choiceHelper}
                      </p>
                      <div className="mt-5 h-px w-20 bg-white/20" />
                      <p className="mt-4 text-xs uppercase tracking-[0.32em] text-stone-400">
                        选择会立刻改变后续片段
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {choiceBlock.map((choice, index) => {
                        const mood = getChoicePresentation(choice);
                        const selected = pendingChoiceCode === choice.code;

                        return (
                          <button
                            key={choice.code}
                            type="button"
                            className={`group story-choice-enter rounded-lg border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 sm:px-5 sm:py-5 ${mood.card} ${mood.glow} ${selected ? "scale-[0.985] border-amber-200/55 bg-amber-200/[0.12]" : ""}`}
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
                              <span className="rounded-md border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
                                {index + 1}
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
                  <div className="max-w-xl">
                    <div className="inline-flex max-w-full items-center gap-3 rounded-md border border-white/10 bg-black/36 px-4 py-3 text-sm text-stone-200 backdrop-blur-xl">
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.28em] text-stone-400">
                        {scenePresentation.label}
                      </span>
                      <span className="truncate text-stone-50">{currentNode?.title ?? "加载中"}</span>
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
                      setIsVideoPaused(true);
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
                  <aside className="relative z-10 h-full w-[min(94vw,520px)] border-l border-white/10 bg-black/82 p-4 backdrop-blur-2xl">
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.35em] text-stone-500">
                            剧情记录
                          </div>
                          <div className="mt-1 text-xl text-stone-100">{getInfoPanelTitle(infoTab)}</div>
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
                          <div className="grid gap-4">
                            {explicitMemoryEntries.length ? (
                              <div className="grid gap-3">
                                {explicitMemoryEntries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className={`rounded-lg border px-4 py-4 ${
                                      entry.locked
                                        ? "border-white/8 bg-white/[0.02] opacity-75"
                                        : "border-[#e0442e]/35 bg-[#e0442e]/10"
                                    }`}
                                  >
                                    <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">{entry.meta}</div>
                                    <div className="mt-2 text-sm text-stone-100">{entry.title}</div>
                                    <div className="mt-2 text-sm leading-7 text-stone-400">{entry.body}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="rounded-lg border border-white/8 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.32em] text-stone-500">已解锁路线</div>
                              <div className="mt-4">
                                {memoryEntries.length ? (
                                  <div className="relative grid gap-0">
                                    {memoryEntries.map((entry, index) => (
                                      <div key={entry.id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                                        {index < memoryEntries.length - 1 ? (
                                          <div className="absolute left-[9px] top-5 h-full w-px bg-white/12" />
                                        ) : null}
                                        <div className={`relative z-10 mt-1 h-5 w-5 rounded-full border ${entry.active ? "border-[#e0442e] bg-[#e0442e] shadow-[0_0_24px_rgba(224,68,46,0.35)]" : "border-white/18 bg-white/8"}`} />
                                        <div className={`rounded-lg border px-4 py-3 ${entry.active ? "border-[#e0442e]/45 bg-[#e0442e]/10" : "border-white/8 bg-black/18"}`}>
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-[11px] uppercase tracking-[0.28em] text-stone-500">
                                              {entry.label}
                                            </span>
                                            <span className="text-xs text-stone-500">{entry.nodeCode}</span>
                                          </div>
                                          <div className="mt-2 text-sm text-stone-100">{entry.title}</div>
                                          <div className="mt-2 text-sm leading-6 text-stone-400">{entry.detail}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                                    进入故事后，路线会在这里逐步点亮。
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {infoTab === "state" ? (
                          <div className="grid gap-3">
                            {clueEntries.length ? (
                              clueEntries.map((entry) => (
                                <div key={entry.id} className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-4">
                                  <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">{entry.meta}</div>
                                  <div className="mt-2 text-sm text-stone-100">{entry.title}</div>
                                  <div className="mt-2 text-sm leading-7 text-stone-400">{entry.body}</div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                                线索会随着剧情推进逐步解开。
                              </div>
                            )}
                          </div>
                        ) : null}

                        {infoTab === "actions" ? (
                          <div className="grid gap-3">
                            {echoEntries.length ? (
                              echoEntries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-4"
                                >
                                  <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">{entry.meta}</div>
                                  <div className="mt-2 text-sm text-stone-100">{entry.title}</div>
                                  <div className="mt-2 text-sm leading-7 text-stone-400">{entry.body}</div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-dashed border-white/12 px-4 py-6 text-sm leading-7 text-stone-400">
                                选择造成的影响会在这里留下回响。
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
