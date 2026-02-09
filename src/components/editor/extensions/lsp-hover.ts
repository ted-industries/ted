import { hoverTooltip, type Tooltip, type EditorView } from "@codemirror/view";
import { lspManager } from "../../../services/lsp/lsp-manager";
import { filePathFacet } from "./lsp-filepath";

// Inject hover styles once into the document head
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
.cm-lsp-hover { max-width:500px; max-height:300px; overflow:auto; padding:8px 12px; font-size:13px; line-height:1.4; color:#ccc; }
.cm-lsp-hover pre { background:#1e1e1e; padding:6px 8px; border-radius:3px; overflow-x:auto; margin:4px 0; font-size:12px; white-space:pre-wrap; }
.cm-lsp-hover div { margin:2px 0; }
`;
  document.head.appendChild(style);
}

function renderHoverContent(contents: unknown): HTMLElement {
  injectStyles();
  const dom = document.createElement("div");
  dom.className = "cm-lsp-hover";

  let text = "";
  if (typeof contents === "string") {
    text = contents;
  } else if (contents && typeof contents === "object" && "value" in contents) {
    text = (contents as { value: string }).value;
  } else if (Array.isArray(contents)) {
    text = contents
      .map((c: unknown) =>
        typeof c === "string" ? c : (c as { value: string }).value,
      )
      .join("\n\n");
  }

  if (!text) {
    dom.textContent = "(no information)";
    return dom;
  }

  // Fast path: no code fences — just set textContent (no DOM tree building)
  if (!text.includes("```")) {
    dom.textContent = text;
    return dom;
  }

  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 2) {
      const pre = document.createElement("pre");
      pre.textContent = parts[i];
      dom.appendChild(pre);
    } else if (i % 3 === 0 && parts[i].trim()) {
      const p = document.createElement("div");
      p.textContent = parts[i].trim();
      dom.appendChild(p);
    }
  }

  return dom;
}

export function lspHoverTooltip() {
  return hoverTooltip(
    async (view: EditorView, pos: number): Promise<Tooltip | null> => {
      const path = view.state.facet(filePathFacet);
      if (!path) return null;

      const client = lspManager.getClientForFile(path);
      if (!client) return null;

      const line = view.state.doc.lineAt(pos);
      const uri = lspManager.pathToUri(path);

      // client.hover() auto-cancels any previous in-flight hover request
      const result = await client.hover(uri, {
        line: line.number - 1,
        character: pos - line.from,
      });
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
        create: () => ({ dom: renderHoverContent(result.contents) }),
      };
    },
    { hideOnChange: true, hoverTime: 350 },
  );
}
