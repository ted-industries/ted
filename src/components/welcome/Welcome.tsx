import { RiFileAddLine, RiFolderOpenLine, RiCommandLine, RiSettings4Line, RiTerminalBoxLine } from "@remixicon/react";
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
            case "command-palette":
                editorStore.toggleCommandPalette();
                break;
            case "terminal":
                editorStore.toggleTerminal();
                break;
            case "settings":
                editorStore.toggleSettings();
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
                                <RiFileAddLine size={16} />
                                <span>New File</span>
                            </div>
                            <span className="action-shortcut">Ctrl-N</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("open-file")}>
                            <div className="action-left">
                                <RiFolderOpenLine size={16} />
                                <span>Open File...</span>
                            </div>
                            <span className="action-shortcut">Ctrl-O</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("command-palette")}>
                            <div className="action-left">
                                <RiCommandLine size={16} />
                                <span>Open Command Palette</span>
                            </div>
                            <span className="action-shortcut">Ctrl-Shift-P</span>
                        </div>
                        <div className="action-item" onClick={() => handleAction("terminal")}>
                            <div className="action-left">
                                <RiTerminalBoxLine size={16} />
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
                                <RiSettings4Line size={16} />
                                <span>Open Settings</span>
                            </div>
                            <span className="action-shortcut">Ctrl-,</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
