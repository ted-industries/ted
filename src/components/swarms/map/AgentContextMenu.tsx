import { useEffect, useRef, useState } from "react";
import {
    RiStarLine, RiDeleteBinLine, RiEditLine, RiMessage3Line,
    RiFlashlightLine, RiBrainLine, RiCloseLine, RiStarFill
} from "@remixicon/react";
import { editorStore } from "../../../store/editor-store";
import { NodeData } from "../types";
import { MODELS } from "../constants";

interface Props {
    node: NodeData;
    x: number;
    y: number;
    onClose: () => void;
    onOpenChat: () => void;
}

export function AgentContextMenu({ node, x, y, onClose, onOpenChat }: Props) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [renaming, setRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(node.name);

    // Get live agent state to check isLead
    const sessions = editorStore.getState().swarmSessions;
    const activeSession = sessions.find(s => s.id === editorStore.getState().activeSwarmSessionId);
    const agent = activeSession?.agents.find(a => a.id === node.id);
    const isLead = agent?.isLead ?? false;
    const model = agent ? MODELS.find(m => m.id === agent.modelId) : null;

    // Close on outside click or Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        window.addEventListener("keydown", handleKey);
        window.addEventListener("mousedown", handleClick);
        return () => {
            window.removeEventListener("keydown", handleKey);
            window.removeEventListener("mousedown", handleClick);
        };
    }, [onClose]);

    // Clamp to viewport
    const menuStyle: React.CSSProperties = {
        position: "fixed",
        left: Math.min(x, window.innerWidth - 220),
        top: Math.min(y, window.innerHeight - 320),
        zIndex: 9999,
    };

    const doRename = () => {
        if (renameVal.trim() && renameVal !== node.name) {
            editorStore.renameAgent(node.id, renameVal.trim());
        }
        setRenaming(false);
        onClose();
    };

    return (
        <div ref={menuRef} className="agent-ctx-menu" style={menuStyle}>
            {/* Header */}
            <div className="agent-ctx-header">
                <div className="agent-ctx-avatar" style={{ background: node.color || "#ffd700" }}>
                    {model?.Icon && <model.Icon size={14} />}
                </div>
                <div className="agent-ctx-info">
                    <span className="agent-ctx-name">{node.name}</span>
                    <span className="agent-ctx-model">{model?.name || "Unknown"}</span>
                </div>
                {isLead && (
                    <div className="agent-ctx-lead-badge">
                        <RiStarFill size={10} />
                        Lead
                    </div>
                )}
                <button className="agent-ctx-close" onClick={onClose}><RiCloseLine size={14} /></button>
            </div>

            <div className="agent-ctx-divider" />

            {/* Rename inline */}
            {renaming ? (
                <div className="agent-ctx-rename">
                    <input
                        autoFocus
                        className="agent-ctx-rename-input"
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") doRename(); if (e.key === "Escape") setRenaming(false); }}
                        onBlur={doRename}
                    />
                </div>
            ) : (
                <div className="agent-ctx-items">
                    <button className="agent-ctx-item" onClick={() => { onOpenChat(); onClose(); }}>
                        <RiMessage3Line size={14} />
                        <span>Open in Chat</span>
                    </button>

                    <button className="agent-ctx-item" onClick={() => {
                        window.dispatchEvent(new CustomEvent("agent-brainstorm", { detail: { agentId: node.id } }));
                        onOpenChat();
                        onClose();
                    }}>
                        <RiBrainLine size={14} />
                        <span>Brainstorm Task</span>
                    </button>

                    <button className="agent-ctx-item" onClick={() => {
                        window.dispatchEvent(new CustomEvent("agent-sprint", { detail: { agentId: node.id } }));
                        onOpenChat();
                        onClose();
                    }}>
                        <RiFlashlightLine size={14} />
                        <span>Quick Sprint</span>
                    </button>

                    <div className="agent-ctx-divider" />

                    {!isLead && (
                        <button className="agent-ctx-item" onClick={() => { editorStore.setAgentAsLead(node.id); onClose(); }}>
                            <RiStarLine size={14} />
                            <span>Set as Project Lead</span>
                        </button>
                    )}

                    <button className="agent-ctx-item" onClick={() => setRenaming(true)}>
                        <RiEditLine size={14} />
                        <span>Rename Agent</span>
                    </button>

                    <div className="agent-ctx-divider" />

                    <button className="agent-ctx-item danger" onClick={() => { editorStore.removeAgentFromSession(node.id); onClose(); }}>
                        <RiDeleteBinLine size={14} />
                        <span>Remove Agent</span>
                    </button>
                </div>
            )}
        </div>
    );
}
