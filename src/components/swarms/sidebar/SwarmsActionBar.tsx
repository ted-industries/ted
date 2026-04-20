import { RiHashtag, RiKanbanView, RiTeamLine } from "@remixicon/react";

interface Props {
    activePanel: "chat" | "kanban" | "agents" | null;
    setActivePanel: (p: "chat" | "kanban" | "agents" | null) => void;
}

export function SwarmsActionBar({ activePanel, setActivePanel }: Props) {
    const toggle = (p: "chat" | "kanban" | "agents") =>
        setActivePanel(activePanel === p ? null : p);

    return (
        <div className={`swarms-action-bar ${activePanel ? 'active' : ''}`}>
            <button
                className={`action-bar-btn ${activePanel === "chat" ? "active" : ""}`}
                onClick={() => toggle("chat")}
                title="Unified Chat"
            >
                <RiHashtag size={20} />
            </button>
            <button
                className={`action-bar-btn ${activePanel === "kanban" ? "active" : ""}`}
                onClick={() => toggle("kanban")}
                title="Kanban Board"
            >
                <RiKanbanView size={20} />
            </button>
            <button
                className={`action-bar-btn ${activePanel === "agents" ? "active" : ""}`}
                onClick={() => toggle("agents")}
                title="Agents"
            >
                <RiTeamLine size={20} />
            </button>
        </div>
    );
}
