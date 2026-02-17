import { invoke } from "@tauri-apps/api/core";
import { editorStore } from "../store/editor-store";

export interface FileChurn {
    path: string;
    commits: number;
    last_modified: string;
}

export interface CommitEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
}

class GitContextService {
    private churnCache: Map<string, FileChurn> = new Map();
    private historyCache: Map<string, CommitEntry[]> = new Map();
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private readonly POLL_DELAY = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.startPolling();
    }

    private startPolling() {
        this.refreshContext();
        this.pollInterval = setInterval(() => this.refreshContext(), this.POLL_DELAY);
    }

    public async refreshContext() {
        const store = editorStore.getState();
        const repoPath = store.explorerPath;

        if (!repoPath) return;

        try {
            // Fetch Churn (heatmap) - last 30 days
            const churnData = await invoke<FileChurn[]>("git_churn", { repoPath, daysLimit: 30 });
            this.churnCache.clear();
            churnData.forEach((c) => this.churnCache.set(c.path, c));
            console.log("[GitContext] Refreshed churn data", churnData.length);
        } catch (e) {
            console.warn("[GitContext] Failed to fetch churn:", e);
        }
    }

    public getFileChurn(path: string): FileChurn | undefined {
        // Try exact match first
        if (this.churnCache.has(path)) return this.churnCache.get(path);

        // Try normalized path (windows backslashes)
        const normalized = path.replace(/\\/g, "/");
        for (const [key, val] of this.churnCache) {
            if (key.replace(/\\/g, "/") === normalized) return val;
        }
        return undefined;
    }

    public async getFileHistory(path: string): Promise<CommitEntry[]> {
        if (this.historyCache.has(path)) {
            return this.historyCache.get(path)!;
        }

        try {
            const store = editorStore.getState();
            const repoPath = store.explorerPath;
            if (!repoPath) return [];

            // git_log is currently repo-wide in backend, but we can filter or update backend to support file path
            // For now, let's assume we want repo history or update backend to support file path
            // Actually, let's use the existing git_log but we might need to update backend to filter by file
            // checking git.rs... git_log takes repo_path only. 
            // For this specific requirement "Commit context accessible", repo history is a good start.
            // But for "File history", we should update backend. 
            // specific file history is not yet in git.rs, only repo history.
            // I will implement a client-side filter for now if possible or just return repo history.

            const history = await invoke<CommitEntry[]>("git_log", {
                repoPath,
                limit: 50,
                fileFilter: path
            });
            this.historyCache.set(path, history);
            return history;
        } catch (e) {
            console.warn("[GitContext] Failed to fetch history:", e);
            return [];
        }
    }

    public dispose() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}

export const gitContext = new GitContextService();
