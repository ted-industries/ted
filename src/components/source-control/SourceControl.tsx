import { useState, useEffect, useCallback } from "react";
import {
    RiCheckLine,
    RiAddLine,
    RiSubtractLine,
    RiArrowRightSLine,
    RiArrowDownSLine,
    RiGitBranchLine,
    RiRefreshLine
} from "@remixicon/react";
import { gitService, FileStatus } from "../../services/git-service";
import { useEditorStore, editorStore } from "../../store/editor-store";
import "./source-control.css";

export default function SourceControl() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const [changes, setChanges] = useState<FileStatus[]>([]);
    const [staged, setStaged] = useState<FileStatus[]>([]);
    const [branch, setBranch] = useState("unknown");
    const [commitMessage, setCommitMessage] = useState("");
    const [isCommitting, setIsCommitting] = useState(false);
    const [expandedChanges, setExpandedChanges] = useState(true);
    const [expandedStaged, setExpandedStaged] = useState(true);

    const refreshStatus = useCallback(async () => {
        if (!explorerPath) return;
        try {
            const [statuses, branchName] = await Promise.all([
                gitService.getStatus(explorerPath),
                gitService.getBranch(explorerPath)
            ]);

            setBranch(branchName);

            // Categorize
            const unstagedList = statuses.filter(s => s.status !== "staged");
            const stagedList = statuses.filter(s => s.status === "staged");

            setChanges(unstagedList);
            setStaged(stagedList);
        } catch (e) {
            console.error("SC Refresh failed:", e);
        }
    }, [explorerPath]);

    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, 10000);
        return () => clearInterval(interval);
    }, [refreshStatus]);

    const handleStage = async (path: string) => {
        if (!explorerPath) return;
        await gitService.stage(explorerPath, path);
        refreshStatus();
    };

    const handleUnstage = async (path: string) => {
        if (!explorerPath) return;
        await gitService.unstage(explorerPath, path);
        refreshStatus();
    };

    const handleCommit = async () => {
        if (!explorerPath || !commitMessage.trim()) return;
        setIsCommitting(true);
        try {
            await gitService.commit(explorerPath, commitMessage);
            setCommitMessage("");
            refreshStatus();
        } catch (e) {
            console.error("Commit failed:", e);
        } finally {
            setIsCommitting(false);
        }
    };

    if (!explorerPath) return <div className="sc-empty">Open a folder to see source control.</div>;

    return (
        <div className="source-control">
            <div className="sc-header">
                <RiGitBranchLine size={14} />
                <span>{branch}</span>
                <button className="sc-refresh-btn" onClick={refreshStatus}>
                    <RiRefreshLine size={14} />
                </button>
            </div>

            <div className="sc-commit-section">
                <textarea
                    className="sc-commit-input"
                    placeholder="Commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    disabled={isCommitting}
                    spellCheck={false}
                />
                <button
                    className="sc-commit-btn"
                    onClick={handleCommit}
                    disabled={isCommitting || staged.length === 0 || !commitMessage.trim()}
                >
                    {isCommitting ? "Committing..." : "Commit"}
                </button>
            </div>

            <div className="sc-sections">
                {/* Staged Changes */}
                {staged.length > 0 && (
                    <div className="sc-section">
                        <div className="sc-section-header" onClick={() => setExpandedStaged(!expandedStaged)}>
                            <RiArrowDownSLine
                                size={14}
                                style={{ transform: expandedStaged ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.1s" }}
                            />
                            <span>STAGED CHANGES</span>
                            <span className="sc-count">{staged.length}</span>
                        </div>
                        {expandedStaged && (
                            <div className="sc-file-list">
                                {staged.map(file => (
                                    <div key={file.path} className="sc-file-item">
                                        <span className={`sc-status-label ${file.status}`}>{file.status[0].toUpperCase()}</span>
                                        <span className="sc-file-name" onClick={() => editorStore.openDiff(file.path)}>
                                            {file.path.split(/[\\/]/).pop()}
                                        </span>
                                        <button className="sc-action-btn" onClick={() => handleUnstage(file.path)}>
                                            <RiSubtractLine size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Changes */}
                <div className="sc-section">
                    <div className="sc-section-header" onClick={() => setExpandedChanges(!expandedChanges)}>
                        <RiArrowDownSLine
                            size={14}
                            style={{ transform: expandedChanges ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.1s" }}
                        />
                        <span>CHANGES</span>
                        <span className="sc-count">{changes.length}</span>
                    </div>
                    {expandedChanges && (
                        <div className="sc-file-list">
                            {changes.map(file => (
                                <div key={file.path} className="sc-file-item">
                                    <span className={`sc-status-label ${file.status}`}>{file.status[0].toUpperCase()}</span>
                                    <span className="sc-file-name" onClick={() => editorStore.openDiff(file.path)}>
                                        {file.path.split(/[\\/]/).pop()}
                                    </span>
                                    <button className="sc-action-btn" onClick={() => handleStage(file.path)}>
                                        <RiAddLine size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
