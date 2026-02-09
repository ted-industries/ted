import { telemetry, TelemetryEvent } from "../telemetry-service";
import { contextBuilder } from "./context-builder";
import { llmService } from "../llm/llm-service";
import { responseValidator } from "../llm/response-validator";
import { suggestionDispatcher } from "./suggestion-dispatcher";
import { Suggestion, SuggestionType } from "./types";
import { editorStore } from "../../store/editor-store";
import { useSuggestionStore } from "../../store/suggestion-store";

export class LLMAgent {
    private unsubscribe: (() => void) | null = null;
    private idleTimer: number | null = null;
    private readonly IDLE_THRESHOLD = 5000; // 5s idle to trigger
    private isGenerating = false;
    private lastFilePath: string | null = null;

    public start() {
        this.unsubscribe = telemetry.subscribe(this.handleEvent.bind(this));

        // Subscribe to file changes to clear stale suggestions
        editorStore.subscribe(() => {
            const currentPath = editorStore.getState().activeTabPath;
            if (currentPath && currentPath !== this.lastFilePath) {
                // User switched files - clear old suggestions as they may be stale
                useSuggestionStore.getState().clearSuggestions();
                this.lastFilePath = currentPath;
            }
        });

        console.log("[LLMAgent] Started");
    }

    public stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.idleTimer) clearTimeout(this.idleTimer);
    }

    private handleEvent(event: TelemetryEvent) {
        // Reset idle timer on user activity
        if (event.type === "typing" || event.type === "cursor_move") {
            this.resetIdleTimer();
        }

        // TODO: Handle explicit "ask_ted" command
    }

    private resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = window.setTimeout(() => this.trigger(), this.IDLE_THRESHOLD);
    }

    private async trigger() {
        if (this.isGenerating) return;

        this.isGenerating = true;
        try {
            console.log("[LLMAgent] Triggering...");
            const context = contextBuilder.build();
            if (!context) return;

            const result = await llmService.generateSuggestions(context);

            const validated = responseValidator.validate(result);

            if (validated && validated.suggestions.length > 0) {
                for (const s of validated.suggestions) {
                    const agentSuggestion: Suggestion = {
                        id: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        sourceRuleId: "llm-agent",
                        type: this.mapType(s.type),
                        message: s.message,
                        confidence: s.confidence,
                        timestamp: Date.now(),
                        priority: 5,
                    };

                    console.log(`[LLMAgent] Suggestion: "${agentSuggestion.message}"`);
                    await suggestionDispatcher.dispatch(agentSuggestion);
                }
            } else {
                console.log("[LLMAgent] No valid suggestions from LLM (model said code is fine, or response format invalid)");
            }
        } catch (e) {
            console.error("[LLMAgent] Error during generation:", e);
        } finally {
            this.isGenerating = false;
        }
    }

    private mapType(llmType: string): SuggestionType {
        switch (llmType) {
            case "refactor": return "ast";
            case "fix": return "behavior"; // Close enough
            case "git": return "git";
            default: return "hybrid";
        }
    }
}

export const llmAgent = new LLMAgent();
