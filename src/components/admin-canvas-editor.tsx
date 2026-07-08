"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Viewport } from "@xyflow/react";
import { nodeTypeName } from "@/components/node-graph-editor/config";
import { NodeGraphCanvas } from "@/components/node-graph-editor/canvas";
import { edgeTypeFromPorts, isKindCompatible } from "@/components/node-graph-editor/geometry";
import { NodeGraphInspector } from "@/components/node-graph-editor/inspector";
import { NodeGraphPalette } from "@/components/node-graph-editor/palette";
import type { Selection } from "@/components/node-graph-editor/types";
import {
  GRAPH_DOCUMENT_VERSION,
  compileGraphToStoryGame,
  createGraphNode,
  defaultPortsForNode,
  graphNodeId,
  importStoryGameToGraph,
  validateGraph,
  type EndingNodeData,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type GraphNodeData,
  type GraphNodeType,
  type GraphPort,
  type GraphValidationIssue,
  type OptionNodeData,
  type SceneNodeData,
} from "@/lib/node-graph";
import type { ProjectSummary, StoryGame } from "@/lib/story-engine";

type AdminPayload = {
  game: StoryGame;
  projects?: ProjectSummary[];
};

type UploadPayload = {
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
};

type AdminCanvasEditorProps = {
  initialGame: StoryGame;
  projects: ProjectSummary[];
};

type UpdateGraphOptions = {
  captureHistory?: boolean;
};

function withProjectQuery(path: string, projectSlug: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}project=${encodeURIComponent(projectSlug)}`;
}

async function requestAdmin<T extends object>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as T | { error: string };

  if (!response.ok || (typeof payload === "object" && payload !== null && "error" in payload)) {
    throw new Error("error" in payload ? payload.error : "后台请求失败");
  }

  return payload;
}

function buildCode(title: string, existingCodes: string[], fallbackPrefix: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized || `${fallbackPrefix}_${Date.now().toString(36)}`;
  const existing = new Set(existingCodes);

  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGraphDocument(value: unknown, projectSlug: string): value is GraphDocument {
  if (!isObject(value)) {
    return false;
  }

  return (
    value.version === GRAPH_DOCUMENT_VERSION &&
    value.projectSlug === projectSlug &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    isObject(value.meta)
  );
}

function normalizeGraphPorts(graph: GraphDocument): GraphDocument {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ports: defaultPortsForNode(node.type, node.id),
    })),
  };
}

function graphFromGame(game: StoryGame): GraphDocument {
  if (isGraphDocument(game.authoringGraph, game.slug)) {
    return normalizeGraphPorts({
      ...game.authoringGraph,
      title: game.title,
      meta: {
        ...game.authoringGraph.meta,
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
      variables: structuredClone(game.variables ?? []),
    });
  }

  return importStoryGameToGraph(game);
}

function createNodeData(type: GraphNodeType, title: string, graph: GraphDocument): { data: GraphNodeData; title: string; key: string } {
  const sceneCodes = graph.nodes.flatMap((node) => {
    if (node.type === "scene") return [(node.data as SceneNodeData).sceneCode];
    if (node.type === "ending") return [(node.data as EndingNodeData).code];
    return [];
  });
  const optionCodes = graph.nodes.flatMap((node) => (node.type === "option" ? [(node.data as OptionNodeData).code] : []));

  if (type === "scene") {
    const code = buildCode(title, sceneCodes, "scene");
    return {
      key: code,
      title: title || "新场景",
      data: {
        sceneCode: code,
        title: title || "新场景",
        description: "",
        transcript: "",
        videoUrl: "",
        memory: { title: title || "新场景", summary: "", visibleInMemory: true },
      },
    };
  }

  if (type === "ending") {
    const code = buildCode(title, sceneCodes, "ending");
    return {
      key: code,
      title: title || "新结局",
      data: {
        code,
        title: title || "新结局",
        description: "",
        transcript: "",
        videoUrl: "",
        endingTone: "truth",
      },
    };
  }

  if (type === "option") {
    const code = buildCode(title, optionCodes, "option");
    return {
      key: `${code}:${Date.now().toString(36)}`,
      title: title || "新选项",
      data: { code, label: title || "新选项", hint: "" },
    };
  }

  if (type === "choice") {
    return {
      key: Date.now().toString(36),
      title: title || "新选择组",
      data: { title: title || "新选择组", prompt: "玩家需要做出选择", pausePlayback: true, displayMode: "overlay" },
    };
  }

  if (type === "record") {
    return {
      key: Date.now().toString(36),
      title: title || "新记录",
      data: { recordType: "memory", title: title || "新记录", body: "", lockedLabel: "尚未解锁", visibleWhenLocked: true },
    };
  }

  if (type === "asset") {
    return {
      key: Date.now().toString(36),
      title: title || "新素材",
      data: { assetType: "video", url: "", filename: "" },
    };
  }

  if (type === "timeline") {
    return {
      key: Date.now().toString(36),
      title: title || "新时间点",
      data: { atMs: 0, eventType: "text", text: "", pausePlayback: false },
    };
  }

  if (type === "condition") {
    return {
      key: Date.now().toString(36),
      title: title || "条件判断",
      data: { conditions: [], matchMode: "all" },
    };
  }

  if (type === "set_variable") {
    return {
      key: Date.now().toString(36),
      title: title || "变量变化",
      data: { actions: [] },
    };
  }

  return {
    key: "root",
    title: title || "开始",
    data: { title: title || "开始" },
  };
}

export function AdminCanvasEditor({ initialGame, projects: initialProjects }: AdminCanvasEditorProps) {
  const router = useRouter();
  const edgeIdCounterRef = useRef(0);
  const undoStackRef = useRef<GraphDocument[]>([]);
  const redoStackRef = useRef<GraphDocument[]>([]);
  const [game, setGame] = useState(initialGame);
  const [projects, setProjects] = useState(initialProjects);
  const [graph, setGraph] = useState<GraphDocument>(() => graphFromGame(initialGame));
  const graphRef = useRef<GraphDocument>(graph);
  const [selection, setSelection] = useState<Selection>({ type: "graph" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const issues = useMemo(() => validateGraph(graph), [graph]);
  const selectedNode = selection.type === "node" ? nodesById.get(selection.nodeId) ?? null : null;
  const selectedEdge = selection.type === "edge" ? graph.edges.find((edge) => edge.id === selection.edgeId) ?? null : null;
  const orderedProjects = useMemo(
    () =>
      [...projects].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return right.sortOrder - left.sortOrder;
        return right.updatedAt.localeCompare(left.updatedAt);
      }),
    [projects],
  );
  const issueCountByNode = useMemo(() => {
    const map = new Map<string, number>();
    for (const issueEntry of issues) {
      if (issueEntry.nodeId) {
        map.set(issueEntry.nodeId, (map.get(issueEntry.nodeId) ?? 0) + 1);
      }
    }
    return map;
  }, [issues]);

  function markHistoryChanged() {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  }

  function pushUndoSnapshot(snapshot: GraphDocument) {
    undoStackRef.current = [...undoStackRef.current.slice(-59), structuredClone(snapshot)];
    redoStackRef.current = [];
    markHistoryChanged();
  }

  function resetHistory() {
    undoStackRef.current = [];
    redoStackRef.current = [];
    markHistoryChanged();
  }

  function updateGraph(updater: (current: GraphDocument) => GraphDocument, options: UpdateGraphOptions = {}) {
    const captureHistory = options.captureHistory ?? true;
    const current = graphRef.current;

    if (captureHistory) {
      pushUndoSnapshot(current);
    }

    const next = {
      ...updater(current),
      updatedAt: new Date().toISOString(),
    };
    graphRef.current = next;
    setGraph(next);
  }

  function undoGraphChange() {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;

    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-59), structuredClone(graphRef.current)];
    const restored = structuredClone(previous);
    graphRef.current = restored;
    setGraph(restored);
    setSelection({ type: "graph" });
    setStatus("已撤销上一步");
    markHistoryChanged();
  }

  function redoGraphChange() {
    const next = redoStackRef.current.at(-1);
    if (!next) return;

    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-59), structuredClone(graphRef.current)];
    const restored = structuredClone(next);
    graphRef.current = restored;
    setGraph(restored);
    setSelection({ type: "graph" });
    setStatus("已重做");
    markHistoryChanged();
  }

  function updateViewport(viewport: Viewport) {
    updateGraph((current) => ({
      ...current,
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      },
    }), { captureHistory: false });
  }

  function switchProject(projectSlug: string) {
    if (projectSlug && projectSlug !== graph.projectSlug) {
      router.push(`/admin?project=${encodeURIComponent(projectSlug)}`);
    }
  }

  async function loadGame() {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestAdmin<AdminPayload>(withProjectQuery("/api/admin/game", graph.projectSlug));
      const nextGraph = graphFromGame(payload.game);
      setGame(payload.game);
      graphRef.current = nextGraph;
      setGraph(nextGraph);
      setProjects(payload.projects ?? projects);
      setSelection({ type: "graph" });
      resetHistory();
      setStatus("已刷新画布");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  }

  function addNode(type: GraphNodeType) {
    if (type === "start") return;

    updateGraph((current) => {
      const created = createNodeData(type, nodeTypeName[type], current);
      const node = createGraphNode(
        type,
        graphNodeId(type, created.key),
        created.title,
        {
          x: 160 + (current.nodes.length % 6) * 42,
          y: 140 + (current.nodes.length % 8) * 38,
        },
        created.data,
      );

      setSelection({ type: "node", nodeId: node.id });
      return {
        ...current,
        nodes: [...current.nodes, node],
      };
    });
  }

  function updateNode(nodeId: string, updater: (node: GraphNode) => GraphNode, options?: UpdateGraphOptions) {
    updateGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    }), options);
  }

  function updateSelectedNodeData<T extends GraphNodeData>(patch: Partial<T>, title?: string) {
    if (!selectedNode) return;

    updateNode(selectedNode.id, (node) => ({
      ...node,
      title: title ?? node.title,
      data: {
        ...node.data,
        ...patch,
      } as GraphNodeData,
    }));
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.type === "start") return;

    updateGraph((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedNode.id),
      edges: current.edges.filter((edge) => edge.fromNodeId !== selectedNode.id && edge.toNodeId !== selectedNode.id),
    }));
    setSelection({ type: "graph" });
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) return;

    updateGraph((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== selectedEdge.id),
    }));
    setSelection({ type: "graph" });
  }

  function connectPorts(fromNode: GraphNode, fromPort: GraphPort, toNode: GraphNode, toPort: GraphPort) {
    if (fromNode.id === toNode.id) {
      setError("不能把节点连接到自己");
      return;
    }

    if (!isKindCompatible(fromPort, toPort)) {
      setError(`端口类型不兼容：${fromPort.label} -> ${toPort.label}`);
      return;
    }

    edgeIdCounterRef.current += 1;
    const edge: GraphEdge = {
      id: `edge:${fromNode.id}:${fromPort.key}:${toNode.id}:${toPort.key}:${edgeIdCounterRef.current}`,
      fromNodeId: fromNode.id,
      fromPortId: fromPort.id,
      toNodeId: toNode.id,
      toPortId: toPort.id,
      type: edgeTypeFromPorts(fromPort),
      label: fromPort.label,
    };

    updateGraph((current) => ({
      ...current,
      edges: [
        ...current.edges.filter((entry) => {
          if (entry.fromPortId === fromPort.id && entry.toPortId === toPort.id) return false;
          if (!fromPort.multiple && entry.fromPortId === fromPort.id) return false;
          if (!toPort.multiple && entry.toPortId === toPort.id) return false;
          return true;
        }),
        edge,
      ],
    }));
    setSelection({ type: "edge", edgeId: edge.id });
    setError(null);
    setStatus("已建立连接");
  }

  function moveNode(nodeId: string, position: { x: number; y: number }) {
    updateNode(nodeId, (node) => ({
      ...node,
      position: {
        x: Math.max(32, Math.round(position.x)),
        y: Math.max(32, Math.round(position.y)),
      },
    }));
  }

  async function saveGraph() {
    const blockingIssues = issues.filter((entry) => entry.severity === "error");

    if (blockingIssues.length) {
      setError(`还有 ${blockingIssues.length} 个结构错误，修复后才能保存`);
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const graphForSave: GraphDocument = {
        ...graph,
        title: graph.meta.title,
        variables: structuredClone(graph.variables),
        updatedAt: new Date().toISOString(),
      };
      const compiledGame = compileGraphToStoryGame(graphForSave, game);
      const payload = await requestAdmin<{ game: StoryGame }>(withProjectQuery("/api/admin/import", graph.projectSlug), {
        method: "POST",
        body: JSON.stringify({
          game: {
            ...compiledGame,
            authoringGraph: graphForSave,
          },
        }),
      });
      const nextGraph = graphFromGame(payload.game);
      setGame(payload.game);
      graphRef.current = nextGraph;
      setGraph(nextGraph);
      resetHistory();
      setProjects((current) =>
        current.map((project) =>
          project.slug === payload.game.slug
            ? {
                ...project,
                title: payload.game.title,
                tagline: payload.game.tagline,
                listedOnHome: payload.game.listedOnHome,
                sortOrder: payload.game.sortOrder,
                promoVideoUrl: payload.game.promoVideoUrl,
                promoPosterUrl: payload.game.promoPosterUrl,
                updatedAt: new Date().toISOString(),
              }
            : project,
        ),
      );
      setStatus("画布已保存，并同步为可游玩的作品数据");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>, folder: string, applyUrl: (url: string, payload: UploadPayload) => void) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadPayload | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "上传失败");
      }

      applyUrl(payload.url, payload);
      setStatus(`已上传：${payload.filename}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  function openPreview(nodeCode?: string) {
    const params = new URLSearchParams({ project: graph.projectSlug });
    if (nodeCode) params.set("node", nodeCode);
    window.open(`/play?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function selectIssue(issueEntry: GraphValidationIssue) {
    if (issueEntry.nodeId && nodesById.has(issueEntry.nodeId)) {
      setSelection({ type: "node", nodeId: issueEntry.nodeId });
      return;
    }

    if (issueEntry.edgeId && graph.edges.some((edge) => edge.id === issueEntry.edgeId)) {
      setSelection({ type: "edge", edgeId: issueEntry.edgeId });
      return;
    }

    setSelection({ type: "graph" });
  }

  function deleteSelection() {
    if (selectedNode) {
      deleteSelectedNode();
      return;
    }

    if (selectedEdge) {
      deleteSelectedEdge();
    }
  }

  useEffect(() => {
    function isEditingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditingTarget(event.target)) {
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoGraphChange();
        } else {
          undoGraphChange();
        }
        return;
      }

      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoGraphChange();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNode || selectedEdge) {
          event.preventDefault();
          deleteSelection();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const canUndo = historyState.canUndo;
  const canRedo = historyState.canRedo;

  return (
    <main className="min-h-screen bg-[#11100d] text-stone-100">
      <header className="border-b border-white/10 bg-[#11100d]">
        <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs text-stone-400">StoryPlay 创作后台</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">{graph.meta.title || "未命名项目"}</h1>
              <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-stone-300">节点画布</span>
              {issues.length ? (
                <span className="rounded-md bg-rose-400/15 px-2 py-1 text-xs text-rose-100">{issues.length} 个结构问题</span>
              ) : (
                <span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs text-emerald-100">结构正常</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="min-w-56 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none" value={graph.projectSlug} onChange={(event) => switchProject(event.target.value)}>
              {orderedProjects.map((project) => (
                <option key={project.slug} value={project.slug} className="text-stone-950">
                  {project.title} / {project.slug}
                </option>
              ))}
            </select>
            <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-100 transition hover:border-white/30 disabled:opacity-50" onClick={() => void loadGame()} disabled={loading}>
              {loading ? "刷新中..." : "刷新"}
            </button>
            <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-100 transition hover:border-white/30" onClick={() => openPreview()}>
              试玩
            </button>
            <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-100 transition hover:border-white/30 disabled:opacity-40" onClick={undoGraphChange} disabled={!canUndo}>
              撤销
            </button>
            <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-100 transition hover:border-white/30 disabled:opacity-40" onClick={redoGraphChange} disabled={!canRedo}>
              重做
            </button>
            <button type="button" className="rounded-lg bg-white px-4 py-2 text-sm text-stone-950 transition hover:bg-amber-50 disabled:opacity-50" onClick={() => void saveGraph()} disabled={saving}>
              {saving ? "保存中..." : "保存画布"}
            </button>
            <Link href="/" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-100 transition hover:border-white/30">
              首页
            </Link>
          </div>
        </div>
        {(status || error) ? (
          <div className="grid gap-2 px-5 pb-4">
            {status ? <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{status}</div> : null}
            {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
          </div>
        ) : null}
      </header>

      <div className="grid h-[calc(100vh-5.25rem)] grid-cols-[240px_minmax(0,1fr)_380px]">
        <NodeGraphPalette onAddNode={addNode} />

        <NodeGraphCanvas
          graph={graph}
          nodesById={nodesById}
          selection={selection}
          issueCountByNode={issueCountByNode}
          onMoveNode={moveNode}
          onConnectPorts={connectPorts}
          onSelectNode={(nodeId) => setSelection({ type: "node", nodeId })}
          onSelectEdge={(edgeId) => setSelection({ type: "edge", edgeId })}
          onSelectGraph={() => setSelection({ type: "graph" })}
          onViewportChange={updateViewport}
        />

        <aside className="overflow-auto border-l border-white/10 bg-[#f4efe7] p-5 text-stone-950">
          <NodeGraphInspector
            graph={graph}
            issues={issues}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            nodesById={nodesById}
            uploading={uploading}
            onUpdateGraph={updateGraph}
            onUpdateSelectedNodeData={updateSelectedNodeData}
            onDeleteSelectedNode={deleteSelectedNode}
            onDeleteSelectedEdge={deleteSelectedEdge}
            onSelectIssue={selectIssue}
            onUploadAsset={(event, folder, applyUrl) => void uploadAsset(event, folder, applyUrl)}
          />
        </aside>
      </div>
    </main>
  );
}
