export type NodeType = "video" | "ending";
export type EndingTone = "truth" | "survival" | "tragedy";

export type VariableValueType = "number" | "boolean" | "string" | "enum";
export type VariableRuntimeValue = string | number | boolean;

export type VariableDefinition = {
  key: string;
  label: string;
  type: VariableValueType;
  initialValue: VariableRuntimeValue;
  options?: string[];
};

export type VariableState = Record<string, VariableRuntimeValue>;

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "includes"
  | "not_includes";

export type ConditionRule = {
  id: string;
  variableKey: string;
  operator: ConditionOperator;
  value: VariableRuntimeValue;
};

export type VariableActionType = "set" | "increment" | "toggle" | "append_tag";

export type VariableAction = {
  id: string;
  variableKey: string;
  type: VariableActionType;
  value?: VariableRuntimeValue;
};

export type TimelineEventType =
  | "show_text"
  | "show_choice"
  | "pause"
  | "play_audio"
  | "jump"
  | "run_actions"
  | "show_overlay";

export type TimelineEvent = {
  id: string;
  atMs: number;
  type: TimelineEventType;
  payload: Record<string, unknown>;
  conditions?: ConditionRule[];
  actions?: VariableAction[];
};

export type StoryChoice = {
  code: string;
  label: string;
  targetNodeCode: string;
  hint: string;
  conditions?: ConditionRule[];
  actions?: VariableAction[];
};

export type StoryNode = {
  code: string;
  title: string;
  description: string;
  transcript: string;
  videoUrl: string;
  nodeType: NodeType;
  autoNextNodeCode?: string;
  isEnding?: boolean;
  endingTone?: EndingTone;
  choices?: StoryChoice[];
  timelineEvents?: TimelineEvent[];
};

export type StoryGame = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  promoVideoUrl: string;
  promoPosterUrl: string;
  promoText: string;
  startNodeCode: string;
  variables?: VariableDefinition[];
  nodes: StoryNode[];
};

export type ChoiceLog = {
  nodeCode: string;
  choiceCode: string;
  choiceLabel: string;
  targetNodeCode: string;
  chosenAt: string;
};

export type PlaythroughStatus = "in_progress" | "completed";

export type PlaythroughState = {
  id: string;
  gameSlug: string;
  currentNodeCode: string;
  status: PlaythroughStatus;
  history: ChoiceLog[];
  startedAt: string;
  finishedAt?: string;
  variables: VariableState;
  triggeredEventIds: string[];
};

export function indexNodes(game: StoryGame) {
  return new Map(game.nodes.map((node) => [node.code, node]));
}

export function getNodeByCode(game: StoryGame, nodeCode: string) {
  const node = game.nodes.find((entry) => entry.code === nodeCode);

  if (!node) {
    throw new Error(`Unknown node code: ${nodeCode}`);
  }

  return node;
}
