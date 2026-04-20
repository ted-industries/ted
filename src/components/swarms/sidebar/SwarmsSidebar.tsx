import { RiAddLine, RiCloseLine, RiEditLine, RiSearchLine, RiApps2Line, RiTimeLine, RiSettings3Line, RiFolderLine, RiChat3Line, RiExpandUpDownLine, RiSortDesc, RiFilter3Line } from "@remixicon/react";
import { useEditorStore, editorStore } from "../../../store/editor-store";

interface Props {
    sidebarOpen: boolean;
    setSidebarOpen: (b: boolean) => void;
    setChatPanelOpen: (b: boolean) => void;
}

export function SwarmsSidebar({ sidebarOpen, setSidebarOpen, setChatPanelOpen }: Props) {
    const activeSessionId = useEditorStore((s) => s.activeSwarmSessionId);
    const sessions = useEditorStore((s) => s.swarmSessions);
    const projectName = useEditorStore((s) => s.projectName);

    return (
        <>
            {/* Left Sidebar Overlay */}
            <div className={`swarms-flyout-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="swarms-sidebar-top-actions">
                    <div className="sidebar-action-item" onClick={() => editorStore.createSwarmSession("New Session")}>
                        <RiEditLine size={16} />
                        <span>New chat</span>
                    </div>
                    <div className="sidebar-action-item">
                        <RiSearchLine size={16} />
                        <span>Search</span>
                    </div>
                    {/* <div className="sidebar-action-item">
                        <RiApps2Line size={16} />
                        <span>Plugins</span>
                    </div>
                    <div className="sidebar-action-item">
                        <RiTimeLine size={16} />
                        <span>Automations</span>
                    </div> */}
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-header">
                        <span>Sessions</span>
                        <div className="header-actions">
                            <RiExpandUpDownLine size={14} />
                            <RiFilter3Line size={14} />
                        </div>
                    </div>
                    <div className="swarms-session-list">
                        {sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`swarms-session-item ${activeSessionId === s.id ? "active" : ""}`}
                                onClick={() => {
                                    editorStore.switchSwarmSession(s.id);
                                    setChatPanelOpen(false);
                                }}
                            >
                                <span className="swarms-session-name">{s.name}</span>
                                <div className="swarms-session-delete" onClick={(e) => {
                                    e.stopPropagation();
                                    editorStore.deleteSwarmSession(s.id);
                                }}>
                                    <RiCloseLine size={12} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <div className="directory-spinner" onClick={() => editorStore.toggleCommandPalette()}>
                        <div className="directory-info">
                            <RiFolderLine size={14} />
                            <span>{projectName || "No Workspace"}</span>
                        </div>
                        <RiExpandUpDownLine size={14} />
                    </div>
                    <button className="settings-footer-btn" onClick={() => editorStore.toggleSettings()}>
                        <RiSettings3Line size={18} />
                    </button>
                </div>
            </div>

            {/* <button className="swarms-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <RiMenuLine size={16} />
            </button> */}
        </>
    );
}
