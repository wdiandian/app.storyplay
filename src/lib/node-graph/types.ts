import type {
  ConditionRule,
  EndingTone,
  TimelineEvent,
  VariableAction,
  VariableDefinition,
} from "@/lib/story-engine";

export type GraphNodeType =
  | "start"
  | "scene"
  | "choice"
  | "option"
  | "condition"
  | "set_variable"
  | "record"
  | "ending"
  | "asset"
  | "timeline";

export type GraphPortDirection = "input" | "output";

export type GraphPortKind =
  | "flow"
  | "choice"
  | "condition"
  | "record"
  | "asset"
  | "timeline";

export type GraphEdgeType =
  | "flow"
  | "choice"
  | "condition_true"
  | "condition_false"
  | "unlock_record"
  | "use_asset"
  | "timeline_event";

export type GraphPosition = {
  x: number;
  y: number;
};

export type GraphSize = {
  width: number;
  height: number;
};

export type GraphViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type GraphPort = {
  id: string;
  nodeId: string;
  key: string;
  direction: GraphPortDirection;
  kind: GraphPortKind;
  label: string;
  accepts?: GraphPortKind[];
  multiple?: boolean;
  required?: boolean;
};

export type StartNodeData = {
  title: string;
  intro?: string;
};

export type SceneNodeData = {
  sceneCode: string;
  title: string;
  description?: string;
  transcript?: string;
  videoUrl?: string;
  memory?: MemoryConfig;
};

export type ChoiceNodeData = {
  title?: string;
  prompt?: string;
  pausePlayback?: boolean;
  displayMode?: "overlay" | "bottom_sheet" | "full_screen";
};

export type OptionNodeData = {
  code: string;
  label: string;
  hint?: string;
};

export type ConditionNodeData = {
  conditions: ConditionRule[];
  matchMode: "all" | "any";
};

export type SetVariableNodeData = {
  actions: VariableAction[];
};

export type RecordNodeData = {
  recordType: "memory" | "clue" | "echo";
  title: string;
  body: string;
  lockedLabel?: string;
  visibleWhenLocked?: boolean;
};

export type EndingNodeData = {
  code: string;
  title: string;
  description?: string;
  transcript?: string;
  videoUrl?: string;
  endingTone: EndingTone;
};

export type AssetNodeData = {
  assetType: "video" | "image" | "audio" | "subtitle";
  url: string;
  filename?: string;
  durationMs?: number;
};

export type TimelineNodeData = {
  atMs: number;
  eventType: "text" | "overlay" | "pause" | "choice" | "unlock_record" | "jump" | "actions";
  text?: string;
  pausePlayback?: boolean;
  sourceEvent?: TimelineEvent;
};

export type GraphNodeData =
  | StartNodeData
  | SceneNodeData
  | ChoiceNodeData
  | OptionNodeData
  | ConditionNodeData
  | SetVariableNodeData
  | RecordNodeData
  | EndingNodeData
  | AssetNodeData
  | TimelineNodeData;

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  title: string;
  position: GraphPosition;
  size?: GraphSize;
  ports: GraphPort[];
  data: GraphNodeData;
};

export type GraphEdge = {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  type: GraphEdgeType;
  label?: string;
  conditions?: ConditionRule[];
  actions?: VariableAction[];
};

export type MemoryConfig = {
  title?: string;
  summary?: string;
  visibleInMemory?: boolean;
  lockedLabel?: string;
};

export type GraphMeta = {
  gameId: string;
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  listedOnHome: boolean;
  sortOrder: number;
  promoVideoUrl: string;
  promoPosterUrl: string;
  promoText: string;
};

export type GraphDocument = {
  id: string;
  projectSlug: string;
  title: string;
  version: number;
  viewport?: GraphViewport;
  meta: GraphMeta;
  nodes: GraphNode[];
  edges: GraphEdge[];
  variables: VariableDefinition[];
  createdAt: string;
  updatedAt: string;
};

export type GraphValidationIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  edgeId?: string;
  portId?: string;
};
