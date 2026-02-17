import { Rule } from "./types";
import { RapidUndoRedoRule } from "./rules/behavior-rule";
import { LargeFunctionRule } from "./rules/ast-rule";
import { GitChurnRule } from "./rules/git-rule";
import { suggestionDispatcher } from "./suggestion-dispatcher";
import { TelemetryEvent, telemetry } from "../telemetry-service";

class RuleEngine {
    private rules: Rule[] = [];
    private unsubscribe: (() => void) | null = null;

    constructor() {
        this.rules = [
            new RapidUndoRedoRule(),
            new LargeFunctionRule(),
            new GitChurnRule(),
        ];
    }

    public start() {
        // Subscribe to Telemetry events (which cover behavior, tree-sitter, etc.)
        this.unsubscribe = telemetry.subscribe(this.handleEvent.bind(this));
        console.log("[RuleEngine] Started (Event-Driven)");
    }

    public stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    private async handleEvent(event: TelemetryEvent) {

        // Routing logic: Which rules care about this event?
        // Rules specify `signalTypes` they are interested in.
        // We need to map `event.type` to `SuggestionType` categories or just let rules filter themselves.
        // Given complexity, letting rules filter in `evaluate` is simpler for now, 
        // but we can optimize by checking `signalTypes` vs event category.

        // Map event type to signals
        // behavior: undo, redo, typing, etc.
        // ast: tree_sitter_parse
        // git: file_open (triggers git check)

        // For MVP, just iterate all rules. Optimize later.

        for (const rule of this.rules) {
            try {
                // Check cooldown again (in addition to dispatcher) if needed?
                // Dispatcher handles global/rule-specific cooldowns on suggestion emission.
                // But we can skip evaluation if rule is in cooldown state internally.
                if (Date.now() - rule.lastTriggered < rule.cooldown) continue;

                const suggestion = await rule.evaluate(event, {}); // Context empty for now, rules pull from stores

                if (suggestion) {
                    rule.lastTriggered = Date.now();
                    suggestionDispatcher.dispatch(suggestion);
                }
            } catch (e) {
                console.error(`Root rule error [${rule.id}]:`, e);
            }
        }
    }
}

export const ruleEngine = new RuleEngine();
