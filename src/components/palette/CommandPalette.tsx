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
    const allCommands = useMemo(() => {
        const ext: Command[] = extCommands.map((c) => ({
            id: c.id,
            label: `extension: ${c.label}`,
            action: () => c.handler(),
            category: "extension",
        }));
        return [...commands, ...ext];
    }, [commands, extCommands]);

    const filteredCommands = useMemo(() => {
        if (!query) return allCommands;
        const lowerQuery = query.toLowerCase();
        return allCommands.filter((c) =>
            c.label.toLowerCase().includes(lowerQuery)
        );
    }, [query, allCommands]);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "Escape") {
                editorStore.setCommandPaletteOpen(false);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => (filteredCommands.length > 0 ? (i + 1) % filteredCommands.length : 0));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => (filteredCommands.length > 0 ? (i - 1 + filteredCommands.length) % filteredCommands.length : 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    telemetry.log("command_executed", { id: cmd.id, label: cmd.label });
                    cmd.action();
                    editorStore.setCommandPaletteOpen(false);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={() => editorStore.setCommandPaletteOpen(false)}>
            <div className="command-palette" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    className="palette-input"
                    placeholder="Execute a command..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    spellCheck={false}
                />
                <div className="palette-list" ref={listRef}>
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((command, index) => (
                            <div
                                key={command.id}
                                className={`palette-item ${index === selectedIndex ? "selected" : ""}`}
                                onClick={() => {
                                    command.action();
                                    editorStore.setCommandPaletteOpen(false);
                                }}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="palette-item-label">{command.label}</span>
                                {command.shortcut && (
                                    <span className="palette-item-shortcut">{command.shortcut}</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="palette-no-results">No commands found</div>
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
