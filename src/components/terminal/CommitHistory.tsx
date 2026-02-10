import { useState, useEffect, useCallback } from "react";
import { useEditorStore } from "../../store/editor-store";
import { gitService, CommitEntry } from "../../services/git-service";
import "./CommitHistory.css";

export default function CommitHistory() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const [commits, setCommits] = useState<CommitEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadHistory = useCallback(async () => {
        if (!explorerPath) return;
        setIsLoading(true);
        try {
            const history = await gitService.getLog(explorerPath, 100);
            setCommits(history);
        } catch (e) {
            console.error("Failed to load history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [explorerPath]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    if (!explorerPath) return <div className="ch-empty">Open a folder to see history.</div>;

    return (
        <div className="commit-history">
            {isLoading && commits.length === 0 ? (
                <div className="ch-loading">Loading history...</div>
            ) : commits.length === 0 ? (
                <div className="ch-empty">No commits found.</div>
            ) : (
                <div className="ch-list">
                    {commits.map((commit) => (
                        <div key={commit.hash} className="ch-item">
                            <div className="ch-item-left">
                                <span className="ch-hash">{commit.hash.slice(0, 7)}</span>
                            </div>
                            <div className="ch-item-main">
                                <span className="ch-message" title={commit.message}>{commit.message}</span>
                            </div>
                            <div className="ch-item-right">
                                <span className="ch-author" title={commit.author}>{commit.author}</span>
                                <span className="ch-date">{commit.date}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
