import type { GraphNodeType, GraphPosition } from "@/lib/node-graph";

export type Selection =
  | { type: "graph" }
  | { type: "node"; nodeId: string }
  | { type: "edge"; edgeId: string };

export type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
};

export type ConnectionDraft = {
  nodeId: string;
  portId: string;
  cursor?: GraphPosition;
};

export type PaletteItem = {
  type: GraphNodeType;
  title: string;
  description: string;
};
