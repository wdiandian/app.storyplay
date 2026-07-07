"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { BranchGraph, type BranchGraphFilter } from "@/components/branch-graph";
import type {
  ConditionOperator,
  ConditionRule,
  EndingTone,
  StoryChoice,
  StoryGame,
  StoryNode,
  TimelineEvent,
  TimelineEventType,
  ProjectSummary,
  VariableAction,
  VariableActionType,
  VariableDefinition,
  VariableRuntimeValue,
  VariableValueType,
} from "@/lib/story-engine";

type AdminPayload = {
  game: StoryGame;
  projects?: ProjectSummary[];
};

type UploadPayload = {
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
};

type WorkspaceTab = "project" | "flow";

type NodeListFilter = "all" | "issues" | "start" | "ending" | "isolated";
type NodeNavigationMode = "flat" | "chapter";

type DraftVariable = {
  key: string;
  label: string;
  type: VariableValueType;
  initialValue: string;
  optionsText: string;
};

type DraftCondition = {
  id: string;
  variableKey: string;
  operator: ConditionOperator;
  value: string;
};

type DraftAction = {
  id: string;
  variableKey: string;
  type: VariableActionType;
  value: string;
};

type DraftTimelineChoice = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
  conditions: DraftCondition[];
  actions: DraftAction[];
};

type DraftTimelineEvent = {
  id: string;
  atMs: string;
  type: TimelineEventType;
  payloadText: string;
  conditions: DraftCondition[];
  actions: DraftAction[];
};

type DraftNode = {
  title: string;
  description: string;
  transcript: string;
  videoUrl: string;
  nodeType: "video" | "ending";
  autoNextNodeCode: string;
  endingTone: EndingTone;
  choices: Array<StoryChoice & { conditions: ConditionRule[]; actions: VariableAction[] }>;
  timelineEvents: DraftTimelineEvent[];
};

type NewNodeForm = {
  code: string;
  title: string;
  nodeType: "video" | "ending";
  videoUrl: string;
};

type NewChoiceForm = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
  targetNodeTitle: string;
};

type QuickLinkForm = {
  title: string;
  code: string;
  nodeType: "video" | "ending";
  linkMode: "auto" | "choice";
  choiceLabel: string;
  choiceHint: string;
};

type GameFormState = {
  title: string;
  slug: string;
  tagline: string;
  listedOnHome: boolean;
  sortOrder: string;
  intro: string;
  promoVideoUrl: string;
  promoPosterUrl: string;
  promoText: string;
  startNodeCode: string;
  variables: DraftVariable[];
};

type AdminStoryEditorProps = {
  initialGame: StoryGame;
  projects: ProjectSummary[];
};

const workspaceTabs: Array<{
  id: WorkspaceTab;
  label: string;
  step: string;
  hint: string;
  description: string;
}> = [
  {
    id: "project",
    label: "项目",
    step: "Step 1",
    hint: "先定作品信息、入口内容和全局变量。",
    description: "这里处理作品基础配置。",
  },
  {
    id: "flow",
    label: "剧情",
    step: "Step 2",
    hint: "先创建片段，再连结构、查问题。",
    description: "这里处理片段目录和剧情结构。",
  },
];

const endingToneLabel: Record<EndingTone, string> = {
  truth: "真相结局",
  survival: "生存结局",
  tragedy: "悲剧结局",
};

const nodeTypeLabel: Record<"video" | "ending", string> = {
  video: "视频片段",
  ending: "结局片段",
};

type PlayerSceneStage = "opening" | "middle" | "ending";

type PlayerScenePresentation = {
  stage: PlayerSceneStage;
  label: string;
  detail: string;
  badgeClassName: string;
};

const playerScenePresentation: Record<PlayerSceneStage, PlayerScenePresentation> = {
  opening: {
    stage: "opening",
    label: "开场 UI",
    detail: "玩家点击开始后进入的第一段，会使用更强的片头氛围和引导文案。",
    badgeClassName: "bg-amber-100 text-amber-800",
  },
  middle: {
    stage: "middle",
    label: "中段 UI",
    detail: "普通剧情推进段，重点展示当前片段和分支选择。",
    badgeClassName: "bg-stone-200 text-stone-700",
  },
  ending: {
    stage: "ending",
    label: "结局 UI",
    detail: "结局片段会使用终局展示和结算摘要。",
    badgeClassName: "bg-sky-100 text-sky-800",
  },
};

const timelineEventTypeOptions: Array<{ value: TimelineEventType; label: string }> = [
  { value: "show_text", label: "显示文本" },
  { value: "show_choice", label: "显示选项" },
  { value: "pause", label: "暂停视频" },
  { value: "play_audio", label: "播放音频" },
  { value: "jump", label: "直接跳转" },
  { value: "run_actions", label: "执行动作" },
  { value: "show_overlay", label: "显示叠层" },
];

const variableTypeOptions: Array<{ value: VariableValueType; label: string }> = [
  { value: "string", label: "字符串" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔" },
  { value: "enum", label: "枚举" },
];

const conditionOperatorOptions: Array<{ value: ConditionOperator; label: string }> = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "includes", label: "包含标签" },
  { value: "not_includes", label: "不包含标签" },
];

const actionTypeOptions: Array<{ value: VariableActionType; label: string }> = [
  { value: "set", label: "设值" },
  { value: "increment", label: "增减数值" },
  { value: "toggle", label: "布尔翻转" },
  { value: "append_tag", label: "追加标签" },
];

function pickNode(game: StoryGame, preferredNodeCode?: string) {
  if (preferredNodeCode) {
    const preferred = game.nodes.find((node) => node.code === preferredNodeCode);

    if (preferred) {
      return preferred;
    }
  }

  return game.nodes.find((node) => node.code === game.startNodeCode) ?? game.nodes[0] ?? null;
}

function getNodeDisplayName(game: StoryGame, nodeCode: string) {
  const node = game.nodes.find((entry) => entry.code === nodeCode);
  return node ? `${node.title} / ${node.code}` : `${nodeCode}（未找到）`;
}

function getPlayerScenePresentation(node: StoryNode, game: StoryGame) {
  if (node.isEnding) {
    return playerScenePresentation.ending;
  }

  if (node.code === game.startNodeCode) {
    return playerScenePresentation.opening;
  }

  return playerScenePresentation.middle;
}

function getNodeChapterLabel(node: StoryNode) {
  const title = node.title.trim();

  const chapterMatch = title.match(/^(序章|终章|尾声|第.{1,8}[章幕卷集])[\s:：-]*/);

  if (chapterMatch?.[1]) {
    return chapterMatch[1];
  }

  const segments = title.split(/[/｜|:：-]/).map((segment) => segment.trim()).filter(Boolean);

  if (segments.length > 1 && segments[0] && segments[0].length <= 12) {
    return segments[0];
  }

  return node.isEnding ? "结局组" : "未分组";
}

function buildNodeCode(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = Date.now().toString(36);

  return normalized ? `${normalized}_${suffix}` : `node_${suffix}`;
}

function buildId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function inputClassName() {
  return "rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-500";
}

function textareaClassName() {
  return "min-h-[120px] rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-500";
}

function loadErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function requestAdmin<T extends object>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T | { error: string };

  if (!response.ok || (typeof payload === "object" && payload !== null && "error" in payload)) {
    throw new Error(
      typeof payload === "object" && payload !== null && "error" in payload
        ? payload.error
        : "Unknown admin error",
    );
  }

  return payload;
}

function withProjectQuery(path: string, projectSlug: string) {
  const value = projectSlug.trim();

  if (!value) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}project=${encodeURIComponent(value)}`;
}

function toDraftVariables(variables: VariableDefinition[] | undefined): DraftVariable[] {
  return (variables ?? []).map((variable) => ({
    key: variable.key,
    label: variable.label,
    type: variable.type,
    initialValue: String(variable.initialValue ?? ""),
    optionsText: (variable.options ?? []).join(", "),
  }));
}

function parseVariableInitialValue(variable: DraftVariable): VariableRuntimeValue {
  if (variable.type === "number") {
    const parsed = Number(variable.initialValue);

    if (!Number.isFinite(parsed)) {
      throw new Error(`变量 ${variable.key || variable.label || "未命名变量"} 的初始值不是有效数字`);
    }

    return parsed;
  }

  if (variable.type === "boolean") {
    const normalized = variable.initialValue.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }

    throw new Error(`变量 ${variable.key || variable.label || "未命名变量"} 的布尔值只能是 true 或 false`);
  }

  return variable.initialValue;
}

function toVariablePayload(variables: DraftVariable[]): VariableDefinition[] {
  return variables.map((variable) => ({
    key: variable.key.trim(),
    label: variable.label.trim(),
    type: variable.type,
    initialValue: parseVariableInitialValue(variable),
    options:
      variable.type === "enum"
        ? variable.optionsText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined,
  }));
}

function toDraftConditions(conditions: ConditionRule[] | undefined): DraftCondition[] {
  return (conditions ?? []).map((condition, index) => ({
    id: condition.id || `condition_${index + 1}`,
    variableKey: condition.variableKey,
    operator: condition.operator,
    value: String(condition.value ?? ""),
  }));
}

function toDraftActions(actions: VariableAction[] | undefined): DraftAction[] {
  return (actions ?? []).map((action, index) => ({
    id: action.id || `action_${index + 1}`,
    variableKey: action.variableKey,
    type: action.type,
    value: action.value === undefined ? "" : String(action.value),
  }));
}

function parseRuleValue(rawValue: string, variable?: DraftVariable): VariableRuntimeValue {
  if (!variable) {
    return rawValue;
  }

  if (variable.type === "number") {
    const parsed = Number(rawValue);

    if (!Number.isFinite(parsed)) {
      throw new Error(`变量 ${variable.key || variable.label || "未命名变量"} 的规则值必须是数字`);
    }

    return parsed;
  }

  if (variable.type === "boolean") {
    const normalized = rawValue.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }

    throw new Error(`变量 ${variable.key || variable.label || "未命名变量"} 的规则值必须是 true 或 false`);
  }

  return rawValue.trim();
}

function toConditionPayload(drafts: DraftCondition[], variables: DraftVariable[]) {
  return drafts.map((condition, index) => {
    const variable = variables.find((entry) => entry.key === condition.variableKey);

    if (!condition.variableKey.trim()) {
      throw new Error(`第 ${index + 1} 条条件缺少变量 key`);
    }

    return {
      id: condition.id.trim() || `condition_${index + 1}`,
      variableKey: condition.variableKey.trim(),
      operator: condition.operator,
      value: parseRuleValue(condition.value, variable),
    } satisfies ConditionRule;
  });
}

function toActionPayload(drafts: DraftAction[], variables: DraftVariable[]) {
  return drafts.map((action, index) => {
    const variable = variables.find((entry) => entry.key === action.variableKey);

    if (!action.variableKey.trim()) {
      throw new Error(`第 ${index + 1} 条动作缺少变量 key`);
    }

    const payload: VariableAction = {
      id: action.id.trim() || `action_${index + 1}`,
      variableKey: action.variableKey.trim(),
      type: action.type,
    };

    if (action.type === "toggle") {
      return payload;
    }

    payload.value = parseRuleValue(action.value, variable);
    return payload;
  });
}

function parsePayloadText(payloadText: string) {
  if (!payloadText.trim()) {
    return {};
  }

  const parsed = JSON.parse(payloadText) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("时间线事件 payload 必须是 JSON 对象");
  }

  return parsed as Record<string, unknown>;
}

function stringifyPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function getTimelinePayloadValue(event: DraftTimelineEvent) {
  return parsePayloadText(event.payloadText);
}

function updateTimelinePayload(
  event: DraftTimelineEvent,
  updater: (payload: Record<string, unknown>) => Record<string, unknown>,
) {
  return {
    ...event,
    payloadText: stringifyPayload(updater(getTimelinePayloadValue(event))),
  };
}

function getTimelineStringField(event: DraftTimelineEvent, key: string) {
  const payload = getTimelinePayloadValue(event);
  return typeof payload[key] === "string" ? String(payload[key]) : "";
}

function getTimelineBooleanField(event: DraftTimelineEvent, key: string, fallback = false) {
  const payload = getTimelinePayloadValue(event);
  return typeof payload[key] === "boolean" ? Boolean(payload[key]) : fallback;
}

function readTimelineChoiceDrafts(event: DraftTimelineEvent): DraftTimelineChoice[] {
  const payload = getTimelinePayloadValue(event);
  const rawChoices = payload.choices;

  if (!Array.isArray(rawChoices)) {
    return [];
  }

  return rawChoices
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const choice = entry as Record<string, unknown>;
      const rawConditions = Array.isArray(choice.conditions) ? choice.conditions : [];
      const rawActions = Array.isArray(choice.actions) ? choice.actions : [];

      return {
        code: typeof choice.code === "string" ? choice.code : "",
        label: typeof choice.label === "string" ? choice.label : "",
        hint: typeof choice.hint === "string" ? choice.hint : "",
        targetNodeCode:
          typeof choice.targetNodeCode === "string" ? choice.targetNodeCode : "",
        conditions: rawConditions
          .map((item, index) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const condition = item as Record<string, unknown>;
            const operator = condition.operator;

            if (
              typeof condition.variableKey !== "string" ||
              (operator !== "eq" &&
                operator !== "neq" &&
                operator !== "gt" &&
                operator !== "gte" &&
                operator !== "lt" &&
                operator !== "lte" &&
                operator !== "includes" &&
                operator !== "not_includes")
            ) {
              return null;
            }

            return {
              id: typeof condition.id === "string" ? condition.id : `condition_${index + 1}`,
              variableKey: condition.variableKey,
              operator,
              value: String(condition.value ?? ""),
            } satisfies DraftCondition;
          })
          .filter((condition): condition is DraftCondition => Boolean(condition)),
        actions: rawActions
          .map((item, index) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const action = item as Record<string, unknown>;
            const type = action.type;

            if (
              typeof action.variableKey !== "string" ||
              (type !== "set" &&
                type !== "increment" &&
                type !== "toggle" &&
                type !== "append_tag")
            ) {
              return null;
            }

            return {
              id: typeof action.id === "string" ? action.id : `action_${index + 1}`,
              variableKey: action.variableKey,
              type,
              value: action.value === undefined ? "" : String(action.value),
            } satisfies DraftAction;
          })
          .filter((action): action is DraftAction => Boolean(action)),
      } satisfies DraftTimelineChoice;
    })
    .filter((choice): choice is DraftTimelineChoice => Boolean(choice));
}

function writeTimelineChoiceDrafts(
  event: DraftTimelineEvent,
  choices: DraftTimelineChoice[],
  variables: DraftVariable[],
) {
  return updateTimelinePayload(event, (payload) => ({
    ...payload,
    choices: choices.map((choice, index) => ({
      code: choice.code.trim() || `choice_${index + 1}`,
      label: choice.label.trim(),
      hint: choice.hint.trim(),
      targetNodeCode: choice.targetNodeCode.trim(),
      conditions: toConditionPayload(choice.conditions, variables),
      actions: toActionPayload(choice.actions, variables),
    })),
  }));
}

function toDraftTimelineEvents(events: TimelineEvent[] | undefined): DraftTimelineEvent[] {
  return (events ?? []).map((event) => ({
    id: event.id,
    atMs: String(event.atMs),
    type: event.type,
    payloadText: JSON.stringify(event.payload ?? {}, null, 2),
    conditions: toDraftConditions(event.conditions),
    actions: toDraftActions(event.actions),
  }));
}

function toTimelinePayload(events: DraftTimelineEvent[], variables: DraftVariable[]): TimelineEvent[] {
  return events.map((event, index) => {
    const atMs = Number(event.atMs);

    if (!event.id.trim()) {
      throw new Error(`第 ${index + 1} 个时间线事件缺少事件 ID`);
    }

    if (!Number.isFinite(atMs) || atMs < 0) {
      throw new Error(`时间线事件 ${event.id} 的触发时间无效`);
    }

    return {
      id: event.id.trim(),
      atMs,
      type: event.type,
      payload: parsePayloadText(event.payloadText),
      conditions: toConditionPayload(event.conditions, variables),
      actions: toActionPayload(event.actions, variables),
    };
  });
}

function toDraftNode(node: StoryNode): DraftNode {
  return {
    title: node.title,
    description: node.description,
    transcript: node.transcript,
    videoUrl: node.videoUrl,
    nodeType: node.nodeType,
    autoNextNodeCode: node.autoNextNodeCode ?? "",
    endingTone: node.endingTone ?? "truth",
    choices: (node.choices ?? []).map((choice) => ({
      ...structuredClone(choice),
      conditions: structuredClone(choice.conditions ?? []),
      actions: structuredClone(choice.actions ?? []),
    })),
    timelineEvents: toDraftTimelineEvents(node.timelineEvents),
  };
}

function buildGameForm(game: StoryGame): GameFormState {
  return {
    title: game.title,
    slug: game.slug,
    tagline: game.tagline,
    listedOnHome: game.listedOnHome,
    sortOrder: String(game.sortOrder ?? 0),
    intro: game.intro,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    promoText: game.promoText,
    startNodeCode: game.startNodeCode,
    variables: toDraftVariables(game.variables),
  };
}

function buildNodeSavePayload(draftNode: DraftNode, variables: DraftVariable[]) {
  return {
    ...draftNode,
    autoNextNodeCode: draftNode.nodeType === "ending" ? null : draftNode.autoNextNodeCode || null,
    endingTone: draftNode.nodeType === "ending" ? draftNode.endingTone : null,
    choices: draftNode.choices.map((choice, index) => ({
      code: choice.code.trim() || `choice_${index + 1}`,
      label: choice.label.trim(),
      hint: choice.hint.trim(),
      targetNodeCode: choice.targetNodeCode.trim(),
      conditions: toConditionPayload(toDraftConditions(choice.conditions), variables),
      actions: toActionPayload(toDraftActions(choice.actions), variables),
    })),
    timelineEvents: toTimelinePayload(draftNode.timelineEvents, variables),
  };
}

function Field({
  label,
  hint,
  visibility,
  children,
}: {
  label: string;
  hint?: string;
  visibility?: "player" | "logic";
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-stone-900">{label}</div>
          {visibility ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] ${
                visibility === "player"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              {visibility === "player" ? "前台显示" : "仅逻辑"}
            </span>
          ) : null}
        </div>
        {hint ? <div className="mt-1 text-xs leading-6 text-stone-500">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-stone-900/10 bg-white/80 p-5 shadow-[0_18px_60px_rgba(52,38,25,0.06)]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">{eyebrow}</p>
        <h2 className="mt-3 text-xl leading-snug text-stone-950 sm:text-[1.7rem]">{title}</h2>
        <p className="mt-2 text-sm leading-7 text-stone-700">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function RuleBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
      <div>
        <div className="text-sm font-medium text-stone-900">{title}</div>
        <div className="mt-1 text-xs leading-6 text-stone-500">{description}</div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function HelperCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-stone-900/10 bg-stone-50/80 px-4 py-4">
      <div className="text-sm font-medium text-stone-900">{title}</div>
      <div className="mt-2 text-sm leading-7 text-stone-600">{children}</div>
    </div>
  );
}

export function AdminStoryEditor({ initialGame, projects: initialProjects }: AdminStoryEditorProps) {
  const router = useRouter();
  const initialNode = pickNode(initialGame);
  const [game, setGame] = useState<StoryGame>(initialGame);
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [selectedNodeCode, setSelectedNodeCode] = useState<string>(initialNode?.code ?? "");
  const [draftNode, setDraftNode] = useState<DraftNode | null>(
    initialNode ? toDraftNode(initialNode) : null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    initialGame.nodes.length ? "flow" : "project",
  );
  const [gameForm, setGameForm] = useState<GameFormState>(() => buildGameForm(initialGame));
  const [newNodeForm, setNewNodeForm] = useState<NewNodeForm>({
    code: "",
    title: "",
    nodeType: "video",
    videoUrl: "",
  });
  const [newChoiceForm, setNewChoiceForm] = useState<NewChoiceForm>({
    code: "",
    label: "",
    hint: "",
    targetNodeCode: "",
    targetNodeTitle: "",
  });
  const [quickLinkForm, setQuickLinkForm] = useState<QuickLinkForm>({
    title: "",
    code: "",
    nodeType: "video",
    linkMode: "choice",
    choiceLabel: "",
    choiceHint: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [uploadingPromo, setUploadingPromo] = useState(false);
  const [uploadingPromoPoster, setUploadingPromoPoster] = useState(false);
  const [uploadingNode, setUploadingNode] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | TimelineEventType>("all");
  const [collapsedTimelineEventIds, setCollapsedTimelineEventIds] = useState<string[]>([]);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeFilter, setNodeFilter] = useState<NodeListFilter>("all");
  const [branchGraphFilter, setBranchGraphFilter] = useState<BranchGraphFilter>("all");
  const [nodeNavigationMode, setNodeNavigationMode] = useState<NodeNavigationMode>("flat");
  const [draggingTimelineEventId, setDraggingTimelineEventId] = useState<string | null>(null);

  const className = inputClassName();
  const textareaClass = textareaClassName();
  const currentProjectSlug = game.slug;
  const selectedNode = game.nodes.find((node) => node.code === selectedNodeCode) ?? null;
  const hasNodes = game.nodes.length > 0;
  const activeWorkspace = activeTab === "project" ? workspaceTabs[0] : workspaceTabs[1];
  const projectBaselineSnapshot = useMemo(() => JSON.stringify(buildGameForm(game)), [game]);
  const projectDraftSnapshot = useMemo(() => JSON.stringify(gameForm), [gameForm]);
  const projectDirty = projectBaselineSnapshot !== projectDraftSnapshot;
  const selectedNodeBaselineSnapshot = useMemo(
    () => (selectedNode ? JSON.stringify(toDraftNode(selectedNode)) : null),
    [selectedNode],
  );
  const selectedNodeDraftSnapshot = useMemo(
    () => (draftNode ? JSON.stringify(draftNode) : null),
    [draftNode],
  );
  const flowComposerRef = useRef<HTMLDivElement | null>(null);
  const quickLinkComposerRef = useRef<HTMLDivElement | null>(null);
  const nodeDirty = Boolean(
    selectedNode && draftNode && selectedNodeBaselineSnapshot !== selectedNodeDraftSnapshot,
  );
  const nodeListEntries = useMemo(() => {
    const nodeCodeSet = new Set(game.nodes.map((node) => node.code));
    const incoming = new Map<string, number>();

    for (const node of game.nodes) {
      incoming.set(node.code, 0);
    }

    for (const node of game.nodes) {
      if (node.autoNextNodeCode && nodeCodeSet.has(node.autoNextNodeCode)) {
        incoming.set(node.autoNextNodeCode, (incoming.get(node.autoNextNodeCode) ?? 0) + 1);
      }

      for (const choice of node.choices ?? []) {
        if (nodeCodeSet.has(choice.targetNodeCode)) {
          incoming.set(choice.targetNodeCode, (incoming.get(choice.targetNodeCode) ?? 0) + 1);
        }
      }
    }

    return game.nodes.map((node) => {
      const invalidChoiceTargets = (node.choices ?? []).filter(
        (choice) => choice.targetNodeCode && !nodeCodeSet.has(choice.targetNodeCode),
      ).length;
      const invalidAutoTarget =
        node.autoNextNodeCode && !nodeCodeSet.has(node.autoNextNodeCode) ? 1 : 0;
      const isStart = node.code === game.startNodeCode;
      const isEnding = Boolean(node.isEnding);
      const incomingCount = incoming.get(node.code) ?? 0;
      const isIsolated = !isStart && !isEnding && incomingCount === 0;
      const issues: string[] = [];

      if (!node.videoUrl.trim()) {
        issues.push("缺视频");
      }

      if (!isEnding && !(node.choices?.length ?? 0) && !node.autoNextNodeCode) {
        issues.push("缺出口");
      }

      if (invalidChoiceTargets + invalidAutoTarget > 0) {
        issues.push("目标无效");
      }

      if (isIsolated) {
        issues.push("孤立片段");
      }

      return {
        node,
        isStart,
        isEnding,
        isIsolated,
        incomingCount,
        playerScene: getPlayerScenePresentation(node, game),
        issues,
        issueCount: issues.length,
      };
    });
  }, [game]);
  const filteredNodeEntries = useMemo(() => {
    const normalizedSearch = nodeSearch.trim().toLowerCase();

    return nodeListEntries.filter((entry) => {
      const matchesSearch =
        !normalizedSearch ||
        entry.node.title.toLowerCase().includes(normalizedSearch) ||
        entry.node.code.toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (nodeFilter === "issues") {
        return entry.issueCount > 0;
      }

      if (nodeFilter === "start") {
        return entry.isStart;
      }

      if (nodeFilter === "ending") {
        return entry.isEnding;
      }

      if (nodeFilter === "isolated") {
        return entry.isIsolated;
      }

      return true;
    });
  }, [nodeFilter, nodeListEntries, nodeSearch]);
  const groupedNodeEntries = useMemo(
    () => ({
      issues: filteredNodeEntries.filter((entry) => entry.issueCount > 0),
      main: filteredNodeEntries.filter((entry) => !entry.isEnding && entry.issueCount === 0),
      endings: filteredNodeEntries.filter((entry) => entry.isEnding),
    }),
    [filteredNodeEntries],
  );
  const chapterNodeEntries = useMemo(() => {
    const groups = new Map<string, typeof filteredNodeEntries>();

    for (const entry of filteredNodeEntries) {
      const label = getNodeChapterLabel(entry.node);
      const group = groups.get(label) ?? [];
      group.push(entry);
      groups.set(label, group);
    }

    return Array.from(groups.entries()).map(([label, entries]) => ({
      label,
      entries,
    }));
  }, [filteredNodeEntries]);
  const orderedProjects = useMemo(
    () =>
      [...projects].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return right.sortOrder - left.sortOrder;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    [projects],
  );
  const issueNodeEntries = useMemo(
    () => nodeListEntries.filter((entry) => entry.issueCount > 0),
    [nodeListEntries],
  );
  const selectedNodeEntry = useMemo(
    () => nodeListEntries.find((entry) => entry.node.code === selectedNodeCode) ?? null,
    [nodeListEntries, selectedNodeCode],
  );
  const hasUnsavedActiveChanges = activeTab === "project" ? projectDirty : nodeDirty;

  function syncFromGame(nextGame: StoryGame, preferredNodeCode?: string) {
    const nextNode = pickNode(nextGame, preferredNodeCode ?? selectedNodeCode);

    setGame(nextGame);
    setProjects((current) => {
      const nextSummary: ProjectSummary = {
        id: nextGame.id,
        slug: nextGame.slug,
        title: nextGame.title,
        tagline: nextGame.tagline,
        listedOnHome: nextGame.listedOnHome,
        sortOrder: nextGame.sortOrder ?? 0,
        promoVideoUrl: nextGame.promoVideoUrl,
        promoPosterUrl: nextGame.promoPosterUrl,
        updatedAt: new Date().toISOString(),
      };
      const filtered = current.filter((item) => item.slug !== nextGame.slug);
      return [nextSummary, ...filtered];
    });
    setGameForm(buildGameForm(nextGame));
    setSelectedNodeCode(nextNode?.code ?? "");
    setDraftNode(nextNode ? toDraftNode(nextNode) : null);
    setTimelineFilter("all");
    setCollapsedTimelineEventIds([]);
    setNewChoiceForm((current) => ({
      ...current,
      targetNodeCode:
        current.targetNodeCode && nextGame.nodes.some((node) => node.code === current.targetNodeCode)
          ? current.targetNodeCode
          : "",
    }));

    if (!nextGame.nodes.length) {
      setActiveTab("project");
    }
  }

  function handleSelectNode(nodeCode: string) {
    const node = game.nodes.find((entry) => entry.code === nodeCode) ?? null;
    setSelectedNodeCode(nodeCode);
    setDraftNode(node ? toDraftNode(node) : null);
    setTimelineFilter("all");
    setCollapsedTimelineEventIds([]);
    setStatus(null);
    setError(null);

    if (activeTab === "project") {
      setActiveTab("flow");
    }
  }

  function focusNode(nodeCode: string, nextTab?: WorkspaceTab) {
    const node = game.nodes.find((entry) => entry.code === nodeCode) ?? null;
    setSelectedNodeCode(nodeCode);
    setDraftNode(node ? toDraftNode(node) : null);
    setTimelineFilter("all");
    setCollapsedTimelineEventIds([]);
    setStatus(null);
    setError(null);

    if (nextTab) {
      setActiveTab(nextTab);
    }
  }

  function openFlowComposer() {
    setActiveTab("flow");
    queueMicrotask(() => {
      flowComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function prepareLinkedNodeFromGraph(nodeCode: string, linkMode: QuickLinkForm["linkMode"]) {
    const node = game.nodes.find((entry) => entry.code === nodeCode);

    if (!node || node.isEnding) {
      return;
    }

    focusNode(nodeCode, "flow");
    setQuickLinkForm((current) => ({
      ...current,
      title: node.title ? `${node.title} / 下一幕` : "",
      code: "",
      nodeType: "video",
      linkMode,
      choiceLabel: linkMode === "choice" ? "继续" : current.choiceLabel,
      choiceHint: "",
    }));
    queueMicrotask(() => {
      quickLinkComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function loadGame(preferredNodeCode?: string) {
    setLoading(true);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", currentProjectSlug));
      syncFromGame(payload.game, preferredNodeCode);
      if (payload.projects) {
        setProjects(payload.projects);
      }
      setStatus("已刷新后台数据");
    } catch (loadGameError) {
      setError(loadErrorMessage(loadGameError, "加载项目失败"));
    } finally {
      setLoading(false);
    }
  }

  async function saveGameSettings() {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", currentProjectSlug), {
        method: "PATCH",
        body: JSON.stringify({
          ...gameForm,
          sortOrder: Number(gameForm.sortOrder || 0),
          intro: gameForm.intro,
          promoText: gameForm.promoText || gameForm.intro,
          variables: toVariablePayload(gameForm.variables),
        }),
      });

      syncFromGame(payload.game, selectedNodeCode);
      if (payload.projects) {
        setProjects(payload.projects);
      }
      setStatus("已保存项目配置");
    } catch (saveGameError) {
      setError(loadErrorMessage(saveGameError, "保存项目配置失败"));
    } finally {
      setSaving(false);
    }
  }

  async function setStartNode(nodeCode: string) {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", currentProjectSlug), {
        method: "PATCH",
        body: JSON.stringify({
          startNodeCode: nodeCode,
        }),
      });

      syncFromGame(payload.game, nodeCode);
      if (payload.projects) {
        setProjects(payload.projects);
      }
      setStatus(`已设为起始片段：${getNodeDisplayName(payload.game, nodeCode)}`);
    } catch (setStartError) {
      setError(loadErrorMessage(setStartError, "设置起始片段失败"));
    } finally {
      setSaving(false);
    }
  }

  async function resetToBlankProject() {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", currentProjectSlug), {
        method: "POST",
        body: JSON.stringify({
          action: "reset_blank",
        }),
      });

      syncFromGame(payload.game);
      if (payload.projects) {
        setProjects(payload.projects);
      }
      setActiveTab("project");
      setStatus("已重置为空白项目");
    } catch (resetError) {
      setError(loadErrorMessage(resetError, "重置空白项目失败"));
    } finally {
      setSaving(false);
    }
  }

  async function createProjectEntry() {
    setCreatingProject(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "POST",
        body: JSON.stringify({
          action: "create_project",
          title: "未命名 StoryPlay 项目",
        }),
      });

      if (payload.projects) {
        setProjects(payload.projects);
      }

      syncFromGame(payload.game);
      setActiveTab("project");
      router.push(`/admin?project=${encodeURIComponent(payload.game.slug)}`);
      setStatus(`已创建项目：${payload.game.title}`);
    } catch (createProjectError) {
      setError(loadErrorMessage(createProjectError, "创建项目失败"));
    } finally {
      setCreatingProject(false);
    }
  }

  function switchProject(projectSlug: string) {
    if (!projectSlug || projectSlug === currentProjectSlug) {
      return;
    }

    router.push(`/admin?project=${encodeURIComponent(projectSlug)}`);
  }

  async function deleteCurrentProject() {
    if (projects.length <= 1) {
      setError("至少保留一个项目后才能删除当前项目");
      return;
    }

    const confirmed = window.confirm(`确定删除项目“${game.title || game.slug}”吗？该项目的剧情与试玩记录会一起移除。`);

    if (!confirmed) {
      return;
    }

    setDeletingProject(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", currentProjectSlug), {
        method: "POST",
        body: JSON.stringify({
          action: "delete_project",
        }),
      });

      if (payload.projects) {
        setProjects(payload.projects);
      }

      syncFromGame(payload.game);
      router.push(`/admin?project=${encodeURIComponent(payload.game.slug)}`);
      setStatus(`已删除项目，当前切换到：${payload.game.title}`);
    } catch (deleteProjectError) {
      setError(loadErrorMessage(deleteProjectError, "删除项目失败"));
    } finally {
      setDeletingProject(false);
    }
  }

  async function exportProject() {
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(withProjectQuery("/api/admin/export", currentProjectSlug), {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "导出项目失败");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `StoryPlay-export-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setStatus("已导出项目 JSON");
    } catch (exportError) {
      setError(loadErrorMessage(exportError, "导出项目失败"));
    }
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setStatus(null);
    setError(null);

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as { game?: StoryGame } | StoryGame;
      const nextGame = "game" in parsed ? parsed.game : parsed;

      if (!nextGame) {
        throw new Error("导入文件缺少 game 数据");
      }

      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/import", currentProjectSlug), {
        method: "POST",
        body: JSON.stringify({ game: nextGame }),
      });

      syncFromGame(payload.game);
      if (payload.projects) {
        setProjects(payload.projects);
      }
      setStatus("已导入项目数据");
    } catch (importError) {
      setError(loadErrorMessage(importError, "导入项目失败"));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function uploadAsset(file: File, folder: "videos" | "promo") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const payload = (await response.json()) as UploadPayload | { error: string };

    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload ? payload.error : "上传失败");
    }

    return payload;
  }

  async function uploadPromoVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingPromo(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await uploadAsset(file, "promo");
      setGameForm((current) => ({ ...current, promoVideoUrl: payload.url }));
      setActiveTab("project");
      setStatus("宣传视频已上传，保存项目后生效");
    } catch (uploadError) {
      setError(loadErrorMessage(uploadError, "上传宣传视频失败"));
    } finally {
      setUploadingPromo(false);
      event.target.value = "";
    }
  }

  async function uploadPromoPoster(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingPromoPoster(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await uploadAsset(file, "promo");
      setGameForm((current) => ({ ...current, promoPosterUrl: payload.url }));
      setActiveTab("project");
      setStatus("入口封面已上传，保存项目后生效");
    } catch (uploadError) {
      setError(loadErrorMessage(uploadError, "上传入口封面失败"));
    } finally {
      setUploadingPromoPoster(false);
      event.target.value = "";
    }
  }

  async function uploadNodeVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !draftNode) {
      return;
    }

    setUploadingNode(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await uploadAsset(file, "videos");
      setDraftNode((current) => (current ? { ...current, videoUrl: payload.url } : current));
      setStatus("片段视频已上传，保存当前片段后生效");
    } catch (uploadError) {
      setError(loadErrorMessage(uploadError, "上传片段视频失败"));
    } finally {
      setUploadingNode(false);
      event.target.value = "";
    }
  }

  async function createNode() {
    const trimmedTitle = newNodeForm.title.trim();
    const trimmedVideoUrl = newNodeForm.videoUrl.trim();
    const trimmedCode = newNodeForm.code.trim() || buildNodeCode(trimmedTitle);

    if (!trimmedTitle) {
      setError("请先填写片段标题");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery("/api/admin/nodes", currentProjectSlug),
        {
        method: "POST",
        body: JSON.stringify({
          ...newNodeForm,
          code: trimmedCode,
          title: trimmedTitle,
          videoUrl: trimmedVideoUrl,
          description: "",
          transcript: "",
        }),
      });

      syncFromGame(payload.game, payload.node.code);
      setNewNodeForm({
        code: "",
        title: "",
        nodeType: "video",
        videoUrl: "",
      });
      setActiveTab("flow");
      setStatus(`已创建片段：${payload.node.title}`);
    } catch (createNodeError) {
      setError(loadErrorMessage(createNodeError, "创建片段失败"));
    } finally {
      setSaving(false);
    }
  }

  async function duplicateSelectedNode() {
    if (!selectedNode || !draftNode) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const duplicatedTitle = `${draftNode.title || selectedNode.title}（副本）`;
      const duplicatedCode = buildNodeCode(`${selectedNode.code}_copy`);
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery("/api/admin/nodes", currentProjectSlug),
        {
        method: "POST",
        body: JSON.stringify({
          code: duplicatedCode,
          title: duplicatedTitle,
          description: draftNode.description,
          transcript: draftNode.transcript,
          videoUrl: draftNode.videoUrl,
          nodeType: draftNode.nodeType,
          autoNextNodeCode: draftNode.nodeType === "ending" ? null : draftNode.autoNextNodeCode || null,
          endingTone: draftNode.nodeType === "ending" ? draftNode.endingTone : null,
        }),
      });

      await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery(`/api/admin/nodes/${payload.node.code}`, currentProjectSlug),
        {
          method: "PATCH",
          body: JSON.stringify({
            ...buildNodeSavePayload(draftNode, gameForm.variables),
            title: duplicatedTitle,
          }),
        },
      );

      await loadGame(payload.node.code);
      setActiveTab("flow");
      setStatus(`已复制片段：${duplicatedTitle}`);
    } catch (duplicateError) {
      setError(loadErrorMessage(duplicateError, "复制片段失败"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除片段“${selectedNode.title || selectedNode.code}”吗？相关出口、自动跳转和时间线跳转会一并清理。`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>(
        withProjectQuery(`/api/admin/nodes/${selectedNode.code}`, currentProjectSlug),
        {
          method: "DELETE",
        },
      );

      syncFromGame(payload.game);
      setActiveTab(payload.game.nodes.length ? "flow" : "project");
      setStatus(`已删除片段：${selectedNode.title || selectedNode.code}`);
    } catch (deleteError) {
      setError(loadErrorMessage(deleteError, "删除片段失败"));
    } finally {
      setSaving(false);
    }
  }

  function openPreviewNode(nodeCode?: string) {
    const previewNodeCode = nodeCode || selectedNodeCode || game.startNodeCode;
    const targetUrl = previewNodeCode
      ? `/projects/${encodeURIComponent(currentProjectSlug)}?previewNode=${encodeURIComponent(previewNodeCode)}`
      : `/projects/${encodeURIComponent(currentProjectSlug)}`;

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  function openPreviewFromSelectedNode() {
    openPreviewNode();
  }

  async function saveNode() {
    if (!draftNode || !selectedNodeCode) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery(`/api/admin/nodes/${selectedNodeCode}`, currentProjectSlug),
        {
          method: "PATCH",
          body: JSON.stringify(buildNodeSavePayload(draftNode, gameForm.variables)),
        },
      );

      syncFromGame(payload.game, payload.node.code);
      setStatus(`已保存片段：${payload.node.title}`);
    } catch (saveNodeError) {
      setError(loadErrorMessage(saveNodeError, "保存片段失败"));
    } finally {
      setSaving(false);
    }
  }

  async function createLinkedNodeFromSelected() {
    if (!selectedNode || !selectedNodeCode || !draftNode) {
      return;
    }

    const trimmedTitle = quickLinkForm.title.trim();
    const trimmedCode = quickLinkForm.code.trim() || buildNodeCode(trimmedTitle);
    const trimmedChoiceLabel = quickLinkForm.choiceLabel.trim();

    if (!trimmedTitle) {
      setError("请先填写新片段标题");
      return;
    }

    if (quickLinkForm.linkMode === "choice" && !trimmedChoiceLabel) {
      setError("创建分支时需要填写选项文案");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const created = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery("/api/admin/nodes", currentProjectSlug),
        {
          method: "POST",
          body: JSON.stringify({
            code: trimmedCode,
            title: trimmedTitle,
            description: "",
            transcript: "",
            videoUrl: "",
            nodeType: quickLinkForm.nodeType,
            autoNextNodeCode: null,
            endingTone: quickLinkForm.nodeType === "ending" ? "truth" : null,
          }),
        },
      );

      const linkedDraft: DraftNode = {
        ...draftNode,
        autoNextNodeCode:
          quickLinkForm.linkMode === "auto" && draftNode.nodeType === "video"
            ? created.node.code
            : draftNode.autoNextNodeCode,
        choices:
          quickLinkForm.linkMode === "choice"
            ? [
                ...draftNode.choices,
                {
                  code: buildId("choice"),
                  label: trimmedChoiceLabel,
                  hint: quickLinkForm.choiceHint.trim(),
                  targetNodeCode: created.node.code,
                  conditions: [],
                  actions: [],
                },
              ]
            : draftNode.choices,
      };

      await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery(`/api/admin/nodes/${selectedNodeCode}`, currentProjectSlug),
        {
          method: "PATCH",
          body: JSON.stringify(buildNodeSavePayload(linkedDraft, gameForm.variables)),
        },
      );

      await loadGame(created.node.code);
      setQuickLinkForm({
        title: "",
        code: "",
        nodeType: "video",
        linkMode: "choice",
        choiceLabel: "",
        choiceHint: "",
      });
      setStatus(`已创建并连接片段：${created.node.title}`);
    } catch (createLinkedError) {
      setError(loadErrorMessage(createLinkedError, "创建并连接片段失败"));
    } finally {
      setSaving(false);
    }
  }

  async function addChoiceToSelectedNode() {
    if (!draftNode || !selectedNodeCode) {
      return;
    }

    const label = newChoiceForm.label.trim();
    const targetNodeTitle = newChoiceForm.targetNodeTitle.trim();
    let targetNodeCode = newChoiceForm.targetNodeCode.trim();

    if (!label) {
      setError("新增选项需要填写选项文案");
      return;
    }

    if (!targetNodeCode && !targetNodeTitle) {
      setError("请选择已有目标片段，或填写新目标片段标题");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      if (!targetNodeCode && targetNodeTitle) {
        const created = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
          withProjectQuery("/api/admin/nodes", currentProjectSlug),
          {
            method: "POST",
            body: JSON.stringify({
              code: buildNodeCode(targetNodeTitle),
              title: targetNodeTitle,
              description: "",
              transcript: "",
              videoUrl: "",
              nodeType: "video",
              autoNextNodeCode: null,
              endingTone: null,
            }),
          },
        );

        targetNodeCode = created.node.code;
      }

      const nextDraft: DraftNode = {
        ...draftNode,
        choices: [
          ...draftNode.choices,
          {
            code: newChoiceForm.code.trim() || buildId("choice"),
            label,
            hint: newChoiceForm.hint.trim(),
            targetNodeCode,
            conditions: [],
            actions: [],
          },
        ],
      };

      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        withProjectQuery(`/api/admin/nodes/${selectedNodeCode}`, currentProjectSlug),
        {
          method: "PATCH",
          body: JSON.stringify(buildNodeSavePayload(nextDraft, gameForm.variables)),
        },
      );

      syncFromGame(payload.game, payload.node.code);
      setNewChoiceForm({
        code: "",
        label: "",
        hint: "",
        targetNodeCode: "",
        targetNodeTitle: "",
      });
      setStatus(targetNodeTitle ? `已创建目标片段并加入选项：${targetNodeTitle}` : "已加入选项");
    } catch (addChoiceError) {
      setError(loadErrorMessage(addChoiceError, "新增选项失败"));
    } finally {
      setSaving(false);
    }
  }

  const publishSummary = useMemo(() => {
    const missingVideo = game.nodes.filter((node) => !node.videoUrl.trim()).length;
    const noLinkNodes = game.nodes.filter((node) => {
      if (node.isEnding) {
        return false;
      }

      const hasChoices = Boolean(node.choices?.length);
      const hasAutoNext = Boolean(node.autoNextNodeCode);
      return !hasChoices && !hasAutoNext;
    }).length;

    const unreachableChoices = game.nodes.flatMap((node) => node.choices ?? []).filter((choice) => {
      return !game.nodes.some((target) => target.code === choice.targetNodeCode);
    }).length;

    return {
      totalNodes: game.nodes.length,
      totalChoices: game.nodes.reduce((count, node) => count + (node.choices?.length ?? 0), 0),
      totalVariables: game.variables?.length ?? 0,
      totalEvents: game.nodes.reduce((count, node) => count + (node.timelineEvents?.length ?? 0), 0),
      missingVideo,
      noLinkNodes,
      unreachableChoices,
      ready:
        game.nodes.length > 0 &&
        Boolean(game.startNodeCode) &&
        missingVideo === 0 &&
        noLinkNodes === 0 &&
        unreachableChoices === 0,
    };
  }, [game]);

  const setupChecklist = useMemo(
    () => [
      {
        label: "填写项目基础信息",
        detail: game.title.trim() && game.tagline.trim() ? "标题和一句话介绍已完成" : "先补标题和一句话介绍",
        done: Boolean(game.title.trim() && game.tagline.trim()),
      },
      {
        label: "设置起始片段",
        detail: game.startNodeCode ? `当前起点：${game.startNodeCode}` : "玩家点击开始后还没有落点",
        done: Boolean(game.startNodeCode),
      },
      {
        label: "创建片段",
        detail: game.nodes.length ? `已创建 ${game.nodes.length} 个片段` : "还没有任何片段",
        done: game.nodes.length > 0,
      },
      {
        label: "挂载片段视频",
        detail:
          publishSummary.missingVideo === 0
            ? "所有片段都已填写视频地址"
            : `还有 ${publishSummary.missingVideo} 个片段缺少视频`,
        done: publishSummary.totalNodes > 0 && publishSummary.missingVideo === 0,
      },
      {
        label: "配置跳转出口",
        detail:
          publishSummary.noLinkNodes === 0
            ? "片段出口结构完整"
            : `还有 ${publishSummary.noLinkNodes} 个片段没有出口`,
        done: publishSummary.totalNodes > 0 && publishSummary.noLinkNodes === 0,
      },
      {
        label: "补充互动规则",
        detail:
          publishSummary.totalChoices + publishSummary.totalEvents > 0
            ? `当前已有 ${publishSummary.totalChoices} 个结尾出口，${publishSummary.totalEvents} 个时间线事件`
            : "还没有选项或时间线互动",
        done: publishSummary.totalChoices + publishSummary.totalEvents > 0,
      },
    ],
    [game.nodes.length, game.startNodeCode, game.tagline, game.title, publishSummary],
  );

  function renderConditionEditor(
    conditions: DraftCondition[],
    onChange: (nextConditions: DraftCondition[]) => void,
  ) {
    return (
      <RuleBlock
        title="显示条件"
        description="条件全部满足时，选项或事件才会生效。"
      >
        <div className="grid gap-3">
          {conditions.map((condition, index) => (
            <div
              key={condition.id}
              className="rounded-2xl border border-stone-900/10 bg-stone-50 p-4"
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="变量">
                  <select
                    className={className}
                    value={condition.variableKey}
                    onChange={(event) =>
                      onChange(
                        conditions.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, variableKey: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  >
                    <option value="">请选择变量</option>
                    {gameForm.variables.map((variable) => (
                      <option key={variable.key} value={variable.key}>
                        {variable.label || variable.key}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="判断">
                  <select
                    className={className}
                    value={condition.operator}
                    onChange={(event) =>
                      onChange(
                        conditions.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                operator: event.target.value as ConditionOperator,
                              }
                            : entry,
                        ),
                      )
                    }
                  >
                    {conditionOperatorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="比较值">
                  <input
                    className={className}
                    value={condition.value}
                    onChange={(event) =>
                      onChange(
                        conditions.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="例如 true / 3 / rebel"
                  />
                </Field>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                  onClick={() => onChange(conditions.filter((_, entryIndex) => entryIndex !== index))}
                >
                  删除条件
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
            onClick={() =>
              onChange([
                ...conditions,
                {
                  id: buildId("condition"),
                  variableKey: gameForm.variables[0]?.key ?? "",
                  operator: "eq",
                  value: "",
                },
              ])
            }
          >
            新增条件
          </button>
        </div>
      </RuleBlock>
    );
  }

  function renderActionEditor(actions: DraftAction[], onChange: (nextActions: DraftAction[]) => void) {
    return (
      <RuleBlock
        title="触发动作"
        description="选项被点击或事件被触发后，对变量执行的修改。"
      >
        <div className="grid gap-3">
          {actions.map((action, index) => (
            <div key={action.id} className="rounded-2xl border border-stone-900/10 bg-stone-50 p-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="变量">
                  <select
                    className={className}
                    value={action.variableKey}
                    onChange={(event) =>
                      onChange(
                        actions.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, variableKey: event.target.value } : entry,
                        ),
                      )
                    }
                  >
                    <option value="">请选择变量</option>
                    {gameForm.variables.map((variable) => (
                      <option key={variable.key} value={variable.key}>
                        {variable.label || variable.key}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="动作">
                  <select
                    className={className}
                    value={action.type}
                    onChange={(event) =>
                      onChange(
                        actions.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, type: event.target.value as VariableActionType }
                            : entry,
                        ),
                      )
                    }
                  >
                    {actionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="值"
                  hint={action.type === "toggle" ? "toggle 不需要填写值" : undefined}
                >
                  <input
                    className={className}
                    value={action.value}
                    disabled={action.type === "toggle"}
                    onChange={(event) =>
                      onChange(
                        actions.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry,
                        ),
                      )
                    }
                    placeholder="例如 1 / unlocked / true"
                  />
                </Field>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                  onClick={() => onChange(actions.filter((_, entryIndex) => entryIndex !== index))}
                >
                  删除动作
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
            onClick={() =>
              onChange([
                ...actions,
                {
                  id: buildId("action"),
                  variableKey: gameForm.variables[0]?.key ?? "",
                  type: "set",
                  value: "",
                },
              ])
            }
          >
            新增动作
          </button>
        </div>
      </RuleBlock>
    );
  }

  function renderVariablesEditor() {
    return (
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-stone-900">项目变量</div>
            <div className="text-xs leading-6 text-stone-500">
              用于条件分支、状态记录和动作系统，避免继续写死某个作品的字段名。
            </div>
          </div>
          <button
            type="button"
            className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
            onClick={() =>
              setGameForm((current) => ({
                ...current,
                variables: [
                  ...current.variables,
                  {
                    key: "",
                    label: "",
                    type: "string",
                    initialValue: "",
                    optionsText: "",
                  },
                ],
              }))
            }
          >
            新增变量
          </button>
        </div>

        {gameForm.variables.length ? (
          <div className="grid gap-3">
            {gameForm.variables.map((variable, index) => (
              <div key={`variable-${index}`} className="rounded-3xl border border-stone-900/10 bg-stone-50 p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="变量 key" hint="程序读取使用，建议英文或下划线命名">
                    <input
                      className={className}
                      value={variable.key}
                      onChange={(event) =>
                        setGameForm((current) => ({
                          ...current,
                          variables: current.variables.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, key: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="例如 affinity_guard"
                    />
                  </Field>

                  <Field label="显示名称">
                    <input
                      className={className}
                      value={variable.label}
                      onChange={(event) =>
                        setGameForm((current) => ({
                          ...current,
                          variables: current.variables.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, label: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="例如 守卫好感"
                    />
                  </Field>

                  <Field label="变量类型">
                    <select
                      className={className}
                      value={variable.type}
                      onChange={(event) =>
                        setGameForm((current) => ({
                          ...current,
                          variables: current.variables.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, type: event.target.value as VariableValueType }
                              : entry,
                          ),
                        }))
                      }
                    >
                      {variableTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="初始值"
                    hint={variable.type === "boolean" ? "布尔值请填 true 或 false" : undefined}
                  >
                    <input
                      className={className}
                      value={variable.initialValue}
                      onChange={(event) =>
                        setGameForm((current) => ({
                          ...current,
                          variables: current.variables.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, initialValue: event.target.value } : entry,
                          ),
                        }))
                      }
                      placeholder="例如 0 / true / faction_a"
                    />
                  </Field>
                </div>

                {variable.type === "enum" ? (
                  <div className="mt-4">
                    <Field label="枚举选项" hint="使用英文逗号分隔，例如 north,south,neutral">
                      <input
                        className={className}
                        value={variable.optionsText}
                        onChange={(event) =>
                          setGameForm((current) => ({
                            ...current,
                            variables: current.variables.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, optionsText: event.target.value } : entry,
                            ),
                          }))
                        }
                        placeholder="例如 noble, common, rebel"
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                    onClick={() =>
                      setGameForm((current) => ({
                        ...current,
                        variables: current.variables.filter((_, entryIndex) => entryIndex !== index),
                      }))
                    }
                  >
                    删除变量
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
            现在还没有项目变量。可以从这里定义平台通用状态，例如阵营、线索、数值或身份标签。
          </div>
        )}
      </div>
    );
  }

  function renderTimelineEditor() {
    if (!draftNode) {
      return (
        <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
          先选择一个片段，再配置它的时间线事件。
        </div>
      );
    }

    const sortedEvents = [...draftNode.timelineEvents].sort((left, right) => Number(left.atMs) - Number(right.atMs));
    const maxAtMs = Math.max(...sortedEvents.map((event) => Number(event.atMs) || 0), 1000);
    const eventTypeLabel = (type: TimelineEventType) =>
      timelineEventTypeOptions.find((option) => option.value === type)?.label ?? type;
    const timelineTrackRows = [
      { id: "show_text", label: "文本轨" },
      { id: "show_choice", label: "选项轨" },
      { id: "show_overlay", label: "叠层轨" },
      { id: "jump", label: "跳转轨" },
      { id: "run_actions", label: "动作轨" },
      { id: "pause", label: "暂停轨" },
      { id: "play_audio", label: "音频轨" },
    ] satisfies Array<{ id: TimelineEventType; label: string }>;
    const visibleEvents =
      timelineFilter === "all"
        ? draftNode.timelineEvents
        : draftNode.timelineEvents.filter((event) => event.type === timelineFilter);
    const addTimelineEvent = (type: TimelineEventType, payloadText: string) => {
      setDraftNode((current) =>
        current
          ? {
              ...current,
              timelineEvents: [
                ...current.timelineEvents,
                {
                  id: buildId("event"),
                  atMs: current.timelineEvents.length
                    ? String(Number(current.timelineEvents[current.timelineEvents.length - 1]?.atMs || "0") + 1000)
                    : "0",
                  type,
                  payloadText,
                  conditions: [],
                  actions: [],
                },
              ],
            }
          : current,
      );
      setTimelineFilter("all");
    };
    const moveTimelineEvent = (index: number, direction: -1 | 1) => {
      setDraftNode((current) => {
        if (!current) {
          return current;
        }

        const nextIndex = index + direction;

        if (nextIndex < 0 || nextIndex >= current.timelineEvents.length) {
          return current;
        }

        const nextEvents = [...current.timelineEvents];
        const [event] = nextEvents.splice(index, 1);
        nextEvents.splice(nextIndex, 0, event);

        return { ...current, timelineEvents: nextEvents };
      });
    };
    const nudgeTimelineEvent = (index: number, deltaMs: number) => {
      setDraftNode((current) =>
        current
          ? {
              ...current,
              timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                entryIndex === index
                  ? { ...entry, atMs: String(Math.max(0, (Number(entry.atMs) || 0) + deltaMs)) }
                  : entry,
              ),
            }
          : current,
      );
    };
    const sortTimelineEvents = () => {
      setDraftNode((current) =>
        current
          ? {
              ...current,
              timelineEvents: [...current.timelineEvents].sort(
                (left, right) => Number(left.atMs) - Number(right.atMs),
              ),
            }
          : current,
      );
    };
    const toggleTimelineEventCollapse = (eventId: string) => {
      setCollapsedTimelineEventIds((current) =>
        current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId],
      );
    };
    const collapseAllTimelineEvents = () => {
      setCollapsedTimelineEventIds(visibleEvents.map((event) => event.id));
    };
    const expandAllTimelineEvents = () => {
      setCollapsedTimelineEventIds([]);
    };
    const duplicateTimelineEvent = (index: number) => {
      setDraftNode((current) => {
        if (!current) {
          return current;
        }

        const source = current.timelineEvents[index];

        if (!source) {
          return current;
        }

        const nextEvents = [...current.timelineEvents];
        nextEvents.splice(index + 1, 0, {
          ...structuredClone(source),
          id: buildId("event"),
          atMs: String((Number(source.atMs) || 0) + 500),
        });

        return { ...current, timelineEvents: nextEvents };
      });
    };
    const reorderTimelineEvent = (sourceEventId: string, targetEventId: string) => {
      if (sourceEventId === targetEventId) {
        return;
      }

      setDraftNode((current) => {
        if (!current) {
          return current;
        }

        const sourceIndex = current.timelineEvents.findIndex((entry) => entry.id === sourceEventId);
        const targetIndex = current.timelineEvents.findIndex((entry) => entry.id === targetEventId);

        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
          return current;
        }

        const nextEvents = [...current.timelineEvents];
        const [movedEvent] = nextEvents.splice(sourceIndex, 1);
        nextEvents.splice(targetIndex, 0, movedEvent);

        return { ...current, timelineEvents: nextEvents };
      });
    };

    return (
      <div className="grid gap-4">
        <div className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-medium text-stone-900">时间线事件</div>
              <div className="text-xs leading-6 text-stone-500">
                用于在视频播放过程中触发文本、选项、暂停、跳转、叠层或变量动作。
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() => addTimelineEvent("show_text", "{\n  \"title\": \"\",\n  \"text\": \"\"\n}")}
              >
                文本事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() =>
                  addTimelineEvent(
                    "show_choice",
                    '{\n  "title": "",\n  "text": "",\n  "pauseVideo": true,\n  "choices": []\n}',
                  )
                }
              >
                选项事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() => addTimelineEvent("show_overlay", '{\n  "title": "",\n  "text": "",\n  "align": "center"\n}')}
              >
                叠层事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() => addTimelineEvent("pause", "{\n  \"durationMs\": 0\n}")}
              >
                暂停事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() => addTimelineEvent("jump", '{\n  "targetNodeCode": "",\n  "label": ""\n}')}
              >
                跳转事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                onClick={() => addTimelineEvent("run_actions", "{}")}
              >
                动作事件
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30 sm:col-span-2 xl:col-span-3"
                onClick={sortTimelineEvents}
              >
                按触发时间排序
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition ${
                timelineFilter === "all"
                  ? "bg-stone-950 text-white"
                  : "border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/30"
              }`}
              onClick={() => setTimelineFilter("all")}
            >
              全部
            </button>
            {timelineEventTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-full px-4 py-2 text-sm transition ${
                  timelineFilter === option.value
                    ? "bg-stone-950 text-white"
                    : "border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/30"
                }`}
                onClick={() => setTimelineFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700 transition hover:border-stone-900/30"
              onClick={collapseAllTimelineEvents}
            >
              折叠当前筛选结果
            </button>
            <button
              type="button"
              className="rounded-full border border-stone-900/10 bg-white px-4 py-2 text-sm text-stone-700 transition hover:border-stone-900/30"
              onClick={expandAllTimelineEvents}
            >
              展开全部事件
            </button>
          </div>
        </div>

        {draftNode.timelineEvents.length ? (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">事件数</div>
                <div className="mt-1 text-2xl text-stone-950">{draftNode.timelineEvents.length}</div>
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">首个触发点</div>
                <div className="mt-1 text-sm text-stone-950">{sortedEvents[0]?.atMs ?? "0"} ms</div>
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">最后触发点</div>
                <div className="mt-1 text-sm text-stone-950">{sortedEvents.at(-1)?.atMs ?? "0"} ms</div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900/10 bg-white px-4 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-stone-900">时间轨道预览</div>
                  <div className="text-xs leading-6 text-stone-500">
                    用相对位置快速查看事件在当前片段中的分布和轨道归属。
                  </div>
                </div>
                <div className="text-xs text-stone-500">0 ms - {maxAtMs} ms</div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-900/10 bg-stone-50">
                <div className="min-w-[720px]">
                  {timelineTrackRows.map((track) => (
                    <div
                      key={track.id}
                      className="grid grid-cols-[92px_minmax(0,1fr)] items-center border-b border-stone-900/8 last:border-b-0"
                    >
                      <div className="px-4 py-4 text-xs text-stone-500">{track.label}</div>
                      <div className="relative h-14">
                        <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-stone-300" />
                        {sortedEvents
                          .filter((event) => event.type === track.id)
                          .map((event) => {
                            const position = `${Math.min(100, Math.max(0, (Number(event.atMs) / maxAtMs) * 100))}%`;
                            return (
                              <div
                                key={`timeline-marker-${event.id}`}
                                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ left: position }}
                              >
                                <button
                                  type="button"
                                  className="h-3.5 w-3.5 rounded-full border-2 border-white bg-stone-950 shadow transition hover:scale-125"
                                  title={`${eventTypeLabel(event.type)} · ${event.atMs} ms`}
                                  onClick={() => {
                                    setTimelineFilter("all");
                                    setCollapsedTimelineEventIds((current) => current.filter((id) => id !== event.id));
                                    if (typeof window !== "undefined") {
                                      window.setTimeout(() => {
                                        document
                                          .getElementById(`timeline-event-card-${event.id}`)
                                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                                      }, 50);
                                    }
                                  }}
                                />
                                <div className="mt-2 -translate-x-1/2 whitespace-nowrap text-[10px] text-stone-600">
                                  {event.atMs} ms
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {visibleEvents.map((event) => {
              const index = draftNode.timelineEvents.findIndex((entry) => entry.id === event.id);
              const timelineChoices = readTimelineChoiceDrafts(event);
              const isCollapsed = collapsedTimelineEventIds.includes(event.id);
              const conditionCount = event.conditions.length;
              const actionCount = event.actions.length;
              const summaryText =
                event.type === "show_text" || event.type === "show_overlay"
                  ? getTimelineStringField(event, "text") || getTimelineStringField(event, "body")
                  : event.type === "show_choice"
                    ? getTimelineStringField(event, "title") || `${timelineChoices.length} 个时间线选项`
                    : event.type === "jump"
                      ? getTimelineStringField(event, "targetNodeCode")
                      : event.type === "play_audio"
                        ? getTimelineStringField(event, "audioUrl") || getTimelineStringField(event, "url")
                        : event.type === "pause"
                          ? "暂停视频"
                          : event.type === "run_actions"
                            ? `${event.actions.length} 个动作`
                            : "";

              return (
                <div
                  key={`${event.id}-${index}`}
                  id={`timeline-event-card-${event.id}`}
                  className="rounded-3xl border border-stone-900/10 bg-stone-50 p-4"
                  draggable
                  onDragStart={() => setDraggingTimelineEventId(event.id)}
                  onDragEnd={() => setDraggingTimelineEventId(null)}
                  onDragOver={(dragEvent) => {
                    dragEvent.preventDefault();
                    dragEvent.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(dragEvent) => {
                    dragEvent.preventDefault();

                    if (draggingTimelineEventId) {
                      reorderTimelineEvent(draggingTimelineEventId, event.id);
                    }

                    setDraggingTimelineEventId(null);
                  }}
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                          {event.atMs} ms
                        </span>
                        <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1 text-xs text-stone-700">
                          {eventTypeLabel(event.type)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-stone-900">
                        {summaryText || "未填写事件摘要"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-stone-900/10 bg-white px-2.5 py-1 text-stone-600">
                          ID: {event.id}
                        </span>
                        <span className="rounded-full border border-stone-900/10 bg-white px-2.5 py-1 text-stone-600">
                          条件 {conditionCount}
                        </span>
                        <span className="rounded-full border border-stone-900/10 bg-white px-2.5 py-1 text-stone-600">
                          动作 {actionCount}
                        </span>
                        {event.type === "show_choice" ? (
                          <span className="rounded-full border border-stone-900/10 bg-white px-2.5 py-1 text-stone-600">
                            中途选项 {timelineChoices.length}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-500">
                        拖拽排序
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => toggleTimelineEventCollapse(event.id)}
                      >
                        {isCollapsed ? "展开" : "折叠"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30 disabled:opacity-40"
                        onClick={() => moveTimelineEvent(index, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30 disabled:opacity-40"
                        onClick={() => moveTimelineEvent(index, 1)}
                        disabled={index === draftNode.timelineEvents.length - 1}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => nudgeTimelineEvent(index, -200)}
                      >
                        -0.2s
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => nudgeTimelineEvent(index, -1000)}
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => nudgeTimelineEvent(index, 200)}
                      >
                        +0.2s
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => nudgeTimelineEvent(index, 1000)}
                      >
                        +1s
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 bg-white px-3 py-2 text-xs text-stone-700 transition hover:border-stone-900/30"
                        onClick={() => duplicateTimelineEvent(index)}
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                        onClick={() =>
                          setDraftNode((current) =>
                            current
                              ? {
                                  ...current,
                                  timelineEvents: current.timelineEvents.filter((_, entryIndex) => entryIndex !== index),
                                }
                              : current,
                          )
                        }
                      >
                        删除事件
                      </button>
                    </div>
                  </div>

                  {isCollapsed ? null : (
                    <>
                      <div className="mb-4 grid gap-3 lg:grid-cols-4">
                        <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">触发时间</div>
                          <div className="mt-1 text-sm text-stone-950">{event.atMs} ms</div>
                        </div>
                        <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">事件类型</div>
                          <div className="mt-1 text-sm text-stone-950">{eventTypeLabel(event.type)}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">条件数量</div>
                          <div className="mt-1 text-sm text-stone-950">{conditionCount}</div>
                        </div>
                        <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">动作数量</div>
                          <div className="mt-1 text-sm text-stone-950">{actionCount}</div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <Field label="事件 ID" visibility="logic">
                          <input
                            className={className}
                            value={event.id}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, id: changedEvent.target.value } : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>

                        <Field label="触发时间" hint="单位毫秒，例如 3200" visibility="logic">
                          <input
                            className={className}
                            value={event.atMs}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, atMs: changedEvent.target.value } : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>

                        <Field label="事件类型" visibility="logic">
                          <select
                            className={className}
                            value={event.type}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? { ...entry, type: changedEvent.target.value as TimelineEventType }
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          >
                            {timelineEventTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <div className="mt-4 grid gap-4">
                    {(event.type === "show_text" || event.type === "show_overlay") && (
                      <>
                        <Field label="标题" visibility="player">
                          <input
                            className={className}
                            value={getTimelineStringField(event, "title")}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? updateTimelinePayload(entry, (payload) => ({
                                              ...payload,
                                              title: changedEvent.target.value,
                                            }))
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>

                        <Field label="正文" visibility="player">
                          <textarea
                            className={textareaClass}
                            value={getTimelineStringField(event, "text") || getTimelineStringField(event, "body")}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? updateTimelinePayload(entry, (payload) => ({
                                              ...payload,
                                              text: changedEvent.target.value,
                                              body: changedEvent.target.value,
                                            }))
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>
                      </>
                    )}

                    {event.type === "show_overlay" ? (
                      <Field label="叠层位置" visibility="logic">
                        <select
                          className={className}
                          value={getTimelineStringField(event, "align") || "center"}
                          onChange={(changedEvent) =>
                            setDraftNode((current) =>
                              current
                                ? {
                                    ...current,
                                    timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                      entryIndex === index
                                        ? updateTimelinePayload(entry, (payload) => ({
                                            ...payload,
                                            align: changedEvent.target.value,
                                          }))
                                        : entry,
                                    ),
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="top">顶部</option>
                          <option value="center">中部</option>
                          <option value="bottom">底部</option>
                        </select>
                      </Field>
                    ) : null}

                    {event.type === "show_choice" ? (
                      <>
                        <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-stone-900">时间线选项面板</div>
                              <div className="mt-1 text-xs text-stone-500">
                                当前包含 {timelineChoices.length} 个中途选项
                              </div>
                            </div>
                            <div className="rounded-full border border-stone-900/10 bg-stone-50 px-3 py-1 text-xs text-stone-700">
                              {getTimelineBooleanField(event, "pauseVideo", true) ? "暂停视频" : "继续播放"}
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-3">
                            <Field label="选项面板标题" visibility="player">
                              <input
                                className={className}
                                value={getTimelineStringField(event, "title")}
                                onChange={(changedEvent) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                            entryIndex === index
                                              ? updateTimelinePayload(entry, (payload) => ({
                                                  ...payload,
                                                  title: changedEvent.target.value,
                                                }))
                                              : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              />
                            </Field>

                            <Field label="是否暂停视频" visibility="logic">
                              <select
                                className={className}
                                value={getTimelineBooleanField(event, "pauseVideo", true) ? "true" : "false"}
                                onChange={(changedEvent) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                            entryIndex === index
                                              ? updateTimelinePayload(entry, (payload) => ({
                                                  ...payload,
                                                  pauseVideo: changedEvent.target.value === "true",
                                                }))
                                              : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              >
                                <option value="true">暂停并等待选择</option>
                                <option value="false">不暂停，直接弹出</option>
                              </select>
                            </Field>

                            <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                              选项数：{timelineChoices.length}
                            </div>

                            <div className="lg:col-span-3">
                              <Field label="说明文案" visibility="player">
                                <textarea
                                  className={textareaClass}
                                  value={getTimelineStringField(event, "text")}
                                  onChange={(changedEvent) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? updateTimelinePayload(entry, (payload) => ({
                                                    ...payload,
                                                    text: changedEvent.target.value,
                                                  }))
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        </div>

                        <RuleBlock
                          title="时间线选项"
                          description="这里配置的是视频中途出现的选项，不等同于节点结尾选项。"
                        >
                          <div className="grid gap-3">
                            {timelineChoices.map((choice, choiceIndex) => (
                              <div
                                key={`${choice.code}-${choiceIndex}`}
                                className="rounded-2xl border border-stone-900/10 bg-stone-50 p-4"
                              >
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <Field label="选项编码" visibility="logic">
                                    <input
                                      className={className}
                                      value={choice.code}
                                      onChange={(changedEvent) =>
                                        setDraftNode((current) =>
                                          current
                                            ? {
                                                ...current,
                                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? writeTimelineChoiceDrafts(
                                                        entry,
                                                        timelineChoices.map((item, itemIndex) =>
                                                          itemIndex === choiceIndex
                                                            ? { ...item, code: changedEvent.target.value }
                                                            : item,
                                                        ),
                                                        gameForm.variables,
                                                      )
                                                    : entry,
                                                ),
                                              }
                                            : current,
                                        )
                                      }
                                    />
                                  </Field>

                                  <Field label="选项文案" visibility="player">
                                    <input
                                      className={className}
                                      value={choice.label}
                                      onChange={(changedEvent) =>
                                        setDraftNode((current) =>
                                          current
                                            ? {
                                                ...current,
                                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? writeTimelineChoiceDrafts(
                                                        entry,
                                                        timelineChoices.map((item, itemIndex) =>
                                                          itemIndex === choiceIndex
                                                            ? { ...item, label: changedEvent.target.value }
                                                            : item,
                                                        ),
                                                        gameForm.variables,
                                                      )
                                                    : entry,
                                                ),
                                              }
                                            : current,
                                        )
                                      }
                                    />
                                  </Field>

                                  <Field label="补充提示" visibility="player">
                                    <input
                                      className={className}
                                      value={choice.hint}
                                      onChange={(changedEvent) =>
                                        setDraftNode((current) =>
                                          current
                                            ? {
                                                ...current,
                                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? writeTimelineChoiceDrafts(
                                                        entry,
                                                        timelineChoices.map((item, itemIndex) =>
                                                          itemIndex === choiceIndex
                                                            ? { ...item, hint: changedEvent.target.value }
                                                            : item,
                                                        ),
                                                        gameForm.variables,
                                                      )
                                                    : entry,
                                                ),
                                              }
                                            : current,
                                        )
                                      }
                                    />
                                  </Field>

                                  <Field label="目标片段" visibility="logic">
                                    <select
                                      className={className}
                                      value={choice.targetNodeCode}
                                      onChange={(changedEvent) =>
                                        setDraftNode((current) =>
                                          current
                                            ? {
                                                ...current,
                                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                                  entryIndex === index
                                                    ? writeTimelineChoiceDrafts(
                                                        entry,
                                                        timelineChoices.map((item, itemIndex) =>
                                                          itemIndex === choiceIndex
                                                            ? { ...item, targetNodeCode: changedEvent.target.value }
                                                            : item,
                                                        ),
                                                        gameForm.variables,
                                                      )
                                                    : entry,
                                                ),
                                              }
                                            : current,
                                        )
                                      }
                                    >
                                      <option value="">请选择目标片段</option>
                                      {game.nodes.map((node) => (
                                        <option key={node.code} value={node.code}>
                                          {getNodeDisplayName(game, node.code)}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                  {renderConditionEditor(choice.conditions, (nextConditions) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? writeTimelineChoiceDrafts(
                                                    entry,
                                                    timelineChoices.map((item, itemIndex) =>
                                                      itemIndex === choiceIndex
                                                        ? { ...item, conditions: nextConditions }
                                                        : item,
                                                    ),
                                                    gameForm.variables,
                                                  )
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    ),
                                  )}

                                  {renderActionEditor(choice.actions, (nextActions) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? writeTimelineChoiceDrafts(
                                                    entry,
                                                    timelineChoices.map((item, itemIndex) =>
                                                      itemIndex === choiceIndex
                                                        ? { ...item, actions: nextActions }
                                                        : item,
                                                    ),
                                                    gameForm.variables,
                                                  )
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    ),
                                  )}
                                </div>

                                <div className="mt-4 flex justify-end">
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                                    onClick={() =>
                                      setDraftNode((current) =>
                                        current
                                          ? {
                                              ...current,
                                              timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                                entryIndex === index
                                                  ? writeTimelineChoiceDrafts(
                                                      entry,
                                                      timelineChoices.filter((_, itemIndex) => itemIndex !== choiceIndex),
                                                      gameForm.variables,
                                                    )
                                                  : entry,
                                              ),
                                            }
                                          : current,
                                      )
                                    }
                                  >
                                    删除这个时间线选项
                                  </button>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                              onClick={() =>
                                setDraftNode((current) =>
                                  current
                                    ? {
                                        ...current,
                                        timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                          entryIndex === index
                                            ? writeTimelineChoiceDrafts(
                                                entry,
                                                [
                                                  ...timelineChoices,
                                                  {
                                                    code: buildId("choice"),
                                                    label: "",
                                                    hint: "",
                                                    targetNodeCode:
                                                      current.autoNextNodeCode || game.nodes[0]?.code || "",
                                                    conditions: [],
                                                    actions: [],
                                                  },
                                                ],
                                                gameForm.variables,
                                              )
                                            : entry,
                                        ),
                                      }
                                    : current,
                                )
                              }
                            >
                              新增时间线选项
                            </button>
                          </div>
                        </RuleBlock>
                      </>
                    ) : null}

                    {event.type === "jump" ? (
                      <>
                        <Field label="跳转目标片段" visibility="logic">
                          <select
                            className={className}
                            value={getTimelineStringField(event, "targetNodeCode")}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? updateTimelinePayload(entry, (payload) => ({
                                              ...payload,
                                              targetNodeCode: changedEvent.target.value,
                                            }))
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          >
                            <option value="">请选择目标片段</option>
                            {game.nodes.map((node) => (
                              <option key={node.code} value={node.code}>
                                {getNodeDisplayName(game, node.code)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="跳转说明" visibility="player">
                          <input
                            className={className}
                            value={getTimelineStringField(event, "label")}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? updateTimelinePayload(entry, (payload) => ({
                                              ...payload,
                                              label: changedEvent.target.value,
                                            }))
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>
                      </>
                    ) : null}

                    {event.type === "play_audio" ? (
                      <Field label="音频地址" visibility="logic">
                        <input
                          className={className}
                          value={getTimelineStringField(event, "audioUrl") || getTimelineStringField(event, "url")}
                          onChange={(changedEvent) =>
                            setDraftNode((current) =>
                              current
                                ? {
                                    ...current,
                                    timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                      entryIndex === index
                                        ? updateTimelinePayload(entry, (payload) => ({
                                            ...payload,
                                            audioUrl: changedEvent.target.value,
                                          }))
                                        : entry,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </Field>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-2">
                      {renderConditionEditor(event.conditions, (nextConditions) =>
                        setDraftNode((current) =>
                          current
                            ? {
                                ...current,
                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, conditions: nextConditions } : entry,
                                ),
                              }
                            : current,
                        ),
                      )}

                      {renderActionEditor(event.actions, (nextActions) =>
                        setDraftNode((current) =>
                          current
                            ? {
                                ...current,
                                timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, actions: nextActions } : entry,
                                ),
                              }
                            : current,
                        ),
                      )}
                    </div>
                  </div>

                      <div className="mt-4">
                        <Field
                          label="Payload JSON"
                          hint="保留原始 JSON 兜底，复杂事件可以直接编辑底层 payload。"
                        >
                          <textarea
                            className={textareaClass}
                            value={event.payloadText}
                            onChange={(changedEvent) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      timelineEvents: current.timelineEvents.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? { ...entry, payloadText: changedEvent.target.value }
                                          : entry,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
            当前片段还没有时间线事件。这意味着它仍然保持传统的“视频播完后再交互”模式。
          </div>
        )}
      </div>
    );
  }

  function renderProjectWorkspace() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
        <div className="grid content-start gap-5 xl:self-start">
          <Panel
            eyebrow="Step 1"
            title="项目配置"
            description="这里先定义作品本身，不处理具体剧情分支。完成后就可以去搭建首个片段。"
          >
            <div className="grid gap-4">
              <HelperCard title="在这里做什么">
                先确定作品标题、入口页素材、开场说明和起始片段。玩家进入作品前看到的内容，基本都在这里配置。
              </HelperCard>
              <div className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4">
                <div className="mb-4 text-sm font-medium text-stone-900">作品基础信息</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="项目标题" visibility="player">
                    <input
                      className={className}
                      value={gameForm.title}
                      onChange={(event) => setGameForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </Field>

                  <Field label="一句话介绍" visibility="player">
                    <input
                      className={className}
                      value={gameForm.tagline}
                      onChange={(event) => setGameForm((current) => ({ ...current, tagline: event.target.value }))}
                    />
                  </Field>

                  <Field label="项目链接 Slug" hint="用于独立链接和后台切换，如 my-first-project" visibility="logic">
                    <input
                      className={className}
                      value={gameForm.slug}
                      onChange={(event) => setGameForm((current) => ({ ...current, slug: event.target.value }))}
                    />
                  </Field>

                  <Field label="首页排序值" hint="数值越大越靠前；相同则按更新时间排序" visibility="logic">
                    <input
                      className={className}
                      value={gameForm.sortOrder}
                      onChange={(event) => setGameForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    />
                  </Field>

                  <Field label="起始片段" hint="玩家点击开始后会进入这个片段。" visibility="logic">
                    <select
                      className={className}
                      value={gameForm.startNodeCode}
                      onChange={(event) =>
                        setGameForm((current) => ({ ...current, startNodeCode: event.target.value }))
                      }
                    >
                      <option value="">请选择起始片段</option>
                      {game.nodes.map((node) => (
                        <option key={node.code} value={node.code}>
                          {getNodeDisplayName(game, node.code)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="lg:col-span-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm text-stone-800">
                      <input
                        type="checkbox"
                        checked={gameForm.listedOnHome}
                        onChange={(event) =>
                          setGameForm((current) => ({ ...current, listedOnHome: event.target.checked }))
                        }
                      />
                      <span>在首页项目大厅展示此项目</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                <div className="mb-4 text-sm font-medium text-stone-900">入口页内容</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="入口视频 URL" visibility="player">
                    <input
                      className={className}
                      value={gameForm.promoVideoUrl}
                      onChange={(event) =>
                        setGameForm((current) => ({ ...current, promoVideoUrl: event.target.value }))
                      }
                    />
                  </Field>

                  <Field label="入口封面 URL" visibility="player">
                    <input
                      className={className}
                      value={gameForm.promoPosterUrl}
                      onChange={(event) =>
                        setGameForm((current) => ({ ...current, promoPosterUrl: event.target.value }))
                      }
                    />
                  </Field>

                  <div className="lg:col-span-2">
                    <Field label="开场说明" hint="玩家开始前会看到的长文案说明。" visibility="player">
                      <textarea
                        className={textareaClass}
                        value={gameForm.promoText}
                        onChange={(event) =>
                          setGameForm((current) => ({ ...current, promoText: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                    {uploadingPromo ? "上传中..." : "上传宣传视频"}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploadingPromo}
                      onChange={(event) => void uploadPromoVideo(event)}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                    {uploadingPromoPoster ? "上传中..." : "上传入口封面"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingPromoPoster}
                      onChange={(event) => void uploadPromoPoster(event)}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                <div className="mb-4 text-sm font-medium text-stone-900">保存与迁移</div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                    onClick={() => void saveGameSettings()}
                    disabled={saving}
                  >
                    保存项目配置
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                    onClick={() => void exportProject()}
                    disabled={saving || importing}
                  >
                    导出项目 JSON
                  </button>
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                    导入项目 JSON
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => void importProject(event)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    onClick={() => void resetToBlankProject()}
                    disabled={saving}
                  >
                    重置为空白项目
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-300 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    onClick={() => void deleteCurrentProject()}
                    disabled={deletingProject || saving || projects.length <= 1}
                  >
                    {deletingProject ? "删除中..." : "删除当前项目"}
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            eyebrow="Rules"
            title="全局变量"
            description="只有当你需要条件判断、数值变化、阵营状态这类玩法时，才需要在这里建变量。"
          >
            <div className="grid gap-4">
              <HelperCard title="什么时候需要变量">
                建议只放通用状态，例如好感、阵营、线索、权限、身份标签。不要把某个具体剧本的人名或剧情设定硬写成字段名。
              </HelperCard>
              {renderVariablesEditor()}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel
            eyebrow="Next"
            title={hasNodes ? "下一步建议" : "建议下一步"}
            description={
              hasNodes
                ? "项目基础配置已经有了，下一步应该去搭建剧情结构。"
                : "项目保存后，直接去“搭建剧情”创建首个片段。没有首片段时，前台不会进入剧情。"
            }
          >
              <div className="grid gap-4">
                <div className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4 text-sm leading-7 text-stone-700">
                  {hasNodes
                    ? "继续去剧情工作台补片段、连跳转，再逐段完善每个片段的内容。"
                    : "先保存当前项目配置，然后去剧情工作台创建首个片段，并把它设为起始片段。"}
                </div>
                <button
                  type="button"
                  className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800"
                  onClick={openFlowComposer}
                >
                  前往剧情工作台
                </button>
              </div>
          </Panel>

          <Panel
            eyebrow="Check"
            title="发布前检查"
            description="这里只保留会直接影响玩家体验的关键问题。"
          >
            <div className="grid gap-3 text-sm">
              <HelperCard title="怎么判断能不能继续做前台体验">
                只要这里还在提示缺视频、缺出口或无效目标，前台播放和跳转就一定会出问题，应优先补齐。
              </HelperCard>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                片段数：{publishSummary.totalNodes}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                选项数：{publishSummary.totalChoices}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                项目变量：{publishSummary.totalVariables}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                时间线事件：{publishSummary.totalEvents}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                缺视频片段：{publishSummary.missingVideo}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                缺出口片段：{publishSummary.noLinkNodes}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                无效目标选项：{publishSummary.unreachableChoices}
              </div>
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  publishSummary.ready
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {publishSummary.ready ? "结构完整，可以继续发布流程" : "结构未闭环，建议先补片段和跳转"}
              </div>
            </div>
          </Panel>

          <Panel
            eyebrow="Transfer"
            title="项目迁移"
            description="用于备份、跨环境搬运或重置当前项目。"
          >
            <div className="grid gap-3">
              <button
                type="button"
                className="rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                onClick={() => void exportProject()}
                disabled={saving || importing}
              >
                导出项目 JSON
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                导入项目 JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => void importProject(event)}
                />
              </label>
              <button
                type="button"
                className="rounded-full border border-rose-200 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                onClick={() => void resetToBlankProject()}
                disabled={saving}
              >
                重置为空白项目
              </button>
              <button
                type="button"
                className="rounded-full border border-rose-300 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                onClick={() => void deleteCurrentProject()}
                disabled={deletingProject || saving || projects.length <= 1}
              >
                {deletingProject ? "删除中..." : "删除当前项目"}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

function renderFlowWorkspace() {
    return (
      <div className="grid gap-5">
        <Panel
          eyebrow="Workspace"
          title={hasNodes ? "剧情工作台" : "先创建首个片段"}
          description="在这里搭剧情树、选中片段、继续创作和编辑内容。"
        >
          <div className="grid gap-5">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">片段</div>
                <div className="mt-1 text-2xl text-stone-950">{publishSummary.totalNodes}</div>
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">出口</div>
                <div className="mt-1 text-2xl text-stone-950">{publishSummary.totalChoices}</div>
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">时间线事件</div>
                <div className="mt-1 text-2xl text-stone-950">{publishSummary.totalEvents}</div>
              </div>
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  publishSummary.ready
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <div className="text-[11px] uppercase tracking-[0.25em]">结构状态</div>
                <div className="mt-2 text-sm">
                  {publishSummary.ready ? "可试玩发布" : `待处理 ${publishSummary.noLinkNodes + publishSummary.missingVideo + publishSummary.unreachableChoices} 项`}
                </div>
              </div>
            </div>

            <div ref={flowComposerRef} className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_220px_180px]">
                  <Field label="新片段标题" visibility="player">
                    <input
                      className={className}
                      value={newNodeForm.title}
                      onChange={(event) =>
                        setNewNodeForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="如 序章 / 电梯间 / 结局A"
                    />
                  </Field>

                  <Field label="新片段编码" hint="编码用于跳转和后台定位" visibility="logic">
                    <input
                      className={className}
                      value={newNodeForm.code}
                      onChange={(event) =>
                        setNewNodeForm((current) => ({ ...current, code: event.target.value }))
                      }
                      placeholder="如 prologue_gate"
                    />
                  </Field>

                  <Field label="新片段类型" visibility="logic">
                    <select
                      className={className}
                      value={newNodeForm.nodeType}
                      onChange={(event) =>
                        setNewNodeForm((current) => ({
                          ...current,
                          nodeType: event.target.value as "video" | "ending",
                        }))
                      }
                    >
                      {Object.entries(nodeTypeLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-stone-950 px-5 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                    onClick={() => void createNode()}
                    disabled={saving}
                  >
                    {hasNodes ? "新增片段" : "创建首个片段"}
                  </button>
                  {selectedNode ? (
                    <button
                      type="button"
                      className="rounded-full border border-stone-900/10 px-5 py-3 text-sm text-stone-800 transition hover:border-stone-900/30"
                      onClick={() =>
                        setNewNodeForm((current) => ({
                          ...current,
                          title: selectedNode.title ? `${selectedNode.title} / 新分支` : current.title,
                        }))
                      }
                    >
                      以当前片段为基础命名
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {!game.startNodeCode && hasNodes ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
                    还没设置起始片段
                  </span>
                ) : null}
                {selectedNode ? (
                  <span className="rounded-full bg-white px-3 py-1 text-stone-600">
                    当前编辑 {selectedNode.title || selectedNode.code}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {Object.values(playerScenePresentation).map((scene) => (
                <div
                  key={scene.stage}
                  className="rounded-2xl border border-stone-900/10 bg-white px-4 py-3"
                >
                  <span className={`rounded-full px-3 py-1 text-xs ${scene.badgeClassName}`}>
                    {scene.label}
                  </span>
                  <p className="mt-3 text-xs leading-6 text-stone-600">{scene.detail}</p>
                </div>
              ))}
            </div>

              <div className="grid gap-5">
                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                    <div className="text-sm font-medium text-stone-900">剧情树</div>
                    <div className="mt-1 text-xs leading-6 text-stone-500">
                      点选节点后，下方会直接切换到对应片段的创作面板。
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                    {([
                      { id: "all", label: "全部" },
                      { id: "issues", label: "只看问题" },
                      { id: "start", label: "起始" },
                      { id: "ending", label: "结局" },
                      { id: "isolated", label: "孤立" },
                    ] as const).map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        className={`rounded-full px-3 py-1 transition ${
                          branchGraphFilter === filter.id
                            ? "bg-stone-950 text-white"
                            : "border border-stone-900/10 bg-stone-50 text-stone-600 hover:border-stone-900/30"
                        }`}
                        onClick={() => setBranchGraphFilter(filter.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  {hasNodes ? (
                    <BranchGraph
                      game={game}
                      selectedNodeCode={selectedNodeCode}
                      onSelectNode={handleSelectNode}
                      onAddNext={(nodeCode) => prepareLinkedNodeFromGraph(nodeCode, "auto")}
                      onAddBranch={(nodeCode) => prepareLinkedNodeFromGraph(nodeCode, "choice")}
                      onPreviewNode={openPreviewNode}
                      filter={branchGraphFilter}
                    />
                  ) : (
                    <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                      还没有任何片段。先创建首个片段，剧情树才会出现。
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-5">
                {issueNodeEntries.length ? (
                  <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-rose-900">待修正片段</div>
                        <div className="mt-1 text-xs leading-6 text-rose-700">
                          这些问题会直接影响前台播放和跳转，建议优先处理。
                        </div>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs text-rose-700">
                        {issueNodeEntries.length} 个
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {issueNodeEntries.slice(0, 6).map((entry) => (
                        <button
                          key={entry.node.code}
                          type="button"
                          className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-left transition hover:border-rose-300"
                          onClick={() => {
                            setBranchGraphFilter("issues");
                            handleSelectNode(entry.node.code);
                          }}
                        >
                          <div className="text-sm font-medium text-stone-900">
                            {entry.node.title || entry.node.code}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {entry.issues.map((issue) => (
                              <span
                                key={`${entry.node.code}-${issue}`}
                                className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700"
                              >
                                {issue}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {selectedNode ? <div className="grid gap-5">{renderSceneWorkspace()}</div> : null}
        </Panel>
      </div>
    );
  }

  function renderSceneWorkspace() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px] xl:items-start">
        <div className="grid content-start gap-5 xl:self-start">
          <Panel
            eyebrow="Node"
            title={selectedNode ? `当前片段：${selectedNode.title}` : "当前片段"}
            description="片段内容、视频、跳转出口和时间线互动都在这里完成。"
          >
            {draftNode ? (
              <div className="grid gap-4">
                <div className="rounded-3xl border border-stone-900/10 bg-stone-50/80 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                          {draftNode.nodeType === "ending" ? "结局片段" : "视频片段"}
                        </span>
                        {selectedNodeEntry ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${selectedNodeEntry.playerScene.badgeClassName}`}
                          >
                            {selectedNodeEntry.playerScene.label}
                          </span>
                        ) : null}
                        {nodeDirty ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                            有未保存修改
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                            已同步
                          </span>
                        )}
                        {!draftNode.videoUrl.trim() ? (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">缺视频</span>
                        ) : null}
                        {!draftNode.nodeType || draftNode.nodeType === "video"
                          ? !draftNode.autoNextNodeCode && !(draftNode.choices?.length ?? 0)
                            ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">缺出口</span>
                            : null
                          : null}
                      </div>
                      <div className="mt-3 text-lg text-stone-950">{draftNode.title || "未命名片段"}</div>
                      <div className="mt-1 text-sm text-stone-600">
                        编码：{selectedNodeCode || "未设置"} · 时间线事件 {draftNode.timelineEvents.length} 个 · 结尾出口 {draftNode.choices.length} 个
                      </div>
                      {selectedNodeEntry ? (
                        <div className="mt-3 rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm leading-7 text-stone-600">
                          玩家侧呈现：<span className="font-medium text-stone-950">{selectedNodeEntry.playerScene.label}</span>。
                          {selectedNodeEntry.playerScene.detail}
                        </div>
                      ) : null}
                      {selectedNodeEntry?.issues.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedNodeEntry.issues.map((issue) => (
                            <span
                              key={`${selectedNodeEntry.node.code}-${issue}`}
                              className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                        onClick={() => void saveNode()}
                        disabled={saving}
                      >
                        {saving ? "保存中..." : "保存片段"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                        onClick={openPreviewFromSelectedNode}
                      >
                        试玩当前片段
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                        onClick={() => void duplicateSelectedNode()}
                        disabled={saving}
                      >
                        复制片段
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                        onClick={() => void deleteSelectedNode()}
                        disabled={saving || game.nodes.length <= 1}
                      >
                        删除片段
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                        onClick={openFlowComposer}
                      >
                        新建片段
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4">
                    <div className="text-sm font-medium text-stone-900">片段内容</div>
                    <div className="mt-1 text-xs leading-6 text-stone-500">玩家会看到的标题、说明和正文。</div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="片段标题" visibility="player">
                      <input
                        className={className}
                        value={draftNode.title}
                        onChange={(event) =>
                          setDraftNode((current) => (current ? { ...current, title: event.target.value } : current))
                        }
                      />
                    </Field>

                    <Field label="片段类型" visibility="logic">
                      <select
                        className={className}
                        value={draftNode.nodeType}
                        onChange={(event) =>
                          setDraftNode((current) =>
                            current
                              ? { ...current, nodeType: event.target.value as "video" | "ending" }
                              : current,
                          )
                        }
                      >
                        {Object.entries(nodeTypeLabel).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="lg:col-span-2">
                      <Field label="片段描述" visibility="player">
                        <textarea
                          className={textareaClass}
                          value={draftNode.description}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, description: event.target.value } : current,
                            )
                          }
                        />
                      </Field>
                    </div>

                    <div className="lg:col-span-2">
                      <Field label="正文文案" hint="用于字幕、简介或前端辅助展示。" visibility="player">
                        <textarea
                          className={textareaClass}
                          value={draftNode.transcript}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, transcript: event.target.value } : current,
                            )
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">视频与流转</div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="视频地址" visibility="player">
                      <input
                        className={className}
                        value={draftNode.videoUrl}
                        onChange={(event) =>
                          setDraftNode((current) => (current ? { ...current, videoUrl: event.target.value } : current))
                        }
                      />
                    </Field>

                    {draftNode.nodeType === "video" ? (
                      <Field label="自动跳转" hint="留空表示等待玩家选择，或停留在最后一帧。" visibility="logic">
                        <select
                          className={className}
                          value={draftNode.autoNextNodeCode}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, autoNextNodeCode: event.target.value } : current,
                            )
                          }
                        >
                          <option value="">不自动跳转</option>
                          {game.nodes
                            .filter((node) => node.code !== selectedNodeCode)
                            .map((node) => (
                              <option key={node.code} value={node.code}>
                                {getNodeDisplayName(game, node.code)}
                              </option>
                            ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="结局类型" visibility="player">
                        <select
                          className={className}
                          value={draftNode.endingTone}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, endingTone: event.target.value as EndingTone } : current,
                            )
                          }
                        >
                          {Object.entries(endingToneLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                      onClick={() => void saveNode()}
                      disabled={saving}
                    >
                      保存片段内容
                    </button>

                    <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                      {uploadingNode ? "上传中..." : "上传片段视频"}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(event) => void uploadNodeVideo(event)}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-stone-900">结尾出口</div>
                      <div className="mt-1 text-xs leading-6 text-stone-500">
                        这里决定这段播完后玩家能去哪里。中途插入的选项仍放在时间线里。
                      </div>
                    </div>
                    <div className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                      当前 {draftNode.choices.length} 个出口
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {draftNode.nodeType === "video" && !draftNode.autoNextNodeCode && !draftNode.choices.length ? (
                      <div className="rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-800">
                        当前还没有出口，玩家会停在这里。
                      </div>
                    ) : null}
                    {draftNode.autoNextNodeCode && draftNode.choices.length ? (
                      <div className="rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-800">
                        同时设置了自动跳转和选项，建议保留一种主要流转方式。
                      </div>
                    ) : null}
                  </div>

                  {draftNode.choices.length ? (
                    <div className="mt-4 grid gap-4">
                      {draftNode.choices.map((choice, index) => (
                        <div
                          key={`${choice.code}-${index}`}
                          className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-4"
                        >
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-stone-900">
                                {choice.label || `选项 ${index + 1}`}
                              </div>
                              <div className="mt-1 text-xs text-stone-500">
                                {choice.code || "未设置编码"} · {choice.targetNodeCode || "未设置目标片段"}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                              onClick={() =>
                                setDraftNode((current) =>
                                  current
                                    ? {
                                        ...current,
                                        choices: current.choices.filter((_, entryIndex) => entryIndex !== index),
                                      }
                                    : current,
                                )
                              }
                            >
                              删除选项
                            </button>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <Field label="选项编码" visibility="logic">
                              <input
                                className={className}
                                value={choice.code}
                                onChange={(event) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          choices: current.choices.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, code: event.target.value } : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              />
                            </Field>

                            <Field label="目标片段" visibility="logic">
                              <select
                                className={className}
                                value={choice.targetNodeCode}
                                onChange={(event) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          choices: current.choices.map((entry, entryIndex) =>
                                            entryIndex === index
                                              ? { ...entry, targetNodeCode: event.target.value }
                                              : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              >
                                <option value="">请选择目标片段</option>
                                {game.nodes
                                  .filter((node) => node.code !== selectedNodeCode)
                                  .map((node) => (
                                    <option key={node.code} value={node.code}>
                                      {getNodeDisplayName(game, node.code)}
                                    </option>
                                  ))}
                              </select>
                            </Field>

                            <Field label="选项文案" visibility="player">
                              <input
                                className={className}
                                value={choice.label}
                                onChange={(event) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          choices: current.choices.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, label: event.target.value } : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              />
                            </Field>

                            <Field label="补充提示" visibility="player">
                              <input
                                className={className}
                                value={choice.hint}
                                onChange={(event) =>
                                  setDraftNode((current) =>
                                    current
                                      ? {
                                          ...current,
                                          choices: current.choices.map((entry, entryIndex) =>
                                            entryIndex === index ? { ...entry, hint: event.target.value } : entry,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              />
                            </Field>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            {renderConditionEditor(toDraftConditions(choice.conditions), (nextConditions) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      choices: current.choices.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              conditions: toConditionPayload(nextConditions, gameForm.variables),
                                            }
                                          : entry,
                                      ),
                                    }
                                  : current,
                              ),
                            )}

                            {renderActionEditor(toDraftActions(choice.actions), (nextActions) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      choices: current.choices.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? {
                                              ...entry,
                                              actions: toActionPayload(nextActions, gameForm.variables),
                                            }
                                          : entry,
                                      ),
                                    }
                                  : current,
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                      当前片段还没有结尾选项。
                    </div>
                  )}

                  <div className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-4">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-stone-900">给当前片段添加选项出口</div>
                        <p className="mt-1 text-xs leading-6 text-stone-500">
                          如果这个选项还没有对应片段，填写“新目标片段标题”，系统会先创建片段，再自动把选项连过去。
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-amber-200/60 bg-amber-50 px-3 py-1 text-xs text-amber-800">
                        选项 = 玩家看到的按钮
                      </span>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="新选项编码" hint="可留空，系统会自动生成。" visibility="logic">
                        <input
                          className={className}
                          value={newChoiceForm.code}
                          onChange={(event) =>
                            setNewChoiceForm((current) => ({ ...current, code: event.target.value }))
                          }
                        />
                      </Field>

                      <Field label="连接已有片段" hint="这个选项要跳到已有片段时选择；如果要新建目标片段，这里留空。" visibility="logic">
                        <select
                          className={className}
                          value={newChoiceForm.targetNodeCode}
                          onChange={(event) =>
                            setNewChoiceForm((current) => ({ ...current, targetNodeCode: event.target.value }))
                          }
                        >
                          <option value="">请选择目标片段</option>
                          {game.nodes
                            .filter((node) => node.code !== selectedNodeCode)
                            .map((node) => (
                              <option key={node.code} value={node.code}>
                                {getNodeDisplayName(game, node.code)}
                              </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="创建新目标片段" hint="填写后点击按钮，会创建一个新片段并自动接到这个选项后面。" visibility="player">
                        <input
                          className={className}
                          value={newChoiceForm.targetNodeTitle}
                          onChange={(event) =>
                            setNewChoiceForm((current) => ({ ...current, targetNodeTitle: event.target.value }))
                          }
                          placeholder="如 追上去 / 留在原地"
                        />
                      </Field>

                      <Field label="选项文案" visibility="player">
                        <input
                          className={className}
                          value={newChoiceForm.label}
                          onChange={(event) =>
                            setNewChoiceForm((current) => ({ ...current, label: event.target.value }))
                          }
                        />
                      </Field>

                      <Field label="补充提示" visibility="player">
                        <input
                          className={className}
                          value={newChoiceForm.hint}
                          onChange={(event) =>
                            setNewChoiceForm((current) => ({ ...current, hint: event.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="rounded-full bg-stone-950 px-4 py-2.5 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                        onClick={() => void addChoiceToSelectedNode()}
                        disabled={saving}
                      >
                        {newChoiceForm.targetNodeTitle.trim() ? "创建目标片段并加入选项" : "加入当前片段"}
                      </button>
                      <span className="text-xs leading-6 text-stone-500">
                        需要两个分支时，重复添加两次：每个选项各填一个新目标片段标题。
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                先创建或选择一个片段。
              </div>
            )}
          </Panel>

          <Panel
            eyebrow="Timeline"
            title="时间线编排"
            description="把互动从“播完再选”扩展到视频中途。阶段 2 的规则系统也从这里开始真正生效。"
          >
            <div className="grid gap-4">
              <HelperCard title="什么时候需要时间线">
                如果只是视频播完后再给出口，可以不配时间线。只有当你要在视频中途弹字、插入选择、暂停、叠层提示或直接跳转时，才需要在这里加事件。
              </HelperCard>
              {renderTimelineEditor()}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel
            eyebrow="Actions"
            title="创作动作"
            description="保存、试玩、复制和从当前片段继续创建后续内容。"
          >
            {selectedNode && draftNode ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                      {draftNode.nodeType === "ending" ? "结局片段" : "视频片段"}
                    </span>
                    {selectedNode.code === game.startNodeCode ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        起始片段
                      </span>
                    ) : null}
                    {nodeDirty ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                        有未保存修改
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                        已同步
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-lg text-stone-950">{selectedNode.title || "未命名片段"}</div>
                  <div className="mt-1 text-sm text-stone-500">{selectedNode.code}</div>
                  <div className="mt-4 grid gap-2 text-xs text-stone-600">
                    <div className="rounded-2xl border border-stone-900/10 bg-white px-3 py-2">
                      结尾出口 {draftNode.choices.length} 个
                    </div>
                    <div className="rounded-2xl border border-stone-900/10 bg-white px-3 py-2">
                      时间线事件 {draftNode.timelineEvents.length} 个
                    </div>
                    <div className="rounded-2xl border border-stone-900/10 bg-white px-3 py-2">
                      {draftNode.videoUrl.trim() ? "已配置视频" : "缺少视频"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                    onClick={() => void saveNode()}
                    disabled={saving}
                  >
                    {saving ? "保存中..." : "保存当前片段"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30"
                    onClick={openPreviewFromSelectedNode}
                  >
                    试玩当前片段
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                    onClick={() => void duplicateSelectedNode()}
                    disabled={saving}
                  >
                    复制当前片段
                  </button>
                  {!selectedNode.isEnding && selectedNode.code !== game.startNodeCode ? (
                    <button
                      type="button"
                      className="rounded-full border border-emerald-200 px-4 py-3 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      onClick={() => void setStartNode(selectedNode.code)}
                      disabled={saving}
                    >
                      设为起始片段
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 px-4 py-3 text-sm text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    onClick={() => void deleteSelectedNode()}
                    disabled={saving || game.nodes.length <= 1}
                  >
                    删除当前片段
                  </button>
                </div>

                {!selectedNode.isEnding ? (
                  <div ref={quickLinkComposerRef} className="rounded-2xl border border-stone-900/10 bg-white p-4">
                    <div className="text-sm font-medium text-stone-900">从当前片段继续创作</div>
                    <div className="mt-1 text-xs leading-6 text-stone-500">
                      直接创建下一个片段，并自动接到当前片段上。
                    </div>

                    <div className="mt-4 grid gap-4">
                      <Field label="新片段标题" visibility="player">
                        <input
                          className={className}
                          value={quickLinkForm.title}
                          onChange={(event) =>
                            setQuickLinkForm((current) => ({ ...current, title: event.target.value }))
                          }
                          placeholder="如 监控室 / 车库出口 / 结局B"
                        />
                      </Field>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="新片段编码" hint="可留空，系统自动生成" visibility="logic">
                          <input
                            className={className}
                            value={quickLinkForm.code}
                            onChange={(event) =>
                              setQuickLinkForm((current) => ({ ...current, code: event.target.value }))
                            }
                            placeholder="如 monitor_room"
                          />
                        </Field>

                        <Field label="新片段类型" visibility="logic">
                          <select
                            className={className}
                            value={quickLinkForm.nodeType}
                            onChange={(event) =>
                              setQuickLinkForm((current) => ({
                                ...current,
                                nodeType: event.target.value as "video" | "ending",
                              }))
                            }
                          >
                            {Object.entries(nodeTypeLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field
                        label="连接方式"
                        hint="自动跳转适合直接接下一幕；分支选项适合玩家做选择。"
                        visibility="logic"
                      >
                        <div className="flex flex-wrap gap-2">
                          {([
                            { id: "choice", label: "作为新选项分支" },
                            { id: "auto", label: "作为自动跳转下一幕" },
                          ] as const).map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              className={`rounded-full px-3 py-2 text-sm transition ${
                                quickLinkForm.linkMode === mode.id
                                  ? "bg-stone-950 text-white"
                                  : "border border-stone-900/10 bg-stone-50 text-stone-700 hover:border-stone-900/30"
                              }`}
                              onClick={() =>
                                setQuickLinkForm((current) => ({
                                  ...current,
                                  linkMode: mode.id,
                                }))
                              }
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </Field>

                      {quickLinkForm.linkMode === "choice" ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Field label="选项文案" visibility="player">
                            <input
                              className={className}
                              value={quickLinkForm.choiceLabel}
                              onChange={(event) =>
                                setQuickLinkForm((current) => ({
                                  ...current,
                                  choiceLabel: event.target.value,
                                }))
                              }
                              placeholder="如 进去看看 / 转身离开"
                            />
                          </Field>

                          <Field label="选项提示" visibility="player">
                            <input
                              className={className}
                              value={quickLinkForm.choiceHint}
                              onChange={(event) =>
                                setQuickLinkForm((current) => ({
                                  ...current,
                                  choiceHint: event.target.value,
                                }))
                              }
                              placeholder="可留空"
                            />
                          </Field>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-600">
                          保存后，当前片段会在播放结束时自动进入新片段。
                        </div>
                      )}

                      <button
                        type="button"
                        className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                        onClick={() => void createLinkedNodeFromSelected()}
                        disabled={saving}
                      >
                        创建并连接新片段
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-900/12 px-4 py-6 text-sm leading-7 text-stone-500">
                先从左侧片段导航中选择一个片段。
              </div>
            )}
          </Panel>

        </div>
      </div>
    );
  }

  function renderActiveWorkspace() {
    if (activeTab === "project") {
      return renderProjectWorkspace();
    }

    return renderFlowWorkspace();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.08),_transparent_26%),linear-gradient(180deg,_#f7f3ee_0%,_#f3efe8_100%)] text-stone-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="flex gap-4 rounded-[2rem] border border-stone-900/10 bg-white/72 p-4 shadow-[0_24px_80px_rgba(52,38,25,0.08)] backdrop-blur-xl xl:max-h-[calc(100vh-3rem)] xl:flex-col">
              <div className="rounded-[1.75rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.92))] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.38em] text-stone-500">StoryPlay Studio</div>
                <div className="mt-3 text-xl text-stone-950">{game.title || "未命名 StoryPlay 项目"}</div>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {game.tagline || "先完成项目配置，再开始搭建剧情与片段内容。"}
                </p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">当前管理项目</div>
                    <select
                      className="mt-2 w-full rounded-2xl border border-stone-900/10 bg-white px-3 py-3 text-sm outline-none transition focus:border-stone-500"
                      value={currentProjectSlug}
                      onChange={(event) => switchProject(event.target.value)}
                    >
                      {orderedProjects.map((project) => (
                        <option key={project.slug} value={project.slug}>
                          {project.title} / {project.slug}{project.listedOnHome ? "" : " / 已隐藏"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                      onClick={() => void createProjectEntry()}
                      disabled={creatingProject}
                    >
                      {creatingProject ? "创建中..." : "新建项目"}
                    </button>
                    <Link
                      href="/"
                      className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                    >
                      前台大厅
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/88 p-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">工作流导航</div>
                <div className="mt-3 grid gap-2">
                  {workspaceTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded-[1.2rem] border px-3 py-3 text-left transition ${
                        activeTab === tab.id
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-900/10 bg-stone-50 text-stone-800 hover:border-stone-900/30"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <div className={`text-[10px] uppercase tracking-[0.28em] ${activeTab === tab.id ? "text-stone-300" : "text-stone-500"}`}>
                        {tab.step}
                      </div>
                      <div className="mt-2 text-sm font-medium">{tab.label}</div>
                      <div className={`mt-1 text-xs leading-6 ${activeTab === tab.id ? "text-stone-300" : "text-stone-500"}`}>
                        {tab.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/88 p-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">片段导航</div>
                    <div className="mt-1 text-sm text-stone-900">{publishSummary.totalNodes} 个片段</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-3 py-1.5 text-xs text-stone-700 transition hover:border-stone-900/30"
                    onClick={openFlowComposer}
                  >
                    新建片段
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  <input
                    className="rounded-2xl border border-stone-900/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-stone-500"
                    value={nodeSearch}
                    onChange={(event) => setNodeSearch(event.target.value)}
                    placeholder="搜索片段标题或编码"
                  />
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "flat", label: "列表视图" },
                      { id: "chapter", label: "章节视图" },
                    ] as const).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          nodeNavigationMode === mode.id
                            ? "bg-stone-950 text-white"
                            : "border border-stone-900/10 bg-stone-50 text-stone-700 hover:border-stone-900/30"
                        }`}
                        onClick={() => setNodeNavigationMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "all", label: "全部" },
                      { id: "issues", label: "仅问题" },
                      { id: "start", label: "起始" },
                      { id: "ending", label: "结局" },
                      { id: "isolated", label: "孤立" },
                    ] as const).map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs transition ${
                          nodeFilter === filter.id
                            ? "bg-stone-950 text-white"
                            : "border border-stone-900/10 bg-stone-50 text-stone-700 hover:border-stone-900/30"
                        }`}
                        onClick={() => setNodeFilter(filter.id)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                  {filteredNodeEntries.length ? (
                    <div className="grid gap-3">
                      {(nodeNavigationMode === "chapter"
                        ? chapterNodeEntries.map((group) => ({
                            key: group.label,
                            label: group.label,
                            entries: group.entries,
                          }))
                        : [
                            { key: "issues", label: "问题片段", entries: groupedNodeEntries.issues },
                            { key: "main", label: "进行中片段", entries: groupedNodeEntries.main },
                            { key: "endings", label: "结局片段", entries: groupedNodeEntries.endings },
                          ]
                      ).map((group) =>
                        group.entries.length ? (
                          <div key={group.key} className="grid gap-2">
                            <div className="px-1 text-[11px] uppercase tracking-[0.28em] text-stone-500">
                              {group.label}
                            </div>
                            {group.entries.map(({ node, isStart, isEnding, isIsolated, incomingCount, playerScene, issues, issueCount }) => {
                              const isSelected = node.code === selectedNodeCode;
                              return (
                                <div
                                  key={node.code}
                                  className={`rounded-[1.2rem] border px-3 py-3 transition ${
                                    isSelected
                                      ? "border-stone-950 bg-stone-950 text-white"
                                      : "border-stone-900/10 bg-stone-50 text-stone-800 hover:border-stone-900/30"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className="w-full text-left"
                                    onClick={() => handleSelectNode(node.code)}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-medium">{node.title}</div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                                          isSelected ? "bg-white/10 text-white/80" : "bg-stone-200 text-stone-700"
                                        }`}
                                      >
                                        {isEnding ? "结局" : "片段"}
                                      </span>
                                    </div>
                                    <div className={`mt-1 text-xs ${isSelected ? "text-stone-300" : "text-stone-500"}`}>
                                      {node.code} · 入口 {incomingCount}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {isStart ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${isSelected ? "bg-emerald-300/15 text-emerald-100" : "bg-emerald-100 text-emerald-700"}`}>
                                          起始
                                        </span>
                                      ) : null}
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                                          isSelected ? "bg-white/10 text-white/75" : playerScene.badgeClassName
                                        }`}
                                      >
                                        {playerScene.label}
                                      </span>
                                      {isIsolated ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${isSelected ? "bg-rose-300/15 text-rose-100" : "bg-rose-100 text-rose-700"}`}>
                                          孤立
                                        </span>
                                      ) : null}
                                      {issueCount > 0
                                        ? issues.filter((issue) => issue !== "孤立片段").map((issue) => (
                                            <span
                                              key={`${node.code}-${issue}`}
                                              className={`rounded-full px-2 py-0.5 text-[10px] ${
                                                isSelected ? "bg-rose-300/15 text-rose-100" : "bg-rose-100 text-rose-700"
                                              }`}
                                            >
                                              {issue}
                                            </span>
                                          ))
                                        : null}
                                    </div>
                                  </button>

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                                        isSelected
                                          ? "border border-white/12 bg-white/6 text-white/85 hover:bg-white/10"
                                          : "border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/30"
                                      }`}
                                      onClick={() => focusNode(node.code, "flow")}
                                    >
                                      编辑
                                    </button>
                                    {!isStart ? (
                                      <button
                                        type="button"
                                        className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                                          isSelected
                                            ? "border border-emerald-200/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15"
                                            : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        }`}
                                        onClick={() => void setStartNode(node.code)}
                                        disabled={saving}
                                      >
                                        设起点
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-stone-900/12 px-3 py-5 text-sm leading-7 text-stone-500">
                      {game.nodes.length ? "没有匹配到符合当前筛选条件的片段。" : "还没有片段。先去“搭建剧情”创建首个片段。"}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/88 p-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">快速操作</div>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                    onClick={() => void loadGame(selectedNodeCode)}
                    disabled={loading}
                  >
                    {loading ? "刷新中..." : "刷新项目"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
                    onClick={() => void exportProject()}
                    disabled={saving || importing}
                  >
                    导出 JSON
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <section className="rounded-[2rem] border border-stone-900/10 bg-white/72 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)] backdrop-blur-xl">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px] xl:items-start">
                <div className="rounded-[1.75rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.9))] px-5 py-5">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-amber-800">当前工作区</div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">{activeWorkspace.step}</span>
                  <span className="text-2xl text-stone-950">{activeWorkspace.label}</span>
                  {hasUnsavedActiveChanges ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">有未保存修改</span>
                  ) : null}
                </div>
                  <p className="mt-4 text-sm leading-7 text-stone-800">{activeWorkspace.description}</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600">{activeWorkspace.hint}</p>
                  {selectedNode ? (
                    <div className="mt-4 rounded-[1.3rem] border border-white/60 bg-white/65 px-4 py-3 text-sm text-stone-700">
                      当前编辑片段：<span className="font-medium text-stone-950">{selectedNode.title}</span>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">片段数</div>
                    <div className="mt-1 text-2xl text-stone-950">{publishSummary.totalNodes}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">出口与事件</div>
                    <div className="mt-1 text-2xl text-stone-950">
                      {publishSummary.totalChoices + publishSummary.totalEvents}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">当前状态</div>
                    <div className="mt-1 text-sm text-stone-950">
                      {publishSummary.ready ? "可进入发布检查" : "仍在搭建中"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">前台显示：玩家会直接看到</span>
                <span className="rounded-full bg-stone-200 px-3 py-1 text-stone-700">仅逻辑：只影响流程、判断、跳转或后台结构</span>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-stone-900">当前项目进度</div>
                    <div className="mt-1 text-xs leading-6 text-stone-500">
                      只保留和可玩性直接相关的检查项，方便你判断下一步该做什么。
                    </div>
                  </div>
                  <div className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                    {setupChecklist.filter((item) => item.done).length}/{setupChecklist.length}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {setupChecklist.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-4 py-3 ${
                        item.done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <div className="text-sm font-medium">{item.done ? "已完成" : "待处理"} · {item.label}</div>
                      <div className="mt-1 text-xs leading-6">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {status ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {status}
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </section>

            <div className="mt-6">{renderActiveWorkspace()}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
