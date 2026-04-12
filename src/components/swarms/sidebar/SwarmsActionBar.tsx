import { RiHashtag, RiKanbanView } from "@remixicon/react";

interface Props {
    activePanel: "chat" | "kanban" | null;
    setActivePanel: (p: "chat" | "kanban" | null) => void;
}

export function SwarmsActionBar({ activePanel, setActivePanel }: Props) {
    return (
        <div className="swarms-action-bar">
            <button 
                className={`action-bar-btn ${activePanel === "chat" ? "active" : ""}`}
                onClick={() => setActivePanel(activePanel === "chat" ? null : "chat")}
                title="Unified Chat"
            >
                <RiHashtag size={20} />
            </button>
            <button 
                className={`action-bar-btn ${activePanel === "kanban" ? "active" : ""}`}
                onClick={() => setActivePanel(activePanel === "kanban" ? null : "kanban")}
                title="Kanban Board"
            >
                <RiKanbanView size={20} />
            </button>
        </div>
    );
}
