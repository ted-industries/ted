import { getCurrentWindow } from "@tauri-apps/api/window";
import { RiCloseLine, RiSubtractLine, RiCheckboxMultipleBlankLine, RiCheckboxBlankLine, RiAddLine } from "@remixicon/react";
import { useState, useEffect } from "react";
import "./Titlebar.css";
import { editorStore, useEditorStore } from "../../store/editor-store";

const appWindow = getCurrentWindow();

export default function Titlebar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateMaximized = async () => {
            setIsMaximized(await appWindow.isMaximized());
        };
        updateMaximized();

        const unlisten = appWindow.onResized(() => {
            updateMaximized();
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const workspaces = useEditorStore((s) => s.workspaces);
    const activeWorkspaceId = useEditorStore((s) => s.activeWorkspaceId);

    // Convert workspaces map to array for rendering
    const workspaceList = Object.values(workspaces);

    return (
        <div data-tauri-drag-region className="titlebar">
            <div data-tauri-drag-region className="titlebar-left">
                <img data-tauri-drag-region src="/ted.svg" alt="ted" className="titlebar-icon" />
            </div>

            <div data-tauri-drag-region className="titlebar-tabs">
                {workspaceList.map((ws) => (
                    <div
                        key={ws.id}
                        className={`workspace-tab ${ws.id === activeWorkspaceId ? "active" : ""}`}
                        onClick={() => editorStore.switchWorkspace(ws.id)}
                        title={ws.explorerPath || "Untitled"}
                    >
                        <span className="workspace-name">{ws.name}</span>
                        <div
                            className="workspace-close-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                editorStore.closeWorkspace(ws.id);
                            }}
                        >
                            <RiCloseLine size={12} />
                        </div>
                    </div>
                ))}
                <div
                    className="workspace-tab workspace-add-btn"
                    onClick={() => editorStore.createWorkspace()}
                    title="New Workspace"
                >
                    <RiAddLine size={14} />
                </div>
            </div>

            <div className="titlebar-actions">
                <button className="titlebar-button" onClick={() => appWindow.minimize()}>
                    <RiSubtractLine size={16} />
                </button>
                <button className="titlebar-button" onClick={() => appWindow.toggleMaximize()}>
                    {isMaximized ? (
                        <RiCheckboxMultipleBlankLine size={14} />
                    ) : (
                        <RiCheckboxBlankLine size={14} />
                    )}
                </button>
                <button className="titlebar-button titlebar-button-close" onClick={() => appWindow.close()}>
                    <RiCloseLine size={18} />
                </button>
            </div>
        </div>
    );
}
