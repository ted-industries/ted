import { Rule, Suggestion, SuggestionType } from "../types";
import { editorStore } from "../../../store/editor-store";
import { TelemetryEvent } from "../../telemetry-service";
// import { treeSitter } from "../../tree-sitter-service"; // Will need to expose query API or similar

export class LargeFunctionRule implements Rule {
    public id = "large-function";
    public signalTypes: SuggestionType[] = ["ast", "behavior"]; // Trigger on parse or tab switch
    public priority = 5;
    public cooldown = 24 * 60 * 60 * 1000; // 24 hours per file
    public lastTriggered = 0;

    // private readonly COMPLEXITY_THRESHOLD = 30; // Heuristic score

    public async evaluate(signal: TelemetryEvent, _context: any): Promise<Suggestion | null> {
        // Trigger only on relevant events
        if (signal.type !== "tree_sitter_parse" && signal.type !== "tab_switch" && signal.type !== "file_open") return null;

        const state = editorStore.getState();
        const path = state.activeTabPath;
        if (!path) return null;

        const tab = state.tabs.find(t => t.path === path);
        if (!tab) return null;

        // Simple heuristic: Line count > 100
        const lineCount = tab.content.split("\n").length;
        if (lineCount > 100) {
            return {
                id: `large-func-${path}`,
                sourceRuleId: this.id,
                type: "ast",
                message: `This file is quite long (${lineCount} lines). Consider breaking it down into smaller modules.`,
                confidence: 0.7,
                timestamp: Date.now(),
                priority: this.priority,
            };
        }
        return null;
    }
}
