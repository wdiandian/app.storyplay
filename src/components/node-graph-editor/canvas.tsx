import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import { nodeTypeName } from "@/components/node-graph-editor/config";
import { edgeStroke, nodePaletteClass } from "@/components/node-graph-editor/geometry";
import type { Selection } from "@/components/node-graph-editor/types";
import type { GraphDocument, GraphEdge, GraphNode, GraphPort, GraphPosition } from "@/lib/node-graph";

type FlowNodeData = Record<string, unknown> & {
  graphNode: GraphNode;
  issueCount: number;
};

type StoryFlowNode = Node<FlowNodeData, "storyNode">;
type StoryFlowEdge = Edge<Record<string, unknown>, "smoothstep">;

type NodeGraphCanvasProps = {
  graph: GraphDocument;
  nodesById: Map<string, GraphNode>;
  selection: Selection;
  issueCountByNode: Map<string, number>;
  onMoveNode: (nodeId: string, position: GraphPosition) => void;
  onConnectPorts: (fromNode: GraphNode, fromPort: GraphPort, toNode: GraphNode, toPort: GraphPort) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectGraph: () => void;
  onViewportChange: (viewport: Viewport) => void;
};

function portTop(index: number) {
  return 74 + index * 28;
}

function StoryNode({ data, selected }: NodeProps<StoryFlowNode>) {
  const node = data.graphNode;
  const inputPorts = node.ports.filter((port) => port.direction === "input");
  const outputPorts = node.ports.filter((port) => port.direction === "output");
  const issueCount = data.issueCount;

  return (
    <div
      className={`relative min-h-36 w-64 rounded-lg border p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] ${nodePaletteClass(node.type)} ${selected ? "ring-2 ring-amber-200" : ""}`}
    >
      {inputPorts.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border !border-current !bg-current"
          style={{ top: portTop(index), left: -7 }}
        />
      ))}
      {outputPorts.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border !border-current !bg-current"
          style={{ top: portTop(index), right: -7 }}
        />
      ))}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-60">{nodeTypeName[node.type]}</div>
          <div className="mt-1 line-clamp-2 text-base font-semibold">{node.title}</div>
        </div>
        {issueCount ? <span className="shrink-0 rounded-md bg-rose-300/20 px-2 py-1 text-xs">{issueCount}</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          {inputPorts.map((port) => (
            <div key={port.id} className="relative flex items-center gap-2 rounded-md bg-black/15 px-2 py-1 text-left text-xs">
              <span className="h-2.5 w-2.5 rounded-full border border-current bg-current" />
              <span className="truncate">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-1">
          {outputPorts.map((port) => (
            <div key={port.id} className="relative flex items-center justify-end gap-2 rounded-md bg-black/15 px-2 py-1 text-right text-xs">
              <span className="truncate">{port.label}</span>
              <span className="h-2.5 w-2.5 rounded-full border border-current bg-current" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  storyNode: StoryNode,
};

function edgeLabel(edge: GraphEdge) {
  return edge.label?.trim() || undefined;
}

function toFlowEdge(edge: GraphEdge, selected: boolean): StoryFlowEdge {
  return {
    id: edge.id,
    type: "smoothstep",
    source: edge.fromNodeId,
    sourceHandle: edge.fromPortId,
    target: edge.toNodeId,
    targetHandle: edge.toPortId,
    label: edgeLabel(edge),
    selected,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeStroke(edge.type),
    },
    style: {
      stroke: edgeStroke(edge.type),
      strokeWidth: selected ? 3 : 2,
    },
    animated: edge.type === "choice" || edge.type === "unlock_record",
    data: { graphEdge: edge },
  };
}

export function NodeGraphCanvas({
  graph,
  nodesById,
  selection,
  issueCountByNode,
  onMoveNode,
  onConnectPorts,
  onSelectNode,
  onSelectEdge,
  onSelectGraph,
  onViewportChange,
}: NodeGraphCanvasProps) {
  const flowNodes = useMemo<StoryFlowNode[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "storyNode",
        position: node.position,
        selected: selection.type === "node" && selection.nodeId === node.id,
        data: {
          graphNode: node,
          issueCount: issueCountByNode.get(node.id) ?? 0,
        },
      })),
    [graph.nodes, issueCountByNode, selection],
  );

  const flowEdges = useMemo<StoryFlowEdge[]>(
    () => graph.edges.map((edge) => toFlowEdge(edge, selection.type === "edge" && selection.edgeId === edge.id)),
    [graph.edges, selection],
  );

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.sourceHandle || !connection.target || !connection.targetHandle) {
      return;
    }

    const fromNode = nodesById.get(connection.source);
    const toNode = nodesById.get(connection.target);
    const fromPort = fromNode?.ports.find((port) => port.id === connection.sourceHandle);
    const toPort = toNode?.ports.find((port) => port.id === connection.targetHandle);

    if (fromNode && toNode && fromPort && toPort) {
      onConnectPorts(fromNode, fromPort, toNode, toPort);
    }
  }

  return (
    <section className="relative h-full min-h-0 bg-[#11100d]">
      <ReactFlow<StoryFlowNode, StoryFlowEdge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        minZoom={0.3}
        maxZoom={1.8}
        defaultViewport={graph.viewport ?? { x: 24, y: 24, zoom: 0.9 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView={!graph.viewport}
        fitViewOptions={{ padding: 0.24 }}
        panOnDrag
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        selectNodesOnDrag={false}
        snapToGrid
        snapGrid={[20, 20]}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onConnect={handleConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onPaneClick={onSelectGraph}
        onNodeDragStop={(_, node) => onMoveNode(node.id, node.position)}
        onMoveEnd={(_, viewport) => onViewportChange(viewport)}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="rgba(255,255,255,0.18)" />
        <Controls position="top-left" showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          position="bottom-left"
          nodeStrokeWidth={2}
          nodeColor={(node) => {
            const graphNode = node.data.graphNode as GraphNode;
            if (graphNode.type === "scene") return "#1c1917";
            if (graphNode.type === "choice" || graphNode.type === "option") return "#92400e";
            if (graphNode.type === "record") return "#075985";
            if (graphNode.type === "ending") return "#881337";
            if (graphNode.type === "asset") return "#065f46";
            return "#27272a";
          }}
          maskColor="rgba(17,16,13,0.68)"
          style={{ background: "#1c1917", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
        />
      </ReactFlow>
    </section>
  );
}
