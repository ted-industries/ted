// define accepted messages
type WorkerMessage =
    | { type: "init"; language: string; wasmPath: string; initialContent: string }
    | { type: "update"; changes: any[]; newContent: string }; // Use any for edits for now as typings are lazy loaded

let parser: any = null;
let tree: any = null;
let languageName: string | null = null;

// Helper to safe-stringify objects for debugging
function removeCircular(obj: any, refs = new WeakSet()) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (refs.has(obj)) return '[Circular]';
    refs.add(obj);
    const newObj: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = removeCircular(obj[key], refs);
        }
    }
    return newObj;
}

// @ts-ignore
import { QueryManager } from "./query-manager";

let queryManager: QueryManager | null = null;

// Initial boot message to verify worker is running
self.postMessage({ type: "boot" });

const ctx: Worker = self as any;

// CRITICAL FIX: Pre-seed Emscripten Module configuration
// This prevents "Unable to determine script URL" errors by providing the location explicitly.
(self as any).Module = {
    locateFile: (path: string, prefix: string) => {
        if (path.endsWith('.wasm')) {
            return new URL("/tree-sitter/tree-sitter.wasm", self.location.origin).href;
        }
        return prefix + path;
    },
    mainScriptUrlOrBlob: new URL("tree-sitter.worker.js", self.location.origin).href,
};

// Also verify self.location exists (it should in a worker, but just in case)
if (!self.location) {
    (self as any).location = {
        href: new URL("tree-sitter.worker.js", "http://localhost").href,
        origin: "http://localhost"
    };
}


// @ts-ignore
import { Parser, Language } from "web-tree-sitter";

// Helper to find the Parser object from the loaded module
function resolveParserClass(importedParser: any): any {
    if (importedParser?.init) return importedParser;
    if (importedParser?.default?.init) return importedParser.default;

    // Globals fallback
    if ((self as any).Parser?.init) return (self as any).Parser;
    if ((globalThis as any).Parser?.init) return (globalThis as any).Parser;

    return importedParser;
}

const ParserClass = resolveParserClass(Parser);

async function init(language: string, wasmPath: string, initialContent: string) {
    if (!ParserClass || !ParserClass.init) {
        throw new Error(`Failed to find Parser class. Resolved: ${removeCircular(ParserClass)}`);
    }

    try {
        self.postMessage({ type: "debug", payload: "Starting Parser.init" });
        await ParserClass.init({
            locateFile() {
                return new URL("/tree-sitter/tree-sitter.wasm", self.location.origin).href;
            },
        });

        self.postMessage({ type: "debug", payload: "Parser.init complete, creating instance" });
        parser = new ParserClass();
        self.postMessage({ type: "debug", payload: `Loading language from ${wasmPath}` });
        const Lang = await Language.load(wasmPath);
        self.postMessage({ type: "debug", payload: "Language loaded, setting parser language" });
        parser.setLanguage(Lang);
        languageName = language;

        // Initialize Query Engine
        queryManager = new QueryManager(Lang);

        // Initial parse
        tree = parser.parse(initialContent);

        self.postMessage({ type: "ready", language });

        runAnalysis();
    } catch (e: any) {
        console.error("[Worker] Init error:", e);
        self.postMessage({ type: "error", error: "Init failed: " + String(e) });
    }
}

function runAnalysis() {
    if (!tree || !languageName || !queryManager) return;

    try {
        const start = performance.now();
        const semanticEvents = queryManager.execute(tree, languageName);
        const duration = performance.now() - start;

        self.postMessage({
            type: "parse_complete",
            duration,
            timestamp: Date.now()
        });

        if (semanticEvents.length > 0) {
            self.postMessage({
                type: "semantic_events",
                events: semanticEvents
            });
        }

        // Also send stats for debugging
        self.postMessage({
            type: "stats",
            nodeCount: tree.rootNode.descendantCount,
            hasError: tree.rootNode.hasError,
        });
    } catch (e: any) {
        console.error("[Worker] Analysis error:", e);
        // Don't kill worker on analysis error, just report it
    }
}

ctx.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    try {
        if (msg.type === "init") {
            await init(msg.language, msg.wasmPath, msg.initialContent);
        } else if (msg.type === "update") {
            if (!parser || !languageName) return;

            // Incremental parsing:
            const oldTree = tree;

            // For now, full re-parse. To support incremental, we need to handle edits.
            tree = parser.parse(msg.newContent);

            if (oldTree) {
                oldTree.delete();
            }

            runAnalysis();
        }
    } catch (e: any) {
        console.error("Worker message handling error:", e);
        self.postMessage({ type: "error", error: String(e) });
    }
});
