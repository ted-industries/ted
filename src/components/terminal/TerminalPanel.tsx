import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { RiCloseLine, RiAddLine } from "@remixicon/react";
import "xterm/css/xterm.css";
import "./TerminalPanel.css";

interface TerminalInstanceProps {
    id: string;
    isActive: boolean;
}

function TerminalInstance({ id, isActive }: TerminalInstanceProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const initializedRef = useRef(false);
    const unlistenRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize xterm
        const term = new Terminal({
            theme: {
                background: "#1a1a1a",
                foreground: "#d4d4d4",
                cursor: "#aeafad",
                selectionBackground: "#ffffff15",
                black: "#1a1a1a",
                red: "#f44747",
                green: "#6a9955",
                yellow: "#d7ba7d",
                blue: "#569cd6",
                magenta: "#c586c0",
                cyan: "#4fc1ff",
                white: "#d4d4d4",
                brightBlack: "#808080",
                brightRed: "#f44747",
                brightGreen: "#6a9955",
                brightYellow: "#d7ba7d",
                brightBlue: "#569cd6",
                brightMagenta: "#c586c0",
                brightCyan: "#4fc1ff",
                brightWhite: "#ffffff",
            },
            fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontSize: 13,
            allowTransparency: true,
            cursorBlink: true,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Open immediately to container
        term.open(containerRef.current);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // ResizeObserver to handle layout readiness and resizing
        const resizeObserver = new ResizeObserver((entries) => {
            if (!Array.isArray(entries) || !entries.length) return;

            const { width, height } = entries[0].contentRect;

            // Only proceed if we have valid dimensions
            if (width > 0 && height > 0) {
                try {
                    fitAddon.fit();
                    const { cols, rows } = term;

                    if (cols > 0 && rows > 0) {
                        invoke("resize_terminal", { id, cols, rows });

                        // If this is the first time we have size, spawn the shell
                        if (!initializedRef.current) {
                            initializedRef.current = true;

                            // Spawn backend process
                            invoke("spawn_terminal", { id });

                            // Setup listeners
                            listen(`terminal-data:${id}`, (event) => {
                                term.write(event.payload as string);
                            }).then((unlisten) => {
                                unlistenRef.current = unlisten;
                            });

                            term.onData((data) => {
                                invoke("write_to_terminal", { id, data });
                            });

                            if (isActive) {
                                term.focus();
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Resize error:", e);
                }
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            if (unlistenRef.current) unlistenRef.current();
            try {
                term.dispose();
            } catch (e) {
                // Ignore disposal errors
            }
            xtermRef.current = null;
            fitAddonRef.current = null;
            initializedRef.current = false;
        };
    }, [id]);

    // Handle focus/visibility changes
    useEffect(() => {
        if (isActive && xtermRef.current && fitAddonRef.current && initializedRef.current) {
            requestAnimationFrame(() => {
                try {
                    fitAddonRef.current?.fit();
                    xtermRef.current?.focus();
                    const term = xtermRef.current;
                    if (term && term.cols > 0 && term.rows > 0) {
                        invoke("resize_terminal", {
                            id,
                            cols: term.cols,
                            rows: term.rows,
                        });
                    }
                } catch (e) {
                    console.warn("Refocus error:", e);
                }
            });
        }
    }, [isActive]);

    return (
        <div
            ref={containerRef}
            className="terminal-instance"
            style={{
                display: "block",
                visibility: isActive ? "visible" : "hidden",
                position: isActive ? "relative" : "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: isActive ? 1 : 0,
            }}
        />
    );
}

export default function TerminalPanel() {
    const terminals = useEditorStore((s) => s.terminals);
    const activeTerminalId = useEditorStore((s) => s.activeTerminalId);
    const terminalOpen = useEditorStore((s) => s.terminalOpen);
    const terminalHeight = useEditorStore((s) => s.terminalHeight);
    const isDraggingRef = useRef(false);

    const handleMouseDown = (_: React.MouseEvent) => {
        isDraggingRef.current = true;
        document.body.style.cursor = "row-resize";
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const height = window.innerHeight - e.clientY;
            editorStore.setTerminalHeight(Math.max(100, Math.min(window.innerHeight - 200, height)));
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.body.style.cursor = "default";
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    if (!terminalOpen) return null;

    return (
        <div className="terminal-panel" style={{ height: `${terminalHeight}px` }}>
            <div className="terminal-resize-handle" onMouseDown={handleMouseDown} />
            <div className="terminal-header">
                <div className="terminal-tabs-wrapper">
                    <div className="terminal-tabs">
                        {terminals.map((t) => (
                            <div
                                key={t.id}
                                className={`terminal-tab ${activeTerminalId === t.id ? "active" : ""}`}
                                onClick={() => editorStore.setActiveTerminal(t.id)}
                            >
                                <span className="terminal-tab-name">{t.name}</span>
                                <button
                                    className="terminal-tab-close"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        editorStore.closeTerminal(t.id);
                                    }}
                                >
                                    <RiCloseLine size={14} />
                                </button>
                            </div>
                        ))}
                        <button className="terminal-add-btn" onClick={() => editorStore.newTerminal()}>
                            <RiAddLine size={16} />
                        </button>
                    </div>
                </div>
                <div className="terminal-actions">
                    <button onClick={() => editorStore.setTerminalOpen(false)}>
                        <RiCloseLine size={18} />
                    </button>
                </div>
            </div>
            <div className="terminal-body">
                {terminals.map((t) => (
                    <TerminalInstance
                        key={t.id}
                        id={t.id}
                        isActive={activeTerminalId === t.id}
                    />
                ))}
            </div>
        </div>
    );
}
