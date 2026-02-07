import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

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
  projectName: string | null;
  explorerCollapsed: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  userSettings: {
    sidebarWidth: number;
    fontSize: number;
    lineNumbers: boolean;
    volume: number;
  };
  projectSettings: {
    sidebarWidth?: number;
    fontSize?: number;
    lineNumbers?: boolean;
    volume?: number;
  };
  settings: {
    sidebarWidth: number;
    fontSize: number;
    lineNumbers: boolean;
    volume: number;
  };
  logs: ActionLog[];
}

type Listener = () => void;

let state: EditorStoreState = {
  tabs: [],
  activeTabPath: null,
  explorerPath: null,
  projectName: null,
  explorerCollapsed: false,
  commandPaletteOpen: false,
  settingsOpen: false,
  userSettings: {
    sidebarWidth: 240,
    fontSize: 15,
    lineNumbers: true,
    volume: 50,
  },
  projectSettings: {},
  settings: {
    sidebarWidth: 240,
    fontSize: 15,
    lineNumbers: true,
    volume: 50,
  },
  logs: [],
};

const MAX_LOGS = 1000;
const listeners = new Set<Listener>();
let userSettingsPath: string | null = null;

function emit() {
  for (const l of listeners) l();
}

function dispatch(type: string, partial: Partial<EditorStoreState>, payload?: any) {
  const log: ActionLog = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
  };

  const nextLogs = [log, ...state.logs].slice(0, MAX_LOGS);
  let nextState = { ...state, ...partial, logs: nextLogs };

  if (partial.userSettings || partial.projectSettings) {
    nextState.settings = {
      ...nextState.userSettings,
      ...nextState.projectSettings,
    };

    // Auto-persist settings on change
    if (userSettingsPath && partial.userSettings) {
      persistSettings(userSettingsPath, nextState.userSettings);
    }
    if (nextState.explorerPath && partial.projectSettings) {
      persistSettings(`${nextState.explorerPath}/.ted/settings.json`, nextState.projectSettings);
    }
  }

  state = nextState;
  emit();
}

async function persistSettings(path: string, settings: any) {
  try {
    await invoke("write_file", { path, content: JSON.stringify(settings, null, 2) });
  } catch (err) {
    console.error("Failed to persist settings to", path, err);
  }
}

function updateTab(path: string, update: Partial<TabState>) {
  const tabs = state.tabs.map((t) =>
    t.path === path ? { ...t, ...update } : t,
  );
  dispatch("UPDATE_TAB", { tabs }, { path, update });
}

export const editorStore = {
  async initialize() {
    try {
      userSettingsPath = await invoke("get_user_config_dir");
      console.log("User settings path:", userSettingsPath);

      const content: string = await invoke("read_file", { path: userSettingsPath });
      const parsed = JSON.parse(content);
      dispatch("INIT_USER_SETTINGS", { userSettings: { ...state.userSettings, ...parsed } });
    } catch (err) {
      console.log("No existing user settings found, using defaults.");
    }
  },

  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  newFile() {
    const id = crypto.randomUUID();
    const path = `untitled-${id}`;
    this.openTab(path, "Untitled", "");
  },

  openTab(path: string, name: string, content: string) {
    if (state.tabs.find((t) => t.path === path)) {
      this.setActiveTab(path);
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

    if (path === "ted://settings.json") {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.updateSettings(parsed, "user");
        }
      } catch { }
    } else if (path === "ted://project-settings.json") {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.updateSettings(parsed, "project");
        }
      } catch { }
    }
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

  async setExplorerPath(path: string | null) {
    dispatch("SET_EXPLORER_PATH", { explorerPath: path, projectSettings: {} });

    if (path) {
      try {
        const projectSettingsPath = `${path}/.ted/settings.json`;
        const content: string = await invoke("read_file", { path: projectSettingsPath });
        const parsed = JSON.parse(content);
        dispatch("LOAD_PROJECT_SETTINGS", { projectSettings: parsed });
      } catch {
        console.log("No project settings found for", path);
      }
    }
  },

  setProjectName(name: string | null) {
    dispatch("SET_PROJECT_NAME", { projectName: name });
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

  setSettingsOpen(open: boolean) {
    dispatch("SET_SETTINGS_OPEN", { settingsOpen: open });
  },

  toggleSettings() {
    dispatch("TOGGLE_SETTINGS", { settingsOpen: !state.settingsOpen });
  },

  updateSettings(update: any, level: "user" | "project" = "user") {
    if (level === "user") {
      const userSettings = { ...state.userSettings, ...update };
      dispatch("UPDATE_USER_SETTINGS", { userSettings }, { update });
    } else {
      const projectSettings = { ...state.projectSettings, ...update };
      dispatch("UPDATE_PROJECT_SETTINGS", { projectSettings }, { update });
    }
  },
};

export function useEditorStore<T>(selector: (s: EditorStoreState) => T): T {
  return useSyncExternalStore(editorStore.subscribe, () =>
    selector(editorStore.getState()),
  );
}
