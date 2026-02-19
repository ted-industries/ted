/**
 * Agent Service — the orchestrator.
 *
 * Imports the system prompt and tool executor, wires them into an
 * async agent loop that calls the LLM, parses tool calls, executes
 * them, and feeds results back until the task is resolved.
 */

import { editorStore } from "../../store/editor-store";
import {
    OllamaProvider,
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
    LLMProvider,
    LLMConfig,
    ChatMessage,
} from "../llm/providers";
import { SYSTEM_PROMPT } from "./system-prompt";
import { parseToolCall, executeTool } from "./tools";

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const providers: Record<string, LLMProvider> = {
    ollama: new OllamaProvider(),
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
    google: new GoogleProvider(),
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AgentUpdate {
    type: "thinking" | "tool" | "tool_result" | "response" | "error";
    text: string;
}

export type AgentUpdateCallback = (update: AgentUpdate) => void;

// ---------------------------------------------------------------------------
// Context builder — injects active file info into the user message
// ---------------------------------------------------------------------------

function buildEditorContext(): string {
    const state = editorStore.getState();
    const parts: string[] = [];

    if (state.explorerPath) {
        parts.push(`Workspace: ${state.explorerPath}`);
    }

    const activeTab = state.tabs.find((t) => t.path === state.activeTabPath);
    if (activeTab?.content) {
        const lines = activeTab.content.split("\n");
        const numbered = lines.map((l, i) => `${i + 1}|${l}`).join("\n");
        const truncated = numbered.length > 15_000
            ? numbered.slice(0, 15_000) + "\n... [truncated]"
            : numbered;
        parts.push(`Active file: ${activeTab.path}\n\`\`\`\n${truncated}\n\`\`\``);
    }

    const otherTabs = state.tabs
        .filter((t) => t.path !== state.activeTabPath)
        .map((t) => t.path);
    if (otherTabs.length > 0) {
        parts.push(`Other open files: ${otherTabs.join(", ")}`);
    }

    return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

const MAX_ITERATIONS = 15;

export async function runAgentLoop(
    userMessage: string,
    onUpdate: AgentUpdateCallback,
    signal?: AbortSignal,
): Promise<string> {
    const config = editorStore.getState().settings.llm as LLMConfig;
    const provider = providers[config.provider];
    if (!provider) throw new Error("No LLM provider configured");

    const cwd = editorStore.getState().explorerPath || "";
    const context = buildEditorContext();

    const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: context
                ? `<editor_context>\n${context}\n</editor_context>\n\n${userMessage}`
                : userMessage,
        },
    ];

    let finalResponse = "";

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (signal?.aborted) throw new Error("Aborted");

        onUpdate({ type: "thinking", text: `thinking${i > 0 ? ` (step ${i + 1})` : ""}...` });

        const response = await provider.agentChat(messages, config);
        const toolCall = parseToolCall(response);

        if (!toolCall) {
            finalResponse = response;
            break;
        }

        // Show tool label
        const toolLabel = `${toolCall.tool}(${Object.values(toolCall.args)
            .map((v) => (typeof v === "string" ? v.slice(0, 60) : v))
            .join(", ")})`;
        onUpdate({ type: "tool", text: toolLabel });

        messages.push({ role: "assistant", content: response });

        const result = await executeTool(toolCall, cwd);
        const truncResult = result.length > 20_000
            ? result.slice(0, 20_000) + "\n... [truncated]"
            : result;

        onUpdate({
            type: "tool_result",
            text: result.length > 200 ? result.slice(0, 200) + "..." : result,
        });

        messages.push({ role: "user", content: `Tool result for ${toolCall.tool}:\n${truncResult}` });

        // Wait a bit to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!finalResponse) {
        finalResponse = "Reached maximum iterations. The task may be partially complete.";
    }

    return stripToolBlocks(finalResponse);
}

// ---------------------------------------------------------------------------
// Cleanup — strip any residual tool blocks from the final response
// ---------------------------------------------------------------------------

function stripToolBlocks(text: string): string {
    return text
        // Remove ```tool ... ``` blocks
        .replace(/```(?:tool|json)\s*\n[\s\S]*?\n```/g, "")
        // Remove <function_calls>...</function_calls> XML blocks
        .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
        // Remove standalone <invoke ...>...</invoke> XML blocks
        .replace(/<invoke[\s\S]*?<\/invoke>/g, "")
        // Remove <function_calls> style tags
        .replace(/<[\s\S]*?<\/antml:[^>]+>/g, "")
        // Clean up excessive blank lines left behind
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

