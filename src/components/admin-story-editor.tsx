"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { BranchGraph } from "@/components/branch-graph";
import type {
  ConditionOperator,
  ConditionRule,
  EndingTone,
  StoryChoice,
  StoryGame,
  StoryNode,
  TimelineEvent,
  TimelineEventType,
  VariableAction,
  VariableActionType,
  VariableDefinition,
  VariableRuntimeValue,
  VariableValueType,
} from "@/lib/story-engine";

type AdminPayload = {
  game: StoryGame;
};

type UploadPayload = {
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
};

type WorkspaceTab = "project" | "assets" | "flow" | "scene" | "choices";

type NodeListFilter = "all" | "issues" | "start" | "ending";
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
};

type GameFormState = {
  title: string;
  tagline: string;
  intro: string;
  promoVideoUrl: string;
  promoPosterUrl: string;
  promoText: string;
  startNodeCode: string;
  variables: DraftVariable[];
};

type AdminStoryEditorProps = {
  initialGame: StoryGame;
};

type ResourceItem = {
  id: string;
  label: string;
  kind: "promo-video" | "promo-poster" | "node-video";
  url: string;
  relatedNodeCode?: string;
};

const defaultVideoUrl =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const workspaceTabs: Array<{
  id: WorkspaceTab;
  label: string;
  step: string;
  hint: string;
  description: string;
}> = [
  {
    id: "project",
    label: "项目配置",
    step: "Step 1",
    hint: "先把作品标题、入口页、起始片段和全局变量定下来。",
    description: "定义作品是什么，以及玩家点开始前会看到什么。",
  },
  {
    id: "flow",
    label: "搭建剧情",
    step: "Step 2",
    hint: "先创建片段，再把片段之间的关系连起来。",
    description: "创建首个片段、扩展分支、检查剧情结构。",
  },
  {
    id: "scene",
    label: "编辑片段",
    step: "Step 3",
    hint: "选中一个片段后，在这里写内容、挂视频、加时间线事件。",
    description: "把单个片段本身做完整。",
  },
  {
    id: "choices",
    label: "设置出口",
    step: "Step 4",
    hint: "给片段结尾配置玩家可选出口，以及条件和动作。",
    description: "决定这一段播完后，玩家能去哪里。",
  },
  {
    id: "assets",
    label: "素材与发布",
    step: "Step 5",
    hint: "统一检查宣传素材、片段视频和发布前结构风险。",
    description: "最后集中处理素材与上线前自检。",
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
    tagline: game.tagline,
    intro: game.intro,
    promoVideoUrl: game.promoVideoUrl,
    promoPosterUrl: game.promoPosterUrl,
    promoText: game.promoText,
    startNodeCode: game.startNodeCode,
    variables: toDraftVariables(game.variables),
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
        <h2 className="mt-3 text-2xl text-stone-950">{title}</h2>
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

export function AdminStoryEditor({ initialGame }: AdminStoryEditorProps) {
  const initialNode = pickNode(initialGame);
  const [game, setGame] = useState<StoryGame>(initialGame);
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
    videoUrl: defaultVideoUrl,
  });
  const [newChoiceForm, setNewChoiceForm] = useState<NewChoiceForm>({
    code: "",
    label: "",
    hint: "",
    targetNodeCode: initialGame.nodes[0]?.code ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingPromo, setUploadingPromo] = useState(false);
  const [uploadingNode, setUploadingNode] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | TimelineEventType>("all");
  const [collapsedTimelineEventIds, setCollapsedTimelineEventIds] = useState<string[]>([]);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeFilter, setNodeFilter] = useState<NodeListFilter>("all");
  const [nodeNavigationMode, setNodeNavigationMode] = useState<NodeNavigationMode>("flat");
  const [draggingTimelineEventId, setDraggingTimelineEventId] = useState<string | null>(null);

  const className = inputClassName();
  const textareaClass = textareaClassName();
  const selectedNode = game.nodes.find((node) => node.code === selectedNodeCode) ?? null;
  const hasNodes = game.nodes.length > 0;
  const activeWorkspace = workspaceTabs.find((tab) => tab.id === activeTab) ?? workspaceTabs[0];
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
  const sceneDirty = Boolean(
    selectedNode && draftNode && selectedNodeBaselineSnapshot !== selectedNodeDraftSnapshot,
  );
  const nodeListEntries = useMemo(() => {
    const nodeCodeSet = new Set(game.nodes.map((node) => node.code));

    return game.nodes.map((node) => {
      const invalidChoiceTargets = (node.choices ?? []).filter(
        (choice) => choice.targetNodeCode && !nodeCodeSet.has(choice.targetNodeCode),
      ).length;
      const invalidAutoTarget =
        node.autoNextNodeCode && !nodeCodeSet.has(node.autoNextNodeCode) ? 1 : 0;
      const issues: string[] = [];

      if (!node.videoUrl.trim()) {
        issues.push("缺视频");
      }

      if (!node.isEnding && !(node.choices?.length ?? 0) && !node.autoNextNodeCode) {
        issues.push("缺出口");
      }

      if (invalidChoiceTargets + invalidAutoTarget > 0) {
        issues.push("目标无效");
      }

      return {
        node,
        isStart: node.code === game.startNodeCode,
        isEnding: Boolean(node.isEnding),
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
  const currentNodeEntry = useMemo(
    () => nodeListEntries.find((entry) => entry.node.code === selectedNodeCode) ?? null,
    [nodeListEntries, selectedNodeCode],
  );
  const issueNodeEntries = useMemo(
    () => nodeListEntries.filter((entry) => entry.issueCount > 0),
    [nodeListEntries],
  );
  const hasUnsavedActiveChanges =
    activeTab === "project" ? projectDirty : activeTab === "scene" || activeTab === "choices" ? sceneDirty : false;

  function syncFromGame(nextGame: StoryGame, preferredNodeCode?: string) {
    const nextNode = pickNode(nextGame, preferredNodeCode ?? selectedNodeCode);

    setGame(nextGame);
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
          : nextGame.nodes[0]?.code ?? "",
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

    if (activeTab === "project" || activeTab === "assets" || activeTab === "flow") {
      setActiveTab("scene");
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

  async function loadGame(preferredNodeCode?: string) {
    setLoading(true);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>("/api/admin/game");
      syncFromGame(payload.game, preferredNodeCode);
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
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "PATCH",
        body: JSON.stringify({
          ...gameForm,
          intro: gameForm.intro,
          promoText: gameForm.promoText || gameForm.intro,
          variables: toVariablePayload(gameForm.variables),
        }),
      });

      syncFromGame(payload.game, selectedNodeCode);
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
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "PATCH",
        body: JSON.stringify({
          startNodeCode: nodeCode,
        }),
      });

      syncFromGame(payload.game, nodeCode);
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
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "POST",
        body: JSON.stringify({
          action: "reset_blank",
        }),
      });

      syncFromGame(payload.game);
      setActiveTab("project");
      setStatus("已重置为空白项目");
    } catch (resetError) {
      setError(loadErrorMessage(resetError, "重置空白项目失败"));
    } finally {
      setSaving(false);
    }
  }

  async function exportProject() {
    setStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/export", {
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
      anchor.download = `storyplay-export-${Date.now()}.json`;
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

      const payload = await requestAdmin<AdminPayload>("/api/admin/import", {
        method: "POST",
        body: JSON.stringify({ game: nextGame }),
      });

      syncFromGame(payload.game);
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
      setActiveTab("assets");
      setStatus("宣传视频已上传，保存项目后生效");
    } catch (uploadError) {
      setError(loadErrorMessage(uploadError, "上传宣传视频失败"));
    } finally {
      setUploadingPromo(false);
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

    if (!trimmedVideoUrl) {
      setError("请先填写视频地址");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>("/api/admin/nodes", {
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
        videoUrl: defaultVideoUrl,
      });
      setActiveTab("scene");
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
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>("/api/admin/nodes", {
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

      await requestAdmin<{ game: StoryGame; node: StoryNode }>(`/api/admin/nodes/${payload.node.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...draftNode,
          title: duplicatedTitle,
          autoNextNodeCode: draftNode.nodeType === "ending" ? null : draftNode.autoNextNodeCode || null,
          endingTone: draftNode.nodeType === "ending" ? draftNode.endingTone : null,
          choices: draftNode.choices.map((choice, index) => ({
            code: choice.code.trim() || `choice_${index + 1}`,
            label: choice.label.trim(),
            hint: choice.hint.trim(),
            targetNodeCode: choice.targetNodeCode.trim(),
            conditions: toConditionPayload(toDraftConditions(choice.conditions), gameForm.variables),
            actions: toActionPayload(toDraftActions(choice.actions), gameForm.variables),
          })),
          timelineEvents: toTimelinePayload(draftNode.timelineEvents, gameForm.variables),
        }),
      });

      await loadGame(payload.node.code);
      setActiveTab("scene");
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
      const payload = await requestAdmin<AdminPayload>(`/api/admin/nodes/${selectedNode.code}`, {
        method: "DELETE",
      });

      syncFromGame(payload.game);
      setActiveTab(payload.game.nodes.length ? "flow" : "project");
      setStatus(`已删除片段：${selectedNode.title || selectedNode.code}`);
    } catch (deleteError) {
      setError(loadErrorMessage(deleteError, "删除片段失败"));
    } finally {
      setSaving(false);
    }
  }

  function openPreviewFromSelectedNode() {
    const previewNodeCode = selectedNodeCode || game.startNodeCode;
    const targetUrl = previewNodeCode
      ? `/?previewNode=${encodeURIComponent(previewNodeCode)}`
      : "/";

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  async function saveNode() {
    if (!draftNode || !selectedNodeCode) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const choicePayload = draftNode.choices.map((choice, index) => ({
        code: choice.code.trim() || `choice_${index + 1}`,
        label: choice.label.trim(),
        hint: choice.hint.trim(),
        targetNodeCode: choice.targetNodeCode.trim(),
        conditions: toConditionPayload(toDraftConditions(choice.conditions), gameForm.variables),
        actions: toActionPayload(toDraftActions(choice.actions), gameForm.variables),
      }));

      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        `/api/admin/nodes/${selectedNodeCode}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...draftNode,
            autoNextNodeCode: draftNode.nodeType === "ending" ? null : draftNode.autoNextNodeCode || null,
            endingTone: draftNode.nodeType === "ending" ? draftNode.endingTone : null,
            choices: choicePayload,
            timelineEvents: toTimelinePayload(draftNode.timelineEvents, gameForm.variables),
          }),
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

  const resourceItems = useMemo<ResourceItem[]>(() => {
    const items: ResourceItem[] = [];
    const seen = new Set<string>();

    function pushItem(item: ResourceItem | null) {
      if (!item || !item.url.trim() || seen.has(item.url)) {
        return;
      }

      seen.add(item.url);
      items.push(item);
    }

    pushItem(
      game.promoVideoUrl
        ? {
            id: "promo-video",
            label: "宣传视频",
            kind: "promo-video",
            url: game.promoVideoUrl,
          }
        : null,
    );

    pushItem(
      game.promoPosterUrl
        ? {
            id: "promo-poster",
            label: "宣传封面",
            kind: "promo-poster",
            url: game.promoPosterUrl,
          }
        : null,
    );

    for (const node of game.nodes) {
      pushItem({
        id: `node-video-${node.code}`,
        label: node.title,
        kind: "node-video",
        url: node.videoUrl,
        relatedNodeCode: node.code,
      });
    }

    return items;
  }, [game]);

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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="grid gap-5">
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
                  ? "去“搭建剧情”继续创建新片段、检查片段关系，再进入“编辑片段”和“设置出口”逐段完善。"
                  : "先保存当前项目配置，然后进入“搭建剧情”，创建首个片段并把它设为起始片段。"}
              </div>
              <button
                type="button"
                className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800"
                onClick={() => setActiveTab("flow")}
              >
                前往搭建剧情
              </button>
            </div>
          </Panel>

          <Panel
            eyebrow="Check"
            title="可玩性检查"
            description="这里只看会不会影响玩家正常游玩的关键问题。"
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
        </div>
      </div>
    );
  }

  function renderAssetsWorkspace() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="grid gap-5">
          <Panel
            eyebrow="Step 5"
            title="入口素材"
            description="集中维护作品入口页会用到的宣传视频、封面和开场说明。"
          >
            <div className="grid gap-4">
              <HelperCard title="这一页的用法">
                这一页只处理素材和发布前检查，不负责剧情跳转。剧情结构仍然在“搭建剧情”“编辑片段”“设置出口”里维护。
              </HelperCard>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="宣传视频 URL" visibility="player">
                  <input
                    className={className}
                    value={gameForm.promoVideoUrl}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoVideoUrl: event.target.value }))
                    }
                  />
                </Field>

                <Field label="宣传封面 URL" visibility="player">
                  <input
                    className={className}
                    value={gameForm.promoPosterUrl}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoPosterUrl: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <Field label="宣传文案" hint="用于序章前的宣传页简介。" visibility="player">
                <textarea
                  className={textareaClass}
                  value={gameForm.promoText}
                  onChange={(event) => setGameForm((current) => ({ ...current, promoText: event.target.value }))}
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                  {uploadingPromo ? "上传中..." : "上传宣传视频"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => void uploadPromoVideo(event)}
                  />
                </label>

                <button
                  type="button"
                  className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                  onClick={() => void saveGameSettings()}
                  disabled={saving}
                >
                    保存入口页素材
                </button>
              </div>
            </div>
          </Panel>

          <Panel
            eyebrow="Scene Video"
            title="当前片段视频"
            description="上传后会先回填到当前草稿，仍然需要保存片段。"
          >
            {draftNode ? (
              <div className="grid gap-4">
                <Field label="当前片段" visibility="logic">
                  <input className={className} value={selectedNode?.title ?? ""} readOnly />
                </Field>

                <Field label="视频地址" visibility="player">
                  <input
                    className={className}
                    value={draftNode.videoUrl}
                    onChange={(event) =>
                      setDraftNode((current) => (current ? { ...current, videoUrl: event.target.value } : current))
                    }
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30">
                    {uploadingNode ? "上传中..." : "上传片段视频"}
                    <input type="file" accept="video/*" className="hidden" onChange={(event) => void uploadNodeVideo(event)} />
                  </label>

                  <button
                    type="button"
                    className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                    onClick={() => void saveNode()}
                    disabled={saving}
                  >
                    保存当前片段
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                先创建或选择一个片段，再管理它的视频资源。
              </div>
            )}
          </Panel>
        </div>

        <Panel
          eyebrow="Library"
          title="已登记素材"
          description="用来快速确认这些地址是否已经正确挂进项目。"
        >
          {resourceItems.length ? (
            <div className="grid gap-3">
              {resourceItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-stone-900/10 bg-stone-50 p-4">
                  <div className="text-sm font-medium text-stone-900">{item.label}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {item.kind === "promo-video"
                      ? "宣传视频"
                      : item.kind === "promo-poster"
                        ? "宣传封面"
                        : `片段视频${item.relatedNodeCode ? ` · ${item.relatedNodeCode}` : ""}`}
                  </div>
                  <div className="mt-3 break-all text-xs leading-6 text-stone-700">{item.url}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
              还没有登记任何素材地址。
            </div>
          )}
        </Panel>
      </div>
    );
  }

  function renderFlowWorkspace() {
    return (
      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <div className="grid gap-5">
            <Panel
              eyebrow="Step 2"
              title={hasNodes ? "继续搭建剧情" : "先创建首个片段"}
              description="这一步先把剧情骨架搭出来。先有片段，再谈片段里的细节。"
            >
              <div className="grid gap-4">
                <HelperCard title="这一页的用法">
                  先创建片段，再用流程图检查片段之间是否连通。点任意片段后，会自动进入“编辑片段”继续补内容。
                </HelperCard>
                <div className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">创建新片段</div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="片段标题" visibility="player">
                      <input
                        className={className}
                        value={newNodeForm.title}
                        onChange={(event) =>
                          setNewNodeForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="例如 序章 / 城门夜谈 / 结局A"
                      />
                    </Field>

                    <Field label="片段编码" hint="可留空，系统会按标题自动生成。" visibility="logic">
                      <input
                        className={className}
                        value={newNodeForm.code}
                        onChange={(event) =>
                          setNewNodeForm((current) => ({ ...current, code: event.target.value }))
                        }
                        placeholder="例如 prologue_gate"
                      />
                    </Field>

                    <Field label="片段类型" visibility="logic">
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

                    <Field label="视频地址" visibility="player">
                      <input
                        className={className}
                        value={newNodeForm.videoUrl}
                        onChange={(event) =>
                          setNewNodeForm((current) => ({ ...current, videoUrl: event.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                      onClick={() => void createNode()}
                      disabled={saving}
                    >
                      {hasNodes ? "创建新片段" : "创建首个片段"}
                    </button>
                    {!game.startNodeCode && hasNodes ? (
                      <div className="rounded-full bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        你还没设置起始片段，记得回“项目配置”补上。
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              eyebrow="Segments"
              title="片段目录工作台"
              description="这里集中处理片段整理、定位问题、设置起点和进入不同编辑工作区。"
            >
              {hasNodes ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="rounded-3xl border border-stone-900/10 bg-stone-50/80 p-4">
                      <div className="text-sm font-medium text-stone-900">当前选中片段</div>
                      {currentNodeEntry ? (
                        <div className="mt-3 grid gap-3">
                          <div className="rounded-2xl border border-stone-900/10 bg-white px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                                {currentNodeEntry.isEnding ? "结局片段" : "视频片段"}
                              </span>
                              {currentNodeEntry.isStart ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                                  起始片段
                                </span>
                              ) : null}
                              {currentNodeEntry.issues.map((issue) => (
                                <span
                                  key={`${currentNodeEntry.node.code}-${issue}`}
                                  className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700"
                                >
                                  {issue}
                                </span>
                              ))}
                            </div>
                            <div className="mt-3 text-lg text-stone-950">
                              {currentNodeEntry.node.title || "未命名片段"}
                            </div>
                            <div className="mt-1 text-sm text-stone-500">
                              {currentNodeEntry.node.code}
                            </div>
                            <div className="mt-3 text-sm leading-7 text-stone-700">
                              {currentNodeEntry.node.description || "这个片段还没有填写对外展示说明。"}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800"
                              onClick={() => focusNode(currentNodeEntry.node.code, "scene")}
                            >
                              进入片段编辑
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                              onClick={() => focusNode(currentNodeEntry.node.code, "choices")}
                            >
                              编辑出口
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                              onClick={openPreviewFromSelectedNode}
                            >
                              试玩此片段
                            </button>
                            {!currentNodeEntry.isStart ? (
                              <button
                                type="button"
                                className="rounded-full border border-emerald-200 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                                onClick={() => void setStartNode(currentNodeEntry.node.code)}
                                disabled={saving}
                              >
                                设为起始片段
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-stone-900/12 px-4 py-6 text-sm leading-7 text-stone-500">
                          先从左侧或结构图里选中一个片段，这里才会出现对应的管理动作。
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                      <div className="text-sm font-medium text-stone-900">问题片段速览</div>
                      <div className="mt-3 grid gap-2">
                        {issueNodeEntries.length ? (
                          issueNodeEntries.slice(0, 6).map((entry) => (
                            <button
                              key={entry.node.code}
                              type="button"
                              className="rounded-2xl border border-stone-900/10 bg-stone-50 px-3 py-3 text-left transition hover:border-stone-900/30"
                              onClick={() => focusNode(entry.node.code, "scene")}
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
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-stone-900/12 px-3 py-5 text-sm leading-7 text-stone-500">
                            当前没有问题片段，结构质量还不错。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                  先创建首个片段，片段目录工作台才会出现。
                </div>
              )}
            </Panel>

            <Panel
              eyebrow="Structure"
              title="剧情结构图"
              description="这里用来检查片段之间的连接关系，不是逐字段编辑区。"
            >
              {hasNodes ? (
                <BranchGraph
                  game={game}
                  selectedNodeCode={selectedNodeCode}
                  onSelectNode={handleSelectNode}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                  还没有任何片段。先在上方创建首个片段，结构图才会出现。
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5">
            <Panel
              eyebrow="Overview"
              title="剧情概况"
              description="快速确认当前项目已经搭到哪一步。"
            >
              <div className="grid gap-3 text-sm text-stone-700">
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  起始片段：{game.startNodeCode ? getNodeDisplayName(game, game.startNodeCode) : "尚未设置"}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  当前选中：{selectedNode ? `${selectedNode.title} / ${selectedNode.code}` : "尚未选中"}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  片段总数：{publishSummary.totalNodes}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  结尾出口：{publishSummary.totalChoices}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  缺出口片段：{publishSummary.noLinkNodes}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  无效目标：{publishSummary.unreachableChoices}
                </div>
              </div>
            </Panel>

            <Panel
              eyebrow="Next"
              title="搭完后做什么"
              description="当片段数量开始增多，就按这个顺序往下走。"
            >
              <div className="grid gap-3 text-sm leading-7 text-stone-700">
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  1. 选中一个片段，进入“编辑片段”补标题、正文、视频和时间线。
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  2. 去“设置出口”决定这一段播完后玩家能去哪里。
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  3. 最后到“素材与发布”统一检查视频地址和结构风险。
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  function renderSceneWorkspace() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="grid gap-5">
          <Panel
            eyebrow="Step 3"
            title={selectedNode ? `编辑片段：${selectedNode.title}` : "编辑片段"}
            description="这里管理单个片段的基础信息、视频、自动跳转和结局属性。"
          >
            {draftNode ? (
              <div className="grid gap-4">
                <div className="rounded-3xl border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.92))] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">
                          {draftNode.nodeType === "ending" ? "结局片段" : "视频片段"}
                        </span>
                        {sceneDirty ? (
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
                        onClick={() => setActiveTab("choices")}
                      >
                        去设置出口
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                        onClick={() => setActiveTab("flow")}
                      >
                        返回结构图
                      </button>
                    </div>
                  </div>
                </div>

                <HelperCard title="这一页编辑什么">
                  这里处理单个片段本身的内容，包括标题、描述、视频、自动跳转和时间线互动。片段结尾有哪些出口，不在这里改，在“设置出口”里改。
                </HelperCard>
                <div className="rounded-3xl border border-stone-900/10 bg-stone-50/70 p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">基础信息</div>
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
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">剧情文案</div>
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

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">播放与跳转</div>
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
            eyebrow="Selected"
            title="当前片段摘要"
            description="这里显示当前选中片段的关键信息。"
          >
            {selectedNode ? (
              <div className="grid gap-3 text-sm text-stone-700">
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  编码：{selectedNode.code}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  类型：{nodeTypeLabel[selectedNode.nodeType]}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  结尾选项：{selectedNode.choices?.length ?? 0}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  时间线事件：{selectedNode.timelineEvents?.length ?? 0}
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                  自动跳转：
                  {selectedNode.autoNextNodeCode
                    ? ` ${getNodeDisplayName(game, selectedNode.autoNextNodeCode)}`
                    : " 无"}
                </div>
              </div>
            ) : (
              <div className="text-sm text-stone-600">尚未选择片段</div>
            )}
          </Panel>

          <Panel
            eyebrow="Jump"
            title="快速切换片段"
            description="项目变大后，从这里直接切换到其他片段会更快。"
          >
            <div className="grid gap-3">
              {game.nodes.map((node) => (
                <button
                  key={node.code}
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    node.code === selectedNodeCode
                      ? "border-stone-950 bg-stone-950 text-white"
                      : "border-stone-900/10 bg-stone-50 text-stone-800 hover:border-stone-900/30"
                  }`}
                  onClick={() => handleSelectNode(node.code)}
                >
                  <div className="font-medium">{node.title}</div>
                  <div className="mt-1 text-xs opacity-70">{node.code}</div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderChoicesWorkspace() {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="grid gap-5">
          <Panel
            eyebrow="Step 4"
            title={selectedNode ? `设置出口：${selectedNode.title}` : "设置出口"}
            description="这里配置片段结尾的分支选项，并给每个选项附加条件和动作。"
          >
            {draftNode ? (
              <div className="grid gap-4">
                <div className="rounded-3xl border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.92))] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-stone-950 px-3 py-1 text-xs text-white">片段出口</span>
                        {sceneDirty ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                            有未保存修改
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                            已同步
                          </span>
                        )}
                        {draftNode.choices.length === 0 && !draftNode.autoNextNodeCode && draftNode.nodeType !== "ending" ? (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">当前片段缺出口</span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-lg text-stone-950">{draftNode.title || "未命名片段"}</div>
                      <div className="mt-1 text-sm text-stone-600">
                        当前已有 {draftNode.choices.length} 个结尾出口
                        {draftNode.autoNextNodeCode ? ` · 自动跳转到 ${draftNode.autoNextNodeCode}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                        onClick={() => void saveNode()}
                        disabled={saving}
                      >
                        {saving ? "保存中..." : "保存出口"}
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
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                        onClick={() => setActiveTab("scene")}
                      >
                        返回编辑片段
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                        onClick={() => setActiveTab("flow")}
                      >
                        查看结构图
                      </button>
                    </div>
                  </div>
                </div>

                <HelperCard title="这里和时间线选项的区别">
                  这里配置的是片段结尾出口，也就是这一段播放结束后玩家能去哪里。视频中途弹出的选项，应该去“编辑片段”里的时间线事件配置。
                </HelperCard>
                {draftNode.choices.length ? (
                  draftNode.choices.map((choice, index) => (
                    <div
                      key={`${choice.code}-${index}`}
                      className="rounded-3xl border border-stone-900/10 bg-stone-50 p-4"
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
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                    当前片段还没有结尾选项。
                  </div>
                )}

                <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                  <div className="mb-4 text-sm font-medium text-stone-900">新增出口</div>
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

                    <Field label="目标片段" visibility="logic">
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

                  <div className="mt-4">
                    <button
                      type="button"
                      className="rounded-full border border-stone-900/10 px-4 py-2 text-sm text-stone-800 transition hover:border-stone-900/30"
                      onClick={() =>
                        setDraftNode((current) => {
                          if (!current) {
                            return current;
                          }

                          const label = newChoiceForm.label.trim();
                          const targetNodeCode = newChoiceForm.targetNodeCode.trim();

                          if (!label || !targetNodeCode) {
                            setError("新增选项至少需要文案和目标片段");
                            return current;
                          }

                          setError(null);

                          return {
                            ...current,
                            choices: [
                              ...current.choices,
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
                        })
                      }
                    >
                      加入当前片段
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                    onClick={() => void saveNode()}
                    disabled={saving}
                  >
                    保存选项配置
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-8 text-sm leading-7 text-stone-600">
                先创建或选择一个片段，再编辑它的分支出口。
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel
            eyebrow="Summary"
            title="出口摘要"
            description="这里汇总当前片段出口设计的复杂度和风险。"
          >
            <div className="grid gap-3 text-sm text-stone-700">
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                结尾出口：{draftNode?.choices.length ?? 0}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                条件总数：
                {draftNode?.choices.reduce((count, choice) => count + choice.conditions.length, 0) ?? 0}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3">
                动作总数：
                {draftNode?.choices.reduce((count, choice) => count + choice.actions.length, 0) ?? 0}
              </div>
              <div className="rounded-2xl border border-stone-900/10 bg-stone-50 px-4 py-3 leading-7">
                最常用的仍然是：选项文案 + 目标片段。条件和动作属于进阶规则，没有需要时可以先不填。
              </div>
            </div>
          </Panel>

          <Panel
            eyebrow="Refresh"
            title="同步数据"
            description="如果你怀疑界面状态与数据库不同步，可以手动刷新。"
          >
            <button
              type="button"
              className="rounded-full border border-stone-900/10 px-4 py-3 text-sm text-stone-800 transition hover:border-stone-900/30 disabled:opacity-50"
              onClick={() => void loadGame(selectedNodeCode)}
              disabled={loading}
            >
              {loading ? "刷新中..." : "重新加载项目"}
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  function renderActiveWorkspace() {
    if (activeTab === "project") {
      return renderProjectWorkspace();
    }

    if (activeTab === "assets") {
      return renderAssetsWorkspace();
    }

    if (activeTab === "flow") {
      return renderFlowWorkspace();
    }

    if (activeTab === "scene") {
      return renderSceneWorkspace();
    }

    return renderChoicesWorkspace();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.08),_transparent_26%),linear-gradient(180deg,_#f7f3ee_0%,_#f3efe8_100%)] text-stone-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <div className="flex h-full flex-col gap-4 rounded-[2rem] border border-stone-900/10 bg-white/72 p-4 shadow-[0_24px_80px_rgba(52,38,25,0.08)] backdrop-blur-xl">
              <div className="rounded-[1.75rem] border border-stone-900/10 bg-[linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,255,255,0.92))] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.38em] text-stone-500">Storyplay Studio</div>
                <div className="mt-3 text-xl text-stone-950">{game.title || "未命名互动影游项目"}</div>
                <p className="mt-2 text-sm leading-7 text-stone-700">
                  {game.tagline || "先完成项目配置，再开始搭建剧情与片段内容。"}
                </p>
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

              <div className="min-h-0 flex-1 rounded-[1.5rem] border border-stone-900/10 bg-white/88 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-stone-500">片段导航</div>
                    <div className="mt-1 text-sm text-stone-900">{publishSummary.totalNodes} 个片段</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-stone-900/10 px-3 py-1.5 text-xs text-stone-700 transition hover:border-stone-900/30"
                    onClick={() => setActiveTab("flow")}
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

                <div className="mt-3 max-h-[42vh] overflow-y-auto pr-1">
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
                            {group.entries.map(({ node, isStart, isEnding, issues, issueCount }) => {
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
                                      {node.code}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {isStart ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${isSelected ? "bg-emerald-300/15 text-emerald-100" : "bg-emerald-100 text-emerald-700"}`}>
                                          起始
                                        </span>
                                      ) : null}
                                      {issueCount > 0
                                        ? issues.map((issue) => (
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
                                      onClick={() => focusNode(node.code, "scene")}
                                    >
                                      编辑
                                    </button>
                                    <button
                                      type="button"
                                      className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                                        isSelected
                                          ? "border border-white/12 bg-white/6 text-white/85 hover:bg-white/10"
                                          : "border border-stone-900/10 bg-white text-stone-700 hover:border-stone-900/30"
                                      }`}
                                      onClick={() => focusNode(node.code, "choices")}
                                    >
                                      出口
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
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_360px]">
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
                      当前聚焦片段：<span className="font-medium text-stone-950">{selectedNode.title}</span>
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
