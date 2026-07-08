import { createGraphNode, getPort, graphNodeId, GRAPH_DOCUMENT_VERSION } from "@/lib/node-graph/defaults";
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  TimelineNodeData,
} from "@/lib/node-graph/types";
import type { StoryGame, StoryNode, TimelineEvent } from "@/lib/story-engine";

function uniqueTargets(node: StoryNode) {
  return [
    ...(node.autoNextNodeCode ? [node.autoNextNodeCode] : []),
    ...(node.choices?.map((choice) => choice.targetNodeCode) ?? []),
  ].filter((targetCode, index, list) => targetCode && list.indexOf(targetCode) === index);
}

function buildLevels(game: StoryGame) {
  const nodeCodes = new Set(game.nodes.map((node) => node.code));
  const levels = new Map<string, number>();
  const queue = game.startNodeCode ? [{ code: game.startNodeCode, level: 0 }] : [];

  while (queue.length) {
    const current = queue.shift();

    if (!current || levels.has(current.code) || !nodeCodes.has(current.code)) {
      continue;
    }

    levels.set(current.code, current.level);
    const node = game.nodes.find((entry) => entry.code === current.code);

    for (const targetCode of node ? uniqueTargets(node) : []) {
      if (!levels.has(targetCode)) {
        queue.push({ code: targetCode, level: current.level + 1 });
      }
    }
  }

  const disconnectedLevel = Math.max(0, ...Array.from(levels.values())) + 1;

  for (const node of game.nodes) {
    if (!levels.has(node.code)) {
      levels.set(node.code, disconnectedLevel);
    }
  }

  return levels;
}

function toTimelineEventType(event: TimelineEvent): TimelineNodeData["eventType"] {
  if (event.type === "show_text") {
    return "text";
  }

  if (event.type === "show_overlay") {
    return "overlay";
  }

  if (event.type === "show_choice") {
    return "choice";
  }

  if (event.type === "jump") {
    return "jump";
  }

  if (event.type === "run_actions") {
    return "actions";
  }

  return "pause";
}

function textFromTimelineEvent(event: TimelineEvent) {
  const text = event.payload.text ?? event.payload.title ?? event.payload.message;
  return typeof text === "string" ? text : undefined;
}

export function importStoryGameToGraph(game: StoryGame): GraphDocument {
  const now = new Date().toISOString();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const levels = buildLevels(game);
  const rowByLevel = new Map<number, number>();
  const startNode = createGraphNode(
    "start",
    graphNodeId("start", "root"),
    "开始",
    { x: 80, y: 120 },
    {
      title: game.title,
      intro: game.intro,
    },
  );
  nodes.push(startNode);

  const nodeByStoryCode = new Map<string, GraphNode>();

  for (const storyNode of game.nodes) {
    const level = levels.get(storyNode.code) ?? 0;
    const row = rowByLevel.get(level) ?? 0;
    rowByLevel.set(level, row + 1);

    const type = storyNode.isEnding || storyNode.nodeType === "ending" ? "ending" : "scene";
    const graphNode = createGraphNode(
      type,
      graphNodeId(type, storyNode.code),
      storyNode.title || storyNode.code,
      { x: 480 + level * 520, y: 100 + row * 360 },
      type === "ending"
        ? {
            code: storyNode.code,
            title: storyNode.title,
            description: storyNode.description,
            transcript: storyNode.transcript,
            videoUrl: storyNode.videoUrl,
            endingTone: storyNode.endingTone ?? "truth",
          }
        : {
            sceneCode: storyNode.code,
            title: storyNode.title,
            description: storyNode.description,
            transcript: storyNode.transcript,
            videoUrl: storyNode.videoUrl,
            memory: {
              title: storyNode.title,
              summary: storyNode.description,
              visibleInMemory: true,
            },
          },
    );
    nodes.push(graphNode);
    nodeByStoryCode.set(storyNode.code, graphNode);
  }

  const startTarget = nodeByStoryCode.get(game.startNodeCode);
  if (startTarget) {
    edges.push({
      id: `edge:start:${game.startNodeCode}`,
      fromNodeId: startNode.id,
      fromPortId: getPort(startNode, "out").id,
      toNodeId: startTarget.id,
      toPortId: getPort(startTarget, "in").id,
      type: "flow",
      label: "进入",
    });
  }

  for (const storyNode of game.nodes) {
    const graphNode = nodeByStoryCode.get(storyNode.code);

    if (!graphNode) {
      continue;
    }

    if (storyNode.autoNextNodeCode) {
      const target = nodeByStoryCode.get(storyNode.autoNextNodeCode);
      if (target) {
        edges.push({
          id: `edge:auto:${storyNode.code}:${storyNode.autoNextNodeCode}`,
          fromNodeId: graphNode.id,
          fromPortId: getPort(graphNode, "finished").id,
          toNodeId: target.id,
          toPortId: getPort(target, "in").id,
          type: "flow",
          label: "播放后进入",
        });
      }
    }

    if (storyNode.choices?.length) {
      const choiceNode = createGraphNode(
        "choice",
        graphNodeId("choice", `${storyNode.code}:group`),
        `${storyNode.title || storyNode.code} 的选择`,
        { x: graphNode.position.x + 360, y: graphNode.position.y + 28 },
        {
          title: `${storyNode.title || storyNode.code} 的选择`,
          prompt: "玩家需要做出选择",
          pausePlayback: true,
          displayMode: "overlay",
        },
      );
      nodes.push(choiceNode);
      edges.push({
        id: `edge:choice-group:${storyNode.code}`,
        fromNodeId: graphNode.id,
        fromPortId: getPort(graphNode, "choice").id,
        toNodeId: choiceNode.id,
        toPortId: getPort(choiceNode, "in").id,
        type: "choice",
        label: "选择",
      });

      storyNode.choices.forEach((choice, index) => {
        const optionNode = createGraphNode(
          "option",
          graphNodeId("option", `${storyNode.code}:${choice.code}`),
          choice.label || `选项 ${index + 1}`,
          { x: choiceNode.position.x + 330, y: choiceNode.position.y + index * 140 },
          {
            code: choice.code,
            label: choice.label,
            hint: choice.hint,
          },
        );
        nodes.push(optionNode);
        edges.push({
          id: `edge:choice-option:${storyNode.code}:${choice.code}`,
          fromNodeId: choiceNode.id,
          fromPortId: getPort(choiceNode, "option").id,
          toNodeId: optionNode.id,
          toPortId: getPort(optionNode, "in").id,
          type: "choice",
          label: choice.label,
        });

        const target = nodeByStoryCode.get(choice.targetNodeCode);
        if (target) {
          edges.push({
            id: `edge:option-target:${storyNode.code}:${choice.code}`,
            fromNodeId: optionNode.id,
            fromPortId: getPort(optionNode, "out").id,
            toNodeId: target.id,
            toPortId: getPort(target, "in").id,
            type: "choice",
            label: "进入",
            conditions: choice.conditions,
            actions: choice.actions,
          });
        }
      });
    }

    (storyNode.timelineEvents ?? []).forEach((event, index) => {
      const timelineNode = createGraphNode(
        "timeline",
        graphNodeId("timeline", `${storyNode.code}:${event.id}`),
        `${Math.round(event.atMs / 1000)}s 事件`,
        { x: graphNode.position.x, y: graphNode.position.y + 230 + index * 110 },
        {
          atMs: event.atMs,
          eventType: toTimelineEventType(event),
          text: textFromTimelineEvent(event),
          pausePlayback: event.type === "pause" || event.type === "show_choice",
          sourceEvent: event,
        },
      );
      nodes.push(timelineNode);
      edges.push({
        id: `edge:timeline:${storyNode.code}:${event.id}`,
        fromNodeId: graphNode.id,
        fromPortId: getPort(graphNode, "timeline").id,
        toNodeId: timelineNode.id,
        toPortId: getPort(timelineNode, "in").id,
        type: "timeline_event",
        label: "时间点",
        conditions: event.conditions,
        actions: event.actions,
      });
    });
  }

  return {
    id: `graph:${game.slug}`,
    projectSlug: game.slug,
    title: game.title,
    version: GRAPH_DOCUMENT_VERSION,
    meta: {
      gameId: game.id,
      slug: game.slug,
      title: game.title,
      tagline: game.tagline,
      intro: game.intro,
      listedOnHome: game.listedOnHome,
      sortOrder: game.sortOrder,
      promoVideoUrl: game.promoVideoUrl,
      promoPosterUrl: game.promoPosterUrl,
      promoText: game.promoText,
    },
    nodes,
    edges,
    variables: structuredClone(game.variables ?? []),
    createdAt: now,
    updatedAt: now,
  };
}
