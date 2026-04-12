import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ForceGraphMethods } from "react-force-graph-2d";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { useEditorStore, editorStore } from "../../store/editor-store";
import { NodeData, LinkData, FileEntry } from "./types";
import { MODELS } from "./constants";
import { SwarmsSidebar } from "./sidebar/SwarmsSidebar";
import { SwarmsChatPanel } from "./chat/SwarmsChatPanel";
import { ForceGraphMap } from "./map/ForceGraphMap";
import { ModelsDeck } from "./deck/ModelsDeck";
import "./Swarms.css";

export default function Swarms() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    
    // UI states
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [chatPanelOpen, setChatPanelOpen] = useState(false);

    // Graph state
    const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({ nodes: [], links: [] });
    const graphRef = useRef<ForceGraphMethods>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    // dnd-kit: active drag state
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const dropCoordsRef = useRef<{ x: number; y: number } | null>(null);

    // Use PointerSensor with a small activation distance to avoid accidental drags
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // Fetch directory tree builder
    const fetchDirTree = useCallback(async (path: string, depth: number): Promise<{ nodes: NodeData[], links: LinkData[] }> => {
        if (depth === 0) return { nodes: [], links: [] };
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
                    val: child.is_dir ? 3 : 1
                });
                allLinks.push({ source: path, target: child.path });

                if (child.is_dir) {
                    const sub = await fetchDirTree(child.path, Math.max(0, depth - 1));
                    allNodes = allNodes.concat(sub.nodes);
                    allLinks = allLinks.concat(sub.links);
                }
            }
            return { nodes: allNodes, links: allLinks };
        } catch {
            return { nodes: [], links: [] };
        }
    }, []);

    // Initial map build
    useEffect(() => {
        if (!explorerPath) return;
        let cancelled = false;

        const loadGraph = async () => {
            const rootName = explorerPath.split(/[\\/]/).pop() || "Root";
            const initNodes: NodeData[] = [{ id: explorerPath, name: rootName, group: "dir", val: 5 }];
            setGraphData({ nodes: initNodes, links: [] });

            const tree = await fetchDirTree(explorerPath, 3);
            if (cancelled) return;

            setGraphData({
                nodes: [...initNodes, ...tree.nodes],
                links: tree.links
            });
        };

        loadGraph();
        return () => { cancelled = true; };
    }, [explorerPath, fetchDirTree]);

    // Track pointer position during drag for drop coordinate calculation
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

        if (!graphRef.current || !viewRef.current || !dropCoordsRef.current) return;

        const rect = viewRef.current.getBoundingClientRect();
        const clientX = dropCoordsRef.current.x;
        const clientY = dropCoordsRef.current.y;

        // Only deploy if dropped within the view bounds (not outside the window)
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const coords = graphRef.current.screen2GraphCoords(screenX, screenY);
        
        const modelConf = MODELS.find(m => m.id === modelId);
        
        // Find nearest node to attach to
        let nearestNodeId = explorerPath || "root";
        let minDistance = Infinity;
        
        graphData.nodes.forEach(n => {
            if (n.x !== undefined && n.y !== undefined) {
                const dist = Math.sqrt(Math.pow(n.x - coords.x, 2) + Math.pow(n.y - coords.y, 2));
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestNodeId = n.id;
                }
            }
        });

        const agentId = `agent-${Date.now()}`;
        const agentNode: NodeData = {
            id: agentId,
            name: `${modelConf?.name || "Agent"}`,
            group: "agent",
            val: 8,
            color: modelConf?.color || "#ffd700",
            x: coords.x,
            y: coords.y
        };

        const agentLink: LinkData = {
            source: agentId,
            target: nearestNodeId,
            isAgent: true
        };

        setGraphData(prev => ({
            nodes: [...prev.nodes, agentNode],
            links: [...prev.links, agentLink]
        }));

        editorStore.createAgentSession(`${modelConf?.name} Agent`);
        setChatPanelOpen(true);
    };

    const activeModel = activeModelId ? MODELS.find(m => m.id === activeModelId) : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="swarms-view" ref={viewRef}>
                <SwarmsSidebar 
                    sidebarOpen={sidebarOpen} 
                    setSidebarOpen={setSidebarOpen} 
                    setChatPanelOpen={setChatPanelOpen} 
                />

                <SwarmsChatPanel 
                    chatPanelOpen={chatPanelOpen} 
                    setChatPanelOpen={setChatPanelOpen} 
                    graphData={graphData} 
                    setGraphData={setGraphData} 
                />

                <div className="swarms-map-container">
                    <ForceGraphMap graphData={graphData} ref={graphRef} />
                </div>

                <ModelsDeck />

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
        </DndContext>
    );
}
