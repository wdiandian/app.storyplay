import type {
  GraphDocument,
  GraphEdgeType,
  GraphNode,
  GraphPort,
  GraphPosition,
} from "@/lib/node-graph";

const NODE_WIDTH = 260;
const HEADER_HEIGHT = 56;
const PORT_ROW_HEIGHT = 28;

export function nodeSize(node: GraphNode) {
  const inputCount = node.ports.filter((port) => port.direction === "input").length;
  const outputCount = node.ports.filter((port) => port.direction === "output").length;
  const portRows = Math.max(inputCount, outputCount, 2);

  return {
    width: node.size?.width ?? NODE_WIDTH,
    height: node.size?.height ?? HEADER_HEIGHT + 34 + portRows * PORT_ROW_HEIGHT,
  };
}

export function canvasSize(graph: GraphDocument) {
  const maxX = Math.max(1200, ...graph.nodes.map((node) => node.position.x + nodeSize(node).width + 360));
  const maxY = Math.max(720, ...graph.nodes.map((node) => node.position.y + nodeSize(node).height + 220));
  return { width: maxX, height: maxY };
}

export function portPoint(node: GraphNode, port: GraphPort): GraphPosition {
  const sameDirectionPorts = node.ports.filter((entry) => entry.direction === port.direction);
  const index = sameDirectionPorts.findIndex((entry) => entry.id === port.id);
  const size = nodeSize(node);

  return {
    x: node.position.x + (port.direction === "output" ? size.width : 0),
    y: node.position.y + HEADER_HEIGHT + 30 + Math.max(0, index) * PORT_ROW_HEIGHT,
  };
}

export function edgePath(from: GraphPosition, to: GraphPosition) {
  const distance = Math.max(72, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${to.x - distance} ${to.y}, ${to.x} ${to.y}`;
}

export function edgeTypeFromPorts(fromPort: GraphPort): GraphEdgeType {
  if (fromPort.kind === "choice") {
    return "choice";
  }

  if (fromPort.kind === "record") {
    return "unlock_record";
  }

  if (fromPort.kind === "asset") {
    return "use_asset";
  }

  if (fromPort.kind === "timeline") {
    return "timeline_event";
  }

  return "flow";
}

export function isKindCompatible(fromPort: GraphPort, toPort: GraphPort) {
  if (fromPort.direction !== "output" || toPort.direction !== "input") {
    return false;
  }

  if (toPort.accepts?.length) {
    return toPort.accepts.includes(fromPort.kind);
  }

  return fromPort.kind === toPort.kind || (fromPort.kind === "choice" && toPort.kind === "flow");
}

export function nodePaletteClass(type: GraphNode["type"]) {
  if (type === "start") return "border-amber-300 bg-amber-100 text-amber-950";
  if (type === "scene") return "border-stone-700 bg-stone-950 text-white";
  if (type === "choice" || type === "option") return "border-amber-400 bg-amber-950 text-amber-50";
  if (type === "record") return "border-sky-300 bg-sky-950 text-sky-50";
  if (type === "ending") return "border-rose-300 bg-rose-950 text-rose-50";
  if (type === "asset") return "border-emerald-300 bg-emerald-950 text-emerald-50";
  if (type === "timeline") return "border-indigo-300 bg-indigo-950 text-indigo-50";
  return "border-white/20 bg-zinc-900 text-zinc-100";
}

export function edgeStroke(type: GraphEdgeType) {
  if (type === "choice") return "#f59e0b";
  if (type === "unlock_record") return "#38bdf8";
  if (type === "use_asset") return "#10b981";
  if (type === "timeline_event") return "#818cf8";
  if (type === "condition_true" || type === "condition_false") return "#a3e635";
  return "#e7e5e4";
}
