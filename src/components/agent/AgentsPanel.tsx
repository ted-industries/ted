import { useState, useRef, useEffect, useCallback } from "react";
import { editorStore } from "../../store/editor-store";
import {
    OllamaProvider,
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
    LLMProvider,
    LLMConfig
} from "../../services/llm/providers";
import "./AgentsPanel.css";

interface Message {
    role: "user" | "agent";
    text: string;
}

const providers: Record<string, LLMProvider> = {
    ollama: new OllamaProvider(),
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
    google: new GoogleProvider(),
};

export default function AgentsPanel() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView();
    }, [messages]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        setInput("");
        setMessages((prev) => [...prev, { role: "user", text }]);
        setLoading(true);

        try {
            const config = editorStore.getState().settings.llm as LLMConfig;
            const provider = providers[config.provider];
            if (!provider) throw new Error("No provider");

            const reply = await provider.chat(text, config);
            setMessages((prev) => [...prev, { role: "agent", text: reply }]);
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { role: "agent", text: e.message || "error" },
            ]);
        } finally {
            setLoading(false);
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
                            {m.text}
                        </div>
                    ))}
                    {loading && <div className="agent-typing">...</div>}
                    <div ref={bottomRef} />
                </div>
            )}
            <div className="agent-input-row">
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
