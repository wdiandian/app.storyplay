"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BranchGraph } from "@/components/branch-graph";
import type { EndingTone, StoryChoice, StoryGame, StoryNode } from "@/lib/story-engine";

type AdminPayload = {
  game: StoryGame;
};

type DraftNode = {
  title: string;
  description: string;
  transcript: string;
  videoUrl: string;
  nodeType: "video" | "ending";
  autoNextNodeCode: string;
  endingTone: EndingTone;
  choices: StoryChoice[];
};

type NewNodeForm = {
  code: string;
  title: string;
  nodeType: "video" | "ending";
  videoUrl: string;
};

type NewChoiceForm = {
  code: string;
  label: string;
  hint: string;
  targetNodeCode: string;
};

type AdminStoryEditorProps = {
  initialGame: StoryGame;
};

const defaultVideoUrl =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const endingToneLabel: Record<EndingTone, string> = {
  truth: "真相结局",
  survival: "生还结局",
  tragedy: "悲剧结局",
};

const nodeTypeLabel: Record<"video" | "ending", string> = {
  video: "普通节点",
  ending: "结局节点",
};

function toDraftNode(node: StoryNode): DraftNode {
  return {
    title: node.title,
    description: node.description,
    transcript: node.transcript,
    videoUrl: node.videoUrl,
    nodeType: node.nodeType,
    autoNextNodeCode: node.autoNextNodeCode ?? "",
    endingTone: node.endingTone ?? "truth",
    choices: structuredClone(node.choices ?? []),
  };
}

function pickNode(game: StoryGame, preferredNodeCode?: string) {
  if (preferredNodeCode) {
    const preferred = game.nodes.find((node) => node.code === preferredNodeCode);

    if (preferred) {
      return preferred;
    }
  }

  return game.nodes.find((node) => node.code === game.startNodeCode) ?? game.nodes[0] ?? null;
}

function getNodeDisplayName(game: StoryGame, nodeCode: string) {
  const node = game.nodes.find((entry) => entry.code === nodeCode);
  return node ? `${node.title} / ${node.code}` : `${nodeCode} (未找到)`;
}

async function requestAdmin<T extends object>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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
    throw new Error(
      typeof payload === "object" && payload !== null && "error" in payload
        ? payload.error
        : "Unknown admin error",
    );
  }

  return payload;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <div>
        <div className="text-sm font-medium text-stone-900">{label}</div>
        {hint ? <div className="mt-1 text-xs leading-6 text-stone-500">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function inputClassName() {
  return "rounded-2xl border border-stone-900/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-stone-500";
}

function loadErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildNodeCode(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = Date.now().toString(36);

  return normalized ? `${normalized}_${suffix}` : `node_${suffix}`;
}

export function AdminStoryEditor({ initialGame }: AdminStoryEditorProps) {
  const initialNode = pickNode(initialGame);
  const [game, setGame] = useState<StoryGame>(initialGame);
  const [selectedNodeCode, setSelectedNodeCode] = useState<string>(initialNode?.code ?? "");
  const [draftNode, setDraftNode] = useState<DraftNode | null>(
    initialNode ? toDraftNode(initialNode) : null,
  );
  const [gameForm, setGameForm] = useState({
    title: initialGame.title,
    tagline: initialGame.tagline,
    intro: initialGame.intro,
    promoVideoUrl: initialGame.promoVideoUrl,
    promoPosterUrl: initialGame.promoPosterUrl,
    promoTitle: initialGame.promoTitle,
    promoText: initialGame.promoText,
    startNodeCode: initialGame.startNodeCode,
  });
  const [newNodeForm, setNewNodeForm] = useState<NewNodeForm>({
    code: "",
    title: "",
    nodeType: "video",
    videoUrl: defaultVideoUrl,
  });
  const [newChoiceForm, setNewChoiceForm] = useState<NewChoiceForm>({
    code: "",
    label: "",
    hint: "",
    targetNodeCode: initialGame.nodes[0]?.code ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasNodes = game.nodes.length > 0;
  const projectReadyForTree = hasNodes && Boolean(game.startNodeCode);

  function syncFromGame(nextGame: StoryGame, preferredNodeCode?: string) {
    const nextNode = pickNode(nextGame, preferredNodeCode ?? selectedNodeCode);

    setGame(nextGame);
    setGameForm({
      title: nextGame.title,
      tagline: nextGame.tagline,
      intro: nextGame.intro,
      promoVideoUrl: nextGame.promoVideoUrl,
      promoPosterUrl: nextGame.promoPosterUrl,
      promoTitle: nextGame.promoTitle,
      promoText: nextGame.promoText,
      startNodeCode: nextGame.startNodeCode,
    });
    setSelectedNodeCode(nextNode?.code ?? "");
    setDraftNode(nextNode ? toDraftNode(nextNode) : null);
    setNewChoiceForm((current) => ({
      ...current,
      targetNodeCode:
        current.targetNodeCode && nextGame.nodes.some((node) => node.code === current.targetNodeCode)
          ? current.targetNodeCode
          : nextGame.nodes[0]?.code ?? "",
    }));
  }

  function handleSelectNode(nodeCode: string) {
    const selectedNode = game.nodes.find((node) => node.code === nodeCode) ?? null;
    setSelectedNodeCode(nodeCode);
    setDraftNode(selectedNode ? toDraftNode(selectedNode) : null);
    setStatus(null);
    setError(null);
  }

  async function loadGame(preferredNodeCode?: string) {
    setLoading(true);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>("/api/admin/game");
      syncFromGame(payload.game, preferredNodeCode);
      setStatus("已刷新后台数据");
    } catch (loadError) {
      setError(loadErrorMessage(loadError, "加载项目失败"));
    } finally {
      setLoading(false);
    }
  }

  async function saveGameSettings() {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "PATCH",
        body: JSON.stringify(gameForm),
      });

      syncFromGame(payload.game, selectedNodeCode);
      setStatus("已保存项目配置");
    } catch (saveError) {
      setError(loadErrorMessage(saveError, "保存项目配置失败"));
    } finally {
      setSaving(false);
    }
  }

  async function resetToBlankProject() {
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<AdminPayload>("/api/admin/game", {
        method: "POST",
        body: JSON.stringify({
          action: "reset_blank",
        }),
      });

      syncFromGame(payload.game);
      setStatus("已重置为空白项目");
    } catch (resetError) {
      setError(loadErrorMessage(resetError, "重置空白项目失败"));
    } finally {
      setSaving(false);
    }
  }

  async function createNode() {
    const trimmedTitle = newNodeForm.title.trim();
    const trimmedVideoUrl = newNodeForm.videoUrl.trim();
    const trimmedCode = newNodeForm.code.trim() || buildNodeCode(trimmedTitle);

    if (!trimmedTitle) {
      setStatus(null);
      setError("请先填写节点标题");
      return;
    }

    if (!trimmedVideoUrl) {
      setStatus(null);
      setError("请先填写媒体地址");
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>("/api/admin/nodes", {
        method: "POST",
        body: JSON.stringify({
          ...newNodeForm,
          code: trimmedCode,
          title: trimmedTitle,
          videoUrl: trimmedVideoUrl,
          description: "",
          transcript: "",
        }),
      });

      syncFromGame(payload.game, payload.node.code);
      setNewNodeForm({
        code: "",
        title: "",
        nodeType: "video",
        videoUrl: defaultVideoUrl,
      });
      setStatus(hasNodes ? `已创建节点：${payload.node.title}` : `已创建首个节点：${payload.node.title}`);
    } catch (saveError) {
      setError(loadErrorMessage(saveError, "创建节点失败"));
    } finally {
      setSaving(false);
    }
  }

  async function saveNode() {
    if (!draftNode || !selectedNodeCode) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame; node: StoryNode }>(
        `/api/admin/nodes/${selectedNodeCode}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...draftNode,
            autoNextNodeCode: draftNode.autoNextNodeCode || null,
          }),
        },
      );

      syncFromGame(payload.game, payload.node.code);
      setStatus(`已保存节点：${payload.node.title}`);
    } catch (saveError) {
      setError(loadErrorMessage(saveError, "保存节点失败"));
    } finally {
      setSaving(false);
    }
  }

  async function addChoice() {
    if (!selectedNodeCode) {
      return;
    }

    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const payload = await requestAdmin<{ game: StoryGame }>(
        `/api/admin/nodes/${selectedNodeCode}/choices`,
        {
          method: "POST",
          body: JSON.stringify(newChoiceForm),
        },
      );

      syncFromGame(payload.game, selectedNodeCode);
      setNewChoiceForm({
        code: "",
        label: "",
        hint: "",
        targetNodeCode: payload.game.nodes[0]?.code ?? "",
      });
      setStatus("已新增分支选项");
    } catch (saveError) {
      setError(loadErrorMessage(saveError, "新增分支选项失败"));
    } finally {
      setSaving(false);
    }
  }

  const selectedNode = game.nodes.find((node) => node.code === selectedNodeCode) ?? null;

  const publishSummary = useMemo(() => {
    const missingVideo = game.nodes.filter((node) => !node.videoUrl.trim()).length;
    const noLinkNodes = game.nodes.filter((node) => {
      if (node.isEnding) {
        return false;
      }

      const hasChoices = Boolean(node.choices?.length);
      const hasAutoNext = Boolean(node.autoNextNodeCode);
      return !hasChoices && !hasAutoNext;
    }).length;

    const unreachableChoices = game.nodes.flatMap((node) => node.choices ?? []).filter((choice) => {
      return !game.nodes.some((target) => target.code === choice.targetNodeCode);
    }).length;

    return {
      totalNodes: game.nodes.length,
      totalChoices: game.nodes.reduce((count, node) => count + (node.choices?.length ?? 0), 0),
      missingVideo,
      noLinkNodes,
      unreachableChoices,
      ready:
        game.nodes.length > 0 &&
        Boolean(game.startNodeCode) &&
        missingVideo === 0 &&
        noLinkNodes === 0 &&
        unreachableChoices === 0,
    };
  }, [game]);

  const className = inputClassName();

  return (
    <main className="min-h-screen bg-[#f4ede2] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1640px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-stone-900/10 bg-[linear-gradient(135deg,_rgba(255,255,255,0.92)_0%,_rgba(245,237,226,0.95)_100%)] p-6 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs uppercase tracking-[0.45em] text-amber-700/80">Project Builder</p>
              <h1 className="mt-3 font-serif text-4xl text-stone-950">互动项目后台</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
                先配置项目基础信息和宣传页，再创建首个节点，最后逐步扩展剧情结构和分支关系。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full border border-stone-900/15 px-4 py-2 text-sm text-stone-800 transition hover:bg-stone-900 hover:text-white"
              >
                打开试玩页
              </Link>
              <button
                type="button"
                className="rounded-full border border-amber-700/20 px-4 py-2 text-sm text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                onClick={() => void resetToBlankProject()}
                disabled={loading || saving}
              >
                重置为空项目
              </button>
              <button
                type="button"
                className="rounded-full border border-stone-900/15 px-4 py-2 text-sm text-stone-800 transition hover:bg-stone-900 hover:text-white disabled:opacity-50"
                onClick={() => void loadGame(selectedNodeCode)}
                disabled={loading || saving}
              >
                刷新数据
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-stone-900/10 bg-white/80 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-stone-500">项目名称</div>
              <div className="mt-2 font-serif text-2xl text-stone-950">{game.title}</div>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/80 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-stone-500">节点总数</div>
              <div className="mt-2 text-2xl text-stone-950">{publishSummary.totalNodes}</div>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/80 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-stone-500">分支总数</div>
              <div className="mt-2 text-2xl text-stone-950">{publishSummary.totalChoices}</div>
            </div>
            <div className="rounded-3xl border border-stone-900/10 bg-white/80 p-4">
              <div className="text-xs uppercase tracking-[0.28em] text-stone-500">当前阶段</div>
              <div className="mt-2 text-lg text-stone-950">
                {!hasNodes ? "初始化项目" : projectReadyForTree ? "编辑剧情结构" : "补全起始节点"}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="grid gap-5">
            <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">1. 项目基础信息</p>
                <p className="mt-2 text-sm text-stone-700">这里配置项目名称、摘要、导语和起始节点。</p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Field label="项目名称">
                  <input
                    className={className}
                    value={gameForm.title}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </Field>

                <Field label="项目摘要">
                  <input
                    className={className}
                    value={gameForm.tagline}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, tagline: event.target.value }))
                    }
                  />
                </Field>

                <Field label="项目说明" hint="适合填写世界观、玩法说明、导语等。">
                  <textarea
                    className={`${className} min-h-36 resize-y`}
                    value={gameForm.intro}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, intro: event.target.value }))
                    }
                  />
                </Field>

                {hasNodes ? (
                  <Field label="起始节点">
                    <select
                      className={className}
                      value={gameForm.startNodeCode}
                      onChange={(event) =>
                        setGameForm((current) => ({ ...current, startNodeCode: event.target.value }))
                      }
                    >
                      <option value="">请选择起始节点</option>
                      {game.nodes.map((node) => (
                        <option key={node.code} value={node.code}>
                          {getNodeDisplayName(game, node.code)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-5 text-sm leading-7 text-stone-600">
                    当前还没有节点。创建首个节点后，系统会自动把它设为起始节点。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">2. 宣传页配置</p>
                <p className="mt-2 text-sm text-stone-700">
                  用户在进入序章之前，会先看到这一页。现在先支持宣传视频、封面和文案。
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Field label="宣传视频地址" hint="进入剧情前的宣传片、CG 预告或封面视频。">
                  <input
                    className={className}
                    value={gameForm.promoVideoUrl}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoVideoUrl: event.target.value }))
                    }
                    placeholder="https://example.com/promo.mp4"
                  />
                </Field>

                <Field label="宣传封面地址" hint="可选。后续如果宣传视频没加载出来，会优先用这个做封面。">
                  <input
                    className={className}
                    value={gameForm.promoPosterUrl}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoPosterUrl: event.target.value }))
                    }
                    placeholder="https://example.com/poster.jpg"
                  />
                </Field>

                <Field label="宣传页标题">
                  <input
                    className={className}
                    value={gameForm.promoTitle}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoTitle: event.target.value }))
                    }
                    placeholder="例如：宣传片 / 作品先导片"
                  />
                </Field>

                <Field label="宣传页说明" hint="适合写宣传文案、进入剧情前的引导和说明。">
                  <textarea
                    className={`${className} min-h-32 resize-y`}
                    value={gameForm.promoText}
                    onChange={(event) =>
                      setGameForm((current) => ({ ...current, promoText: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <button
                type="button"
                className="mt-5 rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                onClick={() => void saveGameSettings()}
                disabled={saving}
              >
                保存项目与宣传页配置
              </button>
            </section>
          </section>

          <section className="rounded-[2rem] border border-stone-900/10 bg-stone-950 p-5 text-white shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-400">
                {hasNodes ? "3. 新建节点" : "3. 创建首个节点"}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-300">
                {!hasNodes
                  ? "项目配置完成后，建议先创建首个节点。系统会自动把它设为起始节点。"
                  : "继续创建新节点，逐步扩展剧情结构。"}
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="节点标题">
                <input
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                  value={newNodeForm.title}
                  onChange={(event) =>
                    setNewNodeForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder={hasNodes ? "例如：线索节点" : "例如：开场节点"}
                />
              </Field>

              <Field label="节点编号" hint="可选，不填时会自动生成。">
                <input
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                  value={newNodeForm.code}
                  onChange={(event) =>
                    setNewNodeForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="例如：opening_scene"
                />
              </Field>

              <Field label="节点类型">
                <select
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                  value={newNodeForm.nodeType}
                  onChange={(event) =>
                    setNewNodeForm((current) => ({
                      ...current,
                      nodeType: event.target.value as "video" | "ending",
                    }))
                  }
                >
                  <option value="video">普通节点</option>
                  <option value="ending">结局节点</option>
                </select>
              </Field>

              <Field label="媒体地址">
                <input
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                  value={newNodeForm.videoUrl}
                  onChange={(event) =>
                    setNewNodeForm((current) => ({ ...current, videoUrl: event.target.value }))
                  }
                />
              </Field>

              <button
                type="button"
                className="rounded-full bg-white px-4 py-3 text-sm text-stone-950 transition hover:bg-stone-200 disabled:opacity-50"
                onClick={() => void createNode()}
                disabled={saving}
              >
                {hasNodes ? "创建新节点" : "创建首个节点"}
              </button>
            </div>
          </section>
        </section>

        {!projectReadyForTree ? (
          <section className="mt-5 rounded-[2rem] border border-dashed border-stone-900/15 bg-white/70 p-8 text-center shadow-[0_24px_80px_rgba(52,38,25,0.06)]">
            <p className="text-xs uppercase tracking-[0.45em] text-stone-500">Next Step</p>
            <h2 className="mt-3 font-serif text-3xl text-stone-950">先完成项目初始化</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              先保存项目基础信息和宣传页配置，再创建首个节点。完成后，剧情树和分支编辑区域才会出现。
            </p>
          </section>
        ) : (
          <>
            <section className="mt-5 rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-stone-500">4. 剧情结构图</p>
                  <p className="mt-2 text-sm text-stone-700">
                    这里只显示节点和分支关系，用于快速定位剧情结构。
                  </p>
                </div>
                <div className="text-sm text-stone-500">
                  当前起始节点：{getNodeDisplayName(game, game.startNodeCode)}
                </div>
              </div>

              <div className="mt-5">
                <BranchGraph
                  game={game}
                  selectedNodeCode={selectedNodeCode}
                  onSelectNode={handleSelectNode}
                />
              </div>
            </section>

            <section className="mt-5 grid flex-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
              <aside className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-stone-500">节点目录</p>
                  <p className="mt-2 text-sm text-stone-700">左侧是当前项目的全部节点。</p>
                </div>

                <div className="mt-4 grid gap-2">
                  {game.nodes.map((node) => (
                    <button
                      key={node.code}
                      type="button"
                      className={`rounded-3xl border px-4 py-3 text-left transition ${
                        selectedNodeCode === node.code
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-900/10 bg-white/85 text-stone-800 hover:border-stone-900/25"
                      }`}
                      onClick={() => handleSelectNode(node.code)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{node.title}</div>
                        <div className="rounded-full border border-current/15 px-2 py-1 text-[10px] uppercase tracking-[0.2em] opacity-75">
                          {nodeTypeLabel[node.nodeType]}
                        </div>
                      </div>
                      <div className="mt-2 text-xs opacity-70">{node.code}</div>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="grid gap-5">
                <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-stone-500">5. 节点内容</p>
                    <p className="mt-2 text-sm text-stone-700">这里编辑节点标题、文本、媒体和流转方式。</p>
                  </div>

                  {draftNode && selectedNode ? (
                    <div className="mt-5 grid gap-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="节点标题">
                          <input
                            className={className}
                            value={draftNode.title}
                            onChange={(event) =>
                              setDraftNode((current) =>
                                current ? { ...current, title: event.target.value } : current,
                              )
                            }
                          />
                        </Field>

                        <Field label="节点类型">
                          <select
                            className={className}
                            value={draftNode.nodeType}
                            onChange={(event) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      nodeType: event.target.value as "video" | "ending",
                                    }
                                  : current,
                              )
                            }
                          >
                            <option value="video">普通节点</option>
                            <option value="ending">结局节点</option>
                          </select>
                        </Field>
                      </div>

                      <Field label="节点摘要">
                        <input
                          className={className}
                          value={draftNode.description}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, description: event.target.value } : current,
                            )
                          }
                        />
                      </Field>

                      <Field label="节点文本">
                        <textarea
                          className={`${className} min-h-36 resize-y`}
                          value={draftNode.transcript}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, transcript: event.target.value } : current,
                            )
                          }
                        />
                      </Field>

                      <Field label="媒体地址">
                        <input
                          className={className}
                          value={draftNode.videoUrl}
                          onChange={(event) =>
                            setDraftNode((current) =>
                              current ? { ...current, videoUrl: event.target.value } : current,
                            )
                          }
                        />
                      </Field>

                      {draftNode.nodeType === "ending" ? (
                        <Field label="结局类型">
                          <select
                            className={className}
                            value={draftNode.endingTone}
                            onChange={(event) =>
                              setDraftNode((current) =>
                                current
                                  ? {
                                      ...current,
                                      endingTone: event.target.value as EndingTone,
                                      autoNextNodeCode: "",
                                    }
                                  : current,
                              )
                            }
                          >
                            <option value="truth">真相结局</option>
                            <option value="survival">生还结局</option>
                            <option value="tragedy">悲剧结局</option>
                          </select>
                        </Field>
                      ) : (
                        <Field label="自动流转到">
                          <select
                            className={className}
                            value={draftNode.autoNextNodeCode}
                            onChange={(event) =>
                              setDraftNode((current) =>
                                current ? { ...current, autoNextNodeCode: event.target.value } : current,
                              )
                            }
                          >
                            <option value="">不自动流转</option>
                            {game.nodes
                              .filter((node) => node.code !== selectedNode.code)
                              .map((node) => (
                                <option key={node.code} value={node.code}>
                                  {getNodeDisplayName(game, node.code)}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}

                      <button
                        type="button"
                        className="rounded-full bg-stone-950 px-4 py-3 text-sm text-white transition hover:bg-stone-800 disabled:opacity-50"
                        onClick={() => void saveNode()}
                        disabled={saving}
                      >
                        保存当前节点
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-stone-600">请先在左侧选择一个节点。</p>
                  )}
                </section>

                <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-stone-500">6. 用户选择</p>
                    <p className="mt-2 text-sm text-stone-700">这里维护选项文案和跳转目标。</p>
                  </div>

                  {draftNode ? (
                    <div className="mt-5 grid gap-4">
                      {draftNode.choices.length ? (
                        draftNode.choices.map((choice, index) => (
                          <div
                            key={`${choice.code}-${index}`}
                            className="rounded-3xl border border-stone-900/10 bg-white p-4"
                          >
                            <div className="grid gap-4 lg:grid-cols-2">
                              <Field label="选项文案">
                                <input
                                  className={className}
                                  value={choice.label}
                                  onChange={(event) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            choices: current.choices.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? { ...entry, label: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                />
                              </Field>

                              <Field label="选项编号">
                                <input
                                  className={className}
                                  value={choice.code}
                                  onChange={(event) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            choices: current.choices.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? { ...entry, code: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                />
                              </Field>

                              <Field label="补充说明">
                                <input
                                  className={className}
                                  value={choice.hint}
                                  onChange={(event) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            choices: current.choices.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? { ...entry, hint: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                />
                              </Field>

                              <Field label="目标节点">
                                <select
                                  className={className}
                                  value={choice.targetNodeCode}
                                  onChange={(event) =>
                                    setDraftNode((current) =>
                                      current
                                        ? {
                                            ...current,
                                            choices: current.choices.map((entry, entryIndex) =>
                                              entryIndex === index
                                                ? {
                                                    ...entry,
                                                    targetNodeCode: event.target.value,
                                                  }
                                                : entry,
                                            ),
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  {game.nodes.map((node) => (
                                    <option key={node.code} value={node.code}>
                                      {getNodeDisplayName(game, node.code)}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-3xl border border-dashed border-stone-900/15 px-4 py-6 text-sm leading-7 text-stone-600">
                          当前节点还没有选项。如果它不是自动流转节点，可以在下面新增分支。
                        </div>
                      )}

                      <div className="rounded-3xl border border-stone-900/10 bg-stone-950 p-4 text-white">
                        <div className="text-sm font-medium">新增一个分支选项</div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <Field label="选项文案">
                            <input
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                              value={newChoiceForm.label}
                              onChange={(event) =>
                                setNewChoiceForm((current) => ({ ...current, label: event.target.value }))
                              }
                              placeholder="例如：进入下一步"
                            />
                          </Field>

                          <Field label="选项编号">
                            <input
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                              value={newChoiceForm.code}
                              onChange={(event) =>
                                setNewChoiceForm((current) => ({ ...current, code: event.target.value }))
                              }
                              placeholder="例如：go_next"
                            />
                          </Field>

                          <Field label="补充说明">
                            <input
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                              value={newChoiceForm.hint}
                              onChange={(event) =>
                                setNewChoiceForm((current) => ({ ...current, hint: event.target.value }))
                              }
                              placeholder="例如：执行更保守的方案"
                            />
                          </Field>

                          <Field label="跳转到哪个节点">
                            <select
                              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none"
                              value={newChoiceForm.targetNodeCode}
                              onChange={(event) =>
                                setNewChoiceForm((current) => ({
                                  ...current,
                                  targetNodeCode: event.target.value,
                                }))
                              }
                            >
                              <option value="">请选择目标节点</option>
                              {game.nodes.map((node) => (
                                <option key={node.code} value={node.code}>
                                  {getNodeDisplayName(game, node.code)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <button
                          type="button"
                          className="mt-4 rounded-full bg-white px-4 py-3 text-sm text-stone-950 transition hover:bg-stone-200 disabled:opacity-50"
                          onClick={() => void addChoice()}
                          disabled={saving || !selectedNodeCode}
                        >
                          添加这个分支选项
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-stone-600">请先选择一个节点，再配置分支。</p>
                  )}
                </section>
              </div>

              <aside className="grid gap-5">
                <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-stone-500">当前节点概览</p>
                    <p className="mt-2 text-sm text-stone-700">右侧只显示当前选中节点的关键信息。</p>
                  </div>

                  {selectedNode ? (
                    <div className="mt-4 grid gap-4">
                      <div className="rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(139,69,19,0.18),_transparent_40%),linear-gradient(180deg,_#20140f_0%,_#0d0b0a_100%)] p-5 text-stone-100">
                        <div className="text-xs uppercase tracking-[0.35em] text-amber-200/65">
                          {nodeTypeLabel[selectedNode.nodeType]}
                        </div>
                        <h2 className="mt-2 font-serif text-3xl">{selectedNode.title}</h2>
                        <p className="mt-3 text-sm leading-7 text-stone-300">
                          {selectedNode.description || "这个节点还没有填写摘要。"}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-stone-900/10 bg-white p-4 text-sm text-stone-700">
                        <div className="text-stone-500">节点编号</div>
                        <div className="mt-1">{selectedNode.code}</div>

                        <div className="mt-4 text-stone-500">媒体地址</div>
                        <div className="mt-1 break-all">{selectedNode.videoUrl}</div>

                        <div className="mt-4 text-stone-500">流转结果</div>
                        <div className="mt-1">
                          {selectedNode.choices?.length
                            ? `显示 ${selectedNode.choices.length} 个用户选项`
                            : selectedNode.autoNextNodeCode
                              ? `自动进入 ${getNodeDisplayName(game, selectedNode.autoNextNodeCode)}`
                              : selectedNode.isEnding
                                ? `结束于 ${endingToneLabel[selectedNode.endingTone ?? "truth"]}`
                                : "尚未配置后续流转"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-stone-600">未选择节点。</p>
                  )}
                </section>

                <section className="rounded-[2rem] border border-stone-900/10 bg-white/75 p-5 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-stone-500">7. 发布检查</p>
                    <p className="mt-2 text-sm text-stone-700">在进入正式测试前，先检查结构和资源是否存在明显缺项。</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm leading-7 text-stone-700">
                    <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                      <div className="text-stone-500">缺少媒体的节点</div>
                      <div className="mt-1 text-lg text-stone-950">{publishSummary.missingVideo}</div>
                    </div>
                    <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                      <div className="text-stone-500">没有后续流转的非结局节点</div>
                      <div className="mt-1 text-lg text-stone-950">{publishSummary.noLinkNodes}</div>
                    </div>
                    <div className="rounded-3xl border border-stone-900/10 bg-white p-4">
                      <div className="text-stone-500">目标不存在的选项</div>
                      <div className="mt-1 text-lg text-stone-950">
                        {publishSummary.unreachableChoices}
                      </div>
                    </div>
                  </div>
                </section>
              </aside>
            </section>
          </>
        )}

        {(loading || saving || status || error) && (
          <section className="mt-5 rounded-[2rem] border border-stone-900/10 bg-stone-950 p-5 text-sm text-stone-200 shadow-[0_24px_80px_rgba(52,38,25,0.08)]">
            {loading && <p>正在加载后台数据...</p>}
            {!loading && saving && <p>正在保存你的修改...</p>}
            {status && <p className="text-emerald-300">{status}</p>}
            {error && <p className="text-rose-300">{error}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
