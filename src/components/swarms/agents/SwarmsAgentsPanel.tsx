import { useState } from "react";
import { useEditorStore, editorStore, SwarmRole } from "../../../store/editor-store";
import { MODELS } from "../constants";
import {
    RiStarFill,
    RiMoreLine,
    RiDeleteBinLine,
    RiStarLine,
    RiEditLine,
    RiTeamLine,
    RiShieldUserLine,
    RiAddLine,
    RiCloseLine,
    RiPriceTag3Line
} from "@remixicon/react";

interface Props {
    agentsPanelOpen: boolean;
    width: number;
}

const ROLE_COLORS = [
    "#ff4d4d", "#ff944d", "#ffdb4d", "#94ff4d", "#4dffdb", "#4db8ff", "#944dff", "#ff4db8"
];

export function SwarmsAgentsPanel({ agentsPanelOpen, width }: Props) {
    const [activeTab, setActiveTab] = useState<"members" | "roles">("members");

    const { agents, roles } = useEditorStore((s) => {
        const session = s.swarmSessions.find(sess => sess.id === s.activeSwarmSessionId);
        return {
            agents: session?.agents ?? [],
            roles: session?.roles ?? []
        };
    }, (a, b) => JSON.stringify(a) === JSON.stringify(b));

    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameVal, setRenameVal] = useState("");

    // Role creation state
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleColor, setNewRoleColor] = useState(ROLE_COLORS[0]);

    // Role assignment state
    const [assigningRoleId, setAssigningRoleId] = useState<string | null>(null);

    return (
        <div
            className="swarms-agents-panel"
            style={{
                width: agentsPanelOpen ? width : 0,
                borderLeft: agentsPanelOpen ? "1px solid rgba(255,255,255,0.08)" : "none",
                overflow: "hidden",
                height: "100%",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                background: "#161616",
                transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
        >
            {/* Tabs Header */}
            <div className="agents-panel-tabs">
                <button
                    className={`agents-tab ${activeTab === "members" ? "active" : ""}`}
                    onClick={() => setActiveTab("members")}
                >
                    <RiTeamLine size={14} />
                    <span>members</span>
                </button>
                <button
                    className={`agents-tab ${activeTab === "roles" ? "active" : ""}`}
                    onClick={() => setActiveTab("roles")}
                >
                    <RiShieldUserLine size={14} />
                    <span>roles</span>
                </button>
            </div>

            <div className="agents-panel-content custom-scrollbar">
                {activeTab === "members" ? (
                    <div className="agents-panel-list">
                        <div className="agents-panel-section-label">
                            Members — {agents.length}
                        </div>
                        {agents.length === 0 && (
                            <div className="agents-panel-empty">
                                Drop an agent on the map to deploy them here.
                            </div>
                        )}

                        {agents.map(agent => {
                            const model = MODELS.find(m => m.id === agent.modelId);
                            const role = roles.find(r => r.id === agent.roleId);
                            const isMenuOpen = menuOpen === agent.id;
                            const isAssigningRole = assigningRoleId === agent.id;

                            return (
                                <div
                                    key={agent.id}
                                    className={`agent-member-row ${agent.isThinking ? "thinking" : ""}`}
                                >
                                    <div
                                        className="agent-member-avatar"
                                        style={{ background: model?.color || "#ffd700" }}
                                    >
                                        {model?.Icon && <model.Icon size={13} />}
                                    </div>

                                    <div className="agent-member-info">
                                        {renamingId === agent.id ? (
                                            <input
                                                autoFocus
                                                className="agent-member-rename-input"
                                                value={renameVal}
                                                onChange={e => setRenameVal(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") {
                                                        if (renameVal.trim()) editorStore.renameAgent(agent.id, renameVal.trim());
                                                        setRenamingId(null);
                                                    }
                                                    if (e.key === "Escape") setRenamingId(null);
                                                }}
                                                onBlur={() => {
                                                    if (renameVal.trim()) editorStore.renameAgent(agent.id, renameVal.trim());
                                                    setRenamingId(null);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="agent-member-name">
                                                    {agent.name}
                                                    {agent.isLead && (
                                                        <RiStarFill size={9} className="agent-lead-star" />
                                                    )}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="agent-member-model">{model?.name || agent.modelId}</span>
                                                    {role && (
                                                        <span
                                                            className="agent-role-badge"
                                                            style={{ color: role.color, borderColor: `${role.color}40`, background: `${role.color}10` }}
                                                        >
                                                            {role.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {agent.isThinking && (
                                            <span className="agent-member-status-text">thinking...</span>
                                        )}
                                    </div>

                                    <div className="agent-member-actions">
                                        <button
                                            className="agent-member-more-btn"
                                            onClick={() => setMenuOpen(isMenuOpen ? null : agent.id)}
                                        >
                                            <RiMoreLine size={14} />
                                        </button>

                                        {isMenuOpen && (
                                            <div className="agent-member-dropdown">
                                                {!agent.isLead && (
                                                    <button className="agent-member-dropdown-item" onClick={() => {
                                                        editorStore.setAgentAsLead(agent.id);
                                                        setMenuOpen(null);
                                                    }}>
                                                        <RiStarLine size={12} />
                                                        Set as Lead
                                                    </button>
                                                )}
                                                <button className="agent-member-dropdown-item" onClick={() => {
                                                    setAssigningRoleId(isAssigningRole ? null : agent.id);
                                                    setMenuOpen(null);
                                                }}>
                                                    <RiPriceTag3Line size={12} />
                                                    Assign Role
                                                </button>
                                                <button className="agent-member-dropdown-item" onClick={() => {
                                                    setRenamingId(agent.id);
                                                    setRenameVal(agent.name);
                                                    setMenuOpen(null);
                                                }}>
                                                    <RiEditLine size={12} />
                                                    Rename
                                                </button>
                                                <div className="agent-member-dropdown-divider" />
                                                <button className="agent-member-dropdown-item danger" onClick={() => {
                                                    editorStore.removeAgentFromSession(agent.id);
                                                    setMenuOpen(null);
                                                }}>
                                                    <RiDeleteBinLine size={12} />
                                                    Remove
                                                </button>
                                            </div>
                                        )}

                                        {isAssigningRole && (
                                            <div className="agent-member-dropdown role-assignment">
                                                <div className="dropdown-header">Select Role</div>
                                                <button
                                                    className="agent-member-dropdown-item"
                                                    onClick={() => {
                                                        editorStore.assignRoleToAgent(agent.id, undefined);
                                                        setAssigningRoleId(null);
                                                    }}
                                                >
                                                    <RiCloseLine size={12} />
                                                    None
                                                </button>
                                                {roles.map(r => (
                                                    <button
                                                        key={r.id}
                                                        className="agent-member-dropdown-item"
                                                        onClick={() => {
                                                            editorStore.assignRoleToAgent(agent.id, r.id);
                                                            setAssigningRoleId(null);
                                                        }}
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                                                        {r.name}
                                                    </button>
                                                ))}
                                                {roles.length === 0 && (
                                                    <div className="p-2 text-[10px] text-white/30 text-center">
                                                        No roles created yet.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="agents-panel-roles">
                        <div className="roles-header flex items-center justify-between px-4 py-2 mt-2">
                            <div className="agents-panel-section-label !p-0">
                                Roles — {roles.length}
                            </div>
                            {!isCreatingRole && (
                                <button
                                    className="add-role-btn"
                                    onClick={() => setIsCreatingRole(true)}
                                >
                                    <RiAddLine size={14} />
                                </button>
                            )}
                        </div>

                        <div className="roles-list p-2 flex flex-col gap-2">
                            {isCreatingRole && (
                                <div className="create-role-card">
                                    <div className="dropdown-header !p-0 !mb-2">new role</div>
                                    <input
                                        autoFocus
                                        className="role-input"
                                        placeholder="role name..."
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter" && newRoleName.trim()) {
                                                editorStore.addRole(newRoleName.trim(), newRoleColor);
                                                setNewRoleName("");
                                                setNewRoleColor(ROLE_COLORS[0]);
                                                setIsCreatingRole(false);
                                            }
                                            if (e.key === "Escape") setIsCreatingRole(false);
                                        }}
                                    />
                                    <div className="color-picker flex flex-wrap gap-1 mt-1 mb-3">
                                        {ROLE_COLORS.map(c => (
                                            <button
                                                key={c}
                                                className={`color-swatch ${newRoleColor === c ? "active" : ""}`}
                                                style={{ background: c }}
                                                onClick={() => setNewRoleColor(c)}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-1.5 mt-2">
                                        <button
                                            className="role-action-btn primary flex-1"
                                            onClick={() => {
                                                if (newRoleName.trim()) {
                                                    editorStore.addRole(newRoleName.trim(), newRoleColor);
                                                    setNewRoleName("");
                                                    setNewRoleColor(ROLE_COLORS[0]);
                                                    setIsCreatingRole(false);
                                                }
                                            }}
                                        >
                                            create
                                        </button>
                                        <button
                                            className="role-action-btn p-1.5"
                                            onClick={() => setIsCreatingRole(false)}
                                        >
                                            <RiCloseLine size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {roles.length === 0 && !isCreatingRole && (
                                <div className="agents-panel-empty">
                                    No roles defined yet. Create roles to categorize your swarm members.
                                </div>
                            )}

                            {roles.map(role => (
                                <div key={role.id} className={`role-item ${role.isDefault ? "is-default" : ""}`}>
                                    <div className="role-indicator" style={{ background: role.color }} />
                                    <span className="role-name">
                                        {role.name}
                                        {role.isDefault && <span className="text-[9px] opacity-30 ml-2">(default)</span>}
                                    </span>
                                    {!role.isDefault && (
                                        <button
                                            className="role-delete-btn"
                                            onClick={() => editorStore.deleteRole(role.id)}
                                        >
                                            <RiDeleteBinLine size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Lead indicator at bottom */}
            {activeTab === "members" && agents.length > 0 && (() => {
                const lead = agents.find(a => a.isLead);
                return lead ? (
                    <div className="agents-panel-lead-footer">
                        <RiStarFill size={10} />
                        <span><strong>{lead.name}</strong> is the Project Lead</span>
                    </div>
                ) : null;
            })()}
        </div>
    );
}
