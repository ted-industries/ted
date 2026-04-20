import { useState } from "react";
import { RiCloseLine, RiText, RiPriceTag3Line, RiFlag2Line, RiDeleteBinLine } from "@remixicon/react";
import { KanbanTask, editorStore } from "../../../store/editor-store";

interface Props {
    task: KanbanTask;
    onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: Props) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || "");
    const [priority, setPriority] = useState(task.priority || "low");

    const handleSave = () => {
        editorStore.updateTask(task.id, {
            title,
            description,
            priority: priority as any
        });
        onClose();
    };

    const handleDelete = () => {
        editorStore.updateKanbanState(
            editorStore.getState().swarmSessions.find(s => s.id === editorStore.getState().activeSwarmSessionId)?.kanbanColumns || [],
            (editorStore.getState().swarmSessions.find(s => s.id === editorStore.getState().activeSwarmSessionId)?.kanbanTasks || []).filter(t => t.id !== task.id)
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'} shadow-[0_0_8px_currentColor]`} />
                        <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Task Details</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors">
                        <RiCloseLine size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Title</label>
                        <input 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white text-[15px] outline-none transition-all font-medium"
                            placeholder="What needs to be done?"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-wider">
                            <RiText size={12} />
                            <span>Description</span>
                        </div>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl px-4 py-3 text-white text-[13px] outline-none transition-all min-h-[120px] resize-none leading-relaxed"
                            placeholder="Add a more detailed description..."
                        />
                    </div>

                    {/* Properties Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-wider">
                                <RiFlag2Line size={12} />
                                <span>Priority</span>
                            </div>
                            <select 
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-white text-[13px] outline-none appearance-none cursor-pointer"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div className="space-y-2 opacity-30 cursor-not-allowed">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-wider">
                                <RiPriceTag3Line size={12} />
                                <span>Labels</span>
                            </div>
                            <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-white/40 text-[13px]">
                                Coming soon...
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <button 
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all text-sm font-medium"
                    >
                        <RiDeleteBinLine size={16} />
                        Delete Task
                    </button>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-white/40 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-600/20"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
