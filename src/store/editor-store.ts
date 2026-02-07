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

interface EditorStoreState {
  tabs: TabState[];
  activeTabPath: string | null;
  explorerPath: string | null;
  explorerCollapsed: boolean;
}

type Listener = () => void;

let state: EditorStoreState = {
  tabs: [],
  activeTabPath: null,
  explorerPath: null,
  explorerCollapsed: false,
};

const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function setState(partial: Partial<EditorStoreState>) {
  state = { ...state, ...partial };
  emit();
}

function updateTab(path: string, update: Partial<TabState>) {
  const tabs = state.tabs.map((t) =>
    t.path === path ? { ...t, ...update } : t,
  );
  setState({ tabs });
}

export const editorStore = {
  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  openTab(path: string, name: string, content: string) {
    const existing = state.tabs.find((t) => t.path === path);
    if (existing) {
      setState({ activeTabPath: path });
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
    setState({
      tabs: [...state.tabs, tab],
      activeTabPath: path,
    });
  },

  closeTab(path: string) {
    const idx = state.tabs.findIndex((t) => t.path === path);
    const tabs = state.tabs.filter((t) => t.path !== path);
    let activeTabPath = state.activeTabPath;
    if (activeTabPath === path) {
      const newIdx = Math.min(idx, tabs.length - 1);
      activeTabPath = newIdx >= 0 ? tabs[newIdx].path : null;
    }
    setState({ tabs, activeTabPath });
  },

  setActiveTab(path: string) {
    setState({ activeTabPath: path });
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
    setState({ explorerPath: path });
  },

  toggleExplorer() {
    setState({ explorerCollapsed: !state.explorerCollapsed });
  },
};

export function useEditorStore<T>(selector: (s: EditorStoreState) => T): T {
  return useSyncExternalStore(editorStore.subscribe, () =>
    selector(editorStore.getState()),
  );
}
