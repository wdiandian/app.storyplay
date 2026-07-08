import type { ChangeEvent, ReactNode } from "react";
import { edgeTypeName, endingToneName, nodeTypeName } from "@/components/node-graph-editor/config";
import type {
  AssetNodeData,
  ChoiceNodeData,
  ConditionNodeData,
  EndingNodeData,
  GraphDocument,
  GraphEdge,
  GraphNode,
  GraphNodeData,
  GraphValidationIssue,
  OptionNodeData,
  RecordNodeData,
  SceneNodeData,
  SetVariableNodeData,
  StartNodeData,
  TimelineNodeData,
} from "@/lib/node-graph";
import type {
  ConditionOperator,
  EndingTone,
  VariableActionType,
  VariableRuntimeValue,
} from "@/lib/story-engine";

type UploadPayload = {
  url: string;
  filename: string;
  size: number;
  contentType: string | null;
};

type NodeGraphInspectorProps = {
  graph: GraphDocument;
  issues: GraphValidationIssue[];
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  nodesById: Map<string, GraphNode>;
  uploading: boolean;
  onUpdateGraph: (updater: (current: GraphDocument) => GraphDocument) => void;
  onUpdateSelectedNodeData: <T extends GraphNodeData>(patch: Partial<T>, title?: string) => void;
  onDeleteSelectedNode: () => void;
  onDeleteSelectedEdge: () => void;
  onSelectIssue: (issue: GraphValidationIssue) => void;
  onUploadAsset: (
    event: ChangeEvent<HTMLInputElement>,
    folder: string,
    applyUrl: (url: string, payload: UploadPayload) => void,
  ) => void;
};

function inputClassName() {
  return "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-amber-500";
}

function textareaClassName() {
  return "w-full min-h-24 resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm leading-6 text-stone-950 outline-none transition focus:border-amber-500";
}

function selectClassName() {
  return "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-amber-500";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-700">{label}</span>
      {hint ? <span className="ml-2 text-xs text-stone-500">{hint}</span> : null}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function ValidationPanel({
  graph,
  issues,
  nodesById,
  onSelectIssue,
}: {
  graph: GraphDocument;
  issues: GraphValidationIssue[];
  nodesById: Map<string, GraphNode>;
  onSelectIssue: (issue: GraphValidationIssue) => void;
}) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return (
    <div className="rounded-lg border border-stone-300 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-stone-950">发布检查</div>
          <div className="mt-1 text-xs text-stone-500">保存会先把画布编译成可游玩的作品数据。</div>
        </div>
        <div className="shrink-0 rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
          {errorCount} 错误 / {warningCount} 提醒
        </div>
      </div>

      {issues.length ? (
        <div className="mt-3 grid gap-2">
          {issues.map((issue, index) => {
            const node = issue.nodeId ? nodesById.get(issue.nodeId) : null;
            const edge = issue.edgeId ? graph.edges.find((entry) => entry.id === issue.edgeId) : null;
            const edgeLabel = edge ? edgeTypeName[edge.type] : null;
            const targetLabel = node ? `${nodeTypeName[node.type]} / ${node.title}` : edgeLabel ? `连线 / ${edgeLabel}` : "全局";
            const toneClass =
              issue.severity === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800";

            return (
              <button
                key={`${issue.id}:${index}`}
                type="button"
                className={`rounded-lg border px-3 py-2 text-left text-sm transition hover:border-stone-500 ${toneClass}`}
                onClick={() => onSelectIssue(issue)}
              >
                <div className="text-xs opacity-70">{targetLabel}</div>
                <div className="mt-1">{issue.message}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          当前画布可以编译并保存。
        </div>
      )}
    </div>
  );
}

const conditionOperators: Array<{ value: ConditionOperator; label: string }> = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "includes", label: "包含标签" },
  { value: "not_includes", label: "不包含标签" },
];

const variableActionTypes: Array<{ value: VariableActionType; label: string }> = [
  { value: "set", label: "设为" },
  { value: "increment", label: "增加" },
  { value: "toggle", label: "切换布尔值" },
  { value: "append_tag", label: "追加标签" },
];

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseRuntimeValue(value: string): VariableRuntimeValue {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed && Number.isFinite(Number(trimmed))) return Number(trimmed);

  return value;
}

export function NodeGraphInspector({
  graph,
  issues,
  selectedNode,
  selectedEdge,
  nodesById,
  uploading,
  onUpdateGraph,
  onUpdateSelectedNodeData,
  onDeleteSelectedNode,
  onDeleteSelectedEdge,
  onSelectIssue,
  onUploadAsset,
}: NodeGraphInspectorProps) {
  function renderGraphInspector() {
    return (
      <div className="grid gap-4">
        <div>
          <div className="text-xs text-stone-500">项目入口</div>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">{graph.meta.title || "未命名项目"}</h2>
        </div>
        <Field label="作品标题">
          <input
            className={inputClassName()}
            value={graph.meta.title}
            onChange={(event) =>
              onUpdateGraph((current) => ({
                ...current,
                title: event.target.value,
                meta: { ...current.meta, title: event.target.value },
              }))
            }
          />
        </Field>
        <Field label="一句话介绍">
          <input
            className={inputClassName()}
            value={graph.meta.tagline}
            onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, tagline: event.target.value } }))}
          />
        </Field>
        <Field label="首页简介">
          <textarea
            className={textareaClassName()}
            value={graph.meta.intro}
            onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, intro: event.target.value } }))}
          />
        </Field>
        <Field label="宣传文案">
          <textarea
            className={textareaClassName()}
            value={graph.meta.promoText}
            onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, promoText: event.target.value } }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="封面图">
            <input
              className={inputClassName()}
              value={graph.meta.promoPosterUrl}
              onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, promoPosterUrl: event.target.value } }))}
            />
          </Field>
          <Field label="预告视频">
            <input
              className={inputClassName()}
              value={graph.meta.promoVideoUrl}
              onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, promoVideoUrl: event.target.value } }))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={graph.meta.listedOnHome}
              onChange={(event) => onUpdateGraph((current) => ({ ...current, meta: { ...current.meta, listedOnHome: event.target.checked } }))}
            />
            首页展示
          </label>
          <Field label="首页排序">
            <input
              className={inputClassName()}
              type="number"
              value={graph.meta.sortOrder}
              onChange={(event) =>
                onUpdateGraph((current) => ({
                  ...current,
                  meta: { ...current.meta, sortOrder: Number(event.target.value || 0) },
                }))
              }
            />
          </Field>
        </div>
        <div className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm leading-6 text-stone-600">
          入口节点由“开始”节点的输出端口决定。把“开始 / 进入”连接到任意场景或结局，即可改变玩家进入作品后的第一幕。
        </div>
        <ValidationPanel graph={graph} issues={issues} nodesById={nodesById} onSelectIssue={onSelectIssue} />
      </div>
    );
  }

  function renderNodeFields(node: GraphNode) {
    if (node.type === "start") {
      const data = node.data as StartNodeData;
      return (
        <>
          <Field label="标题">
            <input className={inputClassName()} value={data.title} onChange={(event) => onUpdateSelectedNodeData<StartNodeData>({ title: event.target.value }, event.target.value)} />
          </Field>
          <Field label="开场备注">
            <textarea className={textareaClassName()} value={data.intro ?? ""} onChange={(event) => onUpdateSelectedNodeData<StartNodeData>({ intro: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "scene") {
      const data = node.data as SceneNodeData;
      return (
        <>
          <Field label="场景编号">
            <input className={inputClassName()} value={data.sceneCode} onChange={(event) => onUpdateSelectedNodeData<SceneNodeData>({ sceneCode: event.target.value })} />
          </Field>
          <Field label="标题">
            <input className={inputClassName()} value={data.title} onChange={(event) => onUpdateSelectedNodeData<SceneNodeData>({ title: event.target.value }, event.target.value)} />
          </Field>
          <Field label="场景描述">
            <textarea className={textareaClassName()} value={data.description ?? ""} onChange={(event) => onUpdateSelectedNodeData<SceneNodeData>({ description: event.target.value })} />
          </Field>
          <Field label="字幕 / 正文">
            <textarea className={textareaClassName()} value={data.transcript ?? ""} onChange={(event) => onUpdateSelectedNodeData<SceneNodeData>({ transcript: event.target.value })} />
          </Field>
          <Field label="视频地址">
            <input className={inputClassName()} value={data.videoUrl ?? ""} onChange={(event) => onUpdateSelectedNodeData<SceneNodeData>({ videoUrl: event.target.value })} />
          </Field>
          <label className="inline-flex cursor-pointer justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 transition hover:border-stone-500">
            {uploading ? "上传中..." : "上传视频"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => onUploadAsset(event, "videos", (url) => onUpdateSelectedNodeData<SceneNodeData>({ videoUrl: url }))}
            />
          </label>
        </>
      );
    }

    if (node.type === "ending") {
      const data = node.data as EndingNodeData;
      return (
        <>
          <Field label="结局编号">
            <input className={inputClassName()} value={data.code} onChange={(event) => onUpdateSelectedNodeData<EndingNodeData>({ code: event.target.value })} />
          </Field>
          <Field label="标题">
            <input className={inputClassName()} value={data.title} onChange={(event) => onUpdateSelectedNodeData<EndingNodeData>({ title: event.target.value }, event.target.value)} />
          </Field>
          <Field label="结局类型">
            <select className={selectClassName()} value={data.endingTone} onChange={(event) => onUpdateSelectedNodeData<EndingNodeData>({ endingTone: event.target.value as EndingTone })}>
              {Object.entries(endingToneName).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="结局描述">
            <textarea className={textareaClassName()} value={data.description ?? ""} onChange={(event) => onUpdateSelectedNodeData<EndingNodeData>({ description: event.target.value })} />
          </Field>
          <Field label="结局视频">
            <input className={inputClassName()} value={data.videoUrl ?? ""} onChange={(event) => onUpdateSelectedNodeData<EndingNodeData>({ videoUrl: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "choice") {
      const data = node.data as ChoiceNodeData;
      return (
        <>
          <Field label="选择组标题">
            <input className={inputClassName()} value={data.title ?? ""} onChange={(event) => onUpdateSelectedNodeData<ChoiceNodeData>({ title: event.target.value }, event.target.value)} />
          </Field>
          <Field label="提示文案">
            <textarea className={textareaClassName()} value={data.prompt ?? ""} onChange={(event) => onUpdateSelectedNodeData<ChoiceNodeData>({ prompt: event.target.value })} />
          </Field>
          <Field label="展示方式">
            <select className={selectClassName()} value={data.displayMode ?? "overlay"} onChange={(event) => onUpdateSelectedNodeData<ChoiceNodeData>({ displayMode: event.target.value as ChoiceNodeData["displayMode"] })}>
              <option value="overlay">视频浮层</option>
              <option value="bottom_sheet">底部面板</option>
              <option value="full_screen">全屏选择</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800">
            <input type="checkbox" checked={data.pausePlayback ?? true} onChange={(event) => onUpdateSelectedNodeData<ChoiceNodeData>({ pausePlayback: event.target.checked })} />
            出现选择时暂停播放
          </label>
        </>
      );
    }

    if (node.type === "option") {
      const data = node.data as OptionNodeData;
      return (
        <>
          <Field label="选项编号">
            <input className={inputClassName()} value={data.code} onChange={(event) => onUpdateSelectedNodeData<OptionNodeData>({ code: event.target.value })} />
          </Field>
          <Field label="玩家看到的文案">
            <input className={inputClassName()} value={data.label} onChange={(event) => onUpdateSelectedNodeData<OptionNodeData>({ label: event.target.value }, event.target.value)} />
          </Field>
          <Field label="选项提示">
            <textarea className={textareaClassName()} value={data.hint ?? ""} onChange={(event) => onUpdateSelectedNodeData<OptionNodeData>({ hint: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "record") {
      const data = node.data as RecordNodeData;
      return (
        <>
          <Field label="记录类型">
            <select className={selectClassName()} value={data.recordType} onChange={(event) => onUpdateSelectedNodeData<RecordNodeData>({ recordType: event.target.value as RecordNodeData["recordType"] })}>
              <option value="memory">回忆</option>
              <option value="clue">线索</option>
              <option value="echo">回响</option>
            </select>
          </Field>
          <Field label="标题">
            <input className={inputClassName()} value={data.title} onChange={(event) => onUpdateSelectedNodeData<RecordNodeData>({ title: event.target.value }, event.target.value)} />
          </Field>
          <Field label="内容">
            <textarea className={textareaClassName()} value={data.body} onChange={(event) => onUpdateSelectedNodeData<RecordNodeData>({ body: event.target.value })} />
          </Field>
          <Field label="未解锁文案">
            <input className={inputClassName()} value={data.lockedLabel ?? ""} onChange={(event) => onUpdateSelectedNodeData<RecordNodeData>({ lockedLabel: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "asset") {
      const data = node.data as AssetNodeData;
      return (
        <>
          <Field label="素材类型">
            <select className={selectClassName()} value={data.assetType} onChange={(event) => onUpdateSelectedNodeData<AssetNodeData>({ assetType: event.target.value as AssetNodeData["assetType"] })}>
              <option value="video">视频</option>
              <option value="image">图片</option>
              <option value="audio">音频</option>
              <option value="subtitle">字幕</option>
            </select>
          </Field>
          <Field label="素材地址">
            <input className={inputClassName()} value={data.url} onChange={(event) => onUpdateSelectedNodeData<AssetNodeData>({ url: event.target.value })} />
          </Field>
          <label className="inline-flex cursor-pointer justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 transition hover:border-stone-500">
            {uploading ? "上传中..." : "上传素材"}
            <input
              type="file"
              className="hidden"
              onChange={(event) =>
                onUploadAsset(event, data.assetType === "image" ? "images" : data.assetType === "audio" ? "audio" : "videos", (url, payload) =>
                  onUpdateSelectedNodeData<AssetNodeData>({ url, filename: payload.filename }),
                )
              }
            />
          </label>
          <Field label="文件名">
            <input className={inputClassName()} value={data.filename ?? ""} onChange={(event) => onUpdateSelectedNodeData<AssetNodeData>({ filename: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "timeline") {
      const data = node.data as TimelineNodeData;
      return (
        <>
          <Field label="触发时间毫秒">
            <input className={inputClassName()} type="number" value={data.atMs} onChange={(event) => onUpdateSelectedNodeData<TimelineNodeData>({ atMs: Number(event.target.value || 0) })} />
          </Field>
          <Field label="事件类型">
            <select className={selectClassName()} value={data.eventType} onChange={(event) => onUpdateSelectedNodeData<TimelineNodeData>({ eventType: event.target.value as TimelineNodeData["eventType"] })}>
              <option value="text">文字</option>
              <option value="overlay">浮层</option>
              <option value="pause">暂停</option>
              <option value="choice">选择</option>
              <option value="unlock_record">解锁记录</option>
              <option value="jump">跳转</option>
              <option value="actions">变量动作</option>
            </select>
          </Field>
          <Field label="事件文本">
            <textarea className={textareaClassName()} value={data.text ?? ""} onChange={(event) => onUpdateSelectedNodeData<TimelineNodeData>({ text: event.target.value })} />
          </Field>
        </>
      );
    }

    if (node.type === "condition") {
      const data = node.data as ConditionNodeData;
      return (
        <>
          <Field label="匹配方式" hint="当前发布编译优先支持“全部条件成立”">
            <select className={selectClassName()} value={data.matchMode} onChange={(event) => onUpdateSelectedNodeData<ConditionNodeData>({ matchMode: event.target.value as ConditionNodeData["matchMode"] })}>
              <option value="all">全部条件成立</option>
              <option value="any">任一条件成立</option>
            </select>
          </Field>
          <div className="rounded-lg border border-stone-300 bg-stone-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-stone-950">条件</div>
              <button
                type="button"
                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 transition hover:border-stone-500"
                onClick={() =>
                  onUpdateSelectedNodeData<ConditionNodeData>({
                    conditions: [
                      ...data.conditions,
                      { id: createId("condition"), variableKey: "", operator: "eq", value: "" },
                    ],
                  })
                }
              >
                添加
              </button>
            </div>
            <div className="mt-3 grid gap-3">
              {data.conditions.length ? (
                data.conditions.map((condition, index) => (
                  <div key={condition.id} className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3">
                    <input
                      className={inputClassName()}
                      placeholder="变量 key"
                      value={condition.variableKey}
                      onChange={(event) =>
                        onUpdateSelectedNodeData<ConditionNodeData>({
                          conditions: data.conditions.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, variableKey: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                    <select
                      className={selectClassName()}
                      value={condition.operator}
                      onChange={(event) =>
                        onUpdateSelectedNodeData<ConditionNodeData>({
                          conditions: data.conditions.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, operator: event.target.value as ConditionOperator } : entry,
                          ),
                        })
                      }
                    >
                      {conditionOperators.map((operator) => (
                        <option key={operator.value} value={operator.value}>{operator.label}</option>
                      ))}
                    </select>
                    <input
                      className={inputClassName()}
                      placeholder="比较值"
                      value={String(condition.value)}
                      onChange={(event) =>
                        onUpdateSelectedNodeData<ConditionNodeData>({
                          conditions: data.conditions.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value: parseRuntimeValue(event.target.value) } : entry,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="justify-self-start rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-50"
                      onClick={() =>
                        onUpdateSelectedNodeData<ConditionNodeData>({
                          conditions: data.conditions.filter((_, entryIndex) => entryIndex !== index),
                        })
                      }
                    >
                      删除条件
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
                  暂无条件。连接到 true 出口时，条件会编译到玩家选项的可用规则。
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    const data = node.data as SetVariableNodeData;
    return (
      <div className="rounded-lg border border-stone-300 bg-stone-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-stone-950">变量动作</div>
          <button
            type="button"
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 transition hover:border-stone-500"
            onClick={() =>
              onUpdateSelectedNodeData<SetVariableNodeData>({
                actions: [
                  ...data.actions,
                  { id: createId("action"), variableKey: "", type: "set", value: "" },
                ],
              })
            }
          >
            添加
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          {data.actions.length ? (
            data.actions.map((action, index) => (
              <div key={action.id} className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3">
                <input
                  className={inputClassName()}
                  placeholder="变量 key"
                  value={action.variableKey}
                  onChange={(event) =>
                    onUpdateSelectedNodeData<SetVariableNodeData>({
                      actions: data.actions.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, variableKey: event.target.value } : entry,
                      ),
                    })
                  }
                />
                <select
                  className={selectClassName()}
                  value={action.type}
                  onChange={(event) =>
                    onUpdateSelectedNodeData<SetVariableNodeData>({
                      actions: data.actions.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, type: event.target.value as VariableActionType } : entry,
                      ),
                    })
                  }
                >
                  {variableActionTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                {action.type !== "toggle" ? (
                  <input
                    className={inputClassName()}
                    placeholder="动作值"
                    value={String(action.value ?? "")}
                    onChange={(event) =>
                      onUpdateSelectedNodeData<SetVariableNodeData>({
                        actions: data.actions.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: parseRuntimeValue(event.target.value) } : entry,
                        ),
                      })
                    }
                  />
                ) : null}
                <button
                  type="button"
                  className="justify-self-start rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-50"
                  onClick={() =>
                    onUpdateSelectedNodeData<SetVariableNodeData>({
                      actions: data.actions.filter((_, entryIndex) => entryIndex !== index),
                    })
                  }
                >
                  删除动作
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
              暂无动作。把选项连接到变量节点，再从变量节点连接到场景，保存时会把这些动作编译到该选项上。
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderNodeInspector(node: GraphNode) {
    const nodeIssues = issues.filter((issue) => issue.nodeId === node.id);

    return (
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-stone-500">{nodeTypeName[node.type]}节点</div>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">{node.title}</h2>
          </div>
          {node.type !== "start" ? (
            <button
              type="button"
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
              onClick={onDeleteSelectedNode}
            >
              删除
            </button>
          ) : null}
        </div>
        {nodeIssues.length ? (
          <div className="grid gap-2">
            {nodeIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {issue.message}
              </div>
            ))}
          </div>
        ) : null}
        {renderNodeFields(node)}
        <div className="rounded-lg border border-stone-300 bg-stone-50 p-3">
          <div className="text-sm font-medium text-stone-950">端口</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-600">
            <div>
              <div className="mb-2 font-medium text-stone-800">输入</div>
              {node.ports.filter((port) => port.direction === "input").map((port) => (
                <div key={port.id} className="rounded-md bg-white px-2 py-1">
                  {port.label} / {port.kind}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 font-medium text-stone-800">输出</div>
              {node.ports.filter((port) => port.direction === "output").map((port) => (
                <div key={port.id} className="rounded-md bg-white px-2 py-1">
                  {port.label} / {port.kind}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderEdgeInspector(edge: GraphEdge) {
    const fromNode = nodesById.get(edge.fromNodeId);
    const toNode = nodesById.get(edge.toNodeId);

    return (
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-stone-500">连线</div>
            <h2 className="mt-1 text-xl font-semibold text-stone-950">{edgeTypeName[edge.type]}</h2>
          </div>
          <button
            type="button"
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
            onClick={onDeleteSelectedEdge}
          >
            删除
          </button>
        </div>
        <Field label="连线标签">
          <input
            className={inputClassName()}
            value={edge.label ?? ""}
            onChange={(event) =>
              onUpdateGraph((current) => ({
                ...current,
                edges: current.edges.map((entry) => (entry.id === edge.id ? { ...entry, label: event.target.value } : entry)),
              }))
            }
          />
        </Field>
        <div className="rounded-lg border border-stone-300 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
          <div>起点：{fromNode?.title ?? edge.fromNodeId}</div>
          <div>目标：{toNode?.title ?? edge.toNodeId}</div>
        </div>
      </div>
    );
  }

  if (selectedNode) return renderNodeInspector(selectedNode);
  if (selectedEdge) return renderEdgeInspector(selectedEdge);
  return renderGraphInspector();
}
