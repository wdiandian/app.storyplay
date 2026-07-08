import type {
  ConditionNodeData,
  EndingNodeData,
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphPort,
  GraphValidationIssue,
  OptionNodeData,
  RecordNodeData,
  SceneNodeData,
  SetVariableNodeData,
} from "@/lib/node-graph/types";

function issue(input: Omit<GraphValidationIssue, "id">): GraphValidationIssue {
  return {
    id: `issue:${input.nodeId ?? input.edgeId ?? input.portId ?? "graph"}:${input.message}`,
    ...input,
  };
}

function isKindCompatible(from: GraphPort, to: GraphPort) {
  if (to.accepts?.length) {
    return to.accepts.includes(from.kind);
  }

  return from.kind === to.kind || (from.kind === "choice" && to.kind === "flow");
}

function validateEdge(edge: GraphEdge, nodesById: Map<string, GraphNode>) {
  const issues: GraphValidationIssue[] = [];
  const fromNode = nodesById.get(edge.fromNodeId);
  const toNode = nodesById.get(edge.toNodeId);

  if (!fromNode) {
    issues.push(issue({ severity: "error", edgeId: edge.id, message: "连线缺少起点节点" }));
    return issues;
  }

  if (!toNode) {
    issues.push(issue({ severity: "error", edgeId: edge.id, message: "连线缺少目标节点" }));
    return issues;
  }

  const fromPort = fromNode.ports.find((port) => port.id === edge.fromPortId);
  const toPort = toNode.ports.find((port) => port.id === edge.toPortId);

  if (!fromPort) {
    issues.push(issue({ severity: "error", edgeId: edge.id, message: "连线缺少起点端口" }));
    return issues;
  }

  if (!toPort) {
    issues.push(issue({ severity: "error", edgeId: edge.id, message: "连线缺少目标端口" }));
    return issues;
  }

  if (fromPort.direction !== "output") {
    issues.push(issue({ severity: "error", edgeId: edge.id, portId: fromPort.id, message: "连线起点必须是输出端口" }));
  }

  if (toPort.direction !== "input") {
    issues.push(issue({ severity: "error", edgeId: edge.id, portId: toPort.id, message: "连线目标必须是输入端口" }));
  }

  if (!isKindCompatible(fromPort, toPort)) {
    issues.push(issue({ severity: "error", edgeId: edge.id, message: `端口类型不兼容：${fromPort.kind} -> ${toPort.kind}` }));
  }

  return issues;
}

function nodeData<T>(node: GraphNode) {
  return node.data as T;
}

function outgoingEdges(graph: GraphDocument, nodeId: string, portKey?: string) {
  return graph.edges.filter((edge) => {
    if (edge.fromNodeId !== nodeId) {
      return false;
    }

    if (!portKey) {
      return true;
    }

    return edge.fromPortId.endsWith(`:${portKey}`);
  });
}

function incomingEdges(graph: GraphDocument, nodeId: string) {
  return graph.edges.filter((edge) => edge.toNodeId === nodeId);
}

function targetStoryCode(node: GraphNode) {
  if (node.type === "scene") {
    return nodeData<SceneNodeData>(node).sceneCode.trim();
  }

  if (node.type === "ending") {
    return nodeData<EndingNodeData>(node).code.trim();
  }

  return "";
}

function resolveFlowTarget(graph: GraphDocument, edge: GraphEdge, visitedNodeIds = new Set<string>()): string {
  const targetNode = graph.nodes.find((node) => node.id === edge.toNodeId);

  if (!targetNode || visitedNodeIds.has(targetNode.id)) {
    return "";
  }

  const code = targetStoryCode(targetNode);

  if (code) {
    return code;
  }

  visitedNodeIds.add(targetNode.id);

  if (targetNode.type === "set_variable") {
    const nextEdge = outgoingEdges(graph, targetNode.id, "out")[0];
    return nextEdge ? resolveFlowTarget(graph, nextEdge, visitedNodeIds) : "";
  }

  if (targetNode.type === "condition") {
    const nextEdge = outgoingEdges(graph, targetNode.id, "true")[0];
    return nextEdge ? resolveFlowTarget(graph, nextEdge, visitedNodeIds) : "";
  }

  return "";
}

function pushDuplicateCodeIssues(
  issues: GraphValidationIssue[],
  nodes: GraphNode[],
) {
  const nodeByCode = new Map<string, GraphNode>();

  for (const node of nodes) {
    const code = targetStoryCode(node);

    if (!code) {
      continue;
    }

    const existing = nodeByCode.get(code);
    if (existing) {
      issues.push(issue({ severity: "error", nodeId: node.id, message: `运行节点编号重复：${code}` }));
      issues.push(issue({ severity: "error", nodeId: existing.id, message: `运行节点编号重复：${code}` }));
      continue;
    }

    nodeByCode.set(code, node);
  }
}

function validateCompileSurface(graph: GraphDocument) {
  const issues: GraphValidationIssue[] = [];
  const runtimeNodes = graph.nodes.filter((node) => node.type === "scene" || node.type === "ending");
  const storyCodes = new Set(runtimeNodes.map(targetStoryCode).filter(Boolean));

  if (!runtimeNodes.length) {
    issues.push(issue({ severity: "error", message: "至少需要一个场景或结局节点，播放器才有可运行内容" }));
  }

  pushDuplicateCodeIssues(issues, runtimeNodes);

  for (const node of graph.nodes) {
    if (node.type === "scene") {
      const data = nodeData<SceneNodeData>(node);

      if (!data.sceneCode.trim()) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "场景缺少编号" }));
      }

      if (!data.title.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "场景缺少标题" }));
      }

      if (!data.videoUrl?.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "场景还没有视频素材" }));
      }

      const autoEdge = outgoingEdges(graph, node.id, "finished")[0];
      if (autoEdge && !resolveFlowTarget(graph, autoEdge)) {
        issues.push(issue({ severity: "error", nodeId: node.id, edgeId: autoEdge.id, message: "场景播放后的流向无法编译到场景或结局" }));
      }

      const choiceEdges = outgoingEdges(graph, node.id, "choice");
      for (const choiceEdge of choiceEdges) {
        const choiceNode = graph.nodes.find((entry) => entry.id === choiceEdge.toNodeId);
        if (!choiceNode || choiceNode.type !== "choice") {
          issues.push(issue({ severity: "error", nodeId: node.id, edgeId: choiceEdge.id, message: "场景选择出口必须连接到选择组节点" }));
          continue;
        }

        const optionEdges = outgoingEdges(graph, choiceNode.id, "option");
        if (!optionEdges.length) {
          issues.push(issue({ severity: "warning", nodeId: choiceNode.id, message: "选择组还没有连接任何选项" }));
        }
      }
    }

    if (node.type === "ending") {
      const data = nodeData<EndingNodeData>(node);

      if (!data.code.trim()) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "结局缺少编号" }));
      }

      if (!data.title.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "结局缺少标题" }));
      }
    }

    if (node.type === "option") {
      const data = nodeData<OptionNodeData>(node);
      const targetEdge = outgoingEdges(graph, node.id, "out")[0];
      const targetNodeCode = targetEdge ? resolveFlowTarget(graph, targetEdge) : "";

      if (!data.code.trim()) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "选项缺少编号" }));
      }

      if (!data.label.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "选项缺少玩家可见文案" }));
      }

      if (!targetNodeCode) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "选项没有可编译的目标场景或结局" }));
      } else if (!storyCodes.has(targetNodeCode)) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: `选项目标不存在：${targetNodeCode}` }));
      }
    }

    if (node.type === "condition") {
      const data = nodeData<ConditionNodeData>(node);
      const hasIncoming = incomingEdges(graph, node.id).length > 0;
      const trueEdge = outgoingEdges(graph, node.id, "true")[0];

      if (data.matchMode === "any") {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "任一条件成立暂未完整编译，发布时会按无条件处理" }));
      }

      if (hasIncoming && !trueEdge) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "条件节点缺少成立后的出口" }));
      }

      for (const condition of data.conditions) {
        if (!condition.variableKey.trim()) {
          issues.push(issue({ severity: "warning", nodeId: node.id, message: "条件里有空的变量 key" }));
          break;
        }
      }
    }

    if (node.type === "set_variable") {
      const data = nodeData<SetVariableNodeData>(node);
      const hasIncoming = incomingEdges(graph, node.id).length > 0;
      const outEdge = outgoingEdges(graph, node.id, "out")[0];

      if (hasIncoming && !outEdge) {
        issues.push(issue({ severity: "error", nodeId: node.id, message: "变量变化节点缺少继续出口" }));
      }

      for (const action of data.actions) {
        if (!action.variableKey.trim()) {
          issues.push(issue({ severity: "warning", nodeId: node.id, message: "变量动作里有空的变量 key" }));
          break;
        }
      }
    }

    if (node.type === "record") {
      const data = nodeData<RecordNodeData>(node);

      if (!data.title.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "记录缺少标题" }));
      }

      if (!data.body.trim()) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "记录还没有正文内容" }));
      }

      if (!incomingEdges(graph, node.id).length) {
        issues.push(issue({ severity: "warning", nodeId: node.id, message: "记录没有解锁来源，播放页不会解锁它" }));
      }
    }
  }

  const startNode = graph.nodes.find((node) => node.type === "start");
  const startEdge = startNode ? outgoingEdges(graph, startNode.id, "out")[0] : undefined;
  if (startNode && startEdge && !resolveFlowTarget(graph, startEdge)) {
    issues.push(issue({ severity: "error", nodeId: startNode.id, edgeId: startEdge.id, message: "开始节点无法解析到可运行场景或结局" }));
  }

  return issues;
}

export function validateGraph(graph: GraphDocument) {
  const issues: GraphValidationIssue[] = [];
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByInputPort = new Map<string, GraphEdge[]>();
  const edgesByOutputPort = new Map<string, GraphEdge[]>();
  const startNodes = graph.nodes.filter((node) => node.type === "start");

  if (startNodes.length !== 1) {
    issues.push(issue({ severity: "error", message: `需要且只能有一个开始节点，当前 ${startNodes.length} 个` }));
  }

  for (const edge of graph.edges) {
    const edgeIssues = validateEdge(edge, nodesById);
    issues.push(...edgeIssues);

    const inputList = edgesByInputPort.get(edge.toPortId) ?? [];
    inputList.push(edge);
    edgesByInputPort.set(edge.toPortId, inputList);

    const outputList = edgesByOutputPort.get(edge.fromPortId) ?? [];
    outputList.push(edge);
    edgesByOutputPort.set(edge.fromPortId, outputList);
  }

  for (const node of graph.nodes) {
    for (const port of node.ports) {
      const connectedEdges =
        port.direction === "input"
          ? edgesByInputPort.get(port.id) ?? []
          : edgesByOutputPort.get(port.id) ?? [];

      if (port.required && connectedEdges.length === 0) {
        issues.push(issue({ severity: "error", nodeId: node.id, portId: port.id, message: `${node.title} 缺少必需连接：${port.label}` }));
      }

      if (!port.multiple && connectedEdges.length > 1) {
        issues.push(issue({ severity: "error", nodeId: node.id, portId: port.id, message: `${node.title} 的端口不允许多条连接：${port.label}` }));
      }
    }
  }

  issues.push(...validateCompileSurface(graph));

  return issues;
}

export function hasBlockingGraphIssues(graph: GraphDocument) {
  return validateGraph(graph).some((entry) => entry.severity === "error");
}
