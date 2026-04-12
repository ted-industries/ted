import { useState, useRef, useCallback } from "react";
import { useEditorStore, editorStore } from "../../../store/editor-store";
import { RiAddLine, RiCloseLine, RiKanbanView } from "@remixicon/react";

interface Props {
    panelOpen: boolean;
    setPanelOpen: (b: boolean) => void;
}

export function SwarmsKanbanPanel({ panelOpen, setPanelOpen }: Props) {
    const activeSessionId = useEditorStore(s => s.activeSwarmSessionId);
    const sessions = useEditorStore(s => s.swarmSessions);
    const activeSession = sessions.find(s => s.id === activeSessionId);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [addingToCol, setAddingToCol] = useState<string | null>(null);
    const [panelWidth, setPanelWidth] = useState(520);
    const panelRef = useRef<HTMLDivElement>(null);

    const startResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = panelRef.current?.getBoundingClientRect().width ?? panelWidth;
        const onMouseMove = (ev: MouseEvent) => {
            const delta = startX - ev.clientX;
            setPanelWidth(Math.min(Math.max(startWidth + delta, 320), 900));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [panelWidth]);

    const handleAddTask = (columnId: string) => {
        if (!newTaskTitle.trim() || !activeSession) return;
        const newTask = {
            id: `task-${Date.now()}`,
            title: newTaskTitle.trim(),
            columnId
        };
        const updatedTasks = [...(activeSession.kanbanTasks || []), newTask];
        editorStore.updateKanbanState(activeSession.kanbanColumns, updatedTasks);
        setNewTaskTitle("");
        setAddingToCol(null);
    };

    const handleDeleteTask = (taskId: string) => {
        if (!activeSession) return;
        const updatedTasks = (activeSession.kanbanTasks || []).filter(t => t.id !== taskId);
        editorStore.updateKanbanState(activeSession.kanbanColumns, updatedTasks);
    };

    if (!activeSessionId || !activeSession) {
        return (
            <div
                ref={panelRef}
                className={`swarms-kanban-panel ${panelOpen ? 'open' : ''}`}
                style={{ width: panelWidth }}
            >
                <div className="panel-resize-handle" onMouseDown={startResize} />
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: 11 }}>
                    Create a Swarm Session to view Kanban.
                </div>
            </div>
        );
    }

    const columns = activeSession.kanbanColumns || [];
    const tasks = activeSession.kanbanTasks || [];

    return (
        <div
            ref={panelRef}
            className={`swarms-kanban-panel ${panelOpen ? 'open' : ''} border-l border-white/5 shadow-2xl transition-all duration-300 ease-in-out flex flex-col`}
            style={{ width: panelWidth }}
        >
            <div className="panel-resize-handle" onMouseDown={startResize} />

            <div className="swarms-sidebar-header flex items-center gap-1.5">
                <div className="flex items-center gap-2">
                    <RiKanbanView size={13} className="text-white/40" />
                    <span className="text-[11px] font-semibold tracking-wider text-white/40 uppercase">Board</span>
                </div>
            </div>

            <div className="flex-1 flex gap-5 p-5 overflow-x-auto overflow-y-hidden scrollbar-hide">
                {columns.map(col => {
                    const colTasks = tasks.filter(t => t.columnId === col.id);
                    return (
                        <div key={col.id} className="flex-shrink-0 w-72 flex flex-col h-full bg-black/20 rounded-xl border border-white/5">
                            <div className="p-4 pb-2 flex items-center justify-between">
                                <h3 className="text-[12px] font-bold text-white/80 flex items-center gap-2">
                                    {col.title}
                                    <span className="text-[10px] font-medium bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full">
                                        {colTasks.length}
                                    </span>
                                </h3>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
                                {colTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="group relative bg-white/[0.03] border border-white/5 hover:border-white/10 p-3 rounded-lg shadow-sm transition-all hover:bg-white/[0.05] cursor-default"
                                    >
                                        <p className="text-[13px] text-white/80 leading-relaxed pr-6">{task.title}</p>
                                        <button
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-all"
                                            onClick={() => handleDeleteTask(task.id)}
                                        >
                                            <RiCloseLine size={12} />
                                        </button>
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                            <span className="text-[9px] text-white/20 font-medium">#{task.id.split('-')[1]}</span>
                                        </div>
                                    </div>
                                ))}

                                {addingToCol === col.id ? (
                                    <div className="bg-white/5 border border-white/10 rounded-lg p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <textarea
                                            autoFocus
                                            className="w-full bg-transparent border-none text-[13px] text-white p-1 focus:ring-0 outline-none resize-none min-h-[60px]"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddTask(col.id);
                                                }
                                                if (e.key === "Escape") setAddingToCol(null);
                                            }}
                                            onBlur={() => handleAddTask(col.id)}
                                            placeholder="Task title..."
                                        />
                                    </div>
                                ) : (
                                    <button
                                        className="mt-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white/60 hover:bg-white/5 hover:border-white/20 transition-all text-[11px] font-medium"
                                        onClick={() => setAddingToCol(col.id)}
                                    >
                                        <RiAddLine size={14} /> Add Task
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
