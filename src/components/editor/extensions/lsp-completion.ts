import type {
    CompletionContext,
    CompletionResult,
    Completion,
} from "@codemirror/autocomplete";
import { lspManager } from "../../../services/lsp/lsp-manager";
import { CompletionItemKind, type CompletionItem } from "../../../services/lsp/types";

function lspKindToType(kind?: number): string {
    switch (kind) {
        case CompletionItemKind.Function:
        case CompletionItemKind.Method:
            return "function";
        case CompletionItemKind.Variable:
            return "variable";
        case CompletionItemKind.Class:
        case CompletionItemKind.Interface:
            return "class";
        case CompletionItemKind.Module:
        case CompletionItemKind.Folder:
            return "namespace";
        case CompletionItemKind.Property:
        case CompletionItemKind.Field:
            return "property";
        case CompletionItemKind.Keyword:
            return "keyword";
        case CompletionItemKind.Snippet:
            return "text";
        case CompletionItemKind.Constant:
        case CompletionItemKind.EnumMember:
            return "constant";
        case CompletionItemKind.Enum:
            return "enum";
        case CompletionItemKind.TypeParameter:
        case CompletionItemKind.Struct:
            return "type";
        default:
            return "text";
    }
}

/** Monotonic counter to discard stale responses */
let lastRequestId = 0;

export async function lspCompletionSource(
    context: CompletionContext,
): Promise<CompletionResult | null> {
    const path = (context.view as unknown as { __tedFilePath?: string }).__tedFilePath;
    if (!path) return null;

    const client = lspManager.getClientForFile(path);
    if (!client) return null;

    const currentId = ++lastRequestId;

    const pos = context.pos;
    const line = context.state.doc.lineAt(pos);
    const lspPosition = {
        line: line.number - 1,
        character: pos - line.from,
    };

    const uri = lspManager.pathToUri(path);
    const result = await client.completion(uri, lspPosition);

    // Discard if a newer request superseded this one
    if (currentId !== lastRequestId) return null;
    if (!result) return null;

    const items: CompletionItem[] = Array.isArray(result) ? result : result.items;
    if (!items || items.length === 0) return null;

    const word = context.matchBefore(/[\w$]+/);
    const from = word?.from ?? pos;

    const completions: Completion[] = items.map((item) => {
        const doc = typeof item.documentation === "string"
            ? item.documentation
            : item.documentation?.value;

        return {
            label: item.label,
            type: lspKindToType(item.kind),
            detail: item.detail,
            info: doc,
            boost: item.sortText ? -item.sortText.charCodeAt(0) : 0,
            apply: item.insertText ?? item.label,
        };
    });

    return {
        from,
        options: completions,
        validFor: /^[\w$]*$/,
    };
}
