import { RiAddLine, RiCloseLine, RiMenuLine } from "@remixicon/react";
import { useEditorStore, editorStore } from "../../../store/editor-store";

interface Props {
    sidebarOpen: boolean;
    setSidebarOpen: (b: boolean) => void;
    setChatPanelOpen: (b: boolean) => void;
}

export function SwarmsSidebar({ sidebarOpen, setSidebarOpen, setChatPanelOpen }: Props) {
    const activeSessionId = useEditorStore((s) => s.activeAgentSessionId);
    const sessions = useEditorStore((s) => s.agentSessions);

    return (
        <>
            {/* Left Sidebar Overlay */}
            <div className={`swarms-flyout-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="swarms-sidebar-header">
                    <button className="swarms-new-btn" onClick={() => editorStore.createAgentSession("New Thread")}>
                        <RiAddLine size={14} />
                        NEW THREAD
                    </button>
                    <button className="swarms-close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
                        <RiCloseLine size={16} />
                    </button>
                </div>
                <div className="swarms-session-list">
                    {sessions.map((s) => (
                        <div
                            key={s.id}
                            className={`swarms-session-item ${activeSessionId === s.id ? "active" : ""}`}
                            onClick={() => {
                                editorStore.switchAgentSession(s.id);
                                setChatPanelOpen(true);
                            }}
                        >
                            <span className="swarms-session-name">{s.name}</span>
                            <div className="swarms-session-delete" onClick={(e) => {
                                e.stopPropagation();
                                editorStore.deleteAgentSession(s.id);
                            }}>
                                <RiCloseLine size={12} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button className="swarms-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <RiMenuLine size={16} /> Sessions
            </button>
        </>
    );
}
