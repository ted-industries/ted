import { useRef, useMemo, useState, useEffect } from "react";
import { useEditorStore, editorStore } from "../../store/editor-store";
import { telemetry } from "../../services/telemetry-service";
import { extensionHost, useExtensionHost } from "../../services/extensions/extension-host";
import "./CommandPalette.css";

interface Command {
    id: string;
    label: string;
    shortcut?: string;
    action: () => void;
    category?: string;
}

export default function CommandPalette() {
    const isOpen = useEditorStore((s) => s.commandPaletteOpen);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<{
        type: "command" | "quickpick" | "input",
        options?: any,
        resolve?: (val: any) => void
    }>({ type: "command" });

    useEffect(() => {
        const onQuickPick = (e: any) => {
            const { items, options, resolve } = e.detail;
            setMode({ type: "quickpick", options: { items, options }, resolve });
            editorStore.setCommandPaletteOpen(true);
        };
        const onInputBox = (e: any) => {
            const { options, resolve } = e.detail;
            setMode({ type: "input", options, resolve });
            editorStore.setCommandPaletteOpen(true);
        };
        window.addEventListener("ted:quickpick", onQuickPick);
        window.addEventListener("ted:inputbox", onInputBox);
        return () => {
            window.removeEventListener("ted:quickpick", onQuickPick);
            window.removeEventListener("ted:inputbox", onInputBox);
        }
    }, []);

    const commands = useMemo<Command[]>(() => [
        {
            id: "new-file",
            label: "file: new file",
            shortcut: "Ctrl+N",
            action: () => editorStore.newFile(),
        },
        {
            id: "open-file",
            label: "file: open file...",
            shortcut: "Ctrl+O",
            action: () => window.dispatchEvent(new CustomEvent("ted:open-file")),
        },
        {
            id: "save-file",
            label: "file: save",
            shortcut: "Ctrl+S",
            action: () => window.dispatchEvent(new CustomEvent("ted:save-file")),
        },
        {
            id: "save-as",
            label: "file: save as...",
            shortcut: "Ctrl+Shift+S",
            action: () => window.dispatchEvent(new CustomEvent("ted:save-file-as")),
        },
        {
            id: "open-folder",
            label: "file: open folder...",
            shortcut: "Ctrl+Shift+O",
            action: () => window.dispatchEvent(new CustomEvent("ted:open-folder")),
        },
        {
            id: "close-folder",
            label: "file: close folder...",
            shortcut: "Ctrl+K Ctrl+O",
            action: () => window.dispatchEvent(new CustomEvent("ted:close-folder")),
        },
        {
            id: "close-active-tab",
            label: "file: close active tab",
            shortcut: "Ctrl+W",
            action: () => {
                const state = editorStore.getState();
                if (state.activeTabPath) {
                    editorStore.closeTab(state.activeTabPath);
                }
            },
        },
        {
            id: "toggle-line-numbers",
            label: "view: toggle line numbers",
            action: () => {
                const s = editorStore.getState().settings;
                editorStore.updateSettings({ lineNumbers: !s.lineNumbers });
            },
        },
        {
            id: "toggle-indent-guides",
            label: "view: toggle indent guides",
            action: () => {
                const s = editorStore.getState().settings;
                editorStore.updateSettings({ indentGuides: !s.indentGuides });
            },
        },
        {
            id: "toggle-explorer",
            label: "view: toggle sidebar explorer",
            shortcut: "Ctrl+B",
            action: () => editorStore.toggleExplorer(),
        },
        {
            id: "toggle-terminal",
            label: "view: toggle integrated terminal",
            shortcut: "Ctrl+J",
            action: () => editorStore.toggleTerminal(),
        },
        {
            id: "new-terminal",
            label: "terminal: create new terminal",
            shortcut: "Ctrl+Shift+`",
            action: () => editorStore.newTerminal(),
        },
        {
            id: "open-settings",
            label: "ted: open settings",
            shortcut: "Ctrl+,",
            action: () => editorStore.setSettingsOpen(true),
        },
        {
            id: "open-logs",
            label: "developer: view action logs",
            action: () => {
                console.log("Logs:", editorStore.getState().logs);
            }
        },
        {
            id: "reload-window",
            label: "developer: reload window",
            action: () => window.location.reload(),
        },
        {
            id: "open-browser",
            label: "browser: open new tab",
            shortcut: "Ctrl+Shift+B",
            action: () => {
                editorStore.openBrowserTab("https://www.google.com");
            },
        },
        {
            id: "open-marketplace",
            label: "extensions: open marketplace",
            action: () => editorStore.openMarketplace(),
        }
    ], []);

    // Merge extension commands into the palette
    const extCommands = useExtensionHost(() => extensionHost.getCommands());
    const allItems = useMemo(() => {
        if (mode.type === "quickpick") {
            return mode.options.items.map((item: any, i: number) => ({
                id: `qp-${i}`,
                label: mode.options.options?.getLabel ? mode.options.options.getLabel(item) : String(item),
                action: () => mode.resolve?.(item),
                data: item
            }));
        }

        const base: Command[] = commands.map(c => ({ ...c, category: "core" }));
        const ext: Command[] = extCommands.map((c) => ({
            id: c.id,
            label: `extension: ${c.label}`,
            action: () => c.handler(),
            category: "extension",
        }));
        return [...base, ...ext];
    }, [commands, extCommands, mode]);

    const filteredItems = useMemo(() => {
        if (!query) return allItems;
        const lowerQuery = query.toLowerCase();
        return allItems.filter((c: any) =>
            c.label.toLowerCase().includes(lowerQuery)
        );
    }, [query, allItems]);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            // If closed without resolving (e.g. Esc), resolve with undefined
            if (mode.type !== "command" && mode.resolve) {
                mode.resolve(undefined);
            }
            setMode({ type: "command" });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "Escape") {
                editorStore.setCommandPaletteOpen(false);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => (filteredItems.length > 0 ? (i + 1) % filteredItems.length : 0));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => (filteredItems.length > 0 ? (i - 1 + filteredItems.length) % filteredItems.length : 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (mode.type === "input") {
                    mode.resolve?.(query);
                    editorStore.setCommandPaletteOpen(false);
                    return;
                }
                const item = filteredItems[selectedIndex];
                if (item) {
                    if (mode.type === "command") {
                        telemetry.log("command_executed", { id: item.id, label: item.label });
                    }
                    item.action();
                    // We don't set mode to command here, useEffect on isOpen does it
                    editorStore.setCommandPaletteOpen(false);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, mode, query]);

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={() => editorStore.setCommandPaletteOpen(false)}>
            <div className="command-palette" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    className="palette-input"
                    placeholder={mode.type === "input" ? (mode.options?.prompt || "Enter value...") :
                        mode.type === "quickpick" ? (mode.options?.options?.placeHolder || "Select an item...") :
                            "Execute a command..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    spellCheck={false}
                />
                <div className="palette-list" ref={listRef} style={{ display: mode.type === "input" ? "none" : "block" }}>
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item: any, index: number) => (
                            <div
                                key={item.id}
                                className={`palette-item ${index === selectedIndex ? "selected" : ""}`}
                                onClick={() => {
                                    item.action();
                                    editorStore.setCommandPaletteOpen(false);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="palette-item-label">{item.label}</span>
                                {(item as any).shortcut && (
                                    <span className="palette-item-shortcut">{(item as any).shortcut}</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="palette-no-results">No matches found</div>
                    )}
                </div>
                {/* <div className="palette-footer">
                    <div className="footer-hint">
                        <span>Add Keybinding...</span>
                        <span className="hint-key">Ctrl-Enter</span>
                    </div>
                    <div className="footer-hint">
                        <span>Run</span>
                        <span className="hint-key">Enter</span>
                    </div>
                </div> */}
            </div>
        </div>
    );
}
