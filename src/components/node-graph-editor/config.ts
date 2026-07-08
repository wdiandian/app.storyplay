import type { PaletteItem } from "@/components/node-graph-editor/types";
import type { GraphEdgeType, GraphNodeType } from "@/lib/node-graph";
import type { EndingTone } from "@/lib/story-engine";

export const nodeTypeName: Record<GraphNodeType, string> = {
  start: "开始",
  scene: "场景",
  choice: "选择组",
  option: "选项",
  condition: "条件",
  set_variable: "变量",
  record: "记录",
  ending: "结局",
  asset: "素材",
  timeline: "时间点",
};

export const edgeTypeName: Record<GraphEdgeType, string> = {
  flow: "流程",
  choice: "选择",
  condition_true: "条件成立",
  condition_false: "条件不成立",
  unlock_record: "解锁记录",
  use_asset: "使用素材",
  timeline_event: "时间事件",
};

export const endingToneName: Record<EndingTone, string> = {
  truth: "真相结局",
  survival: "生还结局",
  tragedy: "悲剧结局",
};

export const paletteItems: PaletteItem[] = [
  { type: "scene", title: "场景节点", description: "视频片段、字幕、描述和自然流向" },
  { type: "choice", title: "选择组", description: "在某个场景后弹出一组选项" },
  { type: "option", title: "选项节点", description: "玩家可点击的具体选择" },
  { type: "record", title: "剧情记录", description: "回忆、线索、回响等可解锁内容" },
  { type: "ending", title: "结局节点", description: "作品终点和结局类型" },
  { type: "asset", title: "素材节点", description: "视频、图片、音频、字幕素材" },
  { type: "timeline", title: "时间点", description: "播放过程中的暂停、提示、跳转" },
  { type: "condition", title: "条件判断", description: "根据变量决定后续分支" },
  { type: "set_variable", title: "变量变化", description: "选择后修改玩家状态" },
];
