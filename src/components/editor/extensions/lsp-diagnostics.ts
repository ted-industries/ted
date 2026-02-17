import { linter, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { Diagnostic } from "../../../services/lsp/types";
import { DiagnosticSeverity } from "../../../services/lsp/types";

function lspSeverityToCm(severity?: number): "error" | "warning" | "info" | "hint" {
    switch (severity) {
        case DiagnosticSeverity.Error: return "error";
        case DiagnosticSeverity.Warning: return "warning";
        case DiagnosticSeverity.Information: return "info";
        case DiagnosticSeverity.Hint: return "hint";
        default: return "warning";
    }
}

/**
 * Convert LSP diagnostics to CM6 diagnostics for a given editor view.
 */
export function convertDiagnostics(
    view: EditorView,
    diagnostics: Diagnostic[],
): CmDiagnostic[] {
    const doc = view.state.doc;
    const cmDiags: CmDiagnostic[] = [];

    for (const diag of diagnostics) {
        try {
            const startLine = doc.line(diag.range.start.line + 1);
            const endLine = doc.line(diag.range.end.line + 1);
            const from = startLine.from + diag.range.start.character;
            const to = endLine.from + diag.range.end.character;

            if (from >= 0 && to <= doc.length && from <= to) {
                cmDiags.push({
                    from,
                    to: Math.max(to, from + 1), // ensure non-zero width
                    severity: lspSeverityToCm(diag.severity),
                    message: diag.message,
                    source: diag.source,
                });
            }
        } catch {
            // Skip diagnostics with out-of-range positions
        }
    }

    return cmDiags;
}

/**
 * A host linter extension that receives diagnostics externally via setDiagnostics.
 * The actual diagnostics are pushed from lsp-sync.ts when the server sends
 * textDocument/publishDiagnostics notifications.
 */
export function lspDiagnosticsExtension() {
    return linter(() => [], { delay: 0 });
}
