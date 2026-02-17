import { GutterMarker, gutter } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { LineDiff } from "../../services/git-service";

export const setGitDiff = StateEffect.define<LineDiff[]>();

const gitDiffField = StateField.define<Record<number, string>>({
    create() { return {} },
    update(value, tr) {
        for (let e of tr.effects) if (e.is(setGitDiff)) {
            const map: Record<number, string> = {};
            e.value.forEach(d => {
                // Since git2 provides old line for deleted, we might have collisions.
                // For simple gutter, we prioritze added > modified > deleted.
                if (!map[d.line] || d.diff_type === "added") {
                    map[d.line] = d.diff_type;
                }
            });
            return map;
        }
        return value;
    }
});

class GitMarker extends GutterMarker {
    constructor(readonly type: string) { super() }
    toDOM() {
        let elt = document.createElement("div")
        elt.className = `cm-git-gutter-marker cm-git-${this.type}`
        return elt
    }
}

export const gitGutterExtension = [
    gitDiffField,
    gutter({
        class: "cm-git-gutter-container",
        lineMarker(view, line) {
            const diffs = view.state.field(gitDiffField);
            const lineNo = view.state.doc.lineAt(line.from).number;
            const type = diffs[lineNo];
            return type ? new GitMarker(type) : null;
        }
    })
];
