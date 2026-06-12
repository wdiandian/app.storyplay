"use client";

import { useMemo } from "react";
import type { StoryGame, StoryNode } from "@/lib/story-engine";

type BranchGraphProps = {
  game: StoryGame;
  selectedNodeCode: string;
  onSelectNode: (nodeCode: string) => void;
};

type GraphEdge = {
  fromCode: string;
  toCode: string;
  kind: "auto" | "choice";
};

type PositionedNode = {
  node: StoryNode;
  x: number;
  y: number;
  incoming: number;
  outgoing: number;
  status: "start" | "ending" | "isolated" | "broken" | "connected";
};

const NODE_WIDTH = 224;
const NODE_HEIGHT = 112;
const COLUMN_GAP = 144;
const ROW_GAP = 44;
const PADDING_X = 32;
const PADDING_Y = 24;

function getNodeDisplayStatus(status: PositionedNode["status"]) {
  if (status === "start") {
    return "开始片段";
  }

  if (status === "ending") {
    return "结局片段";
  }

  if (status === "isolated") {
    return "孤立片段";
  }

  if (status === "broken") {
    return "缺少出口";
  }

  return "已连接";
}

function getNodeColors(status: PositionedNode["status"], isSelected: boolean) {
  if (isSelected) {
    return {
      card: "border-stone-950 bg-stone-950 text-white shadow-[0_18px_50px_rgba(20,17,14,0.22)]",
      badge: "border-white/10 bg-white/10 text-white/85",
      sub: "text-white/70",
    };
  }

  if (status === "start") {
    return {
      card: "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_12px_30px_rgba(34,197,94,0.12)]",
      badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
      sub: "text-emerald-800/70",
    };
  }

  if (status === "ending") {
    return {
      card: "border-amber-300 bg-amber-50 text-amber-950 shadow-[0_12px_30px_rgba(245,158,11,0.12)]",
      badge: "border-amber-200 bg-amber-100 text-amber-800",
      sub: "text-amber-800/70",
    };
  }

  if (status === "isolated" || status === "broken") {
    return {
      card: "border-rose-200 bg-rose-50 text-rose-950 shadow-[0_12px_30px_rgba(244,63,94,0.08)]",
      badge: "border-rose-200 bg-rose-100 text-rose-800",
      sub: "text-rose-800/70",
    };
  }

  return {
    card: "border-stone-900/10 bg-white text-stone-900 shadow-[0_12px_30px_rgba(52,38,25,0.08)]",
    badge: "border-stone-900/10 bg-stone-100 text-stone-700",
    sub: "text-stone-500",
  };
}

function buildGraph(game: StoryGame) {
  const nodeByCode = new Map(game.nodes.map((node) => [node.code, node]));
  const edges: GraphEdge[] = [];
  const incoming = new Map<string, number>();

  for (const node of game.nodes) {
    incoming.set(node.code, 0);
  }

  for (const node of game.nodes) {
    if (node.autoNextNodeCode && nodeByCode.has(node.autoNextNodeCode)) {
      edges.push({
        fromCode: node.code,
        toCode: node.autoNextNodeCode,
        kind: "auto",
      });
      incoming.set(node.autoNextNodeCode, (incoming.get(node.autoNextNodeCode) ?? 0) + 1);
    }

    for (const choice of node.choices ?? []) {
      edges.push({
        fromCode: node.code,
        toCode: choice.targetNodeCode,
        kind: "choice",
      });

      if (nodeByCode.has(choice.targetNodeCode)) {
        incoming.set(choice.targetNodeCode, (incoming.get(choice.targetNodeCode) ?? 0) + 1);
      }
    }
  }

  const adjacency = new Map<string, string[]>();

  for (const node of game.nodes) {
    adjacency.set(
      node.code,
      [
        ...(node.autoNextNodeCode ? [node.autoNextNodeCode] : []),
        ...(node.choices?.map((choice) => choice.targetNodeCode) ?? []),
      ].filter((targetCode, index, list) => list.indexOf(targetCode) === index),
    );
  }

  const visited = new Set<string>();
  const levels = new Map<number, string[]>();
  const queue: Array<{ code: string; depth: number }> = [
    { code: game.startNodeCode, depth: 0 },
  ];
  let maxDepth = 0;

  while (queue.length) {
    const current = queue.shift();

    if (!current || visited.has(current.code) || !nodeByCode.has(current.code)) {
      continue;
    }

    visited.add(current.code);
    maxDepth = Math.max(maxDepth, current.depth);

    const level = levels.get(current.depth) ?? [];
    level.push(current.code);
    levels.set(current.depth, level);

    const targets = adjacency.get(current.code) ?? [];

    for (const targetCode of targets) {
      if (!visited.has(targetCode)) {
        queue.push({ code: targetCode, depth: current.depth + 1 });
      }
    }
  }

  const disconnected = game.nodes
    .filter((node) => !visited.has(node.code))
    .map((node) => node.code);

  if (disconnected.length) {
    levels.set(maxDepth + 1, disconnected);
    maxDepth += 1;
  }

  const positions = new Map<string, PositionedNode>();
  let maxRows = 0;

  for (const [depth, codes] of levels.entries()) {
    maxRows = Math.max(maxRows, codes.length);

    codes.forEach((code, index) => {
      const node = nodeByCode.get(code);

      if (!node) {
        return;
      }

      const outgoing = edges.filter((edge) => edge.fromCode === code).length;
      const isStart = code === game.startNodeCode;
      const isEnding = Boolean(node.isEnding);
      const nodeIncoming = incoming.get(code) ?? 0;
      const status: PositionedNode["status"] = isStart
        ? "start"
        : isEnding
          ? "ending"
          : nodeIncoming === 0
            ? "isolated"
            : outgoing === 0
              ? "broken"
              : "connected";

      positions.set(code, {
        node,
        x: PADDING_X + depth * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING_Y + index * (NODE_HEIGHT + ROW_GAP),
        incoming: nodeIncoming,
        outgoing,
        status,
      });
    });
  }

  const width = PADDING_X * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP;
  const height =
    PADDING_Y * 2 +
    (maxRows > 0 ? maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP : NODE_HEIGHT);

  return {
    edges,
    positions,
    width,
    height,
  };
}

export function BranchGraph({
  game,
  selectedNodeCode,
  onSelectNode,
}: BranchGraphProps) {
  const graph = useMemo(() => buildGraph(game), [game]);

  return (
    <div className="rounded-[1.75rem] border border-stone-900/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.88)_0%,_rgba(247,244,239,0.96)_100%)] p-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
        <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1">
          实线 = 自动跳转
        </span>
        <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1">
          虚线 = 玩家选项
        </span>
        <span className="rounded-full border border-stone-900/10 bg-white px-3 py-1">
          点击节点可切换到对应编辑区
        </span>
      </div>

      <div className="mt-4 overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-stone-900/10 bg-[#f8f5ef]">
        <div
          className="relative"
          style={{
            width: `${graph.width}px`,
            height: `${graph.height}px`,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            width={graph.width}
            height={graph.height}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
            fill="none"
          >
            <defs>
              <marker
                id="branch-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#57534e" />
              </marker>
            </defs>

            {graph.edges.map((edge, index) => {
              const from = graph.positions.get(edge.fromCode);
              const to = graph.positions.get(edge.toCode);

              if (!from || !to) {
                return null;
              }

              const startX = from.x + NODE_WIDTH;
              const startY = from.y + NODE_HEIGHT / 2;
              const endX = to.x;
              const endY = to.y + NODE_HEIGHT / 2;
              const curveX = Math.max(48, Math.abs(endX - startX) * 0.45);
              const path = `M ${startX} ${startY} C ${startX + curveX} ${startY}, ${endX - curveX} ${endY}, ${endX} ${endY}`;
              const labelX = (startX + endX) / 2;
              const labelY = (startY + endY) / 2 - 10;

              return (
                <g key={`${edge.fromCode}-${edge.toCode}-${index}`}>
                  <path
                    d={path}
                    stroke={edge.kind === "auto" ? "#57534e" : "#a16207"}
                    strokeWidth="2.5"
                    strokeDasharray={edge.kind === "choice" ? "8 6" : undefined}
                    markerEnd="url(#branch-arrow)"
                    opacity="0.9"
                  />
                  <rect
                    x={labelX - 48}
                    y={labelY - 12}
                    width="96"
                    height="24"
                    rx="12"
                    fill={edge.kind === "auto" ? "#ffffff" : "#fef3c7"}
                    stroke={edge.kind === "auto" ? "#d6d3d1" : "#fcd34d"}
                  />
                  <text
                    x={labelX}
                    y={labelY + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill={edge.kind === "auto" ? "#44403c" : "#92400e"}
                  >
                    {edge.kind === "auto" ? "自动跳转" : "玩家选项"}
                  </text>
                </g>
              );
            })}
          </svg>

          {Array.from(graph.positions.values()).map((entry) => {
            const isSelected = entry.node.code === selectedNodeCode;
            const colors = getNodeColors(entry.status, isSelected);

            return (
              <button
                key={entry.node.code}
                type="button"
                className={`absolute rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 ${colors.card}`}
                style={{
                  left: `${entry.x}px`,
                  top: `${entry.y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                }}
                onClick={() => onSelectNode(entry.node.code)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="line-clamp-1 text-sm font-medium">{entry.node.title}</div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] ${colors.badge}`}>
                    {getNodeDisplayStatus(entry.status)}
                  </span>
                </div>
                <div className={`mt-2 text-xs ${colors.sub}`}>{entry.node.code}</div>
                <div className={`mt-4 flex flex-wrap gap-2 text-[11px] ${colors.sub}`}>
                  <span>入口 {entry.incoming}</span>
                  <span>出口 {entry.outgoing}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
