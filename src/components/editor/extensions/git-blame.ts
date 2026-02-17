import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet, WidgetType, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { gitService, BlameEntry } from "../../../services/git-service";
import { editorStore } from "../../../store/editor-store";

// Effect to update the blame state
export const setBlame = StateEffect.define<BlameEntry | null>();

// State field to store the current blame info
const blameField = StateField.define<BlameEntry | null>({
    create() { return null; },
    update(value, tr) {
        for (const e of tr.effects) {
            if (e.is(setBlame)) return e.value;
        }
        if (tr.selection || tr.docChanged) return null;
        return value;
    }
});

class BlameWidget extends WidgetType {
    constructor(readonly author: string, readonly date: string) { super(); }

    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-ghost-text";
        span.textContent = `  ${this.author}, ${this.date}`;
        return span;
    }

    eq(other: BlameWidget) {
        return other.author === this.author && other.date === this.date;
    }
}

function formatRelativeTime(timestamp: string): string {
    const seconds = Math.floor(Date.now() / 1000 - parseInt(timestamp));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

class BlamePluginValue {
    timer: ReturnType<typeof setTimeout> | null = null;
    lastLine: number = -1;

    constructor(readonly view: EditorView) {
        this.scheduleBlame();
    }

    update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged) {
            this.scheduleBlame();
        }
    }

    scheduleBlame() {
        if (this.timer) clearTimeout(this.timer);

        const pos = this.view.state.selection.main.head;
        const line = this.view.state.doc.lineAt(pos);

        this.lastLine = line.number;

        this.timer = setTimeout(async () => {
            const state = editorStore.getState();
            const explorerPath = state.explorerPath;
            const activeTabPath = state.activeTabPath;

            if (!explorerPath || !activeTabPath) return;

            try {
                const blame = await gitService.getBlame(explorerPath, activeTabPath, line.number);
                // Ensure we are still on the same line
                const currentPos = this.view.state.selection.main.head;
                const currentLine = this.view.state.doc.lineAt(currentPos);

                if (currentLine.number === line.number) {
                    this.view.dispatch({ effects: setBlame.of(blame) });
                }
            } catch (e) {
                this.view.dispatch({ effects: setBlame.of(null) });
            }
        }, 500);
    }

    destroy() {
        if (this.timer) clearTimeout(this.timer);
    }
}

const blamePlugin = ViewPlugin.fromClass(BlamePluginValue);

const blameDecorations = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(_deco, tr) {
        const blame = tr.state.field(blameField);
        if (!blame) return Decoration.none;

        const pos = tr.state.selection.main.head;
        const line = tr.state.doc.lineAt(pos);

        return Decoration.set([
            Decoration.widget({
                widget: new BlameWidget(blame.author, formatRelativeTime(blame.date)),
                side: 1
            }).range(line.to)
        ]);
    },
    provide: f => EditorView.decorations.from(f)
});

export const gitBlame = [blameField, blamePlugin, blameDecorations];
