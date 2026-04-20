import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RiCloseLine } from "@remixicon/react";
import { KanbanTask } from "../../../store/editor-store";

interface Props {
    task: KanbanTask;
    onDelete: (id: string) => void;
    onClick: (task: KanbanTask) => void;
}

export const SortableTaskCard = memo(function SortableTaskCard({ task, onDelete, onClick }: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const getPriorityColor = (p?: string) => {
        switch (p) {
            case 'high': return 'bg-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
            case 'medium': return 'bg-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.5)]';
            case 'low': return 'bg-green-500/50 shadow-[0_0_8_rgba(34,197,94,0.5)]';
            default: return 'bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(task)}
            className="group relative bg-white/[0.03] border border-white/5 hover:border-white/10 p-3 rounded-lg shadow-sm transition-all hover:bg-white/[0.06] cursor-grab active:cursor-grabbing select-none active:scale-[0.98]"
        >
            {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {task.labels.map((l, i) => (
                        <div key={i} className="h-1 w-6 rounded-full bg-white/20" />
                    ))}
                </div>
            )}
            
            <p className="text-[13px] text-white/80 leading-relaxed pr-6">{task.title}</p>
            
            <button
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all z-10"
                onMouseDown={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                }}
            >
                <RiCloseLine size={12} />
            </button>

            <div className="mt-2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}`}></div>
                <span className="text-[9px] text-white/20 font-medium">#{task.id.split('-').slice(-1)[0]}</span>
                {task.description && (
                    <div className="w-1 h-1 rounded-full bg-white/10 ml-auto" />
                )}
            </div>
        </div>
    );
});
