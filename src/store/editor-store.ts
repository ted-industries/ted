import { useSyncExternalStore } from "react";

export interface TabState {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  scrollTop: number;
  scrollLeft: number;
  cursorPos: number;
}

export interface ActionLog {
  id: string;
  type: string;
  payload?: any;
  timestamp: number;
}

interface EditorStoreState {
  tabs: TabState[];
  activeTabPath: string | null;
  explorerPath: string | null;
  explorerCollapsed: boolean;
  commandPaletteOpen: boolean;
  logs: ActionLog[];
}

type Listener = () => void;

let state: EditorStoreState = {
  tabs: [],
  activeTabPath: null,
  explorerPath: null,
  explorerCollapsed: false,
  commandPaletteOpen: false,
  logs: [],
};

const MAX_LOGS = 1000;
const listeners = new Set<Listener>();
let batchingLevel = 0;
let pendingEmits = false;

function emit() {
  if (batchingLevel > 0) {
    pendingEmits = true;
    return;
  }
  for (const l of listeners) l();
}

/**
 * Updates the state and logs the action.
 * Internal only.
 */
function dispatch(type: string, partial: Partial<EditorStoreState>, payload?: any) {
  const log: ActionLog = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
  };

  const nextLogs = [log, ...state.logs].slice(0, MAX_LOGS);

  state = { ...state, ...partial, logs: nextLogs };
  emit();
}

function updateTab(path: string, update: Partial<TabState>) {
  const tabs = state.tabs.map((t) =>
    t.path === path ? { ...t, ...update } : t,
  );
  dispatch("UPDATE_TAB", { tabs }, { path, update });
}

export const editorStore = {
  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Batch multiple operations together. Only one notification will be emitted
   * to listeners at the end of the batch.
   */
  batch(cb: () => void) {
    batchingLevel++;
    try {
      cb();
    } finally {
      batchingLevel--;
      if (batchingLevel === 0 && pendingEmits) {
        pendingEmits = false;
        emit();
      }
    }
  },

  openTab(path: string, name: string, content: string) {
    const existing = state.tabs.find((t) => t.path === path);
    if (existing) {
      dispatch("SET_ACTIVE_TAB", { activeTabPath: path });
      return;
    }
    const tab: TabState = {
      path,
      name,
      content,
      savedContent: content,
      isDirty: false,
      scrollTop: 0,
      scrollLeft: 0,
      cursorPos: 0,
    };
    dispatch("OPEN_TAB", {
      tabs: [...state.tabs, tab],
      activeTabPath: path,
    }, { path, name });
  },

  closeTab(path: string) {
    const idx = state.tabs.findIndex((t) => t.path === path);
    const tabs = state.tabs.filter((t) => t.path !== path);
    let activeTabPath = state.activeTabPath;
    if (activeTabPath === path) {
      const newIdx = Math.min(idx, tabs.length - 1);
      activeTabPath = newIdx >= 0 ? tabs[newIdx].path : null;
    }
    dispatch("CLOSE_TAB", { tabs, activeTabPath }, { path });
  },

  setActiveTab(path: string) {
    dispatch("SET_ACTIVE_TAB", { activeTabPath: path });
  },

  updateTabContent(path: string, content: string) {
    const tab = state.tabs.find((t) => t.path === path);
    if (!tab) return;
    updateTab(path, { content, isDirty: content !== tab.savedContent });
  },

  saveTabViewState(
    path: string,
    scrollTop: number,
    scrollLeft: number,
    cursorPos: number,
  ) {
    updateTab(path, { scrollTop, scrollLeft, cursorPos });
  },

  markTabSaved(path: string, content: string) {
    updateTab(path, { savedContent: content, content, isDirty: false });
  },

  setExplorerPath(path: string | null) {
    dispatch("SET_EXPLORER_PATH", { explorerPath: path });
  },

  toggleExplorer() {
    dispatch("TOGGLE_EXPLORER", { explorerCollapsed: !state.explorerCollapsed });
  },

  setCommandPaletteOpen(open: boolean) {
    dispatch("SET_COMMAND_PALETTE", { commandPaletteOpen: open });
  },

  toggleCommandPalette() {
    dispatch("TOGGLE_COMMAND_PALETTE", { commandPaletteOpen: !state.commandPaletteOpen });
  },
};

export function useEditorStore<T>(selector: (s: EditorStoreState) => T): T {
  return useSyncExternalStore(editorStore.subscribe, () =>
    selector(editorStore.getState()),
  );
}
