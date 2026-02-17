// ---- JSON-RPC ----

export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}

// ---- LSP Core Types ----

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface Location {
    uri: string;
    range: Range;
}

export interface TextDocumentIdentifier {
    uri: string;
}

export interface TextDocumentContentChangeEvent {
    range?: Range;
    text: string;
}

// ---- Completions ----

export interface CompletionItem {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: string | MarkupContent;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: number;
    textEdit?: TextEdit;
    additionalTextEdits?: TextEdit[];
}

export interface CompletionList {
    isIncomplete: boolean;
    items: CompletionItem[];
}

export const CompletionItemKind = {
    Text: 1, Method: 2, Function: 3, Constructor: 4,
    Field: 5, Variable: 6, Class: 7, Interface: 8,
    Module: 9, Property: 10, Unit: 11, Value: 12,
    Enum: 13, Keyword: 14, Snippet: 15, Color: 16,
    File: 17, Reference: 18, Folder: 19, EnumMember: 20,
    Constant: 21, Struct: 22, Event: 23, Operator: 24,
    TypeParameter: 25,
} as const;

// ---- Hover ----

export interface Hover {
    contents: MarkupContent | string | Array<string | { language: string; value: string }>;
    range?: Range;
}

export interface MarkupContent {
    kind: "plaintext" | "markdown";
    value: string;
}

// ---- Diagnostics ----

export interface Diagnostic {
    range: Range;
    severity?: number;
    code?: number | string;
    source?: string;
    message: string;
}

export const DiagnosticSeverity = {
    Error: 1, Warning: 2, Information: 3, Hint: 4,
} as const;

// ---- Text Edit ----

export interface TextEdit {
    range: Range;
    newText: string;
}

// ---- Server Capabilities (subset we use) ----

export interface ServerCapabilities {
    completionProvider?: { triggerCharacters?: string[]; resolveProvider?: boolean };
    hoverProvider?: boolean | object;
    definitionProvider?: boolean | object;
    referencesProvider?: boolean | object;
    typeDefinitionProvider?: boolean | object;
    textDocumentSync?: number | { openClose?: boolean; change?: number; save?: boolean | object };
}

// ---- LSP Server Config ----

export interface LspServerConfig {
    command: string;
    args: string[];
    languages: string[]; // file extensions: [".ts", ".tsx", ".js"]
    enabled?: boolean;
}
