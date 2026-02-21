// Extension system types

export interface ExtensionManifest {
    name: string;
    version: string;
    displayName: string;
    description?: string;
    main: string; // relative path to entry JS file
    activationEvents?: string[]; // e.g. ["onStartup", "onCommand:myCmd"]
}

export interface ExtensionInstance {
    id: string; // manifest.name
    manifest: ExtensionManifest;
    path: string; // absolute path to extension folder
    status: "active" | "inactive" | "error";
    error?: string;
    module?: ExtensionModule;
    cleanup: ExtensionCleanup;
}

export interface ExtensionModule {
    activate?: (api: TedAPI) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
    default?: any;
}

/** Tracks everything an extension registered so we can clean up on unload */
export interface ExtensionCleanup {
    commands: string[];
    panels: string[];
    statusBarItems: string[];
    eventUnsubs: (() => void)[];
}

// ── Ted API surface exposed to extensions ──────────────────────────

export interface TedAPI {
    editor: TedEditorAPI;
    commands: TedCommandsAPI;
    sidebar: TedSidebarAPI;
    statusbar: TedStatusBarAPI;
    workspace: TedWorkspaceAPI;
    fs: TedFsAPI;
    window: TedWindowAPI;
    onEvent: (event: string, handler: (...args: any[]) => void) => () => void;
}

export interface TedEditorAPI {
    openFile: (path: string) => Promise<void>;
    getActiveFile: () => { path: string; name: string; content: string } | null;
    showNotification: (message: string, type?: "info" | "warning" | "error") => void;
    setSelection: (anchor: number, head?: number) => void;
    getSelection: () => { anchor: number; head: number } | null;
}

export interface TedCommandsAPI {
    register: (id: string, label: string, handler: () => void | Promise<void>) => void;
}

export interface TedSidebarAPI {
    registerPanel: (id: string, label: string, render: (container: HTMLElement) => void | (() => void)) => void;
}

export interface TedStatusBarAPI {
    addItem: (id: string, text: string, opts?: { align?: "left" | "right"; priority?: number; onClick?: () => void }) => void;
    updateItem: (id: string, text: string) => void;
    removeItem: (id: string) => void;
}

export interface TedWorkspaceAPI {
    getPath: () => string | null;
}

export interface TedFsAPI {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    listDir: (path: string) => Promise<{ name: string; path: string; isDir: boolean }[]>;
}

export interface TedWindowAPI {
    showQuickPick: <T>(items: T[], options?: { placeHolder?: string, getLabel: (item: T) => string }) => Promise<T | undefined>;
    showInputBox: (options?: { prompt?: string, value?: string }) => Promise<string | undefined>;
}

// ── Registry types ─────────────────────────────────────────────────

export interface RegisteredCommand {
    id: string;
    label: string;
    handler: () => void | Promise<void>;
    extensionId: string;
}

export interface RegisteredPanel {
    id: string;
    label: string;
    render: (container: HTMLElement) => void | (() => void);
    extensionId: string;
}

export interface RegisteredStatusBarItem {
    id: string;
    text: string;
    align: "left" | "right";
    priority: number;
    onClick?: () => void;
    extensionId: string;
}
