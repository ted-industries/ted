import { hoverTooltip, type Tooltip, type EditorView } from "@codemirror/view";
import { lspManager } from "../../../services/lsp/lsp-manager";

function renderHoverContent(contents: unknown): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "cm-lsp-hover";
    dom.style.cssText =
        "max-width:500px;max-height:300px;overflow:auto;padding:8px 12px;" +
        "font-size:13px;line-height:1.4;color:#ccc;";

    let text = "";
    if (typeof contents === "string") {
        text = contents;
    } else if (contents && typeof contents === "object" && "value" in contents) {
        text = (contents as { value: string }).value;
    } else if (Array.isArray(contents)) {
        text = contents
            .map((c: unknown) => (typeof c === "string" ? c : (c as { value: string }).value))
            .join("\n\n");
    }

    if (!text) {
        dom.textContent = "(no information)";
        return dom;
    }

    // Simple markdown-ish rendering: code blocks as <pre>, rest as text
    const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 2) {
            const pre = document.createElement("pre");
            pre.style.cssText =
                "background:#1e1e1e;padding:6px 8px;border-radius:3px;" +
                "overflow-x:auto;margin:4px 0;font-size:12px;white-space:pre-wrap;";
            pre.textContent = parts[i];
            dom.appendChild(pre);
        } else if (i % 3 === 0 && parts[i].trim()) {
            const p = document.createElement("div");
            p.style.cssText = "margin:2px 0;";
            p.textContent = parts[i].trim();
            dom.appendChild(p);
        }
    }

    return dom;
}

export function lspHoverTooltip() {
    return hoverTooltip(
        async (view: EditorView, pos: number): Promise<Tooltip | null> => {
            const path = (view as unknown as { __tedFilePath?: string }).__tedFilePath;
            if (!path) return null;

            const client = lspManager.getClientForFile(path);
            if (!client) return null;

            const line = view.state.doc.lineAt(pos);
            const lspPosition = {
                line: line.number - 1,
                character: pos - line.from,
            };

            const uri = lspManager.pathToUri(path);
            const result = await client.hover(uri, lspPosition);
            if (!result || !result.contents) return null;

            let from = pos;
            let to = pos;
            if (result.range) {
                const startLine = view.state.doc.line(result.range.start.line + 1);
                from = startLine.from + result.range.start.character;
                const endLine = view.state.doc.line(result.range.end.line + 1);
                to = endLine.from + result.range.end.character;
            }

            return {
                pos: from,
                end: to,
                above: true,
                create() {
                    return { dom: renderHoverContent(result.contents) };
                },
            };
        },
        { hideOnChange: true, hoverTime: 350 },
    );
}
