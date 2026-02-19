/**
 * Agent tool execution — maps LLM tool calls to Tauri invoke commands.
 */

import { invoke } from "@tauri-apps/api/core";
import { editorStore } from "../../store/editor-store";
import { agentDriver } from "../agent-driver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCall {
    tool: string;
    args: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse tool calls from the LLM response.
 * Tries multiple formats:
 *   1. ```tool { JSON } ```          (intended format)
 *   2. ```json { "tool": ... } ```   (common variant)
 *   3. <invoke name="X">...</invoke> (XML hallucination)
 *   4. {"tool": "...", "args": ...}  (bare JSON in text)
 */
export function parseToolCall(response: string): ToolCall | null {
    // 1. ```tool or ```json blocks
    const fencedMatch = response.match(/```(?:tool|json)\s*\n([\s\S]*?)\n```/);
    if (fencedMatch) {
        try {
            const parsed = JSON.parse(fencedMatch[1].trim());
            if (parsed.tool && parsed.args) return parsed;
        } catch { /* fall through */ }
    }

    // 2. XML-style <invoke name="tool_name"><parameter name="key">value</parameter></invoke>
    const invokeMatch = response.match(/<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/);
    if (invokeMatch) {
        const tool = invokeMatch[1];
        const paramsBlock = invokeMatch[2];
        const args: Record<string, any> = {};
        const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
        let pm: RegExpExecArray | null;
        while ((pm = paramRegex.exec(paramsBlock)) !== null) {
            const val = pm[2].trim();
            // Try to parse as JSON (for arrays, objects), fall back to string
            try { args[pm[1]] = JSON.parse(val); } catch { args[pm[1]] = val; }
        }
        if (tool) return { tool, args };
    }

    // 3. Bare JSON with "tool" and "args" keys anywhere in text
    const jsonMatch = response.match(/\{[\s\S]*?"tool"\s*:\s*"[^"]+?"[\s\S]*?"args"\s*:\s*\{[\s\S]*?\}\s*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.tool && parsed.args) return parsed;
        } catch { /* fall through */ }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeTool(call: ToolCall, cwd: string): Promise<string> {
    const t = call.tool;
    const a = call.args;

    try {
        if (t === "read_file") {
            const path = resolvePath(a.target_file, cwd);
            const content: string = await invoke("read_file", { path });
            const lines = content.split("\n");
            const offset = a.offset ? Number(a.offset) - 1 : 0;
            const limit = a.limit ? Number(a.limit) : lines.length;
            const slice = lines.slice(offset, offset + limit);
            const numbered = slice.map((l, i) => `${offset + i + 1}|${l}`).join("\n");
            return truncate(numbered, 30_000);
        }

        if (t === "list_dir") {
            const path = resolvePath(a.target_directory, cwd);
            const entries: { name: string; is_dir: boolean }[] = await invoke("list_dir", { path });
            return entries.map((e) => `${e.is_dir ? "📁" : "📄"} ${e.name}`).join("\n");
        }

        if (t === "grep") {
            return await ripgrepSearch(a.pattern, a.path ? resolvePath(a.path, cwd) : cwd, true, 100);
        }

        if (t === "codebase_search") {
            const dir = a.target_directories?.length > 0 ? resolvePath(a.target_directories[0], cwd) : cwd;
            return await ripgrepSearch(a.query || "", dir, false, 50);
        }

        if (t === "edit_file") {
            const path = resolvePath(a.target_file, cwd);
            const codeEdit: string = a.code_edit || a.replace || "";

            let existingContent = "";
            try { existingContent = await invoke("read_file", { path }); } catch { /* new file */ }

            const newContent = existingContent
                ? applySketchEdit(existingContent, codeEdit)
                : codeEdit.replace(/\/\/\s*\.\.\.\s*existing code\s*\.\.\.\s*\n?/g, "");

            await invoke("write_file", { path, content: newContent });

            const tab = editorStore.getState().tabs.find((tab) => tab.path === path);
            if (tab) {
                editorStore.updateTabContent(path, newContent);
                editorStore.markTabSaved(path, newContent);
            }
            return `Edited ${path}`;
        }

        if (t === "delete_file") {
            const path = resolvePath(a.target_file, cwd);
            await invoke("write_file", { path, content: "" });
            return `Deleted ${path}`;
        }

        if (t === "run_terminal_cmd") {
            const timeoutMs = a.timeout ? Number(a.timeout) : 5000;

            // Check if we should run in background via new command
            // If background is requested or default, we use exec_background_cmd
            const res: any = await invoke("exec_background_cmd", {
                command: a.command,
                cwd,
                timeoutMs,
            });

            if (res.status === "running") {
                return `Command timed out but is running in background.\nPID: ${res.pid}\n\nSTDOUT so far:\n${truncate(res.stdout, 1000)}\n\nSTDERR so far:\n${truncate(res.stderr, 1000)}\n\nUse the 'check_background_cmd' tool (or schedule a check) to see progress.`;
            }

            if (res.exit_code !== 0 && res.exit_code !== null) {
                return `Command failed (exit code ${res.exit_code}):\n${res.stderr}\n${res.stdout}`;
            }
            return res.stdout ? truncate(res.stdout, 10000) : "Command completed with no output.";
        }

        if (t === "file_search") {
            const pattern = a.glob_pattern || "*";
            const results: { path: string }[] = await invoke("ripgrep_search", {
                query: "", cwd, caseSensitive: false, regex: false, maxResults: 50,
            });
            const unique = [...new Set(results.map((r) => r.path))];
            const filtered = unique.filter((p) => simpleGlobMatch(p, pattern));
            return filtered.length > 0 ? filtered.join("\n") : "No files found matching pattern.";
        }

        if (t === "check_background_cmd") {
            const res: any = await invoke("check_background_cmd", { pid: a.pid });
            if (res.status === "running") {
                return `Still running.\nSTDOUT:\n${truncate(res.stdout, 2000)}\nSTDERR:\n${truncate(res.stderr, 2000)}`;
            }
            return `Finished (exit ${res.exit_code}).\nSTDOUT:\n${truncate(res.stdout, 5000)}\nSTDERR:\n${truncate(res.stderr, 5000)}`;
        }

        if (t === "schedule_request") {
            const delay = Number(a.delay_seconds) * 1000;
            setTimeout(() => {
                editorStore.addAgentMessage({ role: "user", content: `[SCHEDULED REMINDER]: ${a.message}` });
                // We need to trigger the loop if it's not running, but simply adding a message might not trigger it if it stopped.
                // However, usually the user (or system) re-initiates. 
                // For now, let's assume the user will see it or we trigger "continue".
                // Ideally we'd call runAgentLoop again but that requires access to it or a signal.
                // Hack: We'll append to history. If the agent is "Stopped", the user has to click "Retry" or type "Go".
                // But wait, the user wants the agent to wake up.
                // If we are here, the agent is running. It will return "Scheduled..." and likely Stop/Pause.
                // We need a way to auto-resume.
                // Let's just add the message. The UI should show it.
            }, delay);
            return `Scheduled message in ${a.delay_seconds}s: "${a.message}"`;
        }

        if (t === "todo_write") return "Todos updated.";

        // --- Browser Tools ---

        if (t === "browser_open") {
            const label = await agentDriver.spawn(a.url);
            return `Browser opened with label: ${label}`;
        }

        if (t === "browser_click") {
            await agentDriver.click(a.label, a.selector);
            return `Clicked ${a.selector}`;
        }

        if (t === "browser_type") {
            await agentDriver.type(a.label, a.selector, a.text);
            return `Typed into ${a.selector}`;
        }

        if (t === "browser_scroll") {
            await agentDriver.scroll(a.label, a.selector);
            return `Scrolled to ${a.selector}`;
        }

        if (t === "browser_hover") {
            await agentDriver.hover(a.label, a.selector);
            return `Hovered over ${a.selector}`;
        }

        if (t === "browser_read") {
            const content = await agentDriver.getContent(a.label);
            return truncate(content, 10000);
        }

        if (t === "browser_close") {
            await agentDriver.close(a.label);
            return `Browser window ${a.label} closed.`;
        }

        return `Unknown tool: ${t}. Available: read_file, edit_file, grep, codebase_search, list_dir, file_search, delete_file, run_terminal_cmd, browser_open, browser_click, browser_type, browser_input, browser_read, browser_close`;
    } catch (e: any) {
        return `Tool error: ${e.message || e}`;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolvePath(path: string, cwd: string): string {
    if (!path) return cwd;
    if (/^[A-Za-z]:[/\\]/.test(path) || path.startsWith("/")) return path;
    return `${cwd}/${path}`.replace(/\//g, "\\");
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "\n... [truncated]" : text;
}

function simpleGlobMatch(filepath: string, pattern: string): boolean {
    const re = new RegExp(
        "^" + pattern.replace(/\*\*/g, "<<D>>").replace(/\*/g, "[^/\\\\]*").replace(/<<D>>/g, ".*").replace(/\?/g, ".") + "$",
        "i",
    );
    return re.test(filepath) || re.test(filepath.split(/[/\\]/).pop() || "");
}

async function ripgrepSearch(query: string, cwd: string, regex: boolean, max: number): Promise<string> {
    const results: { path: string; line_number: number; line_text: string }[] = await invoke("ripgrep_search", {
        query, cwd, caseSensitive: false, regex, maxResults: max,
    });
    if (results.length === 0) return "No matches found.";
    return results.map((r) => `${r.path}:${r.line_number}: ${r.line_text}`).join("\n");
}

// ---------------------------------------------------------------------------
// Sketch edit — applies "// ... existing code ..." edits to files
// ---------------------------------------------------------------------------

export function applySketchEdit(existing: string, sketch: string): string {
    const existingLines = existing.split("\n");
    const sketchLines = sketch.split("\n");

    const markerRe = /^\s*(\/\/|#|--|\/\*|\*|<!--)\s*\.\.\.?\s*existing\s+code\s*\.\.\.?\s*(\*\/|-->)?\s*$/i;
    const hasMarkers = sketchLines.some((l) => markerRe.test(l));

    if (!hasMarkers) return sketch; // full replacement

    // Split sketch into alternating existing/new chunks
    const chunks: { type: "existing" | "new"; lines: string[] }[] = [];
    let cur: string[] = [];

    for (const line of sketchLines) {
        if (markerRe.test(line)) {
            if (cur.length) { chunks.push({ type: "new", lines: cur }); cur = []; }
            chunks.push({ type: "existing", lines: [] });
        } else {
            cur.push(line);
        }
    }
    if (cur.length) chunks.push({ type: "new", lines: cur });

    // Assemble result
    const result: string[] = [];
    let idx = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        if (chunk.type === "existing") {
            const next = chunks[i + 1];
            if (next?.lines.length) {
                const anchor = next.lines[0].trim();
                let found = -1;
                for (let j = idx; j < existingLines.length; j++) {
                    if (existingLines[j].trim() === anchor) { found = j; break; }
                }
                if (found >= 0) {
                    for (let j = idx; j < found; j++) result.push(existingLines[j]);
                    idx = found;
                }
            } else {
                for (let j = idx; j < existingLines.length; j++) result.push(existingLines[j]);
                idx = existingLines.length;
            }
        } else {
            const last = chunk.lines[chunk.lines.length - 1].trim();
            result.push(...chunk.lines);
            let skip = idx;
            for (let j = idx; j < existingLines.length; j++) {
                if (existingLines[j].trim() === last) { skip = j + 1; break; }
            }
            idx = skip;
        }
    }

    if (idx < existingLines.length) {
        for (let j = idx; j < existingLines.length; j++) result.push(existingLines[j]);
    }

    return result.join("\n");
}
