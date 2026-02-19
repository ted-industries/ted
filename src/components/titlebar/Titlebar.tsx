import { getCurrentWindow } from "@tauri-apps/api/window";
import { RiCloseLine, RiSubtractLine, RiCheckboxMultipleBlankLine, RiCheckboxBlankLine } from "@remixicon/react";
import { useState, useEffect } from "react";
import "./Titlebar.css";

const appWindow = getCurrentWindow();

export default function Titlebar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateMaximized = async () => {
            setIsMaximized(await appWindow.isMaximized());
        };
        updateMaximized();

        const unlisten = appWindow.onResized(() => {
            updateMaximized();
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    return (
        <div className="titlebar">
            <div data-tauri-drag-region className="titlebar-left">
                <img data-tauri-drag-region src="/ted.svg" alt="ted" className="titlebar-icon" />
                <span data-tauri-drag-region className="titlebar-title">ted</span>
            </div>
            <div data-tauri-drag-region className="titlebar-spacer" />
            <div className="titlebar-actions">
                <button className="titlebar-button" onClick={() => appWindow.minimize()}>
                    <RiSubtractLine size={16} />
                </button>
                <button className="titlebar-button" onClick={() => appWindow.toggleMaximize()}>
                    {isMaximized ? (
                        <RiCheckboxMultipleBlankLine size={14} />
                    ) : (
                        <RiCheckboxBlankLine size={14} />
                    )}
                </button>
                <button className="titlebar-button titlebar-button-close" onClick={() => appWindow.close()}>
                    <RiCloseLine size={18} />
                </button>
            </div>
        </div>
    );
}
