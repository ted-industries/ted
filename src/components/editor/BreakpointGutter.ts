import { GutterMarker, gutter } from "@codemirror/view";
import { StateField, StateEffect, RangeSet, RangeSetBuilder } from "@codemirror/state";
import { useDebugStore } from "../../store/debug-store";
import { filePathFacet } from "./extensions/lsp-filepath";

export const setBreakpointsEffect = StateEffect.define<number[]>();

const breakpointField = StateField.define<RangeSet<BreakpointMarker>>({
    create() { return RangeSet.empty },
    update(set, tr) {
        set = set.map(tr.changes);
        for (let e of tr.effects) if (e.is(setBreakpointsEffect)) {
            let builder = new RangeSetBuilder<BreakpointMarker>();
            for (let line of e.value.sort((a, b) => a - b)) {
                // Ensure line is within bounds
                if (line > 0 && line <= tr.state.doc.lines) {
                    const linePos = tr.state.doc.line(line);
                    builder.add(linePos.from, linePos.from, new BreakpointMarker());
                }
            }
            set = builder.finish();
        }
        return set;
    },
    provide: f => gutter({
        class: "cm-breakpoint-gutter",
        markers: v => v.state.field(f),
        domEventHandlers: {
            mousedown(view, line) {
                const path = view.state.facet(filePathFacet);
                const lineNo = view.state.doc.lineAt(line.from).number;
                useDebugStore.getState().toggleBreakpoint(path, lineNo);
                return true;
            }
        }
    })
});

class BreakpointMarker extends GutterMarker {
    toDOM() {
        let elt = document.createElement("div");
        elt.className = "cm-breakpoint-marker";
        return elt;
    }
}

export const breakpointGutterExtension = [
    breakpointField
];
