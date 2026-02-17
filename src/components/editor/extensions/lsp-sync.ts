import {
  ViewPlugin,
  type PluginValue,
  type ViewUpdate,
  type EditorView,
} from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { lspManager } from "../../../services/lsp/lsp-manager";
import { convertDiagnostics } from "./lsp-diagnostics";
import { filePathFacet } from "./lsp-filepath";
import type { TextDocumentContentChangeEvent } from "../../../services/lsp/types";
import type { ChangeSet, Text } from "@codemirror/state";

/**
 * Convert CM6 ChangeSet to LSP incremental TextDocumentContentChangeEvents.
 * Only called for incremental sync — never serializes the full document.
 */
function changesToLspEvents(
  changes: ChangeSet,
  oldDoc: Text,
): TextDocumentContentChangeEvent[] {
  const events: TextDocumentContentChangeEvent[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const startLine = oldDoc.lineAt(fromA);
    const endLine = oldDoc.lineAt(toA);
    events.push({
      range: {
        start: {
          line: startLine.number - 1,
          character: fromA - startLine.from,
        },
        end: { line: endLine.number - 1, character: toA - endLine.from },
      },
      text: inserted.toString(),
    });
  });
  return events;
}

const DEBOUNCE_FULL_SYNC = 50; // ms — debounce full-sync didChange
const DIAG_RETRY_INTERVAL = 2000; // ms — retry diagnostics subscription

class LspSyncPlugin implements PluginValue {
  private path: string;
  private unsubDiagnostics: (() => void) | null = null;
  private view: EditorView;
  private fullSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private diagTimer: ReturnType<typeof setTimeout> | null = null;
  private diagRetries = 0;
  private readonly MAX_DIAG_RETRIES = 5;

  constructor(view: EditorView) {
    this.view = view;
    this.path = view.state.facet(filePathFacet);

    if (this.path) {
      // Fire-and-forget: tell LSP manager to open this document.
      // documentOpened is async and handles server startup lazily.
      // Pass the doc text only once on open — no repeated serialization.
      lspManager.documentOpened(this.path, view.state.doc.toString());
      this.scheduleDiagSubscription();
    }
  }

  /** Retry diagnostics subscription until the server is ready. */
  private scheduleDiagSubscription(): void {
    if (this.unsubDiagnostics || this.diagRetries >= this.MAX_DIAG_RETRIES)
      return;
    this.diagTimer = setTimeout(
      () => {
        this.diagTimer = null;
        this.trySubscribeDiagnostics();
      },
      this.diagRetries === 0 ? 500 : DIAG_RETRY_INTERVAL,
    );
  }

  private trySubscribeDiagnostics(): void {
    if (this.unsubDiagnostics) return; // already subscribed
    const client = lspManager.getClientForFile(this.path);
    if (!client) {
      this.diagRetries++;
      this.scheduleDiagSubscription();
      return;
    }

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
      // Incremental: send only the changes, no full doc serialization.
      for (const tr of update.transactions) {
        if (tr.docChanged) {
          const events = changesToLspEvents(tr.changes, tr.startState.doc);
          lspManager.documentChanged(this.path, events, "");
        }
      }
    } else {
      // Full sync: debounce to avoid serializing on every keystroke.
      if (this.fullSyncTimer) clearTimeout(this.fullSyncTimer);
      this.fullSyncTimer = setTimeout(() => {
        this.fullSyncTimer = null;
        lspManager.documentChanged(
          this.path,
          [],
          this.view.state.doc.toString(),
        );
      }, DEBOUNCE_FULL_SYNC);
    }
  }

  destroy() {
    if (this.fullSyncTimer) clearTimeout(this.fullSyncTimer);
    if (this.diagTimer) clearTimeout(this.diagTimer);
    this.unsubDiagnostics?.();
    if (this.path) lspManager.documentClosed(this.path);
  }
}

export const lspSync = ViewPlugin.fromClass(LspSyncPlugin);
