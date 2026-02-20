import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { telemetry } from "../services/telemetry-service";
import { gitService } from "../services/git-service";
import { applyTheme } from "../services/theme/mod";

export interface TabState {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  scrollTop: number;
  scrollLeft: number;
  cursorPos: number;
  isDiff?: boolean;
  originalContent?: string;
  type?: "editor" | "diff" | "browser";
  url?: string;
}

export interface TerminalState {
  id: string;
  name: string;
}

export interface ActionLog {
  id: string;
  type: string;
  payload?: any;
  timestamp: number;
}

export interface WorkspaceState {
  id: string;
  name: string; // usually folder name or "Untitled"
  tabs: TabState[];
  activeTabPath: string | null;
  explorerPath: string | null;
  projectName: string | null;
  explorerCollapsed: boolean;
  historyOpen: boolean;
  terminalOpen: boolean;
  // We can keep terminals global or per-workspace. 
  // VS Code keeps terminals usually per window/workspace so let's try to keep them per workspace if possible,
  // but for now to keep it simple and given the task is mostly about file tabs, let's keep terminals global?
  // Actually, standard behavior is per-workspace terminals. Let's start with just Tabs/Explorer state per workspace.
}

interface EditorStoreState {
  // Global / Window level state
  workspaces: Record<string, WorkspaceState>;
  activeWorkspaceId: string;

  // Active Workspace State (flattened for easy access by components)
  tabs: TabState[];
  activeTabPath: string | null;
  explorerPath: string | null;
  projectName: string | null;
  explorerCollapsed: boolean;

  // UI State (Global)
  commandPaletteOpen: boolean;
  settingsOpen: boolean;

  // Terminal State (Global for now, to avoid complexity)
  terminalOpen: boolean;
  terminalHeight: number;
  terminals: TerminalState[];
  activeTerminalId: string | null;
  historyOpen: boolean;

  userSettings: {
    sidebarWidth: number;
    fontSize: number;
    lineNumbers: boolean;
    indentGuides: boolean;
    volume: number;
    uiBlur: boolean;
    autoSave: boolean;
    theme: string;
    llm: {
      provider: "ollama" | "openai" | "anthropic" | "google";
      model: string;
      baseUrl?: string;
      apiKey?: string;
    };
    lsp: {
      enabled: boolean;
      servers?: Record<
        string,
        { command: string; args: string[]; enabled?: boolean }
      >;
    };
  };
  projectSettings: {
    sidebarWidth?: number;
    fontSize?: number;
    lineNumbers?: boolean;
    indentGuides?: boolean;
    volume?: number;
    uiBlur?: boolean;
    autoSave?: boolean;
    theme?: string;
    llm?: {
      provider?: "ollama" | "openai" | "anthropic" | "google";
      model?: string;
      baseUrl?: string;
      apiKey?: string;
    };
    lsp?: {
      enabled?: boolean;
      servers?: Record<
        string,
        { command?: string; args?: string[]; enabled?: boolean }
      >;
    };
  };
  settings: {
    sidebarWidth: number;
    fontSize: number;
    lineNumbers: boolean;
    indentGuides: boolean;
    volume: number;
    uiBlur: boolean;
    autoSave: boolean;
    theme: string;
    llm: {
      provider: "ollama" | "openai" | "anthropic" | "google";
      model: string;
      baseUrl?: string;
      apiKey?: string;
    };
    lsp: {
      enabled: boolean;
      servers?: Record<
        string,
        { command: string; args: string[]; enabled?: boolean }
      >;
    };
  };
  logs: ActionLog[];
  agentHistory: { role: "user" | "assistant" | "system"; content: string }[];
}

type Listener = () => void;

const DEFAULT_WORKSPACE_ID = "default";

let state: EditorStoreState = {
  workspaces: {
    [DEFAULT_WORKSPACE_ID]: {
      id: DEFAULT_WORKSPACE_ID,
      name: "Untitled",
      tabs: [],
      activeTabPath: null,
      explorerPath: null,
      projectName: null,
      explorerCollapsed: false,
      historyOpen: false,
      terminalOpen: false
    }
  },
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,

  // Initialize flattened state from default workspace
  tabs: [],
  activeTabPath: null,
  explorerPath: null,
  projectName: null,
  explorerCollapsed: false,

  commandPaletteOpen: false,
  settingsOpen: false,
  terminalOpen: false,
  terminalHeight: 300,
  terminals: [],
  activeTerminalId: null,
  historyOpen: false,
  userSettings: {
    sidebarWidth: 240,
    fontSize: 15,
    lineNumbers: true,
    indentGuides: true,
    volume: 50,
    uiBlur: false,
    autoSave: false,
    theme: "ted",
    llm: {
      provider: "ollama",
      model: "mistral",
      baseUrl: "http://localhost:11434",
      apiKey: "",
    },
    lsp: {
      enabled: true,
    },
  },
  projectSettings: {},
  settings: {
    sidebarWidth: 240,
    fontSize: 15,
    lineNumbers: true,
    indentGuides: true,
    volume: 50,
    uiBlur: false,
    autoSave: false,
    theme: "ted",
    llm: {
      provider: "ollama",
      model: "mistral",
      baseUrl: "http://localhost:11434",
      apiKey: "",
    },
    lsp: {
      enabled: true,
    },
  },
  logs: [],
  agentHistory: [],
};

const MAX_LOGS = 1000;
const listeners = new Set<Listener>();
let userSettingsPath: string | null = null;

function emit() {
  for (const l of listeners) l();
}

function dispatch(
  type: string,
  partial: Partial<EditorStoreState>,
  payload?: any,
) {
  const log: ActionLog = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
  };

  const nextLogs = [log, ...state.logs].slice(0, MAX_LOGS);
  let nextState = { ...state, ...partial, logs: nextLogs };

  // Sync current flattened state back to the active workspace entry
  // We do this for ALL actions except those that explicitly handle workspace switching/closing
  // (which handle the state transition themselves)
  if (type !== "SWITCH_WORKSPACE" && type !== "CLOSE_WORKSPACE") {
    // Optimization: Only update workspace if relevant fields changed
    const relevantKeys: (keyof WorkspaceState)[] = [
      "tabs",
      "activeTabPath",
      "explorerPath",
      "projectName",
      "explorerCollapsed",
      "historyOpen",
      "terminalOpen"
    ];
    // We check if any of the keys in `partial` match the relevant keys
    // Note: `partial` might contain keys not in WorkspaceState, so we cast to check presence
    const shouldSync = relevantKeys.some((k) => k in partial);

    if (shouldSync) {
      const activeId = nextState.activeWorkspaceId;
      if (nextState.workspaces[activeId]) {
        // We update the workspace record with the new state values
        // This ensures that if we switch away and back, we have the latest state
        nextState.workspaces = {
          ...nextState.workspaces,
          [activeId]: {
            ...nextState.workspaces[activeId],
            tabs: nextState.tabs,
            activeTabPath: nextState.activeTabPath,
            explorerPath: nextState.explorerPath,
            projectName: nextState.projectName,
            explorerCollapsed: nextState.explorerCollapsed,
            historyOpen: nextState.historyOpen,
            terminalOpen: nextState.terminalOpen
          }
        };
      }
    }
  }

  if (partial.userSettings || partial.projectSettings) {
    nextState.settings = {
      ...nextState.userSettings,
      ...nextState.projectSettings,
      theme:
        nextState.projectSettings.theme ??
        nextState.userSettings.theme,
      llm: {
        ...nextState.userSettings.llm,
        ...nextState.projectSettings.llm,
        // Ensure required fields are always present if project settings are partial
        provider:
          nextState.projectSettings.llm?.provider ??
          nextState.userSettings.llm.provider,
        model:
          nextState.projectSettings.llm?.model ??
          nextState.userSettings.llm.model,
      },
      lsp: {
        enabled:
          nextState.projectSettings.lsp?.enabled ??
          nextState.userSettings.lsp.enabled,
        servers: nextState.userSettings.lsp.servers,
      },
    };

    if (userSettingsPath && partial.userSettings) {
      persistSettings(userSettingsPath, nextState.userSettings);
    }
    if (nextState.explorerPath && partial.projectSettings) {
      persistSettings(
        `${nextState.explorerPath}/.ted/settings.json`,
        nextState.projectSettings,
      );
    }
  }

  state = nextState;
  emit();
}

async function persistSettings(path: string, settings: any) {
  try {
    await invoke("write_file", {
      path,
      content: JSON.stringify(settings, null, 2),
    });
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
      const content: string = await invoke("read_file", {
        path: userSettingsPath,
      });
      const parsed = JSON.parse(content);

      const theme = parsed.theme || "ted";
      applyTheme(theme);

      dispatch("INIT_USER_SETTINGS", {
        userSettings: { ...state.userSettings, ...parsed },
      });
    } catch (err) {
      console.log("No existing user settings found, using defaults.");
      applyTheme("ted");
    }
  },

  getState: () => state,
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Workspace Actions
  createWorkspace(path?: string) {
    const id = crypto.randomUUID();
    const name = path ? path.split(/[\\/]/).pop() || "Untitled" : "Untitled";

    const newWorkspace: WorkspaceState = {
      id,
      name,
      tabs: [],
      activeTabPath: null,
      explorerPath: path || null,
      projectName: name,
      explorerCollapsed: false,
      historyOpen: false,
      terminalOpen: false
    };

    // If we have a path, we should probably switch to it immediately?
    // User flow: Click "+" -> New Workspace.

    dispatch("CREATE_WORKSPACE", {
      workspaces: { ...state.workspaces, [id]: newWorkspace }
    });

    this.switchWorkspace(id);

    if (path) {
      this.setExplorerPath(path);
    }
  },

  switchWorkspace(id: string) {
    if (id === state.activeWorkspaceId) return;
    const target = state.workspaces[id];
    if (!target) return;

    // Save current state is handled by the pre-dispatch logic in `dispatch` 
    // BUT since we are doing a "SWITCH_WORKSPACE", we suppressed the auto-update there 
    // so we can do it cleanly here if we wanted, OR we rely on the previous state.

    // Let's do it manually to be safe and explicit.
    const currentId = state.activeWorkspaceId;
    const currentWorkspaceUpdated = {
      ...state.workspaces[currentId],
      tabs: state.tabs,
      activeTabPath: state.activeTabPath,
      explorerPath: state.explorerPath,
      projectName: state.projectName,
      explorerCollapsed: state.explorerCollapsed,
      historyOpen: state.historyOpen,
      terminalOpen: state.terminalOpen
    };

    const newWorkspaces = {
      ...state.workspaces,
      [currentId]: currentWorkspaceUpdated
    };

    dispatch("SWITCH_WORKSPACE", {
      workspaces: newWorkspaces,
      activeWorkspaceId: id,
      // Load target state
      tabs: target.tabs,
      activeTabPath: target.activeTabPath,
      explorerPath: target.explorerPath,
      projectName: target.projectName,
      explorerCollapsed: target.explorerCollapsed,
      historyOpen: target.historyOpen,
      terminalOpen: target.terminalOpen
    });
  },

  closeWorkspace(id: string) {
    // Don't close if it's the only one
    const ids = Object.keys(state.workspaces);
    if (ids.length <= 1) return;

    const { [id]: removed, ...remainingWorkspaces } = state.workspaces;

    let nextActiveId = state.activeWorkspaceId;
    let extraStateUpdates = {};

    if (id === state.activeWorkspaceId) {
      // Switch to another one (e.g. the last one or previous one)
      const newIds = Object.keys(remainingWorkspaces);
      nextActiveId = newIds[newIds.length - 1];
      const target = remainingWorkspaces[nextActiveId];

      extraStateUpdates = {
        tabs: target.tabs,
        activeTabPath: target.activeTabPath,
        explorerPath: target.explorerPath,
        projectName: target.projectName,
        explorerCollapsed: target.explorerCollapsed,
        historyOpen: target.historyOpen,
        terminalOpen: target.terminalOpen
      };
    }

    dispatch("CLOSE_WORKSPACE", {
      workspaces: remainingWorkspaces,
      activeWorkspaceId: nextActiveId,
      ...extraStateUpdates
    });
  },

  newFile() {
    const id = crypto.randomUUID();
    const path = `untitled-${id}`;
    this.openTab(path, "Untitled", "");
  },

  openTab(path: string, name: string, content: string, type: "editor" | "browser" = "editor", url?: string) {
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
      type,
      url,
    };
    dispatch(
      "OPEN_TAB",
      {
        tabs: [...state.tabs, tab],
        activeTabPath: path,
      },
      { path, name },
    );

    telemetry.log("file_open", { path, name, type });
  },

  openBrowserTab(url: string) {
    const id = crypto.randomUUID();
    const path = `browser://${id}`;
    this.openTab(path, "Browser", "", "browser", url);
  },

  async openDiff(path: string) {
    const diffPath = `diff:${path}`;
    if (state.tabs.find((t) => t.path === diffPath)) {
      this.setActiveTab(diffPath);
      return;
    }

    const tab = state.tabs.find((t) => t.path === path);
    const content = tab
      ? tab.content
      : await invoke<string>("read_file", { path });
    const originalContent = await gitService.readFile(path, "HEAD");
    const name = tab
      ? tab.name
      : await invoke<string>("get_basename", { path });

    const diffTab: TabState = {
      path: diffPath,
      name: `Diff: ${name}`,
      content,
      savedContent: content,
      originalContent,
      isDiff: true,
      isDirty: false,
      scrollTop: 0,
      scrollLeft: 0,
      cursorPos: 0,
    };

    dispatch(
      "OPEN_DIFF_TAB",
      {
        tabs: [...state.tabs, diffTab],
        activeTabPath: diffPath,
      },
      { path },
    );

    telemetry.log("diff_open", { path });
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
    telemetry.log("file_close", { path });
  },

  setActiveTab(path: string) {
    dispatch("SET_ACTIVE_TAB", { activeTabPath: path });
    telemetry.log("tab_switch", { path });
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
    // Update workspace name if opening a folder
    const updates: Partial<EditorStoreState> = { explorerPath: path, projectSettings: {} };

    if (path) {
      const name = path.split(/[\\/]/).pop() || "Untitled";
      updates.projectName = name;

      // Also update the workspace record immediately if possible/needed,
      // but our dispatch middleware handles it.
      // However, we want to update the `name` field of the workspace too.
      if (state.activeWorkspaceId && state.workspaces[state.activeWorkspaceId]) {
        const ws = state.workspaces[state.activeWorkspaceId];
        updates.workspaces = {
          ...state.workspaces,
          [state.activeWorkspaceId]: {
            ...ws,
            name: name,
            explorerPath: path,
            projectName: name
          }
        };
      }
    }

    dispatch("SET_EXPLORER_PATH", updates);

    if (path) {
      try {
        const projectSettingsPath = `${path}/.ted/settings.json`;
        const content: string = await invoke("read_file", {
          path: projectSettingsPath,
        });
        const parsed = JSON.parse(content);
        dispatch("LOAD_PROJECT_SETTINGS", { projectSettings: parsed });

        // Apply project theme if exists
        if (parsed.theme) {
          applyTheme(parsed.theme);
        }
      } catch {
        console.log("No project settings found for", path);
      }
    }
  },


  setProjectName(name: string | null) {
    dispatch("SET_PROJECT_NAME", { projectName: name });
  },

  toggleExplorer() {
    dispatch("TOGGLE_EXPLORER", {
      explorerCollapsed: !state.explorerCollapsed,
    });
  },

  setCommandPaletteOpen(open: boolean) {
    dispatch("SET_COMMAND_PALETTE", { commandPaletteOpen: open });
  },

  toggleCommandPalette() {
    dispatch("TOGGLE_COMMAND_PALETTE", {
      commandPaletteOpen: !state.commandPaletteOpen,
    });
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
      if (update.theme) applyTheme(update.theme);
      dispatch("UPDATE_USER_SETTINGS", { userSettings }, { update });
    } else {
      const projectSettings = { ...state.projectSettings, ...update };
      if (update.theme) applyTheme(update.theme);
      dispatch("UPDATE_PROJECT_SETTINGS", { projectSettings }, { update });
    }
  },

  // Terminal actions
  toggleTerminal() {
    const nextOpen = !state.terminalOpen;
    if (nextOpen && state.terminals.length === 0) {
      this.newTerminal();
    }
    dispatch("TOGGLE_TERMINAL", { terminalOpen: nextOpen });
  },

  setTerminalOpen(open: boolean) {
    if (open && state.terminals.length === 0) {
      this.newTerminal();
    }
    dispatch("SET_TERMINAL_OPEN", { terminalOpen: open });
  },

  newTerminal() {
    const id = crypto.randomUUID();
    const newTerminal: TerminalState = {
      id,
      name: `Terminal ${state.terminals.length + 1}`,
    };
    dispatch("NEW_TERMINAL", {
      terminals: [...state.terminals, newTerminal],
      activeTerminalId: id,
      terminalOpen: true,
    });
  },

  setActiveTerminal(id: string) {
    dispatch("SET_ACTIVE_TERMINAL", { activeTerminalId: id });
  },

  closeTerminal(id: string) {
    const terminals = state.terminals.filter((t) => t.id !== id);
    let activeTerminalId = state.activeTerminalId;
    if (activeTerminalId === id) {
      activeTerminalId =
        terminals.length > 0 ? terminals[terminals.length - 1].id : null;
    }
    const terminalOpen = terminals.length === 0 ? false : state.terminalOpen;
    dispatch("CLOSE_TERMINAL", { terminals, activeTerminalId, terminalOpen });
  },

  setTerminalHeight(height: number) {
    dispatch("SET_TERMINAL_HEIGHT", { terminalHeight: height });
  },

  toggleHistory() {
    const nextOpen = !state.historyOpen;
    if (nextOpen && !state.terminalOpen) {
      this.setTerminalOpen(true);
    }
    dispatch("TOGGLE_HISTORY", { historyOpen: nextOpen });
  },

  setHistoryOpen(open: boolean) {
    if (open && !state.terminalOpen) {
      this.setTerminalOpen(true);
    }
    dispatch("SET_HISTORY_OPEN", { historyOpen: open });
  },

  addAgentMessage(msg: { role: "user" | "assistant" | "system"; content: string }) {
    // This is a bit of a hack to inject messages into the agent loop.
    // Ideally the agent service should be a store itself or subscribe to this.
    // For now, we'll store it in a temporary state that the agent UI can read, 
    // OR we just dispatch it so the UI updates if it's displaying a chat history.
    // Since the current Agent UI mainly shows the *current* run loop, this might need
    // the Agent Service to expose a method `injectMessage`.
    // But `tools.ts` imports `editorStore`. 

    // Let's rely on the Agent UI to listen to an event or just use this as a signal.
    // Actually, looking at `agent-service.ts`, it keeps its own `messages` array locally in `runAgentLoop`.
    // We cannot easily inject into a *running* loop from the outside without a signal.

    // However, `schedule_request` implies a NEW loop might be needed if the old one finished.
    // If the old one is finished, how do we trigger a new one?
    // The `Agent` component in the UI likely calls `runAgentLoop`.

    // We need a global way to request an agent action.
    // Let's add `pendingAgentRequest` to store.
    dispatch("ADD_AGENT_REQUEST", {
      // We'll store this in a new field in state, likely not defined yet. 
      // Let's just emit an event for now.
    }, { msg });

    // Dispatch a custom event that the UI can listen to
    window.dispatchEvent(new CustomEvent("agent-request", { detail: msg }));
  },

  updateAgentHistory(history: { role: "user" | "assistant" | "system"; content: string }[]) {
    dispatch("UPDATE_AGENT_HISTORY", { agentHistory: history });
  },

  clearAgentHistory() {
    dispatch("UPDATE_AGENT_HISTORY", { agentHistory: [] });
  },
};

export function useEditorStore<T>(selector: (s: EditorStoreState) => T): T {
  return useSyncExternalStore(editorStore.subscribe, () =>
    selector(editorStore.getState()),
  );
}
