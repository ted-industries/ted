import { useState, useRef, useCallback, useMemo } from "react";
import { useEditorStore, editorStore, KanbanTask, KanbanColumn } from "../../../store/editor-store";
import { RiAddLine, RiCloseLine, RiKanbanView, RiDraggable } from "@remixicon/react";
import {
    Kanban,
    KanbanBoard,
    KanbanColumn as KanbanCol,
    KanbanColumnContent,
    KanbanItem,
    KanbanItemHandle,
    KanbanOverlay,
    type KanbanMoveEvent,
} from "../../kanban/kanban";
import { TaskDetailModal } from "./TaskDetailModal";

interface Props {
    kanbanPanelOpen: boolean;
    width: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert flat store arrays → Record<columnId, KanbanTask[]> */
function toColumnMap(
    columns: KanbanColumn[],
    tasks: KanbanTask[]
): Record<string, KanbanTask[]> {
    const map: Record<string, KanbanTask[]> = {};
    for (const col of columns) {
        map[col.id] = [];
    }
    for (const task of tasks) {
        if (map[task.columnId]) {
            map[task.columnId].push(task);
        }
    }
    return map;
}

/** Convert Record<columnId, KanbanTask[]> back → flat KanbanTask[] with correct columnIds */
function fromColumnMap(
    columns: KanbanColumn[],
    map: Record<string, KanbanTask[]>
): KanbanTask[] {
    const tasks: KanbanTask[] = [];
    for (const col of columns) {
        const colTasks = map[col.id] || [];
        for (const task of colTasks) {
            tasks.push({ ...task, columnId: col.id });
        }
    }
    return tasks;
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({
    task,
    onDelete,
    onClick,
}: {
    task: KanbanTask;
    onDelete: (id: string) => void;
    onClick: (task: KanbanTask) => void;
}) {
    const getPriorityDot = (p?: string) => {
        switch (p) {
            case "high": return "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]";
            case "medium": return "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]";
            case "low": return "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]";
            default: return "bg-blue-500/60";
        }
    };

    return (
        <KanbanItem
            value={task.id}
            className="group relative bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-lg p-3 shadow-sm transition-all hover:bg-white/[0.07] select-none"
        >
            {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {task.labels.map((_, i) => (
                        <div key={i} className="h-1 w-6 rounded-full bg-white/20" />
                    ))}
                </div>
            )}

            <div className="flex items-start gap-2">
                <KanbanItemHandle className="mt-0.5 flex-shrink-0 text-white/20 hover:text-white/50 transition-colors">
                    <RiDraggable size={14} />
                </KanbanItemHandle>

                <p
                    className="flex-1 text-[13px] text-white/80 leading-relaxed pr-5 cursor-pointer"
                    onClick={() => onClick(task)}
                >
                    {task.title}
                </p>
            </div>

            <div className="mt-2.5 flex items-center gap-2 pl-5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />
                <span className="text-[9px] text-white/20 font-medium">#{task.id.split("-").slice(-1)[0]}</span>
                {task.description && <div className="w-1 h-1 rounded-full bg-white/10 ml-auto" />}
            </div>

            <button
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-white/30 hover:text-red-400 rounded transition-all z-10"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                }}
            >
                <RiCloseLine size={12} />
            </button>
        </KanbanItem>
    );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SwarmsKanbanPanel({ kanbanPanelOpen, width }: Props) {
    const activeSessionId = useEditorStore((s) => s.activeSwarmSessionId);
    const sessions = useEditorStore((s) => s.swarmSessions);
    const activeSession = sessions.find((s) => s.id === activeSessionId);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [addingToCol, setAddingToCol] = useState<string | null>(null);
    const [isAddingColumn, setIsAddingColumn] = useState(false);
    const [newColumnTitle, setNewColumnTitle] = useState("");
    const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // ── Data ─────────────────────────────────────────────────────────────────
    const columns = useMemo(
        () => activeSession?.kanbanColumns || [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSession?.kanbanColumns]
    );
    const tasks = useMemo(
        () => activeSession?.kanbanTasks || [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSession?.kanbanTasks]
    );

    const columnMap = useMemo(() => toColumnMap(columns, tasks), [columns, tasks]);

    // Called by Kanban when the user finishes a drag
    const handleValueChange = useCallback(
        (newMap: Record<string, KanbanTask[]>) => {
            if (!activeSession) return;
            const newTasks = fromColumnMap(columns, newMap);
            editorStore.updateKanbanState(columns, newTasks);
        },
        [activeSession, columns]
    );

    // ── CRUD ─────────────────────────────────────────────────────────────────
    const handleAddTask = (columnId: string) => {
        if (!newTaskTitle.trim() || !activeSession) return;
        const newTask: KanbanTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle.trim(),
            columnId,
        };
        editorStore.updateKanbanState(columns, [...tasks, newTask]);
        setNewTaskTitle("");
        setAddingToCol(null);
    };

    const handleDeleteTask = (taskId: string) => {
        if (!activeSession) return;
        editorStore.updateKanbanState(
            columns,
            tasks.filter((t) => t.id !== taskId)
        );
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    if (!activeSessionId || !activeSession) {
        return (
            <div
                ref={panelRef}
                className={`swarms-kanban-panel ${kanbanPanelOpen ? "open" : ""}`}
                style={{ width: kanbanPanelOpen ? width : 0 }}
            >
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
                    <RiKanbanView size={28} />
                    <span className="text-[11px]">Create a Swarm Session to use the board.</span>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={panelRef}
            className={`swarms-kanban-panel ${kanbanPanelOpen ? "open" : ""} border-l border-white/5 flex flex-col`}
            style={{ width: kanbanPanelOpen ? width : 0 }}
        >


            {/* Header */}
            {/* <div className="swarms-sidebar-header flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <RiKanbanView size={13} className="text-white/40" />
                    <span className="text-[11px] font-semibold tracking-wider text-white/40 uppercase">
                        Board
                    </span>
                </div>
            </div> */}

            {/* Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-2">
                <Kanban
                    value={columnMap}
                    onValueChange={handleValueChange}
                    getItemValue={(task: KanbanTask) => task.id}
                    className="flex gap-2 h-full"
                >
                    <KanbanBoard className="!grid-cols-none flex gap-2 h-full">
                        {columns.map((col) => {
                            const colTasks = columnMap[col.id] || [];
                            return (
                                <KanbanCol
                                    key={col.id}
                                    value={col.id}
                                    className="flex-shrink-0 w-[272px] flex flex-col bg-black/20 rounded-xl border border-white/5"
                                >
                                    {/* Column header */}
                                    <div className="p-3 pb-2 flex items-center justify-between group">
                                        <h3 className="text-[11px] font-bold text-white/60 flex items-center gap-2 tracking-wide uppercase">
                                            {col.title}
                                            <span className="text-[9px] font-semibold bg-white/8 text-white/30 px-1.5 py-0.5 rounded-full">
                                                {colTasks.length}
                                            </span>
                                        </h3>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 text-white/20 hover:text-white/60 rounded transition-all"
                                            onClick={() => editorStore.deleteColumn(col.id)}
                                        >
                                            <RiCloseLine size={12} />
                                        </button>
                                    </div>

                                    {/* Tasks */}
                                    <KanbanColumnContent
                                        value={col.id}
                                        className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2 custom-scrollbar min-h-[40px]"
                                    >
                                        {colTasks.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onDelete={handleDeleteTask}
                                                onClick={setEditingTask}
                                            />
                                        ))}
                                    </KanbanColumnContent>

                                    {/* Add task */}
                                    <div className="p-2 pt-0">
                                        {addingToCol === col.id ? (
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                                <textarea
                                                    autoFocus
                                                    className="w-full bg-transparent border-none text-[13px] text-white p-1 focus:ring-0 outline-none resize-none min-h-[56px]"
                                                    value={newTaskTitle}
                                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleAddTask(col.id);
                                                        }
                                                        if (e.key === "Escape") {
                                                            setAddingToCol(null);
                                                            setNewTaskTitle("");
                                                        }
                                                    }}
                                                    onBlur={() => handleAddTask(col.id)}
                                                    placeholder="Task title…"
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/8 text-white/30 hover:text-white/60 hover:bg-white/5 hover:border-white/20 transition-all text-[11px] font-medium"
                                                onClick={() => setAddingToCol(col.id)}
                                            >
                                                <RiAddLine size={13} /> Add Task
                                            </button>
                                        )}
                                    </div>
                                </KanbanCol>
                            );
                        })}
                    </KanbanBoard>

                    {/* Add column */}
                    {isAddingColumn ? (
                        <div className="flex-shrink-0 w-[272px] bg-black/20 rounded-xl border border-white/5 p-3 h-fit self-start">
                            <input
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-lg text-[13px] text-white p-2.5 focus:ring-1 focus:ring-blue-500/50 outline-none mb-2"
                                placeholder="Column name…"
                                value={newColumnTitle}
                                onChange={(e) => setNewColumnTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newColumnTitle.trim()) {
                                        editorStore.addColumn(newColumnTitle.trim());
                                        setNewColumnTitle("");
                                        setIsAddingColumn(false);
                                    }
                                    if (e.key === "Escape") setIsAddingColumn(false);
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                                    onClick={() => {
                                        if (newColumnTitle.trim()) {
                                            editorStore.addColumn(newColumnTitle.trim());
                                            setNewColumnTitle("");
                                            setIsAddingColumn(false);
                                        }
                                    }}
                                >
                                    Add Column
                                </button>
                                <button
                                    className="p-1.5 hover:bg-white/10 text-white/40 rounded-lg transition-colors"
                                    onClick={() => setIsAddingColumn(false)}
                                >
                                    <RiCloseLine size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            className="flex-shrink-0 w-[272px] h-fit self-start group flex items-center gap-2 p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-dashed border-white/8 hover:border-white/20 rounded-xl transition-all"
                            onClick={() => setIsAddingColumn(true)}
                        >
                            <RiAddLine size={15} className="text-white/20 group-hover:text-white/50 transition-colors" />
                            <span className="text-[12px] font-semibold text-white/20 group-hover:text-white/50 transition-colors">
                                Add Column
                            </span>
                        </button>
                    )}

                    {/* Drag overlay */}
                    <KanbanOverlay>
                        {({ value }) => {
                            const task = tasks.find((t) => t.id === value);
                            if (!task) return null;
                            return (
                                <div className="rotate-2 scale-105 shadow-2xl cursor-grabbing">
                                    <TaskCard task={task} onDelete={() => { }} onClick={() => { }} />
                                </div>
                            );
                        }}
                    </KanbanOverlay>
                </Kanban>
            </div>

            {/* Task detail modal */}
            {editingTask && (
                <TaskDetailModal
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                />
            )}
        </div>
    );
}
