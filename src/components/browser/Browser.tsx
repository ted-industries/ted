import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    RiArrowLeftLine,
    RiArrowRightLine,
    RiGlobalLine,
    RiRefreshLine,
    RiExternalLinkLine
} from "@remixicon/react";
import { useEditorStore } from "../../store/editor-store";
import AgentDebug from "../agent/AgentDebug";
import "./browser.css";

export default function Browser() {
    const activeTabPath = useEditorStore((s) => s.activeTabPath);
    const tabs = useEditorStore((s) => s.tabs);
    const activeTab = tabs.find((t) => t.path === activeTabPath);

    const [url, setUrl] = useState(activeTab?.url || "https://google.com");
    const [inputUrl, setInputUrl] = useState(url);

    useEffect(() => {
        if (activeTab?.url) {
            setUrl(activeTab.url);
            setInputUrl(activeTab.url);
        }
    }, [activeTab?.url]);

    const handleNavigate = () => {
        let target = inputUrl;
        if (!target.startsWith("http://") && !target.startsWith("https://") && !target.startsWith("agent:")) {
            target = `https://${target}`;
        }
        setUrl(target);
        setInputUrl(target);
    };

    const handleOpenNative = async () => {
        try {
            await invoke("open_browser_window", { targetUrl: url });
        } catch (error) {
            console.error("Failed to open browser window:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleNavigate();
        }
    };

    return (
        <div className="browser-container">
            <div className="browser-toolbar">
                <button
                    className="browser-nav-btn"
                    onClick={() => { }} // Navigation inside iframe is limited due to CORS
                    title="Back"
                    disabled
                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                    <RiArrowLeftLine size={16} />
                </button>
                <button
                    className="browser-nav-btn"
                    onClick={() => { }} // Navigation inside iframe is limited due to CORS
                    title="Forward"
                    disabled
                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                    <RiArrowRightLine size={16} />
                </button>
                <button
                    className="browser-nav-btn"
                    onClick={() => {
                        const iframe = document.querySelector(".browser-iframe") as HTMLIFrameElement;
                        if (iframe) iframe.src = iframe.src;
                    }}
                    title="Refresh"
                >
                    <RiRefreshLine size={16} />
                </button>

                <div className="browser-address-bar">
                    <RiGlobalLine size={14} style={{ marginRight: 8, opacity: 0.5 }} />
                    <input
                        className="browser-address-input"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a URL..."
                    />
                </div>

                <button
                    className="browser-nav-btn"
                    onClick={handleOpenNative}
                    title="Open in Native Window"
                >
                    <RiExternalLinkLine size={16} />
                </button>
            </div>
            <div className="browser-content">
                {url === "agent:debug" ? (
                    <AgentDebug />
                ) : (
                    <iframe
                        src={url}
                        className="browser-iframe"
                        title="Browser"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    />
                )}
            </div>
        </div>
    );
}
