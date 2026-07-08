import { paletteItems } from "@/components/node-graph-editor/config";
import type { GraphNodeType } from "@/lib/node-graph";

type NodeGraphPaletteProps = {
  onAddNode: (type: GraphNodeType) => void;
};

export function NodeGraphPalette({ onAddNode }: NodeGraphPaletteProps) {
  return (
    <aside className="overflow-auto border-r border-white/10 bg-[#17140f] p-4">
      <div className="text-sm font-medium text-white">节点</div>
      <div className="mt-3 grid gap-2">
        {paletteItems.map((item) => (
          <button
            key={item.type}
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-3 text-left transition hover:border-amber-200/50 hover:bg-white/10"
            onClick={() => onAddNode(item.type)}
          >
            <div className="text-sm font-medium text-white">{item.title}</div>
            <div className="mt-1 text-xs leading-5 text-stone-400">{item.description}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-stone-400">
        操作：拖动节点移动。点击输出端口，再点击输入端口建立连接。点击连线可编辑或删除。
      </div>
    </aside>
  );
}
