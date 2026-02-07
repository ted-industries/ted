import { useState, useEffect, useRef, useMemo } from "react";
import { editorStore, useEditorStore } from "../../store/editor-store";
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
            id: "toggle-explorer",
            label: "Toggle Sidebar Explorer",
            shortcut: "Ctrl+B",
            action: () => editorStore.toggleExplorer(),
        },
        {
            id: "open-file",
            label: "Open File...",
            shortcut: "Ctrl+O",
            action: () => {
                // This will be handled in App.tsx but we can trigger it here if we expose it
                // For now, let's just emit a custom event or similar
                window.dispatchEvent(new CustomEvent("ted:open-file"));
            },
        },
        {
            id: "close-active-tab",
            label: "Close Active Tab",
            shortcut: "Ctrl+W",
            action: () => {
                const state = editorStore.getState();
                if (state.activeTabPath) {
                    editorStore.closeTab(state.activeTabPath);
                }
            },
        },
        {
            id: "new-file",
            label: "New File",
            shortcut: "Ctrl+N",
            action: () => {
                // Placeholder
                console.log("New file command trigger");
            },
        },
        {
            id: "save-file",
            label: "Save File",
            shortcut: "Ctrl+S",
            action: () => {
                window.dispatchEvent(new CustomEvent("ted:save-file"));
            }
        }
    ], []);

    const filteredCommands = useMemo(() => {
        if (!query) return commands;
        const lowerQuery = query.toLowerCase();
        return commands.filter((c) =>
            c.label.toLowerCase().includes(lowerQuery) ||
            c.category?.toLowerCase().includes(lowerQuery)
        );
    }, [query, commands]);

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
                setSelectedIndex((i) => (i + 1) % filteredCommands.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
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
                <div className="palette-input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        className="palette-input"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
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
            </div>
        </div>
    );
}
