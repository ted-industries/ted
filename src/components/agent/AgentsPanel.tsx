import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { runAgentLoop, AgentUpdate } from "../../services/agent/agent-service";
import "./AgentsPanel.css";

interface Message {
    role: "user" | "agent" | "status";
    text: string;
}

export default function AgentsPanel() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages, status]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        setInput("");
        setMessages((prev) => [...prev, { role: "user", text }]);
        setLoading(true);
        setStatus("");

        const controller = new AbortController();
        abortRef.current = controller;

        const onUpdate = (update: AgentUpdate) => {
            if (update.type === "thinking") {
                setStatus(update.text);
            } else if (update.type === "tool") {
                setStatus(`⚡ ${update.text}`);
            } else if (update.type === "tool_result") {
                // brief flash, don't accumulate
            }
        };

        try {
            const reply = await runAgentLoop(text, onUpdate, controller.signal);
            setMessages((prev) => [...prev, { role: "agent", text: reply }]);
        } catch (e: any) {
            if (e.message !== "Aborted") {
                setMessages((prev) => [
                    ...prev,
                    { role: "agent", text: e.message || "error" },
                ]);
            }
        } finally {
            setLoading(false);
            setStatus("");
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
                        <div
                            key={i}
                            className={`agent-msg agent-msg-${m.role}`}
                        >
                            {m.role === "agent" ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {m.text}
                                </ReactMarkdown>
                            ) : (
                                m.text
                            )}
                        </div>
                    ))}
                    {loading && status && (
                        <div className="agent-typing">{status}</div>
                    )}
                    {loading && !status && (
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
