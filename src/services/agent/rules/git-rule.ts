import { Rule, Suggestion, SuggestionType } from "../types";
import { TelemetryEvent } from "../../telemetry-service";
import { gitContext } from "../../git-context-service";
import { editorStore } from "../../../store/editor-store";

export class GitChurnRule implements Rule {
    public id = "git-churn";
    public signalTypes: SuggestionType[] = ["git", "behavior"];
    public priority = 3;
    public cooldown = 3 * 24 * 60 * 60 * 1000; // 3 days
    public lastTriggered = 0;

    private readonly THRESHOLD = 10; // commits in timeframe (30d default in git service)

    public async evaluate(signal: TelemetryEvent, _context: any): Promise<Suggestion | null> {
        // Check churn on file open or switch
        if (signal.type !== "file_open" && signal.type !== "tab_switch") return null;

        const state = editorStore.getState();
        const path = state.activeTabPath;
        if (!path) return null;

        // Since churn data might be loaded async, check if we have it
        const churn = gitContext.getFileChurn(path);

        const tab = state.tabs.find(t => t.path === path);
        if (churn && tab) {
            // Normalized: commits per 100 lines
            // If file is tiny (e.g. 5 lines) and has 5 commits, that's high churn density!
            // But spec says "Normalized by file size". 
            // Let's use commits / line_count. 
            // If > 10 commits total AND density is high, trigger.

            const lines = tab.content.split("\n").length || 1;
            const density = churn.commits / lines;

            // Example: 20 commits on 100 lines = 0.2
            // Example: 20 commits on 1000 lines = 0.02

            // Spec: "> 10 commits in last 7 days" (our churn is just total commits in window)
            // + "Normalized by file size"

            if (churn.commits > this.THRESHOLD) {
                // Adjust confidence based on density?
                const isHighDensity = density > 0.1; // > 1 commit per 10 lines

                return {
                    id: `churn-${path}`,
                    sourceRuleId: this.id,
                    type: "git",
                    message: `High churn detected (${churn.commits} recent commits). ${isHighDensity ? "This file is changing very frequently considering its size." : ""} Consider refactoring?`,
                    confidence: isHighDensity ? 0.9 : 0.6,
                    timestamp: Date.now(),
                    priority: this.priority,
                };
            }
        }
        return null;
    }
}
