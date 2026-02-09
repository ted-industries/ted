import { editorStore } from "../../store/editor-store";
// import { treeSitter } from "../tree-sitter-service";
import { gitContext } from "../git-context-service";
import { telemetry } from "../telemetry-service";
import { AgentContext } from "../llm/types";

// For MVP, we'll pull simplified metrics. 
// Telemetry aggregation needs a query API on the service side (e.g. getRecentStats())
// TreeSitter needs getComplexity()

export class ContextBuilder {

    async build(): Promise<AgentContext | null> {
        const state = editorStore.getState();
        const path = state.activeTabPath;
        if (!path) return null;

        const tab = state.tabs.find(t => t.path === path);
        if (!tab) return null;

        // 1. Editor Context
        const content = tab.content;
        const cursor = tab.cursorPos;

        // 2. Git Context
        const churn = gitContext.getFileChurn(path);

        // 3. Telemetry (Mocked/Placeholder until we expose stats API)
        const recentUndos = telemetry.getRecentEventCount("undo", 60000); // Last minute
        const recentEdits = telemetry.getRecentEventCount("typing", 60000);

        // 4. AST (Mocked/Placeholder)
        const complexity = 0; // TODO: Implement treeSitter.getComplexity(path)

        return {
            file: {
                path,
                content,
                language: this.detectLanguage(path),
                cursor,
                selection: { from: 0, to: 0 } // TODO: Get from editor state
            },
            ast: {
                complexity,
                hasError: false,
                functions: []
            },
            git: {
                churn: churn ? churn.commits : 0,
                lastCommit: ""
            },
            telemetry: {
                recentUndos,
                recentEdits
            }
        };
    }

    private detectLanguage(path: string): string {
        if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
        if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
        if (path.endsWith(".rs")) return "rust";
        if (path.endsWith(".cpp") || path.endsWith(".c")) return "cpp";
        if (path.endsWith(".py")) return "python";
        return "text";
    }
}

export const contextBuilder = new ContextBuilder();
