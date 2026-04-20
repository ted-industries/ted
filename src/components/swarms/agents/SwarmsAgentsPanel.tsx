import { useState } from "react";
import { useEditorStore, editorStore, SwarmRole, AgentInstance } from "../../../store/editor-store";
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
    RiPriceTag3Line,
    RiMore2Fill,
    RiDraggable
} from "@remixicon/react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
    agentsPanelOpen: boolean;
    width: number;
}

const ROLE_COLORS = [
    "#ff4d4d", "#ff944d", "#ffdb4d", "#94ff4d", "#4dffdb", "#4db8ff", "#944dff", "#ff4db8"
];

function SortableRoleItem({
    role,
    editingRoleId,
    editRoleName,
    setEditRoleName,
    editRoleColor,
    setEditRoleColor,
    editRolePrompt,
    setEditRolePrompt,
    setEditingRoleId
}: {
    role: SwarmRole,
    editingRoleId: string | null,
    editRoleName: string,
    setEditRoleName: (v: string) => void,
    editRoleColor: string,
    setEditRoleColor: (v: string) => void,
    editRolePrompt: string,
    setEditRolePrompt: (v: string) => void,
    setEditingRoleId: (v: string | null) => void
}) {
    const isEditing = editingRoleId === role.id;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: role.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={`role-item-container ${isEditing ? "editing" : ""}`}>
            <div className={`role-item ${role.isDefault ? "is-default" : ""}`}>
                <div className="role-drag-handle" {...attributes} {...listeners}>
                    <RiDraggable size={14} />
                </div>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: role.color }} />
                <span className="flex-1 text-[11px] font-medium text-white/70 cursor-pointer hover:text-white" onClick={() => {
                    setEditingRoleId(isEditing ? null : role.id);
                    setEditRoleName(role.name);
                    setEditRoleColor(role.color);
                    setEditRolePrompt(role.systemPrompt || "");
                }}>
                    {role.name}
                    {role.isDefault && <span className="text-[9px] opacity-30 ml-2">(default)</span>}
                </span>
                <div className="flex items-center gap-1">
                    <button className="role-edit-btn" onClick={() => {
                        if (isEditing) {
                            setEditingRoleId(null);
                        } else {
                            setEditingRoleId(role.id);
                            setEditRoleName(role.name);
                            setEditRoleColor(role.color);
                            setEditRolePrompt(role.systemPrompt || "");
                        }
                    }}>
                        <RiEditLine size={12} />
                    </button>
                    {!role.isDefault && (
                        <button className="role-delete-btn" onClick={() => editorStore.deleteRole(role.id)}>
                            <RiDeleteBinLine size={12} />
                        </button>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="role-edit-panel">
                    <div className="dropdown-header !p-0 !mb-1">role name</div>
                    <input
                        className="role-input"
                        value={editRoleName}
                        onChange={e => setEditRoleName(e.target.value)}
                        disabled={role.isDefault}
                    />
                    <div className="dropdown-header !p-0 !mb-1 !mt-2">role identity & instructions</div>
                    <textarea
                        className="role-prompt-input custom-scrollbar"
                        value={editRolePrompt}
                        onChange={e => setEditRolePrompt(e.target.value)}
                        placeholder="Role-specific instructions..."
                    />
                    <div className="dropdown-header !p-0 !mb-1 !mt-2">identity color</div>
                    <div className="color-picker flex flex-wrap gap-1 mt-1 mb-3">
                        {ROLE_COLORS.map(c => (
                            <button
                                key={c}
                                className={`color-swatch ${editRoleColor === c ? "active" : ""}`}
                                style={{ background: c }}
                                onClick={() => setEditRoleColor(c)}
                                disabled={role.isDefault}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="role-action-btn primary flex-1"
                            onClick={() => {
                                editorStore.updateRole(role.id, {
                                    name: editRoleName,
                                    color: editRoleColor,
                                    systemPrompt: editRolePrompt
                                });
                                setEditingRoleId(null);
                            }}
                        >
                            save changes
                        </button>
                        <button
                            className="role-action-btn"
                            onClick={() => setEditingRoleId(null)}
                        >
                            cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function SwarmsAgentsPanel({ agentsPanelOpen, width }: Props) {
    const [activeTab, setActiveTab] = useState<"members" | "roles">("members");

    const { agents, roles } = useEditorStore((s) => {
        const session = s.swarmSessions.find(sess => sess.id === s.activeSwarmSessionId);
        return {
            agents: session?.agents ?? [],
            roles: session?.roles ?? []
        };
    }, (a, b) => JSON.stringify(a) === JSON.stringify(b));

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = roles.findIndex((r) => r.id === active.id);
            const newIndex = roles.findIndex((r) => r.id === over.id);
            editorStore.reorderRoles(arrayMove(roles, oldIndex, newIndex));
        }
    };

    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameVal, setRenameVal] = useState("");

    // Role creation state
    const [isCreatingRole, setIsCreatingRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleColor, setNewRoleColor] = useState(ROLE_COLORS[0]);
    const [newRolePrompt, setNewRolePrompt] = useState("");

    // Role editing state
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [editRoleName, setEditRoleName] = useState("");
    const [editRoleColor, setEditRoleColor] = useState("");
    const [editRolePrompt, setEditRolePrompt] = useState("");

    // Role assignment state
    const [assigningRoleId, setAssigningRoleId] = useState<string | null>(null);

    const renderAgentCard = (agent: AgentInstance, role: SwarmRole | null) => {
        const model = MODELS.find(m => m.id === agent.modelId);
        const isMenuOpen = menuOpen === agent.id;
        const isAssigningRole = assigningRoleId === agent.id;

        return (
            <div
                key={agent.id}
                className={`agent-member-card ${agent.isThinking ? "thinking" : ""}`}
            >

                <div className="member-card-main">
                    <div className="member-card-header">
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
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="member-name" style={{ color: role?.color || "inherit" }}>{agent.name}</span>
                                {agent.isLead && (
                                    <span className="member-lead-badge">LEAD</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="member-card-sub">
                        <span className="member-model-text">{model?.name || agent.modelId}</span>
                    </div>
                </div>

                <div className="member-card-actions">
                    <button
                        className="member-action-trigger"
                        onClick={() => setMenuOpen(isMenuOpen ? null : agent.id)}
                    >
                        <RiMore2Fill size={14} />
                    </button>

                    {isMenuOpen && (
                        <div className="agent-member-dropdown">
                            {!agent.isLead && (
                                <button className="agent-member-dropdown-item" onClick={() => {
                                    editorStore.setAgentAsLead(agent.id);
                                    setMenuOpen(null);
                                }}>
                                    Set as Lead
                                </button>
                            )}
                            <button className="agent-member-dropdown-item" onClick={() => {
                                setAssigningRoleId(isAssigningRole ? null : agent.id);
                                setMenuOpen(null);
                            }}>
                                Assign Role
                            </button>
                            <button className="agent-member-dropdown-item" onClick={() => {
                                setRenamingId(agent.id);
                                setRenameVal(agent.name);
                                setMenuOpen(null);
                            }}>
                                Rename
                            </button>
                            <div className="agent-member-dropdown-divider" />
                            <button className="agent-member-dropdown-item danger" onClick={() => {
                                editorStore.removeAgentFromSession(agent.id);
                                setMenuOpen(null);
                            }}>
                                Remove Agent
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
                        </div>
                    )}
                </div>
            </div>
        );
    };

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
                        {agents.length === 0 && (
                            <div className="agents-panel-empty">
                                Drop an agent on the map to deploy them here.
                            </div>
                        )}

                        {/* Grouped Agents by Role */}
                        {(() => {
                            const unassigned = agents.filter(a => !a.roleId);
                            const rolesWithAgents = roles.map(r => ({
                                ...r,
                                members: agents.filter(a => a.roleId === r.id)
                            })).filter(r => r.members.length > 0);

                            return (
                                <div className="members-grouped-list">
                                    {rolesWithAgents.map(roleGroup => (
                                        <div key={roleGroup.id} className="role-group-section">
                                            <div className="role-group-header">
                                                {roleGroup.name} — {roleGroup.members.length}
                                            </div>
                                            <div className="role-group-members">
                                                {roleGroup.members.map(agent => renderAgentCard(agent, roleGroup))}
                                            </div>
                                        </div>
                                    ))}

                                    {unassigned.length > 0 && (
                                        <div className="role-group-section">
                                            <div className="role-group-header unassigned">
                                                Unassigned — {unassigned.length}
                                            </div>
                                            <div className="role-group-members">
                                                {unassigned.map(agent => renderAgentCard(agent, null))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="agents-panel-roles">
                        <div className="roles-list p-2 flex flex-col gap-2">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={roles.map(r => r.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {roles.map(role => (
                                        <SortableRoleItem
                                            key={role.id}
                                            role={role}
                                            editingRoleId={editingRoleId}
                                            editRoleName={editRoleName}
                                            setEditRoleName={setEditRoleName}
                                            editRoleColor={editRoleColor}
                                            setEditRoleColor={setEditRoleColor}
                                            editRolePrompt={editRolePrompt}
                                            setEditRolePrompt={setEditRolePrompt}
                                            setEditingRoleId={setEditingRoleId}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>

                            {roles.length === 0 && !isCreatingRole && (
                                <div className="agents-panel-empty">
                                    No roles defined yet. Create roles to categorize your swarm members.
                                </div>
                            )}

                            {isCreatingRole && (
                                <div className="create-role-card">
                                    <div className="dropdown-header !p-0 !mb-2">new role</div>
                                    <input
                                        autoFocus
                                        className="role-input"
                                        placeholder="role name..."
                                        value={newRoleName}
                                        onChange={e => setNewRoleName(e.target.value)}
                                    />
                                    <textarea
                                        className="role-prompt-input custom-scrollbar"
                                        placeholder="role identity & instructions..."
                                        value={newRolePrompt}
                                        onChange={e => setNewRolePrompt(e.target.value)}
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
                                                    editorStore.addRole(newRoleName.trim(), newRoleColor, newRolePrompt.trim());
                                                    setNewRoleName("");
                                                    setNewRolePrompt("");
                                                    setNewRoleColor(ROLE_COLORS[0]);
                                                    setIsCreatingRole(false);
                                                }
                                            }}
                                        >
                                            create
                                        </button>
                                        <button
                                            className="role-action-btn p-1.5"
                                            onClick={() => {
                                                setIsCreatingRole(false);
                                                setNewRoleName("");
                                                setNewRolePrompt("");
                                            }}
                                        >
                                            <RiCloseLine size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isCreatingRole && (
                                <button
                                    className="add-role-dashed"
                                    onClick={() => setIsCreatingRole(true)}
                                >
                                    <RiAddLine size={14} />
                                    <span>add new role</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
