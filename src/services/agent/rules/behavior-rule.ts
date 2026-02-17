import { Rule, Suggestion, SuggestionType } from "../types";
import { TelemetryEvent } from "../../telemetry-service";

export class RapidUndoRedoRule implements Rule {
    public id = "rapid-undo-redo";
    public signalTypes: SuggestionType[] = ["behavior"];
    public priority = 10;
    public cooldown = 30 * 60 * 1000; // 30 minutes
    public lastTriggered = 0;

    private undoTimestamps: number[] = [];
    private readonly WINDOW = 10000; // 10s sliding window
    private readonly THRESHOLD = 5;

    public async evaluate(signal: TelemetryEvent, _context: any): Promise<Suggestion | null> {
        if (signal.type !== "undo" && signal.type !== "redo") return null;

        const now = Date.now();
        // Sliding window: keep timestamps within the window
        this.undoTimestamps = this.undoTimestamps.filter(t => now - t < this.WINDOW);
        this.undoTimestamps.push(now);


        if (this.undoTimestamps.length >= this.THRESHOLD) {
            return this.createSuggestion();
        }
        return null;
    }

    private createSuggestion(): Suggestion {
        return {
            id: "frustration-undo-spam",
            sourceRuleId: this.id,
            type: "behavior",
            message: "You seem to be undoing a lot. Want to revert the file to the last Git commit?",
            confidence: 0.8,
            timestamp: Date.now(),
            priority: this.priority,
            action: {
                label: "Revert File",
                handler: () => {
                    console.log("Revert requested via suggestion");
                    // TODO: Integrate with GitContextService to actually revert
                }
            }
        };
    }
}
