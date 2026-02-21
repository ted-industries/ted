import { RiFile2Fill, RiFileAddFill, RiFolderOpenFill, RiCommandFill, RiTerminalBoxFill, RiSettings2Fill, RiPlug2Fill } from "@remixicon/react";
import { editorStore } from "../../store/editor-store";
import "./Welcome.css";

export default function Welcome() {
    const handleAction = (type: string) => {
        switch (type) {
            case "new-file":
                editorStore.newFile();
                break;
            case "open-file":
                window.dispatchEvent(new CustomEvent("ted:open-file"));
                break;
            case "open-folder":
                window.dispatchEvent(new CustomEvent("ted:open-folder"));
                break;
            case "command-palette":
                editorStore.toggleCommandPalette();
                break;
            case "terminal":
                editorStore.toggleTerminal();
                break;
            case "settings":
                editorStore.toggleSettings();
                break;
            case "extensions":
                editorStore.openMarketplace();
                break;
        }
    };

    return (
        <div className="welcome-container">
            <div className="welcome-content">
                <div className="welcome-header">
                    <div className="welcome-logo">
                        <img src="/ted.svg" alt="ted" />
                    </div>
                    <div className="welcome-title-group">
                        <h1>Welcome to ted</h1>
                        <p>a minimal code editor for agents</p>
                    </div>
                </div>

                <div className="welcome-section">
                    <div className="section-title">
                        <span>GET STARTED</span>
                        <div className="section-line"></div>
                    </div>
                    <div className="action-list">
                        <div className="action-item" onClick={() => handleAction("new-file")}>
                            <div className="action-left">
                                <RiFileAddFill size={16} />
                                <span>New File</span>
                            </div>
                            <span className="action-shortcut">Ctrl-N</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("open-file")}>
                            <div className="action-left">
                                <RiFile2Fill size={16} />
                                <span>Open File...</span>
                            </div>
                            <span className="action-shortcut">Ctrl-O</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("open-folder")}>
                            <div className="action-left">
                                <RiFolderOpenFill size={16} />
                                <span>Open Folder...</span>
                            </div>
                            <span className="action-shortcut">Ctrl-Shift-O</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("command-palette")}>
                            <div className="action-left">
                                <RiCommandFill size={16} />
                                <span>Open Command Palette</span>
                            </div>
                            <span className="action-shortcut">Ctrl-Shift-P</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("terminal")}>
                            <div className="action-left">
                                <RiTerminalBoxFill size={16} />
                                <span>Integrated Terminal</span>
                            </div>
                            <span className="action-shortcut">Ctrl-J</span>
                        </div>
                    </div>
                </div>
                <div className="welcome-section">
                    <div className="section-title">
                        <span>CONFIGURE</span>
                        <div className="section-line"></div>
                    </div>
                    <div className="action-list">
                        <div className="action-item" onClick={() => handleAction("settings")}>
                            <div className="action-left">
                                <RiSettings2Fill size={16} />
                                <span>Open Settings</span>
                            </div>
                            <span className="action-shortcut">Ctrl-,</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("extensions")}>
                            <div className="action-left">
                                <RiPlug2Fill size={16} />
                                <span>Explore Extensions</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
