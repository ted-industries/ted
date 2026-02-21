import { useState } from "react";
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
    const { isActive, isPaused, variables, stackFrames, breakpoints, setSessionActive, setPaused, clearSession } = useDebugStore();

    const handleStart = async () => {
        try {
            // In a real app, this URL would come from settings or a launch config
            await dapService.connect("ws://localhost:8088");
            await dapService.initialize("ted-debug");
            await dapService.launch({ program: "main.py" }); // Mock launch
            setSessionActive(true);
        } catch (err) {
            console.error("Failed to start debug session:", err);
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
                    <button className="debug-btn debug-btn-start" title="Start Debugging (Mock)" onClick={handleStart}>
                        <RiPlayFill size={16} />
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
