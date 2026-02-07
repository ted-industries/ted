import { useRef, useEffect, useState } from "react";
import {
    RiCloseLine,
    RiSearchLine,
    RiArrowRightSLine,
    RiSettings4Line,
    RiPaletteLine,
    RiCodeLine,
    RiFileSearchLine
} from "@remixicon/react";
import { editorStore, useEditorStore } from "../../store/editor-store";
import "./SettingsPopup.css";

const CATEGORIES = [
    { id: "general", label: "General", icon: RiSettings4Line },
    { id: "appearance", label: "Appearance", icon: RiPaletteLine },
    { id: "editor", label: "Editor", icon: RiCodeLine },
    { id: "files", label: "Files", icon: RiFileSearchLine },
];

export default function SettingsPopup() {
    const isOpen = useEditorStore((s) => s.settingsOpen);
    const settings = useEditorStore((s) => s.settings);
    const explorerPath = useEditorStore((s) => s.explorerPath);

    const [activeCategory, setActiveCategory] = useState("general");
    const [activeTab, setActiveTab] = useState("user");
    const [projectName, setProjectName] = useState("ted");

    const generalRef = useRef<HTMLDivElement>(null);
    const appearanceRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const filesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (explorerPath) {
            const parts = explorerPath.split(/[\\/]/);
            setProjectName(parts[parts.length - 1] || "ted");
        } else {
            setProjectName("ted");
        }
    }, [explorerPath]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === "Escape") {
                editorStore.setSettingsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const scrollToCategory = (id: string) => {
        setActiveCategory(id);
        const refs: Record<string, React.RefObject<HTMLDivElement>> = {
            general: generalRef,
            appearance: appearanceRef,
            editor: editorRef,
            files: filesRef
        };
        refs[id]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={() => editorStore.setSettingsOpen(false)}>
            <div className="settings-popup" onClick={(e) => e.stopPropagation()}>

                {/* Sidebar */}
                <div className="settings-sidebar">
                    <div className="settings-search-container">
                        <RiSearchLine className="search-icon" size={14} />
                        <input type="text" placeholder="Search settings..." className="settings-search-input" />
                    </div>

                    <div className="settings-category-list">
                        {CATEGORIES.map((cat) => (
                            <div
                                key={cat.id}
                                className={`category-item ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => scrollToCategory(cat.id)}
                            >
                                <RiArrowRightSLine className="chevron" size={14} />
                                <span className="category-label">{cat.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="settings-sidebar-footer">
                        <span className="shortcut-hint">Ctrl-Shift-E</span>
                        <span className="hint-text">Focus Navbar</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="settings-main">
                    {/* Top Bar */}
                    <div className="settings-main-header">
                        <div className="settings-tabs">
                            <div
                                className={`settings-tab ${activeTab === 'user' ? 'active' : ''}`}
                                onClick={() => setActiveTab('user')}
                            >
                                User
                            </div>
                            <div
                                className={`settings-tab ${activeTab === 'ted' ? 'active' : ''}`}
                                onClick={() => setActiveTab('ted')}
                            >
                                {projectName}
                            </div>
                        </div>

                        <div className="settings-header-actions">
                            <button className="settings-json-btn">
                                <span>Edit in settings.json</span>
                            </button>
                            <button className="settings-close-btn" onClick={() => editorStore.setSettingsOpen(false)}>
                                <RiCloseLine size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Settings Content */}
                    <div className="settings-content">
                        {/* GENERAL SECTION */}
                        <div ref={generalRef} className="settings-section">
                            <div className="section-header">General</div>
                            <div className="settings-row">
                                <div className="row-text">
                                    <div className="row-title">Auto Save</div>
                                    <div className="row-description">
                                        Automatically save changes to the disk after a short delay.
                                    </div>
                                </div>
                                <div className="row-control">
                                    <div className="zed-switch active"></div>
                                </div>
                            </div>
                        </div>

                        {/* APPEARANCE SECTION */}
                        <div ref={appearanceRef} className="settings-section top-margin">
                            <div className="section-header">Appearance</div>
                            <div className="settings-row">
                                <div className="row-text">
                                    <div className="row-title">Tape Spinner Volume</div>
                                    <div className="row-description">
                                        Control the volume of the Satisfying™ mechanical tick sounds.
                                    </div>
                                </div>
                                <div className="row-control">
                                    <div className="zed-slider-container">
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={settings.volume}
                                            onChange={(e) => editorStore.updateSettings({ volume: parseInt(e.target.value) })}
                                        />
                                        <div className="zed-slider-track" style={{ width: `${settings.volume}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* EDITOR SECTION */}
                        <div ref={editorRef} className="settings-section top-margin">
                            <div className="section-header">Editor</div>
                            <div className="settings-row">
                                <div className="row-text">
                                    <div className="row-title">Font Size</div>
                                    <div className="row-description">
                                        The font size of the editor in pixels.
                                    </div>
                                </div>
                                <div className="row-control">
                                    <input
                                        type="number"
                                        className="zed-input"
                                        value={settings.fontSize}
                                        onChange={(e) => editorStore.updateSettings({ fontSize: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="settings-row divider">
                                <div className="row-text">
                                    <div className="row-title">Line Numbers</div>
                                    <div className="row-description">
                                        Whether to show line numbers in the gutter.
                                    </div>
                                </div>
                                <div className="row-control">
                                    <div
                                        className={`zed-switch ${settings.lineNumbers ? 'active' : ''}`}
                                        onClick={() => editorStore.updateSettings({ lineNumbers: !settings.lineNumbers })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* FILES SECTION */}
                        <div ref={filesRef} className="settings-section top-margin">
                            <div className="section-header">Files</div>
                            <div className="settings-row">
                                <div className="row-text">
                                    <div className="row-title">Sidebar Width</div>
                                    <div className="row-description">
                                        The default width of the sidebar in pixels.
                                    </div>
                                </div>
                                <div className="row-control">
                                    <input
                                        type="number"
                                        className="zed-input"
                                        value={settings.sidebarWidth}
                                        onChange={(e) => editorStore.updateSettings({ sidebarWidth: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
