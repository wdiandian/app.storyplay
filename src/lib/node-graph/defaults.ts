import type {
  GraphNode,
  GraphNodeData,
  GraphNodeType,
  GraphPort,
  GraphPortKind,
  GraphPosition,
} from "@/lib/node-graph/types";

export const GRAPH_DOCUMENT_VERSION = 1;

export function graphNodeId(type: GraphNodeType, key: string) {
  return `${type}:${key}`;
}

export function graphPortId(nodeId: string, key: string) {
  return `${nodeId}:${key}`;
}

function port(
  nodeId: string,
  key: string,
  direction: GraphPort["direction"],
  kind: GraphPortKind,
  label: string,
  options: Pick<GraphPort, "accepts" | "multiple" | "required"> = {},
): GraphPort {
  return {
    id: graphPortId(nodeId, key),
    nodeId,
    key,
    direction,
    kind,
    label,
    ...options,
  };
}

export function defaultPortsForNode(type: GraphNodeType, nodeId: string): GraphPort[] {
  if (type === "start") {
    return [port(nodeId, "out", "output", "flow", "进入", { required: true })];
  }

  if (type === "scene") {
    return [
      port(nodeId, "in", "input", "flow", "进入", { multiple: true }),
      port(nodeId, "asset", "input", "asset", "素材"),
      port(nodeId, "finished", "output", "flow", "播放后"),
      port(nodeId, "choice", "output", "choice", "选择", { multiple: true }),
      port(nodeId, "unlock", "output", "record", "解锁", { multiple: true }),
      port(nodeId, "timeline", "output", "timeline", "时间点", { multiple: true }),
    ];
  }

  if (type === "choice") {
    return [
      port(nodeId, "in", "input", "choice", "触发"),
      port(nodeId, "option", "output", "choice", "选项", { multiple: true }),
    ];
  }

  if (type === "option") {
    return [
      port(nodeId, "in", "input", "choice", "选择"),
      port(nodeId, "out", "output", "flow", "进入", { required: true }),
      port(nodeId, "echo", "output", "record", "回响"),
    ];
  }

  if (type === "condition") {
    return [
      port(nodeId, "in", "input", "flow", "判断"),
      port(nodeId, "true", "output", "flow", "成立"),
      port(nodeId, "false", "output", "flow", "不成立"),
    ];
  }

  if (type === "set_variable") {
    return [
      port(nodeId, "in", "input", "flow", "进入"),
      port(nodeId, "out", "output", "flow", "继续"),
    ];
  }

  if (type === "record") {
    return [
      port(nodeId, "unlock", "input", "record", "解锁", { multiple: true }),
      port(nodeId, "out", "output", "flow", "继续"),
    ];
  }

  if (type === "ending") {
    return [
      port(nodeId, "in", "input", "flow", "进入", { multiple: true }),
      port(nodeId, "unlock", "output", "record", "解锁", { multiple: true }),
    ];
  }

  if (type === "asset") {
    return [port(nodeId, "asset", "output", "asset", "素材", { multiple: true })];
  }

  return [
    port(nodeId, "in", "input", "timeline", "触发"),
    port(nodeId, "choice", "output", "choice", "选择"),
    port(nodeId, "unlock", "output", "record", "解锁"),
    port(nodeId, "jump", "output", "flow", "跳转"),
  ];
}

export function createGraphNode(
  type: GraphNodeType,
  id: string,
  title: string,
  position: GraphPosition,
  data: GraphNodeData,
): GraphNode {
  return {
    id,
    type,
    title,
    position,
    ports: defaultPortsForNode(type, id),
    data,
  };
}

export function getPort(node: GraphNode, key: string) {
  const port = node.ports.find((entry) => entry.key === key);

  if (!port) {
    throw new Error(`Missing port ${node.id}.${key}`);
  }

  return port;
}
