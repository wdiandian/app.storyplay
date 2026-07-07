"use client";

import { useMemo } from "react";
import type { StoryGame, StoryNode } from "@/lib/story-engine";

type BranchGraphProps = {
  game: StoryGame;
  selectedNodeCode: string;
  onSelectNode: (nodeCode: string) => void;
  onAddNext?: (nodeCode: string) => void;
  onAddBranch?: (nodeCode: string) => void;
  onPreviewNode?: (nodeCode: string) => void;
  filter?: BranchGraphFilter;
};

export type BranchGraphFilter = "all" | "issues" | "start" | "ending" | "isolated";

type GraphEdge = {
  fromCode: string;
  toCode: string;
  kind: "auto" | "choice";
  missingTarget: boolean;
};

type PositionedNode = {
  node: StoryNode;
  x: number;
  y: number;
  incoming: number;
  outgoing: number;
  missingTargets: number;
  issueLabels: string[];
  status: "start" | "ending" | "isolated" | "broken" | "connected";
};

const NODE_WIDTH = 232;
const NODE_HEIGHT = 232;
const COLUMN_GAP = 140;
const ROW_GAP = 56;
const PADDING_X = 40;
const PADDING_Y = 34;

function getNodeDisplayStatus(status: PositionedNode["status"]) {
  if (status === "start") {
    return "起始节点";
  }

  if (status === "ending") {
    return "结局节点";
  }

  if (status === "isolated") {
    return "孤立节点";
  }

  if (status === "broken") {
    return "待补出口";
  }

  return "已连通";
}

function getPlayerSceneLabel(game: StoryGame, node: StoryNode) {
  if (node.isEnding) {
    return "结局 UI";
  }

  if (node.code === game.startNodeCode) {
    return "开场 UI";
  }

  return "中段 UI";
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
    if (node.autoNextNodeCode) {
      const exists = nodeByCode.has(node.autoNextNodeCode);
      edges.push({
        fromCode: node.code,
        toCode: node.autoNextNodeCode,
        kind: "auto",
        missingTarget: !exists,
      });

      if (exists) {
        incoming.set(node.autoNextNodeCode, (incoming.get(node.autoNextNodeCode) ?? 0) + 1);
      }
    }

    for (const choice of node.choices ?? []) {
      const exists = nodeByCode.has(choice.targetNodeCode);
      edges.push({
        fromCode: node.code,
        toCode: choice.targetNodeCode,
        kind: "choice",
        missingTarget: !exists,
      });

      if (exists) {
        incoming.set(choice.targetNodeCode, (incoming.get(choice.targetNodeCode) ?? 0) + 1);
      }
    }
  }

  const adjacency = new Map<string, string[]>();

  for (const node of game.nodes) {
    adjacency.set(
      node.code,
      [
        ...(node.autoNextNodeCode && nodeByCode.has(node.autoNextNodeCode)
          ? [node.autoNextNodeCode]
          : []),
        ...(node.choices
          ?.map((choice) => choice.targetNodeCode)
          .filter((targetCode) => nodeByCode.has(targetCode)) ?? []),
      ].filter((targetCode, index, list) => list.indexOf(targetCode) === index),
    );
  }

  const visited = new Set<string>();
  const levels = new Map<number, string[]>();
  const queue: Array<{ code: string; depth: number }> = game.startNodeCode
    ? [{ code: game.startNodeCode, depth: 0 }]
    : [];
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
      const missingTargets = edges.filter((edge) => edge.fromCode === code && edge.missingTarget).length;
      const isStart = code === game.startNodeCode;
      const isEnding = Boolean(node.isEnding);
      const nodeIncoming = incoming.get(code) ?? 0;
      const status: PositionedNode["status"] = isStart
        ? "start"
        : isEnding
          ? "ending"
          : nodeIncoming === 0
            ? "isolated"
            : outgoing === 0 || missingTargets > 0
              ? "broken"
              : "connected";
      const issueLabels = [
        ...(!node.videoUrl.trim() ? ["缺视频"] : []),
        ...(!isEnding && !node.autoNextNodeCode && !(node.choices?.length ?? 0) ? ["缺出口"] : []),
        ...(missingTargets > 0 ? ["目标无效"] : []),
        ...(status === "isolated" ? ["孤立片段"] : []),
      ];

      positions.set(code, {
        node,
        x: PADDING_X + depth * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING_Y + index * (NODE_HEIGHT + ROW_GAP),
        incoming: nodeIncoming,
        outgoing,
        missingTargets,
        issueLabels,
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
  onAddNext,
  onAddBranch,
  onPreviewNode,
  filter = "all",
}: BranchGraphProps) {
  const graph = useMemo(() => buildGraph(game), [game]);
  const visibleEntries = useMemo(
    () =>
      Array.from(graph.positions.values()).filter((entry) => {
        if (filter === "issues") {
          return entry.issueLabels.length > 0;
        }

        if (filter === "start") {
          return entry.status === "start";
        }

        if (filter === "ending") {
          return entry.status === "ending";
        }

        if (filter === "isolated") {
          return entry.status === "isolated";
        }

        return true;
      }),
    [filter, graph.positions],
  );
  const visibleNodeCodes = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.node.code)),
    [visibleEntries],
  );

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
          红色边 = 缺失目标或待补出口
        </span>
      </div>

      <div className="mt-4 overflow-auto rounded-[1.5rem] border border-stone-900/10 bg-[#f8f5ef]">
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
              if (!visibleNodeCodes.has(edge.fromCode) || !visibleNodeCodes.has(edge.toCode)) {
                return null;
              }

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
              const stroke = edge.missingTarget
                ? "#e11d48"
                : edge.kind === "auto"
                  ? "#57534e"
                  : "#a16207";
              const fill = edge.missingTarget ? "#ffe4e6" : edge.kind === "auto" ? "#ffffff" : "#fef3c7";
              const border = edge.missingTarget ? "#fb7185" : edge.kind === "auto" ? "#d6d3d1" : "#fcd34d";
              const text = edge.missingTarget
                ? "目标缺失"
                : edge.kind === "auto"
                  ? "自动跳转"
                  : "玩家选项";
              const textColor = edge.missingTarget ? "#be123c" : edge.kind === "auto" ? "#44403c" : "#92400e";

              return (
                <g key={`${edge.fromCode}-${edge.toCode}-${index}`}>
                  <path
                    d={path}
                    stroke={stroke}
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
                    fill={fill}
                    stroke={border}
                  />
                  <text
                    x={labelX}
                    y={labelY + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill={textColor}
                  >
                    {text}
                  </text>
                </g>
              );
            })}
          </svg>

          {visibleEntries.map((entry) => {
            const isSelected = entry.node.code === selectedNodeCode;
            const colors = getNodeColors(entry.status, isSelected);
            const canContinue = !entry.node.isEnding;
            const hasVideo = Boolean(entry.node.videoUrl.trim());
            const timelineCount = entry.node.timelineEvents?.length ?? 0;
            const playerSceneLabel = getPlayerSceneLabel(game, entry.node);
            const actionButtonClass = isSelected
              ? "border-white/15 bg-white/10 text-white/85 hover:bg-white/15"
              : "border-stone-900/10 bg-white/80 text-stone-700 hover:border-stone-900/30 hover:bg-white";

            return (
              <div
                key={entry.node.code}
                className={`absolute flex flex-col rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 ${colors.card}`}
                style={{
                  left: `${entry.x}px`,
                  top: `${entry.y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                }}
              >
                <button
                  type="button"
                  className="block min-h-0 flex-1 text-left"
                  onClick={() => onSelectNode(entry.node.code)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-medium">{entry.node.title}</div>
                      <div className={`mt-1 truncate text-xs ${colors.sub}`}>{entry.node.code}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${colors.badge}`}>
                      {getNodeDisplayStatus(entry.status)}
                    </span>
                  </div>

                  <div className={`mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] ${colors.sub}`}>
                    <span className="rounded-xl border border-current/10 px-1.5 py-1">
                      {hasVideo ? "有视频" : "缺视频"}
                    </span>
                    <span className="rounded-xl border border-current/10 px-1.5 py-1">
                      出口 {entry.outgoing}
                    </span>
                    <span className="rounded-xl border border-current/10 px-1.5 py-1">
                      时间线 {timelineCount}
                    </span>
                  </div>

                  <div className={`mt-2 rounded-xl border border-current/10 px-2 py-1 text-[10px] ${colors.sub}`}>
                    玩家侧：{playerSceneLabel}
                  </div>

                  <div className={`mt-2 flex max-h-9 flex-wrap gap-1.5 overflow-hidden text-[11px] ${colors.sub}`}>
                    <span>入口 {entry.incoming}</span>
                    {entry.issueLabels.map((issue) => (
                      <span key={`${entry.node.code}-${issue}`}>{issue}</span>
                    ))}
                  </div>
                </button>

                <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 border-t border-current/10 pt-3">
                  <button
                    type="button"
                    className={`rounded-full border px-2 py-2 text-[11px] leading-none transition ${actionButtonClass}`}
                    onClick={() => onSelectNode(entry.node.code)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-2 py-2 text-[11px] leading-none transition ${actionButtonClass}`}
                    onClick={() => onPreviewNode?.(entry.node.code)}
                  >
                    试玩
                  </button>
                  {canContinue ? (
                    <>
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-2 text-[11px] leading-none transition ${actionButtonClass}`}
                        onClick={() => onAddNext?.(entry.node.code)}
                      >
                        加下一幕
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-2 text-[11px] leading-none transition ${actionButtonClass}`}
                        onClick={() => onAddBranch?.(entry.node.code)}
                      >
                        加分支
                      </button>
                    </>
                  ) : (
                    <span className={`col-span-2 rounded-full border px-2 py-2 text-center text-[11px] leading-none ${colors.badge}`}>
                      结局片段不可继续
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {!visibleEntries.length ? (
            <div className="absolute left-9 top-7 w-[360px] rounded-[1.5rem] border border-dashed border-stone-900/15 bg-white/80 px-5 py-6 text-sm leading-7 text-stone-600">
              当前筛选下没有匹配的片段。切回“全部”可以查看完整剧情树。
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
