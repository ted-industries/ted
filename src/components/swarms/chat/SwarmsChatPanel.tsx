import { useState, useRef, useEffect, useCallback, memo, Dispatch, SetStateAction } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEditorStore, editorStore } from "../../../store/editor-store";
import { runAgentLoop, AgentUpdate } from "../../../services/agent/agent-service";
import { RiCloseLine, RiSendPlane2Line, RiAttachment2, RiStopCircleLine } from "@remixicon/react";
import { Trace, NodeData, LinkData } from "../types";

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

interface Props {
    chatPanelOpen: boolean;
    setChatPanelOpen: (b: boolean) => void;
    graphData: { nodes: NodeData[]; links: LinkData[] };
    setGraphData: Dispatch<SetStateAction<{ nodes: NodeData[]; links: LinkData[] }>>;
}

export function SwarmsChatPanel({ chatPanelOpen, setChatPanelOpen, graphData, setGraphData }: Props) {
    const activeSessionId = useEditorStore((s) => s.activeAgentSessionId);
    const sessions = useEditorStore((s) => s.agentSessions);
    const agentHistory = useEditorStore((s) => s.agentHistory);

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [liveTraces, setLiveTraces] = useState<Trace[]>([]);
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [agentHistory, status, liveTraces, chatPanelOpen]);

    // Resizing textarea horizontally
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 250) + "px";
    }, [input]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading || !activeSessionId) return;

        setInput("");
        setLoading(true);
        setStatus("Thinking");
        setLiveTraces([]);
        
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
    }, [input, loading, activeSessionId, agentHistory, graphData, setGraphData]);

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
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
                
                {agentHistory.filter((m: any) => m.role !== 'system').map((m: any, i: number) => (
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
    );
}
