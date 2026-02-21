import { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { RiCloseLine, RiAddLine, RiHistoryLine } from "@remixicon/react";
import CommitHistory from "./CommitHistory";
import "xterm/css/xterm.css";
import "./TerminalPanel.css";

interface TerminalInstanceProps {
    id: string;
    isActive: boolean;
    explorerPath: string | null;
}

function TerminalInstance({ id, isActive, explorerPath }: TerminalInstanceProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const initializedRef = useRef(false);
    const unlistenRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize xterm
        // Get computed styles for theme colors
        const computedStyle = getComputedStyle(document.documentElement);
        const getVar = (name: string) => computedStyle.getPropertyValue(name).trim();

        const term = new Terminal({
            theme: {
                background: getVar("--background"),
                foreground: getVar("--foreground"),
                cursor: getVar("--foreground"),
                selectionBackground: getVar("--selection"),
                black: getVar("--background"),
                red: getVar("--syntax-keyword"),
                green: getVar("--syntax-string"),
                yellow: getVar("--syntax-variable"),
                blue: getVar("--syntax-type"),
                magenta: getVar("--syntax-function"),
                cyan: getVar("--syntax-operator"),
                white: getVar("--foreground"),
                brightBlack: getVar("--sidebar-fg"),
                brightRed: getVar("--syntax-keyword"),
                brightGreen: getVar("--syntax-string"),
                brightYellow: getVar("--syntax-variable"),
                brightBlue: getVar("--syntax-type"),
                brightMagenta: getVar("--syntax-function"),
                brightCyan: getVar("--syntax-operator"),
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
                            invoke("spawn_terminal", { id, cwd: explorerPath });

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
        let isMounted = true;
        if (isActive && xtermRef.current && fitAddonRef.current && initializedRef.current) {
            requestAnimationFrame(() => {
                if (!isMounted) return;
                try {
                    if (containerRef.current && containerRef.current.offsetParent !== null) {
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
                    }
                } catch (e) {
                    console.warn("Refocus error:", e);
                }
            });
        }
        return () => { isMounted = false; };
    }, [isActive, id]);

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
    const historyOpen = useEditorStore((s) => s.historyOpen);
    const explorerPath = useEditorStore((s) => s.explorerPath);
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
                        {!historyOpen ? (
                            <>
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
                                <button className="terminal-add-btn" onClick={() => editorStore.newTerminal()} title="New Terminal">
                                    <RiAddLine size={16} />
                                </button>
                            </>
                        ) : (
                            <div className="terminal-tab active">
                                <span className="terminal-tab-name">Commit History</span>
                                <button className="terminal-tab-close" onClick={() => editorStore.setHistoryOpen(false)}>
                                    <RiCloseLine size={14} />
                                </button>
                            </div>
                        )}
                        <button
                            className={`terminal-add-btn ${historyOpen ? "active" : ""}`}
                            onClick={() => editorStore.toggleHistory()}
                            title="Commit History"
                            style={{ marginLeft: historyOpen ? '0' : '8px' }}
                        >
                            <RiHistoryLine size={15} />
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
                {historyOpen ? (
                    <CommitHistory />
                ) : (
                    terminals.map((t) => (
                        <TerminalInstance
                            key={t.id}
                            id={t.id}
                            isActive={activeTerminalId === t.id}
                            explorerPath={explorerPath}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
