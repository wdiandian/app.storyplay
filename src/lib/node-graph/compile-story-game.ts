import type {
  ConditionNodeData,
  EndingNodeData,
  GraphEdge,
  GraphDocument,
  GraphNode,
  OptionNodeData,
  RecordNodeData,
  SceneNodeData,
  SetVariableNodeData,
} from "@/lib/node-graph/types";
import type {
  ConditionRule,
  StoryChoice,
  StoryGame,
  StoryNode,
  StoryRecord,
  TimelineEvent,
  VariableAction,
} from "@/lib/story-engine";

function nodeData<T>(node: GraphNode) {
  return node.data as T;
}

function incomingEdges(graph: GraphDocument, nodeId: string) {
  return graph.edges.filter((edge) => edge.toNodeId === nodeId);
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

function targetStoryCode(targetNode: GraphNode) {
  if (targetNode.type === "scene") {
    return nodeData<SceneNodeData>(targetNode).sceneCode;
  }

  if (targetNode.type === "ending") {
    return nodeData<EndingNodeData>(targetNode).code;
  }

  return "";
}

type FlowResolution = {
  targetNodeCode: string;
  conditions: ConditionRule[];
  actions: VariableAction[];
};

function resolveFlowTarget(
  graph: GraphDocument,
  edge: GraphEdge,
  visitedNodeIds = new Set<string>(),
): FlowResolution | null {
  const targetNode = graph.nodes.find((node) => node.id === edge.toNodeId);
  const edgeConditions = edge.conditions ?? [];
  const edgeActions = edge.actions ?? [];

  if (!targetNode || visitedNodeIds.has(targetNode.id)) {
    return null;
  }

  const targetNodeCode = targetStoryCode(targetNode);

  if (targetNodeCode) {
    return {
      targetNodeCode,
      conditions: edgeConditions,
      actions: edgeActions,
    };
  }

  visitedNodeIds.add(targetNode.id);

  if (targetNode.type === "set_variable") {
    const data = nodeData<SetVariableNodeData>(targetNode);
    const nextEdge = outgoingEdges(graph, targetNode.id, "out")[0];
    const resolved = nextEdge ? resolveFlowTarget(graph, nextEdge, visitedNodeIds) : null;

    if (!resolved) {
      return null;
    }

    return {
      targetNodeCode: resolved.targetNodeCode,
      conditions: [...edgeConditions, ...resolved.conditions],
      actions: [...edgeActions, ...data.actions, ...resolved.actions],
    };
  }

  if (targetNode.type === "condition") {
    const data = nodeData<ConditionNodeData>(targetNode);
    const nextEdge = outgoingEdges(graph, targetNode.id, "true")[0];
    const resolved = nextEdge ? resolveFlowTarget(graph, nextEdge, visitedNodeIds) : null;

    if (!resolved) {
      return null;
    }

    return {
      targetNodeCode: resolved.targetNodeCode,
      conditions: [
        ...edgeConditions,
        ...(data.matchMode === "all" ? data.conditions : []),
        ...resolved.conditions,
      ],
      actions: [...edgeActions, ...resolved.actions],
    };
  }

  return null;
}

function compileChoices(graph: GraphDocument, sceneNode: GraphNode) {
  const choiceGroupEdges = outgoingEdges(graph, sceneNode.id, "choice");
  const choices: StoryChoice[] = [];

  for (const choiceGroupEdge of choiceGroupEdges) {
    const choiceNode = graph.nodes.find((node) => node.id === choiceGroupEdge.toNodeId);

    if (!choiceNode || choiceNode.type !== "choice") {
      continue;
    }

    const optionEdges = outgoingEdges(graph, choiceNode.id, "option");

    for (const optionEdge of optionEdges) {
      const optionNode = graph.nodes.find((node) => node.id === optionEdge.toNodeId);

      if (!optionNode || optionNode.type !== "option") {
        continue;
      }

      const targetEdge = outgoingEdges(graph, optionNode.id, "out")[0];
      const target = targetEdge ? resolveFlowTarget(graph, targetEdge) : null;
      const optionData = nodeData<OptionNodeData>(optionNode);

      if (!target?.targetNodeCode) {
        continue;
      }

      choices.push({
        code: optionData.code,
        label: optionData.label,
        hint: optionData.hint ?? "",
        targetNodeCode: target.targetNodeCode,
        conditions: target.conditions,
        actions: target.actions,
      });
    }
  }

  return choices;
}

function compileTimelineEvents(graph: GraphDocument, sceneNode: GraphNode) {
  return outgoingEdges(graph, sceneNode.id, "timeline")
    .map((edge) => graph.nodes.find((node) => node.id === edge.toNodeId))
    .filter((node): node is GraphNode => Boolean(node && node.type === "timeline"))
    .map((node) => {
      const data = node.data as { sourceEvent?: TimelineEvent };
      return data.sourceEvent;
    })
    .filter((event): event is TimelineEvent => Boolean(event));
}

function sourceSceneForChoice(graph: GraphDocument, optionNodeId: string) {
  const optionInput = incomingEdges(graph, optionNodeId)[0];
  const choiceNode = optionInput ? graph.nodes.find((node) => node.id === optionInput.fromNodeId) : null;
  const choiceInput = choiceNode ? incomingEdges(graph, choiceNode.id)[0] : null;
  const sceneNode = choiceInput ? graph.nodes.find((node) => node.id === choiceInput.fromNodeId) : null;

  return sceneNode?.type === "scene" ? sceneNode : null;
}

function sourceSceneForTimeline(graph: GraphDocument, timelineNodeId: string) {
  const timelineInput = incomingEdges(graph, timelineNodeId)[0];
  const sceneNode = timelineInput ? graph.nodes.find((node) => node.id === timelineInput.fromNodeId) : null;

  return sceneNode?.type === "scene" ? sceneNode : null;
}

function unlockRefsFromNode(graph: GraphDocument, node: GraphNode) {
  const nodeCodes: string[] = [];
  const choiceCodes: string[] = [];

  if (node.type === "scene" || node.type === "ending") {
    const code = targetStoryCode(node);
    if (code) nodeCodes.push(code);
  }

  if (node.type === "option") {
    const optionData = nodeData<OptionNodeData>(node);
    if (optionData.code) choiceCodes.push(optionData.code);

    const sourceScene = sourceSceneForChoice(graph, node.id);
    if (sourceScene) {
      const sourceCode = targetStoryCode(sourceScene);
      if (sourceCode) nodeCodes.push(sourceCode);
    }
  }

  if (node.type === "timeline") {
    const sourceScene = sourceSceneForTimeline(graph, node.id);
    if (sourceScene) {
      const sourceCode = targetStoryCode(sourceScene);
      if (sourceCode) nodeCodes.push(sourceCode);
    }
  }

  return {
    nodeCodes,
    choiceCodes,
  };
}

function compileRecords(graph: GraphDocument): StoryRecord[] {
  return graph.nodes
    .filter((node) => node.type === "record")
    .map((node) => {
      const data = nodeData<RecordNodeData>(node);
      const unlockRefs = incomingEdges(graph, node.id).reduce(
        (result, edge) => {
          const sourceNode = graph.nodes.find((entry) => entry.id === edge.fromNodeId);
          if (!sourceNode) return result;

          const refs = unlockRefsFromNode(graph, sourceNode);
          result.nodeCodes.push(...refs.nodeCodes);
          result.choiceCodes.push(...refs.choiceCodes);
          return result;
        },
        { nodeCodes: [] as string[], choiceCodes: [] as string[] },
      );

      return {
        id: node.id,
        recordType: data.recordType,
        title: data.title,
        body: data.body,
        lockedLabel: data.lockedLabel,
        visibleWhenLocked: data.visibleWhenLocked,
        unlockNodeCodes: Array.from(new Set(unlockRefs.nodeCodes)),
        unlockChoiceCodes: Array.from(new Set(unlockRefs.choiceCodes)),
      };
    });
}

export function compileGraphToStoryGame(graph: GraphDocument, baseGame?: StoryGame): StoryGame {
  const storyNodes: StoryNode[] = [];

  for (const graphNode of graph.nodes) {
    if (graphNode.type === "scene") {
      const data = nodeData<SceneNodeData>(graphNode);
      const autoEdge = outgoingEdges(graph, graphNode.id, "finished")[0];
      const autoTarget = autoEdge ? resolveFlowTarget(graph, autoEdge) : null;
      const autoNextNodeCode = autoTarget?.targetNodeCode ?? "";

      storyNodes.push({
        code: data.sceneCode,
        title: data.title,
        description: data.description ?? "",
        transcript: data.transcript ?? "",
        videoUrl: data.videoUrl ?? "",
        nodeType: "video",
        autoNextNodeCode: autoNextNodeCode || undefined,
        isEnding: false,
        choices: compileChoices(graph, graphNode),
        timelineEvents: compileTimelineEvents(graph, graphNode),
      });
    }

    if (graphNode.type === "ending") {
      const data = nodeData<EndingNodeData>(graphNode);

      storyNodes.push({
        code: data.code,
        title: data.title,
        description: data.description ?? "",
        transcript: data.transcript ?? "",
        videoUrl: data.videoUrl ?? "",
        nodeType: "ending",
        isEnding: true,
        endingTone: data.endingTone,
        choices: [],
        timelineEvents: [],
      });
    }
  }

  const startNode = graph.nodes.find((node) => node.type === "start");
  const startEdge = startNode ? outgoingEdges(graph, startNode.id, "out")[0] : undefined;
  const startTarget = startEdge ? resolveFlowTarget(graph, startEdge) : undefined;
  const startNodeCode = startTarget?.targetNodeCode ?? storyNodes[0]?.code ?? "";

  return {
    id: baseGame?.id ?? graph.meta.gameId,
    slug: graph.meta.slug,
    title: graph.meta.title,
    tagline: graph.meta.tagline,
    listedOnHome: graph.meta.listedOnHome,
    sortOrder: graph.meta.sortOrder,
    intro: graph.meta.intro,
    promoVideoUrl: graph.meta.promoVideoUrl,
    promoPosterUrl: graph.meta.promoPosterUrl,
    promoText: graph.meta.promoText,
    startNodeCode,
    variables: structuredClone(graph.variables),
    records: compileRecords(graph),
    nodes: storyNodes,
  };
}

export function findSourceSceneForChoice(graph: GraphDocument, optionNodeId: string) {
  return sourceSceneForChoice(graph, optionNodeId);
}
