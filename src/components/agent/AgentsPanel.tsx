import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { runAgentLoop, AgentUpdate } from "../../services/agent/agent-service";
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
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages, status, liveTraces]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        setInput("");
        setMessages((prev) => [...prev, { role: "user", text }]);
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
            const reply = await runAgentLoop(text, onUpdate, controller.signal);
            setMessages((prev) => [
                ...prev,
                { role: "agent", text: reply, traces: traces.length > 0 ? [...traces] : undefined },
            ]);
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
    }, [input, loading]);

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

    return (
        <div className="agent-panel">
            {messages.length === 0 && !loading ? (
                <div className="agent-empty">agent</div>
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
            <div className="agent-input-row">
                {loading ? (
                    <button className="agent-stop" onClick={handleStop}>
                        stop
                    </button>
                ) : null}
                <input
                    className="agent-input"
                    placeholder="ask ted"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={loading}
                />
            </div>
        </div>
    );
}
