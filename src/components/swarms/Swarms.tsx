import { useState, useRef, useEffect, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEditorStore, editorStore } from "../../store/editor-store";
import { runAgentLoop, AgentUpdate } from "../../services/agent/agent-service";
import { 
    RiCloseLine,
    RiSendPlane2Line,
    RiMenuLine,
    RiAddLine,
    RiAnthropicFill,
    RiGoogleFill,
    RiOpenaiFill,
    RiAttachment2,
    RiStopCircleLine
} from "@remixicon/react";
import "./Swarms.css";

const MODELS = [
  { id: "opus-4-6", name: "Opus 4.6", Icon: RiAnthropicFill, color: "#d97757" },
  { id: "sonnet-4-6", name: "Sonnet 4.6", Icon: RiAnthropicFill, color: "#f29374" },
  { id: "gemini-3-1", name: "Gemini 3.1", Icon: RiGoogleFill, color: "#4285f4" },
  { id: "codex-5-3", name: "5.3 Codex", Icon: RiOpenaiFill, color: "#fb8c00" },
  { id: "gpt-5-4", name: "GPT-5.4", Icon: RiOpenaiFill, color: "#10a37f" }
];

interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
}

interface NodeData {
    id: string;
    name: string;
    group: "dir" | "file" | "agent";
    val: number;
    color?: string;
    x?: number;
    y?: number;
    isThinking?: boolean;
}

interface LinkData {
    source: string;
    target: string;
    isAgent?: boolean;
}

interface Trace {
    type: "tool" | "result";
    text: string;
}

const TraceResult = ({ text }: { text: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="trace-result-wrapper">
            <div className="trace-result-header" onClick={() => setOpen(!open)}>
                {open ? "−" : "+"} result
            </div>
            {open && <pre className="trace-result-body">{text}</pre>}
        </div>
    );
};

const TraceGroup = ({ traces }: { traces: Trace[] }) => {
    const [open, setOpen] = useState(false);
    const toolCalls = traces.filter(t => t.type === "tool");
    if (toolCalls.length === 0) return null;

    return (
        <div className="swarms-traces">
            <div className="trace-group-header" onClick={() => setOpen(!open)}>
                <span className="trace-toggle">{open ? "−" : "+"}</span>
                {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
            </div>
            {open && (
                <div className="trace-group-body">
                    {traces.map((t, i) => (
                        t.type === "tool" ? (
                            <div key={i} className="trace-call">{t.text}</div>
                        ) : (
                            <TraceResult key={i} text={t.text} />
                        )
                    ))}
                </div>
            )}
        </div>
    );
};

const ChatMessage = memo(({ role, text, traces }: { role: string; text: string; traces?: Trace[] }) => (
    <div className="swarms-message-row">
        <div className="swarms-message-content">
            <div className="swarms-msg-header">
                {role === "user" ? "User" : "Agent"}
            </div>
            <div className="swarms-msg-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {text}
                </ReactMarkdown>
            </div>
            {traces && traces.length > 0 && <TraceGroup traces={traces} />}
        </div>
    </div>
));


export default function Swarms() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const activeSessionId = useEditorStore((s) => s.activeAgentSessionId);
    const sessions = useEditorStore((s) => s.agentSessions);
    const agentHistory = useEditorStore((s) => s.agentHistory);
    
    // UI Layout state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [chatPanelOpen, setChatPanelOpen] = useState(false);

    // Graph state
    const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({ nodes: [], links: [] });
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const graphRef = useRef<ForceGraphMethods>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Chat state
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [liveTraces, setLiveTraces] = useState<Trace[]>([]);
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Resize observers
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Chat Scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [agentHistory, status, liveTraces, chatPanelOpen]);

    // Chat Expand textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 250) + "px";
    }, [input]);

    // Fetch directory tree
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

    // Drag and Drop
    const handleDragStart = (e: React.DragEvent, modelId: string) => {
        e.dataTransfer.setData("model_id", modelId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const modelId = e.dataTransfer.getData("model_id");
        if (!modelId) return;

        if (!containerRef.current || !graphRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

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

        // Add Agent node with simple shape (done via Canvas obj)
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

        // Open right chat panel and start a new session
        editorStore.createAgentSession(`${modelConf?.name} Agent`);
        setChatPanelOpen(true);
    };

    // Chat sending logic
    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading || !activeSessionId) return;

        setInput("");
        setLoading(true);
        setStatus("Thinking");
        setLiveTraces([]);
        
        // Find latest agent node to set to isThinking
        const currentAgentId = graphData.nodes.slice().reverse().find(n => n.group === "agent")?.id;
        if (currentAgentId) {
            setGraphData(prev => ({
                 nodes: prev.nodes.map(n => n.id === currentAgentId ? { ...n, isThinking: true } : n),
                 links: prev.links
            }));
        }

        const currentHistory = [...agentHistory, { role: "user" as const, content: text }];
        editorStore.updateAgentHistory(currentHistory);

        const controller = new AbortController();
        abortRef.current = controller;
        const traces: Trace[] = [];

        const onUpdate = (update: AgentUpdate) => {
            if (update.type === "thinking") {
                setStatus(update.text);
            } else if (update.type === "tool") {
                traces.push({ type: "tool", text: update.text });
                setLiveTraces([...traces]);
                setStatus(update.text);
            } else if (update.type === "tool_result") {
                traces.push({ type: "result", text: update.text });
                setLiveTraces([...traces]);
            }
        };

        try {
            const { history: newHistory } = await runAgentLoop(
                text,
                currentHistory,
                onUpdate,
                controller.signal
            );

            const finalHistory = newHistory.map((m, idx) => {
                if (idx === newHistory.length - 1 && m.role === "assistant") {
                    return { ...m, traces: traces.length > 0 ? [...traces] : undefined };
                }
                return m;
            });

            editorStore.updateAgentHistory(finalHistory);
        } catch (e: any) {
            if (e.message !== "Aborted") {
                const errorHistory = [...currentHistory, { 
                    role: "assistant" as const, 
                    content: `Error: ${e.message}`,
                    traces: traces.length > 0 ? [...traces] : undefined
                }];
                editorStore.updateAgentHistory(errorHistory);
            }
        } finally {
            setLoading(false);
            setStatus("");
            setLiveTraces([]);
            abortRef.current = null;
            
            if (currentAgentId) {
                setGraphData(prev => ({
                     nodes: prev.nodes.map(n => n.id === currentAgentId ? { ...n, isThinking: false } : n),
                     links: prev.links
                }));
            }
        }
    }, [input, loading, activeSessionId, agentHistory, graphData]);

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="swarms-view">
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

            <button className="swarms-sidebar-toggle" onClick={() => setSidebarOpen(true)}>
                <RiMenuLine size={16} /> Sessions
            </button>

            {/* Right Chat Panel */}
            <div className={`swarms-chat-panel ${chatPanelOpen ? 'open' : ''}`}>
                <div className="swarms-sidebar-header">
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, opacity: 0.8 }}>
                        {sessions.find(s => s.id === activeSessionId)?.name || 'Agent Chat'}
                    </div>
                    <button className="swarms-close-sidebar-btn" onClick={() => setChatPanelOpen(false)}>
                        <RiCloseLine size={16} />
                    </button>
                </div>
                
                <div className="swarms-chat-container" ref={chatContainerRef}>
                    {agentHistory.length === 0 && !loading && (
                        <div className="agent-empty" style={{ opacity: 0.5, fontSize: 11, textAlign: 'center', marginTop: 40 }}>
                            AGENT DEPLOYED. GIVE A PROMPT.
                        </div>
                    )}
                    
                    {agentHistory.filter(m => m.role !== 'system').map((m, i) => (
                        <ChatMessage key={i} role={m.role} text={m.content} traces={m.traces} />
                    ))}
                    
                    {loading && (
                        <div className="swarms-status-area">
                            <div className="swarms-status-pill">{status}...</div>
                        </div>
                    )}

                    {loading && liveTraces.length > 0 && (
                        <div className="swarms-message-row">
                             <div className="swarms-message-content" style={{ opacity: 0.5 }}>
                                <TraceGroup traces={liveTraces} />
                             </div>
                        </div>
                    )}
                </div>

                <div className="swarms-input-section">
                    <div className="swarms-input-box">
                        <textarea
                            ref={textareaRef}
                            className="swarms-textarea"
                            placeholder="Instruct agent..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            rows={1}
                            disabled={loading}
                        />
                        <div className="swarms-input-footer">
                            <div className="swarms-input-actions">
                                <button className="swarms-icon-btn" title="attach file">
                                    <RiAttachment2 size={18} />
                                </button>
                            </div>
                            {loading ? (
                                <button className="swarms-icon-btn" onClick={() => abortRef.current?.abort()}>
                                    <RiStopCircleLine size={20} />
                                </button>
                            ) : (
                                <button 
                                    className="swarms-send-btn" 
                                    onClick={send} 
                                    disabled={!input.trim()}
                                >
                                    <RiSendPlane2Line size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Force Graph Map Area */}
            <div
                className="swarms-map-container"
                ref={containerRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="force-graph-container">
                    <ForceGraph2D
                        ref={graphRef}
                        width={dimensions.width}
                        height={dimensions.height}
                        graphData={graphData}
                        nodeLabel="name"
                        nodeCanvasObject={(node: any, ctx, globalScale) => {
                            // Custom Drawing for nodes
                            if (node.group === "agent") {
                                const size = node.isThinking ? 10 : 8;
                                ctx.beginPath();
                                ctx.moveTo(node.x, node.y - size);
                                ctx.lineTo(node.x - size, node.y + size);
                                ctx.lineTo(node.x + size, node.y + size);
                                ctx.fillStyle = node.color || "#ffd700";
                                ctx.fill();
                                
                                if (node.isThinking) {
                                    ctx.lineWidth = 1;
                                    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                                    ctx.stroke();
                                }
                            } else {
                                const size = node.val || 2;
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                                ctx.fillStyle = node.color ? node.color : (node.group === "dir" ? "rgba(100, 150, 255, 0.8)" : "rgba(200, 200, 200, 0.6)");
                                ctx.fill();
                            }
                        }}
                        linkColor={(link: any) => link.isAgent ? "rgba(255, 215, 0, 0.5)" : "rgba(255, 255, 255, 0.1)"}
                        linkWidth={(link: any) => link.isAgent ? 2 : 1}
                        linkDirectionalParticles={(link: any) => link.isAgent ? 4 : 0}
                        linkDirectionalParticleSpeed={0.01}
                        backgroundColor="transparent"
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.4}
                        cooldownTicks={100}
                    />
                </div>
            </div>

            {/* Bottom Models Deck */}
            <div className="swarms-deck">
                {MODELS.map((m) => (
                    <div
                        key={m.id}
                        className="deck-model-card"
                        draggable
                        onDragStart={(e) => handleDragStart(e, m.id)}
                        title={`Drag ${m.name} onto the map`}
                    >
                        <m.Icon className="deck-model-icon" />
                        <span className="deck-model-name">{m.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
