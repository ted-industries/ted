import {
  ViewPlugin,
  type PluginValue,
  type ViewUpdate,
  type EditorView,
} from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { lspManager } from "../../../services/lsp/lsp-manager";
import { convertDiagnostics } from "./lsp-diagnostics";
import type {
  TextDocumentContentChangeEvent,
  Position,
} from "../../../services/lsp/types";
import type { ChangeSet, Text } from "@codemirror/state";

/**
 * Convert CM6 ChangeSet to LSP incremental TextDocumentContentChangeEvents.
 */
function changesToLspEvents(
  changes: ChangeSet,
  oldDoc: Text,
): TextDocumentContentChangeEvent[] {
  const events: TextDocumentContentChangeEvent[] = [];

  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const startLine = oldDoc.lineAt(fromA);
    const endLine = oldDoc.lineAt(toA);

    const start: Position = {
      line: startLine.number - 1,
      character: fromA - startLine.from,
    };
    const end: Position = {
      line: endLine.number - 1,
      character: toA - endLine.from,
    };

    events.push({
      range: { start, end },
      text: inserted.toString(),
    });
  });

  return events;
}

class LspSyncPlugin implements PluginValue {
  private path: string;
  private unsubDiagnostics: (() => void) | null = null;
  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.path =
      (view as unknown as { __tedFilePath?: string }).__tedFilePath ?? "";

    if (this.path) {
      // Notify LSP that document is open (async, fire-and-forget)
      lspManager.documentOpened(this.path, view.state.doc.toString());

      // Subscribe to diagnostics for this file after a short delay
      // (gives the server time to initialize)
      setTimeout(() => this.subscribeDiagnostics(), 500);
    }
  }

  private subscribeDiagnostics(): void {
    if (!this.path) return;
    const client = lspManager.getClientForFile(this.path);
    if (!client) return;

    const uri = lspManager.pathToUri(this.path);
    this.unsubDiagnostics = client.onDiagnostics((diagUri, diags) => {
      if (diagUri === uri) {
        const cmDiags = convertDiagnostics(this.view, diags);
        this.view.dispatch(setDiagnostics(this.view.state, cmDiags));
      }
    });
  }

  update(update: ViewUpdate) {
    if (!this.path || !update.docChanged) return;

    const client = lspManager.getClientForFile(this.path);
    if (!client) return;

    if (client.syncMode === 2 /* Incremental */) {
      for (const tr of update.transactions) {
        if (tr.docChanged) {
          const events = changesToLspEvents(tr.changes, tr.startState.doc);
          lspManager.documentChanged(
            this.path,
            events,
            update.state.doc.toString(),
          );
        }
      }
    } else {
      // Full sync
      lspManager.documentChanged(this.path, [], update.state.doc.toString());
    }

    // Re-subscribe to diagnostics if we don't have a subscription yet
    if (!this.unsubDiagnostics) {
      this.subscribeDiagnostics();
    }
  }

  destroy() {
    if (this.path) {
      lspManager.documentClosed(this.path);
    }
    this.unsubDiagnostics?.();
  }
}

export const lspSync = ViewPlugin.fromClass(LspSyncPlugin);
