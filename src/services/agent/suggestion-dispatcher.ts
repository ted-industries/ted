import { Suggestion } from "./types";
import { useSuggestionStore } from "../../store/suggestion-store";

class SuggestionDispatcher {
    // Cooldown tracking per sourceRuleId
    private ruleCooldowns: Map<string, number> = new Map();
    private readonly GLOBAL_COOLDOWN = 2000; // 2s between any suggestions
    private lastSuggestionTime = 0;

    public async dispatch(suggestion: Suggestion) {
        const now = Date.now();

        // 1. Check Global Cooldown
        if (now - this.lastSuggestionTime < this.GLOBAL_COOLDOWN) {
            console.debug(`[Dispatcher] Global cooldown active. Dropping suggestion from ${suggestion.sourceRuleId}`);
            return;
        }

        // 2. Check Rule Cooldown (if specified in suggestion)
        // If the rule provided a cooldownUntil, respect it.
        // Additionally check internal map if we want double safety
        if (suggestion.cooldownUntil && now < suggestion.cooldownUntil) {
            console.debug(`[Dispatcher] Rule cooldown active for ${suggestion.sourceRuleId}`);
            return;
        }

        // 3. Deduplication (Store handles this via ID check, but we can do smarter checks)
        // e.g., don't show "LargeFunction" for the same function if dismissed recently?
        // Store persistence handles dismissed IDs.

        // 4. Priority Check? (Future: Queue low priority if high priority active)

        // Commit to Store
        useSuggestionStore.getState().addSuggestion(suggestion);

        // Update state
        this.lastSuggestionTime = now;
        if (suggestion.cooldownUntil) {
            this.ruleCooldowns.set(suggestion.sourceRuleId, suggestion.cooldownUntil);
        }
    }
}

export const suggestionDispatcher = new SuggestionDispatcher();
