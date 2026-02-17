import { keymap, type EditorView } from "@codemirror/view";
import { lspManager } from "../../../services/lsp/lsp-manager";
import { filePathFacet } from "./lsp-filepath";
import { editorStore } from "../../../store/editor-store";
import { invoke } from "@tauri-apps/api/core";
import type { Location } from "../../../services/lsp/types";

async function navigateToLocation(
  location: Location | Location[] | null,
): Promise<void> {
  if (!location) return;

  const loc = Array.isArray(location) ? location[0] : location;
  if (!loc) return;

  const path = lspManager.uriToPath(loc.uri);
  const line = loc.range.start.line;
  const character = loc.range.start.character;

  const state = editorStore.getState();
  const existingTab = state.tabs.find((t) => t.path === path);

  if (existingTab) {
    editorStore.setActiveTab(path);
  } else {
    try {
      const content: string = await invoke("read_file", { path });
      const name: string = await invoke("get_basename", { path });
      editorStore.openTab(path, name, content);
    } catch (err) {
      console.error("[LSP] Failed to open file for navigation:", err);
      return;
    }
  }

  // Calculate target offset via index scan (no allocation)
  requestAnimationFrame(() => {
    const tab = editorStore.getState().tabs.find((t) => t.path === path);
    if (!tab) return;

    const text = tab.content;
    let offset = 0;
    let currentLine = 0;
    while (currentLine < line && offset < text.length) {
      if (text.charCodeAt(offset) === 10) currentLine++;
      offset++;
    }
    offset += Math.min(character, text.length - offset);

    editorStore.saveTabViewState(path, tab.scrollTop, tab.scrollLeft, offset);
  });
}

function goToDefinition(view: EditorView): boolean {
  const path = view.state.facet(filePathFacet);
  if (!path) return false;

  const client = lspManager.getClientForFile(path);
  if (!client) return false;

  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const lspPos = { line: line.number - 1, character: pos - line.from };
  const uri = lspManager.pathToUri(path);

  client.definition(uri, lspPos).then(navigateToLocation);
  return true;
}

function goToTypeDefinition(view: EditorView): boolean {
  const path = view.state.facet(filePathFacet);
  if (!path) return false;

  const client = lspManager.getClientForFile(path);
  if (!client) return false;

  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const lspPos = { line: line.number - 1, character: pos - line.from };
  const uri = lspManager.pathToUri(path);

  client.typeDefinition(uri, lspPos).then(navigateToLocation);
  return true;
}

function goToReferences(view: EditorView): boolean {
  const path = view.state.facet(filePathFacet);
  if (!path) return false;

  const client = lspManager.getClientForFile(path);
  if (!client) return false;

  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const lspPos = { line: line.number - 1, character: pos - line.from };
  const uri = lspManager.pathToUri(path);

  client.references(uri, lspPos).then((locations) => {
    if (!locations || locations.length === 0) return;
    // Navigate to first result; a references panel can be added later
    navigateToLocation(locations[0]);
  });
  return true;
}

export function lspGoToKeymap() {
  return keymap.of([
    { key: "F12", run: goToDefinition },
    { key: "Mod-F12", run: goToTypeDefinition },
    { key: "Shift-F12", run: goToReferences },
  ]);
}
