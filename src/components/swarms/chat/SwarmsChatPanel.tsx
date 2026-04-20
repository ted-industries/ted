import { useState, useRef, useEffect, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEditorStore, editorStore } from "../../../store/editor-store";
import { runAgentLoop, AgentUpdate } from "../../../services/agent/agent-service";
import { RiCloseLine, RiSendPlane2Line, RiAttachment2, RiStopCircleLine, RiHashtag } from "@remixicon/react";
import { Trace } from "../types";
import { MentionsInput, Mention } from "react-mentions";

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

const ChatMessage = memo(({ role, text, traces, authorName }: { role: string; text: string; traces?: Trace[]; authorName?: string }) => (
    <div className="swarms-message-row">
        <div className="swarms-message-content">
            <div className="swarms-msg-header">
                {authorName || (role === "user" ? "User" : "Agent")}
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
    width: number;
}

export function SwarmsChatPanel({ chatPanelOpen, width }: Props) {
    const activeSessionId = useEditorStore((s) => s.activeSwarmSessionId);
    const sessions = useEditorStore((s) => s.swarmSessions);

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const sessionHistory = activeSession?.history || [];

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [liveTraces, setLiveTraces] = useState<Trace[]>([]);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Auto-scroll

    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [sessionHistory, status, liveTraces, chatPanelOpen]);

    // Resizing textarea horizontally
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 250) + "px";
    }, [input]);

    // Listen to @mention from map
    useEffect(() => {
        const handler = (e: any) => {
            setInput(prev => prev + e.detail);
            textareaRef.current?.focus();
        };
        window.addEventListener("agent-mention", handler);
        return () => window.removeEventListener("agent-mention", handler);
    }, []);

    // Recursive Collaboration Loop
    // Takes a message string, routes to an agent (targetAgentId or fallback lead), generates response.
    // If response contains @AgentName, dispatch the loop again automatically!
    const runInferenceIteration = async (
        promptText: string,
        currentHistoryBase: any[],
        targetAgentId: string | undefined
    ) => {
        if (!activeSession) return;

        // Find routing agent
        let processingAgent = activeSession.agents.find(a => a.id === targetAgentId);
        if (!processingAgent && activeSession.agents.length > 0) {
            processingAgent = activeSession.agents[0]; // fallback Tech Lead
        }

        if (!processingAgent) return; // No agents deployed

        editorStore.setAgentStatus(processingAgent.id, true, null);

        const controller = new AbortController();
        abortRef.current = controller;
        const traces: Trace[] = [];

        setStatus(`waiting for ${processingAgent.name}`);

        const onUpdate = (update: AgentUpdate) => {
            if (update.type === "thinking") {
                setStatus(`${processingAgent!.name} is thinking...`);
            } else if (update.type === "tool") {
                traces.push({ type: "tool", text: update.text });
                setLiveTraces([...traces]);
                setStatus(`${processingAgent!.name}: ` + update.text);

                const pathMatch = update.text.match(/(?:[a-zA-Z]:[\\/]|(?:\.\/|\.\.\/)+)[a-zA-Z0-9_\-\.\/\\]+/);
                if (pathMatch) {
                    editorStore.setAgentStatus(processingAgent!.id, true, pathMatch[0].replace(/\\/g, '/'));
                }
            } else if (update.type === "tool_result") {
                traces.push({ type: "result", text: update.text });
                setLiveTraces([...traces]);
            }
        };

        try {
            // Send full unified context up to this point
            const { history: newHistory } = await runAgentLoop(
                promptText,
                currentHistoryBase,
                onUpdate,
                controller.signal
            );

            // Fetch the final output the AI returned 
            const finalAiMessage = newHistory[newHistory.length - 1];

            let resultData = {
                role: "assistant" as const,
                content: finalAiMessage.content,
                traces: traces.length > 0 ? [...traces] : undefined,
                authorId: processingAgent.id,
                authorName: processingAgent.name
            };

            const updatedHistory = [...currentHistoryBase, resultData];
            editorStore.updateSwarmHistory(updatedHistory);

            // Check for collaboration request in AI's output
            // e.g. "I think you should look @Model2"
            activeSession.agents.forEach(collaborator => {
                const mentionTag = `@${collaborator.name}`;
                if (finalAiMessage.content.includes(mentionTag) && collaborator.id !== processingAgent!.id) {
                    // Start next recursive turn after slight delay
                    setTimeout(() => {
                        setLiveTraces([]);
                        runInferenceIteration(
                            `Agent ${processingAgent!.name} @ mentioned you in the history. Respond seamlessly.`,
                            updatedHistory,
                            collaborator.id
                        );
                    }, 500);
                }
            });

        } catch (e: any) {
            if (e.message !== "Aborted") {
                const errorHistory = [...currentHistoryBase, {
                    role: "assistant" as const,
                    content: `Error: ${e.message}`,
                    traces: traces.length > 0 ? [...traces] : undefined,
                    authorId: processingAgent.id,
                    authorName: processingAgent.name
                }];
                editorStore.updateSwarmHistory(errorHistory);
            }
        } finally {
            editorStore.setAgentStatus(processingAgent.id, false, null);
        }
    };

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading || !activeSessionId || !activeSession) return;

        setInput("");
        setLoading(true);
        setStatus("Thinking");
        setLiveTraces([]);

        let routingAgentId: string | undefined = undefined;
        // Check local routing
        // Regex over the raw markup, e.g. @[GPT-4](agent-123)
        // Or simply pull ID directly
        activeSession.agents.forEach(a => {
            if (text.includes(`](${a.id})`)) routingAgentId = a.id;
        });

        // Strip the [ ] ( ) markup for standard rendering before inserting to history
        const cleanedText = text.replace(/@\[(.*?)\]\([^)]+\)/g, "@$1");

        const currentHistory = [...sessionHistory, { role: "user" as const, content: cleanedText, authorName: "User" }];
        editorStore.updateSwarmHistory(currentHistory);

        await runInferenceIteration(cleanedText, currentHistory, routingAgentId);

        setLoading(false);
        setStatus("");
        setLiveTraces([]);
        abortRef.current = null;
    }, [input, loading, activeSessionId, activeSession, sessionHistory]);

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    if (!activeSessionId) {
        return (
            <div
                ref={panelRef}
                className={`swarms-chat-panel ${chatPanelOpen ? 'open' : ''}`}
                style={{ width: chatPanelOpen ? panelWidth : 0 }}
            >

                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: 11 }}>
                    Create a Swarm Session to begin formatting.
                </div>
            </div>
        );
    }

    return (
        <div
            ref={panelRef}
            className={`swarms-chat-panel ${chatPanelOpen ? 'open' : ''}`}
            style={{ width: chatPanelOpen ? width : 0 }}
        >

            {/* <div className="swarms-sidebar-header flex items-center gap-1.5">
                <RiHashtag size={13} className="opacity-80 translate-y-[0.5px] text-white/40" />
                <span className="text-[12px] font-semibold text-white/40 leading-none">
                    {activeSession?.name?.replace(/\s+/g, '-').toLowerCase() || 'channel'}
                </span>
            </div> */}

            <div className="swarms-chat-container" ref={chatContainerRef}>
                {sessionHistory.length === 0 && !loading && (
                    <div className="agent-empty" style={{ opacity: 0.5, fontSize: 11, textAlign: 'center', marginTop: 40 }}>
                        {activeSession?.agents?.length === 0 ? "NO AGENTS DEPLOYED" : "Describe the task"}
                    </div>
                )}

                {sessionHistory.filter((m: any) => m.role !== 'system').map((m: any, i: number) => (
                    <ChatMessage key={i} role={m.role} text={m.content} traces={m.traces} authorName={m.authorName} />
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
                    <MentionsInput
                        inputRef={textareaRef}
                        className="swarms-mentions-input"
                        placeholder="Message channel... Type @ to mention an agent."
                        value={input}
                        onChange={(_, newValue) => setInput(newValue)}
                        onKeyDown={handleKey}
                        disabled={loading}
                        style={{
                            control: { fontSize: 13, fontWeight: 'normal' },
                            highlighter: { padding: 12, color: 'transparent' },
                            input: { padding: 12, border: 'none', outline: 'none', minHeight: 48, color: '#fff', background: 'transparent' },
                            suggestions: {
                                backgroundColor: 'transparent',
                                list: { backgroundColor: '#111', border: '1px solid #333', fontSize: 12, borderRadius: 4 },
                                item: { padding: '8px 12px', borderBottom: '1px solid #222' }
                            }
                        }}
                    >
                        <Mention
                            trigger="@"
                            markup="@[__display__](__id__)"
                            data={activeSession?.agents?.map(a => ({ id: a.id, display: a.name })) || []}
                            displayTransform={(_, display) => ` @${display} `}
                            style={{ backgroundColor: 'rgba(100, 255, 218, 0.2)', borderRadius: 5 }}
                        />
                    </MentionsInput>
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

