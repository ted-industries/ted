import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ForceGraphMethods } from "react-force-graph-2d";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { useEditorStore, editorStore } from "../../store/editor-store";
import { NodeData, LinkData, FileEntry } from "./types";
import { MODELS } from "./constants";
import { SwarmsSidebar } from "./sidebar/SwarmsSidebar";
import { SwarmsActionBar } from "./sidebar/SwarmsActionBar";
import { SwarmsChatPanel } from "./chat/SwarmsChatPanel";
import { SwarmsKanbanPanel } from "./kanban/SwarmsKanbanPanel";
import { SwarmsAgentsPanel } from "./agents/SwarmsAgentsPanel";
import { AgentContextMenu } from "./map/AgentContextMenu";
import { ForceGraphMap } from "./map/ForceGraphMap";
import { ModelsDeck } from "./deck/ModelsDeck";
import "./Swarms.css";

function Swarms() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const activeSessionId = useEditorStore((s) => s.activeSwarmSessionId);
    const swarmSessions = useEditorStore((s) => s.swarmSessions);
    
    // UI states
    const swarmsSidebarOpen = useEditorStore((s) => s.swarmsSidebarOpen);
    const viewMode = useEditorStore((s) => s.viewMode);
    const [activeRightPanel, setActiveRightPanel] = useState<"chat" | "kanban" | "agents" | null>(null);
    const [agentsWidth] = useState(260);

    // Context menu state
    const [ctxMenu, setCtxMenu] = useState<{ node: NodeData; x: number; y: number } | null>(null);

    // Graph base tree (FileSystem isolated)
    const [fsNodes, setFsNodes] = useState<NodeData[]>([]);
    const [fsLinks, setFsLinks] = useState<LinkData[]>([]);
    const [chatWidth, setChatWidth] = useState(400);
    const [kanbanWidth, setKanbanWidth] = useState(650);
    const isResizingRef = useRef(false);

    const graphRef = useRef<ForceGraphMethods>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const dropCoordsRef = useRef<{ x: number; y: number } | null>(null);

    // dnd-kit: active drag state
    const [activeModelId, setActiveModelId] = useState<string | null>(null);

    // Use PointerSensor with a small activation distance to avoid accidental drags
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // Fetch directory tree builder
    const fetchDirTree = useCallback(async (path: string, maxDepth: number, currentLevel: number): Promise<{ nodes: NodeData[], links: LinkData[] }> => {
        if (currentLevel >= maxDepth) return { nodes: [], links: [] };
        try {
            const children = await invoke<FileEntry[]>("list_dir", { path });
            let allNodes: NodeData[] = [];
            let allLinks: LinkData[] = [];
            
            for (const child of children) {
                if (child.name === ".git" || child.name === "node_modules") continue;
                allNodes.push({
                    id: child.path,
                    name: child.name,
                    group: child.is_dir ? "dir" : "file",
                    val: child.is_dir ? 3 : 1,
                    depth: currentLevel + 1
                });
                allLinks.push({ source: path, target: child.path });

                if (child.is_dir) {
                    const sub = await fetchDirTree(child.path, maxDepth, currentLevel + 1);
                    allNodes = allNodes.concat(sub.nodes);
                    allLinks = allLinks.concat(sub.links);
                }
            }
            return { nodes: allNodes, links: allLinks };
        } catch {
            return { nodes: [], links: [] };
        }
    }, []);

    // Initial map build (Filesystem only)
    useEffect(() => {
        if (!explorerPath) return;
        let cancelled = false;

        const loadGraph = async () => {
            const rootName = explorerPath.split(/[\\/]/).pop() || "Root";
            const initNodes: NodeData[] = [{ id: explorerPath, name: rootName, group: "dir", val: 5, depth: 0 }];

            const tree = await fetchDirTree(explorerPath, 3, 0);
            if (cancelled) return;

            setFsNodes([...initNodes, ...tree.nodes]);
            setFsLinks(tree.links);
        };

        loadGraph();
        return () => { cancelled = true; };
    }, [explorerPath, fetchDirTree]);

    // Merging actual layout graph = FileSystem Base + Current Session Agents
    const graphData = useMemo(() => {
        const activeSession = swarmSessions.find(s => s.id === activeSessionId);
        
        let sessionAgentNodes: NodeData[] = [];
        let sessionAgentLinks: LinkData[] = []; 
        
        if (activeSession) {
            sessionAgentNodes = activeSession.agents.map(a => ({
                id: a.id,
                name: a.name,
                group: "agent" as const,
                val: 8,
                color: MODELS.find(m => m.id === a.modelId)?.color || "#ffd700",
                x: a.x,
                y: a.y,
                fx: a.x,
                fy: a.y,
                isThinking: a.isThinking,
                isLead: a.isLead,
                targetNode: a.activeTaskTarget
            }));

            // Torch light links hook here if targetNode exists
            activeSession.agents.forEach(a => {
                if (a.activeTaskTarget) {
                    sessionAgentLinks.push({
                        source: a.id,
                        target: a.activeTaskTarget,
                        isAgent: true
                    });
                }
            });
        }

        return {
            nodes: [...fsNodes, ...sessionAgentNodes],
            links: [...fsLinks, ...sessionAgentLinks]
        };
    }, [fsNodes, fsLinks, activeSessionId, swarmSessions]);



    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current) return;
            const container = mapContainerRef.current?.parentElement;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const newWidth = rect.right - e.clientX;
            if (activeRightPanel === "chat") {
                setChatWidth(Math.max(300, Math.min(newWidth, 800)));
            } else if (activeRightPanel === "kanban") {
                setKanbanWidth(Math.max(400, Math.min(newWidth, 1200)));
            }
        };

        const onMouseUp = () => {
            isResizingRef.current = false;
            document.body.classList.remove("is-resizing-h");
        };

        if (activeRightPanel && activeRightPanel !== "agents") {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [activeRightPanel]);


    useEffect(() => {
        if (!activeModelId) {
            dropCoordsRef.current = null;
            return;
        }
        const onPointerMove = (e: PointerEvent) => {
            dropCoordsRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("pointermove", onPointerMove);
        return () => window.removeEventListener("pointermove", onPointerMove);
    }, [activeModelId]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveModelId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const modelId = event.active.id as string;
        setActiveModelId(null);

        // Required session context to drop
        if (!activeSessionId) {
            if (swarmSessions.length === 0) {
                editorStore.createSwarmSession("New Session");
            }
        }

        if (!graphRef.current || !mapContainerRef.current || !dropCoordsRef.current) return;

        const rect = mapContainerRef.current.getBoundingClientRect();
        const clientX = dropCoordsRef.current.x;
        const clientY = dropCoordsRef.current.y;

        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const coords = graphRef.current.screen2GraphCoords(screenX, screenY);
        
        const modelConf = MODELS.find(m => m.id === modelId);
        
        const agentId = `agent-${Date.now()}`;
        
        // Push agent to Editor Store
        editorStore.addAgentToSession({
            id: agentId,
            modelId: modelId,
            name: `${modelConf?.name || "Agent"}`,
            x: coords.x,
            y: coords.y
        });

        setActiveRightPanel("chat");
    };

    const handleNodeClick = useCallback((node: NodeData) => {
        if (node.group === "agent") {
            window.dispatchEvent(new CustomEvent("agent-mention", { detail: `@[${node.name}](${node.name}) ` }));
            setActiveRightPanel("chat");
        }
    }, []);

    const handleNodeRightClick = useCallback((node: NodeData, event: MouseEvent) => {
        event.preventDefault();
        setCtxMenu({ node, x: event.clientX, y: event.clientY });
    }, []);

    const activeModel = activeModelId ? MODELS.find(m => m.id === activeModelId) : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="swarms-view">
                <SwarmsSidebar 
                    sidebarOpen={swarmsSidebarOpen} 
                    setSidebarOpen={(open) => editorStore.setSwarmsSidebarOpen(open)} 
                    setChatPanelOpen={() => setActiveRightPanel("chat")} 
                />

                <div className="swarms-main-container">
                    <div className="swarms-main-card">
                        <div className={`swarms-session-header ${activeRightPanel ? 'has-panel' : ''}`}>
                            <div className="session-info">
                                <span className="session-name">
                                    {swarmSessions.find(s => s.id === activeSessionId)?.name || "New Session"}
                                </span>
                            </div>
                            <div className="session-actions">
                                <SwarmsActionBar 
                                    activePanel={activeRightPanel} 
                                    setActivePanel={setActiveRightPanel} 
                                />
                            </div>
                        </div>

                        <div className="swarms-main-body">
                            <div className="swarms-map-container" ref={mapContainerRef}>
                                <ForceGraphMap
                                    graphData={graphData}
                                    ref={graphRef}
                                    onNodeClick={handleNodeClick}
                                    onNodeRightClick={handleNodeRightClick}
                                    viewMode={viewMode}
                                />
                                <ModelsDeck />
                            </div>

                            {activeRightPanel && activeRightPanel !== "agents" && (
                                <div
                                    className="panel-resize-handle"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        isResizingRef.current = true;
                                        document.body.classList.add("is-resizing-h");
                                    }}
                                />
                            )}

                            <SwarmsChatPanel
                                chatPanelOpen={activeRightPanel === "chat"}
                                width={chatWidth}
                            />
                            <SwarmsKanbanPanel
                                kanbanPanelOpen={activeRightPanel === "kanban"}
                                width={kanbanWidth}
                            />
                            <SwarmsAgentsPanel
                                agentsPanelOpen={activeRightPanel === "agents"}
                                width={agentsWidth}
                            />
                        </div>
                    </div>
                </div>


                {/* Drag overlay - the ghost card that follows the cursor */}
                <DragOverlay dropAnimation={null}>
                    {activeModel ? (
                        <div className="deck-model-card drag-ghost">
                            <activeModel.Icon className="deck-model-icon" />
                            <span className="deck-model-name">{activeModel.name}</span>
                        </div>
                    ) : null}
                </DragOverlay>
            </div>

            {/* Agent Context Menu portal */}
            {ctxMenu && (
                <AgentContextMenu
                    node={ctxMenu.node}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    onClose={() => setCtxMenu(null)}
                    onOpenChat={() => setActiveRightPanel("chat")}
                />
            )}
        </DndContext>
    );
}

export default React.memo(Swarms);
