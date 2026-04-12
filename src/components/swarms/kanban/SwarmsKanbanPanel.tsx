import { useState } from "react";
import { useEditorStore, editorStore } from "../../../store/editor-store";
import { RiAddLine, RiCloseLine } from "@remixicon/react";

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
            <div className={`swarms-kanban-panel ${panelOpen ? 'open' : ''}`}>
                 <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: 11 }}>
                    Create a Swarm Session to view Kanban.
                </div>
            </div>
        );
    }

    const columns = activeSession.kanbanColumns || [];
    const tasks = activeSession.kanbanTasks || [];

    return (
        <div className={`swarms-kanban-panel ${panelOpen ? 'open' : ''}`}>
            <div className="swarms-sidebar-header">
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, opacity: 0.8 }}>
                    BOARD
                </div>
                <button className="swarms-close-sidebar-btn" onClick={() => setPanelOpen(false)}>
                    <RiCloseLine size={16} />
                </button>
            </div>
            <div className="swarms-kanban-container">
                {columns.map(col => {
                    const colTasks = tasks.filter(t => t.columnId === col.id);
                    return (
                        <div key={col.id} className="kanban-column">
                            <div className="kanban-column-header">
                                {col.title} <span style={{opacity: 0.4}}>({colTasks.length})</span>
                            </div>
                            <div className="kanban-column-body">
                                {colTasks.map(task => (
                                    <div key={task.id} className="kanban-card">
                                        <div className="kanban-card-title">{task.title}</div>
                                        <button className="kanban-card-delete" onClick={() => handleDeleteTask(task.id)}>×</button>
                                    </div>
                                ))}
                                {addingToCol === col.id ? (
                                    <div className="kanban-add-form">
                                        <textarea 
                                            autoFocus
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddTask(col.id);
                                                }
                                            }}
                                            onBlur={() => handleAddTask(col.id)}
                                            placeholder="Task title..."
                                        />
                                    </div>
                                ) : (
                                    <button className="kanban-add-btn" onClick={() => setAddingToCol(col.id)}>
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
