import { invoke } from "@tauri-apps/api/core";

export interface FileStatus {
    path: string;
    status: "new" | "modified" | "deleted" | "staged" | "unknown";
}

export interface CommitEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
}

class GitService {
    async getStatus(path: string): Promise<FileStatus[]> {
        try {
            return await invoke("git_status", { path });
        } catch (e) {
            console.warn("Git status failed:", e);
            return [];
        }
    }

    async getDiff(repoPath: string, filePath: string): Promise<string> {
        try {
            return await invoke("git_diff", { repoPath, filePath });
        } catch (e) {
            console.warn("Git diff failed:", e);
            return "";
        }
    }

    async getLog(repoPath: string, limit: number = 50): Promise<CommitEntry[]> {
        try {
            return await invoke("git_log", { repoPath, limit });
        } catch (e) {
            console.warn("Git log failed:", e);
            return [];
        }
    }
}

export const gitService = new GitService();
