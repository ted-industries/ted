import { ViewUpdate } from "@codemirror/view";
// Import worker directly using Vite's worker import syntax
import TreeSitterWorker from "../workers/tree-sitter.worker?worker";
import { telemetry } from "./telemetry-service";

export class TreeSitterService {
    private worker: Worker | null = null;
    private isReady: boolean = false;

    constructor() {
        console.log("[Service] TreeSitterService initializing...");
        this.init();
    }

    private init() {
        if (this.worker) return;
        this.worker = new TreeSitterWorker();
        this.worker.onerror = (e) => {
            console.error("Tree-sitter worker error:", e);
            telemetry.log("tree_sitter_worker_error", { message: e.message, filename: e.filename, lineno: e.lineno });
        };

        this.worker.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case "boot":
                    console.log("Tree-sitter worker booted");
                    telemetry.log("tree_sitter_boot", {});
                    break;
                case "ready":
                    console.log(`Tree-sitter ready for ${msg.language}`);
                    this.isReady = true;
                    telemetry.log("tree_sitter_ready", { language: msg.language });
                    break;
                case "parse_complete":
                    console.log(`Parse complete in ${msg.duration?.toFixed(2)}ms`);
                    telemetry.log("tree_sitter_parse", { duration: msg.duration });
                    break;
                case "semantic_events":
                    // console.log("Semantic Events:", msg.events);
                    // Batch or log meaningful events. For now, log the count or first few.
                    telemetry.log("tree_sitter_semantic", {
                        count: msg.events.length,
                        sample: msg.events.slice(0, 5)
                    });
                    break;
                case "stats":
                    console.log("AST Stats:", msg);
                    break;
                case "error":
                    console.error("Tree-sitter error:", msg.error);
                    telemetry.log("tree_sitter_error", { error: msg.error });
                    break;
                case "debug":
                    console.log("Worker Debug:", msg.payload);
                    telemetry.log("tree_sitter_worker_debug", msg.payload);
                    break;
            }
        };
    }

    public async loadLanguage(language: string, initialContent: string) {
        if (!this.worker) this.init();

        // Map language to WASM filename
        const wasmMap: Record<string, string> = {
            "typescript": "tree-sitter-typescript.wasm",
            "javascript": "tree-sitter-javascript.wasm",
            "tsx": "tree-sitter-tsx.wasm",
            "jsx": "tree-sitter-tsx.wasm", // reusing tsx for jsx for now? or javascript?
            "rust": "tree-sitter-rust.wasm",
            "python": "tree-sitter-python.wasm",
            "json": "tree-sitter-json.wasm",
            "html": "tree-sitter-html.wasm",
            "css": "tree-sitter-css.wasm",
            "c": "tree-sitter-c.wasm",
            "cpp": "tree-sitter-cpp.wasm"
        };

        const wasmName = wasmMap[language] || wasmMap["typescript"]; // fallback?
        const wasmPath = `/tree-sitter/${wasmName}`;

        this.worker?.postMessage({
            type: "init",
            language,
            wasmPath,
            initialContent
        });
        telemetry.log("tree_sitter_init", { language, wasmPath });
    }

    public update(update: ViewUpdate) {
        if (!this.isReady || !this.worker) {
            telemetry.log("debug_service_not_ready", { isReady: this.isReady, hasWorker: !!this.worker });
            return;
        }

        if (update.docChanged) {
            telemetry.log("debug_service_sending_update", { length: update.state.doc.length });
            this.worker.postMessage({
                type: "update",
                changes: [], // TODO: Implement granular edits
                newContent: update.state.doc.toString()
            });
        }
    }
}

export const treeSitter = new TreeSitterService();
