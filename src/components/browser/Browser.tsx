import { useState, useRef, useEffect } from "react";
import {
    RiArrowLeftLine,
    RiArrowRightLine,
    RiRefreshLine,
    RiGlobalLine
} from "@remixicon/react";
import { useEditorStore } from "../../store/editor-store";
import "./browser.css";

export default function Browser() {
    const activeTabPath = useEditorStore((s) => s.activeTabPath);
    const tabs = useEditorStore((s) => s.tabs);
    const activeTab = tabs.find((t) => t.path === activeTabPath);

    const [url, setUrl] = useState(activeTab?.url || "https://google.com");
    const [inputUrl, setInputUrl] = useState(url);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (activeTab?.url) {
            setUrl(activeTab.url);
            setInputUrl(activeTab.url);
        }
    }, [activeTab?.url]);

    const handleNavigate = () => {
        let target = inputUrl;
        if (!target.startsWith("http://") && !target.startsWith("https://")) {
            target = `https://${target}`;
        }
        setUrl(target);
        setInputUrl(target);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleNavigate();
        }
    };

    const handleRefresh = () => {
        if (iframeRef.current) {
            // eslint-disable-next-line no-self-assign
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    return (
        <div className="browser-container">
            <div className="browser-toolbar">
                <button
                    className="browser-nav-btn"
                    onClick={() => window.history.back()}
                    title="Back"
                >
                    <RiArrowLeftLine size={16} />
                </button>
                <button
                    className="browser-nav-btn"
                    onClick={() => window.history.forward()}
                    title="Forward"
                >
                    <RiArrowRightLine size={16} />
                </button>
                <button
                    className="browser-nav-btn"
                    onClick={handleRefresh}
                    title="Refresh"
                >
                    <RiRefreshLine size={16} />
                </button>
                <div className="browser-address-bar">
                    <RiGlobalLine size={14} style={{ marginRight: 8, opacity: 0.7 }} />
                    <input
                        className="browser-address-input"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search or enter website name"
                    />
                </div>
            </div>
            <div className="browser-content">
                <iframe
                    ref={iframeRef}
                    src={url}
                    className="browser-iframe"
                    title="Browser"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
            </div>
        </div>
    );
}
