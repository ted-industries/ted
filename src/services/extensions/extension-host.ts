// Extension Host — discovers, loads, and manages extensions
// No sandboxing: extensions run in the renderer process directly.

import { invoke } from "@tauri-apps/api/core";
import { createTedAPI } from "./ted-api";
import type {
    ExtensionManifest,
    ExtensionInstance,
    ExtensionCleanup,
    RegisteredCommand,
    RegisteredPanel,
    RegisteredStatusBarItem,
} from "./types";

type Listener = () => void;

/** Read a JS file from disk and return an importable blob URL */
async function loadModuleFromDisk(filePath: string): Promise<any> {
    const source: string = await invoke("read_file", { path: filePath });
    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        return await import(/* @vite-ignore */ url);
    } finally {
        URL.revokeObjectURL(url);
    }
}

class ExtensionHost {
    private extensions: Map<string, ExtensionInstance> = new Map();
    private commands: Map<string, RegisteredCommand> = new Map();
    private panels: Map<string, RegisteredPanel> = new Map();
    private statusBarItems: Map<string, RegisteredStatusBarItem> = new Map();
    private listeners = new Set<Listener>();
    private initialized = false;

    // Snapshot caches — stable references for useSyncExternalStore
    private _extSnap: ExtensionInstance[] = [];
    private _cmdSnap: RegisteredCommand[] = [];
    private _panelSnap: RegisteredPanel[] = [];
    private _sbSnap: RegisteredStatusBarItem[] = [];

    // ── Lifecycle ──────────────────────────────────────────────────

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log("[ExtensionHost] Initializing...");
        await this.scanAndLoadAll();
        console.log(`[ExtensionHost] ${this.extensions.size} extension(s) loaded`);
    }

    dispose() {
        for (const [id] of this.extensions) {
            this.unloadExtension(id);
        }
        this.extensions.clear();
        this.commands.clear();
        this.panels.clear();
        this.statusBarItems.clear();
        this.initialized = false;
    }

    // ── Discovery ──────────────────────────────────────────────────

    private async scanAndLoadAll() {
        const dirs = await this.getExtensionDirs();
        for (const dir of dirs) {
            try {
                const manifests = await this.scanDir(dir);
                for (const { manifest, path } of manifests) {
                    await this.loadExtension(manifest, path);
                }
            } catch (err) {
                console.warn(`[ExtensionHost] Failed to scan ${dir}:`, err);
            }
        }
    }

    private async getExtensionDirs(): Promise<string[]> {
        const dirs: string[] = [];
        try {
            // User-global extensions directory
            const configDir: string = await invoke("get_user_config_dir");
            // configDir is like C:\Users\X\AppData\Roaming\com.tomlin7.ted\settings.json
            // We want the parent directory + \extensions
            const parent = configDir.replace(/[\\/][^\\/]+$/, "");
            dirs.push(`${parent}\\extensions`);
        } catch { /* no config dir */ }

        return dirs;
    }

    private async scanDir(dir: string): Promise<{ manifest: ExtensionManifest; path: string }[]> {
        const results: { manifest: ExtensionManifest; path: string }[] = [];
        try {
            const entries: { name: string; path: string; is_dir: boolean }[] =
                await invoke("list_dir", { path: dir });

            for (const entry of entries) {
                if (!entry.is_dir) continue;
                try {
                    const manifestPath = `${entry.path}\\package.json`;
                    const raw: string = await invoke("read_file", { path: manifestPath });
                    const manifest = JSON.parse(raw) as ExtensionManifest;
                    if (manifest.name && manifest.main) {
                        results.push({ manifest, path: entry.path });
                    }
                } catch {
                    // Not an extension folder, skip
                }
            }
        } catch {
            // Directory doesn't exist yet, that's fine
        }
        return results;
    }

    // ── Loading / Unloading ────────────────────────────────────────

    async loadExtension(manifest: ExtensionManifest, extPath: string) {
        if (this.extensions.has(manifest.name)) {
            console.warn(`[ExtensionHost] Extension "${manifest.name}" already loaded`);
            return;
        }

        const cleanup: ExtensionCleanup = {
            commands: [],
            panels: [],
            statusBarItems: [],
            eventUnsubs: [],
        };

        const instance: ExtensionInstance = {
            id: manifest.name,
            manifest,
            path: extPath,
            status: "inactive",
            cleanup,
        };

        this.extensions.set(manifest.name, instance);
        this.emit();

        try {
            const entryPath = `${extPath}\\${manifest.main}`;
            const mod = await loadModuleFromDisk(entryPath);

            instance.module = mod;

            // Create scoped API and activate
            const api = createTedAPI(manifest.name, cleanup);
            if (typeof mod.activate === "function") {
                await mod.activate(api);
            }

            instance.status = "active";
            console.log(`[ExtensionHost] Activated "${manifest.displayName || manifest.name}"`);
        } catch (err) {
            instance.status = "error";
            instance.error = String(err);
            console.error(`[ExtensionHost] Failed to load "${manifest.name}":`, err);
        }

        this.emit();
    }

    async unloadExtension(id: string) {
        const instance = this.extensions.get(id);
        if (!instance) return;

        try {
            if (instance.module?.deactivate) {
                await instance.module.deactivate();
            }
        } catch (err) {
            console.error(`[ExtensionHost] Error deactivating "${id}":`, err);
        }

        // Clean up registered items
        for (const cmdId of instance.cleanup.commands) this.commands.delete(cmdId);
        for (const panelId of instance.cleanup.panels) this.panels.delete(panelId);
        for (const itemId of instance.cleanup.statusBarItems) this.statusBarItems.delete(itemId);
        for (const unsub of instance.cleanup.eventUnsubs) unsub();

        this.extensions.delete(id);
        this.emit();
    }

    async toggleExtension(id: string) {
        const instance = this.extensions.get(id);
        if (!instance) return;

        if (instance.status === "active") {
            // Deactivate but keep in list
            try {
                if (instance.module?.deactivate) {
                    await instance.module.deactivate();
                }
            } catch { /* ignore */ }

            for (const cmdId of instance.cleanup.commands) this.commands.delete(cmdId);
            for (const panelId of instance.cleanup.panels) this.panels.delete(panelId);
            for (const itemId of instance.cleanup.statusBarItems) this.statusBarItems.delete(itemId);
            for (const unsub of instance.cleanup.eventUnsubs) unsub();
            instance.cleanup = { commands: [], panels: [], statusBarItems: [], eventUnsubs: [] };

            instance.status = "inactive";
            instance.module = undefined;
        } else {
            // Re-activate
            await this.reloadExtension(id);
        }

        this.emit();
    }

    private async reloadExtension(id: string) {
        const instance = this.extensions.get(id);
        if (!instance) return;

        const cleanup: ExtensionCleanup = { commands: [], panels: [], statusBarItems: [], eventUnsubs: [] };
        instance.cleanup = cleanup;

        try {
            const entryPath = `${instance.path}\\${instance.manifest.main}`;
            const mod = await loadModuleFromDisk(entryPath);
            instance.module = mod;

            const api = createTedAPI(id, cleanup);
            if (typeof mod.activate === "function") {
                await mod.activate(api);
            }
            instance.status = "active";
        } catch (err) {
            instance.status = "error";
            instance.error = String(err);
        }
    }

    /** Load a single extension from a user-picked folder path */
    async loadFromPath(folderPath: string) {
        try {
            const manifestPath = `${folderPath}\\package.json`;
            const raw: string = await invoke("read_file", { path: manifestPath });
            const manifest = JSON.parse(raw) as ExtensionManifest;
            if (!manifest.name || !manifest.main) {
                throw new Error("Invalid manifest: missing 'name' or 'main'");
            }
            await this.loadExtension(manifest, folderPath);
        } catch (err) {
            console.error(`[ExtensionHost] loadFromPath failed:`, err);
            throw err;
        }
    }

    // ── Registry management ────────────────────────────────────────

    registerCommand(cmd: RegisteredCommand) {
        this.commands.set(cmd.id, cmd);
        this.emit();
    }

    registerPanel(panel: RegisteredPanel) {
        this.panels.set(panel.id, panel);
        this.emit();
    }

    registerStatusBarItem(item: RegisteredStatusBarItem) {
        this.statusBarItems.set(item.id, item);
        this.emit();
    }

    updateStatusBarItem(id: string, text: string) {
        const item = this.statusBarItems.get(id);
        if (item) {
            item.text = text;
            this.emit();
        }
    }

    removeStatusBarItem(id: string) {
        this.statusBarItems.delete(id);
        this.emit();
    }

    // ── Getters (cached snapshots) ─────────────────────────────────

    getExtensions(): ExtensionInstance[] {
        return this._extSnap;
    }

    getCommands(): RegisteredCommand[] {
        return this._cmdSnap;
    }

    getPanels(): RegisteredPanel[] {
        return this._panelSnap;
    }

    getStatusBarItems(): RegisteredStatusBarItem[] {
        return this._sbSnap;
    }

    // ── Pub/Sub ────────────────────────────────────────────────────

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit() {
        // Rebuild cached snapshots so React gets stable references
        this._extSnap = Array.from(this.extensions.values());
        this._cmdSnap = Array.from(this.commands.values());
        this._panelSnap = Array.from(this.panels.values());
        this._sbSnap = Array.from(this.statusBarItems.values()).sort((a, b) => a.priority - b.priority);
        for (const l of this.listeners) l();
    }
}

export const extensionHost = new ExtensionHost();

// React hook to subscribe to extension host changes
import { useSyncExternalStore } from "react";

export function useExtensionHost<T>(selector: (host: ExtensionHost) => T): T {
    return useSyncExternalStore(
        (cb) => extensionHost.subscribe(cb),
        () => selector(extensionHost)
    );
}
