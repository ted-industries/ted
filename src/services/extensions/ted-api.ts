// Creates a scoped TedAPI instance for each extension

import { invoke } from "@tauri-apps/api/core";
import { editorStore } from "../../store/editor-store";
import { extensionHost } from "./extension-host";
import type {
    TedAPI,
    ExtensionCleanup,
    RegisteredCommand,
    RegisteredPanel,
    RegisteredStatusBarItem,
} from "./types";

export function createTedAPI(extensionId: string, cleanup: ExtensionCleanup): TedAPI {
    return {
        editor: {
            async openFile(path: string) {
                try {
                    const content: string = await invoke("read_file", { path });
                    const name: string = await invoke("get_basename", { path });
                    editorStore.openTab(path, name, content);
                } catch (err) {
                    console.error(`[ext:${extensionId}] openFile failed:`, err);
                }
            },

            getActiveFile() {
                const s = editorStore.getState();
                const tab = s.tabs.find((t) => t.path === s.activeTabPath);
                if (!tab) return null;
                return { path: tab.path, name: tab.name, content: tab.content };
            },

            showNotification(message: string, type: "info" | "warning" | "error" = "info") {
                window.dispatchEvent(
                    new CustomEvent("ted:notification", {
                        detail: { message, type, extensionId },
                    })
                );
            },

            setSelection(anchor: number, _head?: number) {
                const s = editorStore.getState();
                if (s.activeTabPath) {
                    editorStore.saveTabViewState(s.activeTabPath, 0, 0, anchor);
                }
            },

            getSelection() {
                const s = editorStore.getState();
                const tab = s.tabs.find((t) => t.path === s.activeTabPath);
                if (!tab) return null;
                return { anchor: tab.cursorPos, head: tab.cursorPos };
            },
        },

        commands: {
            register(id: string, label: string, handler: () => void | Promise<void>) {
                const fullId = `${extensionId}.${id}`;
                const cmd: RegisteredCommand = { id: fullId, label, handler, extensionId };
                extensionHost.registerCommand(cmd);
                cleanup.commands.push(fullId);
            },
        },

        sidebar: {
            registerPanel(
                id: string,
                label: string,
                render: (container: HTMLElement) => void | (() => void)
            ) {
                const fullId = `${extensionId}.${id}`;
                const panel: RegisteredPanel = { id: fullId, label, render, extensionId };
                extensionHost.registerPanel(panel);
                cleanup.panels.push(fullId);
            },
        },

        statusbar: {
            addItem(
                id: string,
                text: string,
                opts?: { align?: "left" | "right"; priority?: number; onClick?: () => void }
            ) {
                const fullId = `${extensionId}.${id}`;
                const item: RegisteredStatusBarItem = {
                    id: fullId,
                    text,
                    align: opts?.align ?? "right",
                    priority: opts?.priority ?? 0,
                    onClick: opts?.onClick,
                    extensionId,
                };
                extensionHost.registerStatusBarItem(item);
                cleanup.statusBarItems.push(fullId);
            },

            updateItem(id: string, text: string) {
                extensionHost.updateStatusBarItem(`${extensionId}.${id}`, text);
            },

            removeItem(id: string) {
                extensionHost.removeStatusBarItem(`${extensionId}.${id}`);
            },
        },

        workspace: {
            getPath() {
                return editorStore.getState().explorerPath;
            },
        },

        fs: {
            async readFile(path: string): Promise<string> {
                return invoke("read_file", { path });
            },
            async writeFile(path: string, content: string): Promise<void> {
                await invoke("write_file", { path, content });
            },
            async listDir(path: string) {
                const entries: { name: string; path: string; is_dir: boolean }[] =
                    await invoke("list_dir", { path });
                return entries.map((e) => ({ name: e.name, path: e.path, isDir: e.is_dir }));
            },
        },

        window: {
            showQuickPick<T>(items: T[], options?: any): Promise<T | undefined> {
                return new Promise((resolve) => {
                    window.dispatchEvent(new CustomEvent("ted:quickpick", {
                        detail: { items, options, resolve }
                    }));
                });
            },
            showInputBox(options?: any): Promise<string | undefined> {
                return new Promise((resolve) => {
                    window.dispatchEvent(new CustomEvent("ted:inputbox", {
                        detail: { options, resolve }
                    }));
                });
            }
        },

        onEvent(event: string, handler: (...args: any[]) => void) {
            const wrappedHandler = ((e: CustomEvent) => handler(...(e.detail ? [e.detail] : []))) as EventListener;
            window.addEventListener(`ted:${event}`, wrappedHandler);
            const unsub = () => window.removeEventListener(`ted:${event}`, wrappedHandler);
            cleanup.eventUnsubs.push(unsub);
            return unsub;
        },
    };
}
