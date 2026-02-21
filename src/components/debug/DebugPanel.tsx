import { useState, useEffect } from "react";
import { useDebugStore } from "../../store/debug-store";
import {
    RiPlayFill,
    RiStopFill,
    RiRepeatFill,
    RiArrowRightSLine,
    RiArrowDownSLine,
    RiArrowRightUpLine,
    RiArrowRightDownLine,
    RiSkipForwardFill,
    RiPauseFill
} from "@remixicon/react";
import { dapService } from "../../services/dap/dap-service";
import { useEditorStore } from "../../store/editor-store";
import "./debug.css";

interface SectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function DebugSection({ title, children, defaultOpen = true }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="debug-section">
            <div className="debug-section-header" onClick={() => setOpen(!open)}>
                <span>{title}</span>
                {open ? <RiArrowDownSLine size={14} /> : <RiArrowRightSLine size={14} />}
            </div>
            {open && <div className="debug-section-content">{children}</div>}
        </div>
    );
}

export default function DebugPanel() {
    const {
        isActive, isPaused, variables, stackFrames, breakpoints,
        setSessionActive, setPaused, clearSession, setStackFrames, setVariables, setScopes
    } = useDebugStore();
    const activeTab = useEditorStore(s => s.tabs.find(t => t.path === s.activeTabPath));
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        // Handle stop event
        dapService.onEvent("stopped", async (ev) => {
            const threadId = ev.body.threadId;
            setPaused(true);

            // Fetch stack trace
            const stackRes = await dapService.getStackTrace(threadId);
            if (stackRes.success && stackRes.body.stackFrames) {
                setStackFrames(stackRes.body.stackFrames);

                // Fetch scopes for the top frame
                const topFrame = stackRes.body.stackFrames[0];
                const scopesRes = await dapService.getScopes(topFrame.id);
                if (scopesRes.success && scopesRes.body.scopes) {
                    setScopes(scopesRes.body.scopes);

                    // Fetch variables for each scope
                    for (const scope of scopesRes.body.scopes) {
                        const varsRes = await dapService.getVariables(scope.variablesReference);
                        if (varsRes.success) {
                            setVariables(scope.variablesReference, varsRes.body.variables);
                        }
                    }
                }
            }
        });

        dapService.onEvent("terminated", () => {
            clearSession();
            setSessionActive(false);
        });

        dapService.onEvent("exited", () => {
            clearSession();
            setSessionActive(false);
        });
    }, []);

    const handleStart = async () => {
        setIsConnecting(true);
        try {
            await dapService.connect("localhost", 5678);
            await dapService.initialize("ted-debug");

            // Sync current breakpoints before configurationDone
            const filePaths = Array.from(new Set(breakpoints.map(bp => bp.source?.path).filter(Boolean)));
            for (const path of filePaths as string[]) {
                const lines = breakpoints.filter(bp => bp.source?.path === path).map(bp => bp.line);
                await dapService.setBreakpoints(path, lines);
            }

            await dapService.attach({
                name: "Ted Attach",
                type: "python",
                request: "attach",
                connect: {
                    host: "localhost",
                    port: 5678
                },
                pathMappings: [
                    {
                        localRoot: "${workspaceFolder}",
                        remoteRoot: "."
                    }
                ]
            });

            await dapService.configurationDone();
            setSessionActive(true);
        } catch (err) {
            console.error("Failed to start debug session:", err);
            alert("Connection failed. Ensure your DAP server is running on port 5678.");
        } finally {
            setIsConnecting(false);
        }
    };

    const handleStop = async () => {
        await dapService.disconnect();
        clearSession();
    };

    const handleContinue = async () => {
        await dapService.continue(1); // Hardcoded threadId for now
        setPaused(false);
    };

    const handleStepOver = async () => {
        await dapService.next(1);
    };

    const handleStepInto = async () => {
        await dapService.stepIn(1);
    };

    const handleStepOut = async () => {
        await dapService.stepOut(1);
    };

    return (
        <div className="debug-panel">
            <div className="debug-toolbar">
                {!isActive ? (
                    <button
                        className="debug-btn debug-btn-start"
                        title="Start Debugging"
                        onClick={handleStart}
                        disabled={isConnecting}
                    >
                        {isConnecting ? <span className="debug-loading" /> : <RiPlayFill size={16} />}
                    </button>
                ) : (
                    <>
                        <button className="debug-btn" title={isPaused ? "Continue" : "Pause"} onClick={isPaused ? handleContinue : () => setPaused(true)}>
                            {isPaused ? <RiPlayFill size={16} /> : <RiPauseFill size={16} />}
                        </button>
                        <button className="debug-btn" title="Step Over" onClick={handleStepOver}>
                            <RiSkipForwardFill size={16} />
                        </button>
                        <button className="debug-btn" title="Step Into" onClick={handleStepInto}>
                            <RiArrowRightDownLine size={16} />
                        </button>
                        <button className="debug-btn" title="Step Out" onClick={handleStepOut}>
                            <RiArrowRightUpLine size={16} />
                        </button>
                        <button className="debug-btn" title="Restart">
                            <RiRepeatFill size={16} />
                        </button>
                        <button className="debug-btn debug-btn-stop" title="Stop" onClick={handleStop}>
                            <RiStopFill size={16} />
                        </button>
                    </>
                )}
            </div>

            <DebugSection title="Variables">
                {Object.keys(variables).length === 0 ? (
                    <div className="debug-empty">No variables</div>
                ) : (
                    Object.entries(variables).map(([ref, vars]) => (
                        <div key={ref}>
                            {vars.map(v => (
                                <div key={v.name} className="debug-item">
                                    <span className="debug-item-label">{v.name}:</span>
                                    <span className="debug-item-value">{v.value}</span>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </DebugSection>

            <DebugSection title="Watch">
                <div className="debug-empty">No expressions</div>
            </DebugSection>

            <DebugSection title="Call Stack">
                {stackFrames.length === 0 ? (
                    <div className="debug-empty">Not paused</div>
                ) : (
                    stackFrames.map(frame => (
                        <div key={frame.id} className="debug-item">
                            <span className="debug-item-label">{frame.name}</span>
                            <span className="debug-item-value">{frame.source?.name}:{frame.line}</span>
                        </div>
                    ))
                )}
            </DebugSection>

            <DebugSection title="Breakpoints">
                {breakpoints.length === 0 ? (
                    <div className="debug-empty">No breakpoints</div>
                ) : (
                    breakpoints.map((bp, i) => (
                        <div key={i} className="debug-item">
                            <span className="debug-item-label">{bp.source?.name}</span>
                            <span className="debug-item-value">line {bp.line}</span>
                        </div>
                    ))
                )}
            </DebugSection>
        </div>
    );
}
