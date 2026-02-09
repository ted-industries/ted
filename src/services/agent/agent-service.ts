/**
 * Agent Service — Tool-using LLM agent for ted editor.
 * 
 * Architecture: System prompt → LLM → parse tool calls → execute → loop.
 * Max 10 iterations. All tool execution via Tauri invoke (fast, local).
 * Runs fully async — never blocks the editor.
 */

import { invoke } from "@tauri-apps/api/core";
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
// System prompt — adapted from prompt.txt for ted's tool set
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are ted, a fast AI coding agent embedded in the ted editor. You help users with their coding tasks.

You have tools at your disposal. To use a tool, output a JSON block fenced with \`\`\`tool tags:

\`\`\`tool
{"tool": "read_file", "args": {"path": "/absolute/path/to/file"}}
\`\`\`

\`\`\`tool
{"tool": "grep", "args": {"pattern": "searchPattern", "path": "/dir/or/file"}}
\`\`\`

\`\`\`tool
{"tool": "list_dir", "args": {"path": "/absolute/path"}}
\`\`\`

\`\`\`tool
{"tool": "edit_file", "args": {"path": "/absolute/path", "search": "exact old text", "replace": "new text"}}
\`\`\`

Rules:
1. You can call ONE tool per response. After the tool result is returned, you continue.
2. Always use absolute file paths.
3. Keep going until the user's request is fully resolved. Don't stop early.
4. When no more tool calls are needed, respond with your final answer as plain text (no tool blocks).
5. Be concise. Don't explain what you're about to do — just do it.
6. For edit_file: "search" must be an exact substring of the current file content. "replace" is what replaces it.
7. If you need to create a new file, use edit_file with search="" and the full file contents as replace.
8. When you read a file, its content is returned. Use that to inform your edits.
9. For grep: pattern is a regex. Results include file paths, line numbers, and matching lines.
10. Be thorough — read files before editing so you understand the full context.
`;

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

interface ToolCall {
    tool: string;
    args: Record<string, any>;
}

function parseToolCalls(response: string): ToolCall | null {
    // Match ```tool ... ``` blocks
    const regex = /```tool\s*\n([\s\S]*?)\n```/;
    const match = response.match(regex);
    if (!match) return null;

    try {
        return JSON.parse(match[1].trim());
    } catch {
        return null;
    }
}


async function executeTool(call: ToolCall, cwd: string): Promise<string> {
    const t = call.tool;
    const a = call.args;

    try {
        if (t === "read_file") {
            const content: string = await invoke("read_file", { path: a.path });
            // Number lines for context
            const lines = content.split("\n");
            const numbered = lines.map((l, i) => `${i + 1}|${l}`).join("\n");
            return numbered.length > 30000
                ? numbered.slice(0, 30000) + "\n... [truncated]"
                : numbered;
        }

        if (t === "list_dir") {
            const entries: { name: string; is_dir: boolean }[] = await invoke("list_dir", {
                path: a.path || cwd,
            });
            return entries
                .map((e) => `${e.is_dir ? "📁" : "📄"} ${e.name}`)
                .join("\n");
        }

        if (t === "grep") {
            const results: {
                path: string;
                line_number: number;
                line_text: string;
                match_text: string;
            }[] = await invoke("ripgrep_search", {
                query: a.pattern,
                cwd: a.path || cwd,
                caseSensitive: false,
                regex: true,
                maxResults: 50,
            });

            if (results.length === 0) return "No matches found.";

            return results
                .map((r) => `${r.path}:${r.line_number}: ${r.line_text}`)
                .join("\n");
        }

        if (t === "edit_file") {
            if (!a.search && a.replace) {
                // Create new file
                await invoke("write_file", { path: a.path, content: a.replace });
                // Update open tab if exists
                const tab = editorStore.getState().tabs.find((tab) => tab.path === a.path);
                if (tab) {
                    editorStore.updateTabContent(a.path, a.replace);
                    editorStore.markTabSaved(a.path, a.replace);
                }
                return `Created ${a.path}`;
            }

            // Read, replace, write
            const content: string = await invoke("read_file", { path: a.path });
            if (!content.includes(a.search)) {
                return `Error: search string not found in ${a.path}. Read the file first to get exact content.`;
            }
            const newContent = content.replace(a.search, a.replace);
            await invoke("write_file", { path: a.path, content: newContent });

            // Update open tab
            const tab = editorStore.getState().tabs.find((tab) => tab.path === a.path);
            if (tab) {
                editorStore.updateTabContent(a.path, newContent);
                editorStore.markTabSaved(a.path, newContent);
            }
            return `Edited ${a.path}`;
        }

        return `Unknown tool: ${t}`;
    } catch (e: any) {
        return `Tool error: ${e.message || e}`;
    }
}

// ---------------------------------------------------------------------------
// Context builder — injects active file info
// ---------------------------------------------------------------------------

function buildEditorContext(): string {
    const state = editorStore.getState();
    const parts: string[] = [];

    // Workspace
    if (state.explorerPath) {
        parts.push(`Workspace: ${state.explorerPath}`);
    }

    // Active file
    const activeTab = state.tabs.find((t) => t.path === state.activeTabPath);
    if (activeTab && activeTab.content) {
        const lines = activeTab.content.split("\n");
        const numbered = lines.map((l, i) => `${i + 1}|${l}`).join("\n");
        const truncated =
            numbered.length > 15000
                ? numbered.slice(0, 15000) + "\n... [truncated]"
                : numbered;
        parts.push(`Active file: ${activeTab.path}\n\`\`\`\n${truncated}\n\`\`\``);
    }

    // Open files
    const otherTabs = state.tabs
        .filter((t) => t.path !== state.activeTabPath)
        .map((t) => t.path);
    if (otherTabs.length > 0) {
        parts.push(`Other open files: ${otherTabs.join(", ")}`);
    }

    return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Agent loop — the core
// ---------------------------------------------------------------------------

export interface AgentUpdate {
    type: "thinking" | "tool" | "tool_result" | "response" | "error";
    text: string;
}

export type AgentUpdateCallback = (update: AgentUpdate) => void;

const MAX_ITERATIONS = 10;

export async function runAgentLoop(
    userMessage: string,
    onUpdate: AgentUpdateCallback,
    signal?: AbortSignal
): Promise<string> {
    const config = editorStore.getState().settings.llm as LLMConfig;
    const provider = providers[config.provider];
    if (!provider) throw new Error("No LLM provider configured");

    const cwd = editorStore.getState().explorerPath || "";
    const context = buildEditorContext();

    // Build messages array
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

        // Call LLM
        const response = await provider.agentChat(messages, config);

        // Check for tool calls
        const toolCall = parseToolCalls(response);

        if (!toolCall) {
            // No tool call — this is the final response
            finalResponse = response;
            break;
        }

        // Show what tool is being used
        const toolLabel = `${toolCall.tool}(${Object.values(toolCall.args).map(v => typeof v === "string" ? v.slice(0, 60) : v).join(", ")})`;
        onUpdate({ type: "tool", text: toolLabel });

        // Add assistant response to history
        messages.push({ role: "assistant", content: response });

        // Execute tool
        const result = await executeTool(toolCall, cwd);

        // Truncate large results
        const truncResult = result.length > 20000
            ? result.slice(0, 20000) + "\n... [truncated]"
            : result;

        onUpdate({ type: "tool_result", text: result.length > 200 ? result.slice(0, 200) + "..." : result });

        // Add tool result as user message
        messages.push({
            role: "user",
            content: `Tool result for ${toolCall.tool}:\n${truncResult}`,
        });
    }

    if (!finalResponse) {
        finalResponse = "Reached maximum iterations. The task may be partially complete.";
    }

    return finalResponse;
}
