import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { runAgentLoop, AgentUpdate } from "../../services/agent/agent-service";
import { editorStore, useEditorStore } from "../../store/editor-store";
import "./AgentsPanel.css";

interface Trace {
    type: "tool" | "result";
    text: string;
}

interface Message {
    role: "user" | "agent";
    text: string;
    traces?: Trace[];
}

function TraceResult({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="trace-result" onClick={() => setOpen(!open)}>
            <span className="trace-toggle">{open ? "−" : "+"}</span>
            <span className="trace-result-label">result</span>
            {open && <pre className="trace-result-body">{text}</pre>}
        </div>
    );
}

function TraceGroup({ traces }: { traces: Trace[] }) {
    const [open, setOpen] = useState(false);
    const count = traces.filter((t) => t.type === "tool").length;
    return (
        <div className="trace-group">
            <div className="trace-group-header" onClick={() => setOpen(!open)}>
                <span className="trace-toggle">{open ? "−" : "+"}</span>
                <span>{count} tool call{count !== 1 ? "s" : ""}</span>
            </div>
            {open && (
                <div className="trace-group-body">
                    {traces.map((t, i) =>
                        t.type === "tool" ? (
                            <div key={i} className="trace-call">{t.text}</div>
                        ) : (
                            <TraceResult key={i} text={t.text} />
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

function LiveTraces({ traces }: { traces: Trace[] }) {
    return (
        <div className="trace-group-body trace-live">
            {traces.map((t, i) =>
                t.type === "tool" ? (
                    <div key={i} className="trace-call">{t.text}</div>
                ) : (
                    <TraceResult key={i} text={t.text} />
                ),
            )}
        </div>
    );
}

export default function AgentsPanel() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [liveTraces, setLiveTraces] = useState<Trace[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [attachments, setAttachments] = useState<string[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages, status, liveTraces]);

    // Auto-resize textarea when not expanded
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta || expanded) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }, [input, expanded]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuOpen]);



    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        const contextPrefix = attachments.length > 0
            ? `[Attached: ${attachments.join(", ")}]\n\n`
            : "";

        const fullMessage = contextPrefix + text;

        setInput("");
        setAttachments([]);
        setExpanded(false);
        setMessages((prev) => [...prev, { role: "user", text: fullMessage }]);
        setLoading(true);
        setStatus("");
        setLiveTraces([]);

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
                setStatus("");
            }
        };

        try {
            // Pass the current store history
            // We use editorStore.getState() to get the freshest value without closure staleness if we used the hook value inside useCallback without dep
            const currentHistory = editorStore.getState().agentHistory || [];

            const { text: reply, history: newHistory } = await runAgentLoop(
                fullMessage,
                currentHistory,
                onUpdate,
                controller.signal
            );

            setMessages((prev) => [
                ...prev,
                { role: "agent", text: reply, traces: traces.length > 0 ? [...traces] : undefined },
            ]);

            // Update store with new history
            editorStore.updateAgentHistory(newHistory);

        } catch (e: any) {
            if (e.message !== "Aborted") {
                setMessages((prev) => [
                    ...prev,
                    { role: "agent", text: e.message || "error", traces: traces.length > 0 ? [...traces] : undefined },
                ]);
            }
        } finally {
            setLoading(false);
            setStatus("");
            setLiveTraces([]);
            abortRef.current = null;
        }
    }, [input, loading, attachments]); // Removed agentHistory from deps, getting from getState()

    const handleKey = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        },
        [send],
    );

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const handleAttach = useCallback(() => {
        fileRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const names = Array.from(files).map((f) => f.name);
        setAttachments((prev) => [...prev, ...names]);
        e.target.value = "";
    }, []);

    return (
        <div className="agent-panel">
            <div className={`agent-more-container${menuOpen ? " agent-more-container-open" : ""}`} ref={menuRef}>
                <button
                    className="agent-input-btn"
                    onClick={() => setMenuOpen(!menuOpen)}
                    title="more"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                    </svg>
                </button>
                {menuOpen && (
                    <div className="agent-more-dropdown">
                        <div
                            className="agent-dropdown-item"
                            onClick={() => {
                                editorStore.clearAgentHistory();
                                setMessages([]);
                                setMenuOpen(false);
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            clear history
                        </div>
                    </div>
                )}
            </div>
            {messages.length === 0 && !loading ? (
                <div className="agent-empty">ask anything</div>
            ) : (
                <div className="agent-messages">
                    {messages.map((m, i) => (
                        <div key={i}>
                            {m.role === "user" ? (
                                <div className="agent-msg agent-msg-user">{m.text}</div>
                            ) : (
                                <div className="agent-msg agent-msg-agent">
                                    {m.traces && <TraceGroup traces={m.traces} />}
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {m.text}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && liveTraces.length > 0 && (
                        <LiveTraces traces={liveTraces} />
                    )}
                    {loading && status && (
                        <div className="agent-typing">{status}</div>
                    )}
                    {loading && !status && liveTraces.length === 0 && (
                        <div className="agent-typing">...</div>
                    )}
                    <div ref={bottomRef} />
                </div>
            )}
            <div className={`agent-input-area${expanded ? " agent-input-expanded" : ""}`}>
                {attachments.length > 0 && (
                    <div className="agent-attachments">
                        {attachments.map((a, i) => (
                            <span key={i} className="agent-attachment-tag">
                                {a}
                                <span
                                    className="agent-attachment-remove"
                                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                                >
                                    ×
                                </span>
                            </span>
                        ))}
                    </div>
                )}
                <div className="agent-input-main">
                    <textarea
                        ref={textareaRef}
                        className="agent-input"
                        placeholder="ask ted"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        disabled={loading}
                        rows={1}
                    />
                    <button
                        className="agent-input-btn"
                        onClick={() => setExpanded(!expanded)}
                        title={expanded ? "collapse" : "expand"}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {expanded ? (
                                <>
                                    <polyline points="4 14 10 14 10 20" />
                                    <polyline points="20 10 14 10 14 4" />
                                    <line x1="14" y1="10" x2="21" y2="3" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </>
                            ) : (
                                <>
                                    <polyline points="15 3 21 3 21 9" />
                                    <polyline points="9 21 3 21 3 15" />
                                    <line x1="21" y1="3" x2="14" y2="10" />
                                    <line x1="3" y1="21" x2="10" y2="14" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>
                <div className="agent-input-bottom">
                    <button
                        className="agent-input-btn"
                        onClick={handleAttach}
                        disabled={loading}
                        title="attach context"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                        </svg>
                    </button>
                    {loading ? (
                        <button className="agent-stop" onClick={handleStop}>stop</button>
                    ) : (
                        <button
                            className="agent-send-btn"
                            onClick={send}
                            disabled={!input.trim()}
                            title="send"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                            </svg>
                        </button>
                    )}
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />
            </div>
        </div>
    );
}
