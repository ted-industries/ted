import { Extension, StateEffect } from "@codemirror/state";
import { EditorView, ViewUpdate, ViewPlugin, PluginValue } from "@codemirror/view";
import { telemetry } from "../../../services/telemetry-service";

class BehaviorTrackingPlugin implements PluginValue {
    constructor(view: EditorView) {
        // Initial log?
    }

    update(update: ViewUpdate) {
        if (update.docChanged) {
            update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                const insertedText = inserted.toString();
                const isHuge = insertedText.length > 500;

                telemetry.log("typing", {
                    type: "change",
                    from: fromA,
                    to: toA,
                    insert: isHuge ? insertedText.slice(0, 500) + "...[TRUNCATED]" : insertedText,
                    length: inserted.length,
                    // isPaste: inserted.length > 1, // Heuristic (commented out to avoid type error if TelemetryEvent doesn't support it yet)
                });
            });
        }

        if (update.selectionSet) {
            const main = update.state.selection.main;
            telemetry.log("selection_change", {
                anchor: main.anchor,
                head: main.head,
                empty: main.empty,
            });

            // Also log implicit cursor move
            telemetry.log("cursor_move", {
                pos: main.head,
                line: update.state.doc.lineAt(main.head).number,
                col: main.head - update.state.doc.lineAt(main.head).from,
            });
        }
    }
}

export const behaviorTracking = ViewPlugin.fromClass(BehaviorTrackingPlugin);
