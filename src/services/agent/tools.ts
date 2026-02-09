/**
 * Agent tool execution — maps LLM tool calls to Tauri invoke commands.
 */

import { invoke } from "@tauri-apps/api/core";
import { editorStore } from "../../store/editor-store";

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

/** Parse a ```tool JSON block from the LLM response. */
export function parseToolCall(response: string): ToolCall | null {
    const match = response.match(/```tool\s*\n([\s\S]*?)\n```/);
    if (!match) return null;
    try {
        return JSON.parse(match[1].trim());
    } catch {
        return null;
    }
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
            return `Terminal commands are not yet supported in the ted agent. Please run manually: ${a.command}`;
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

        if (t === "todo_write") return "Todos updated.";

        return `Unknown tool: ${t}. Available: read_file, edit_file, grep, codebase_search, list_dir, file_search, delete_file, run_terminal_cmd`;
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
