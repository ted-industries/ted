import { invoke } from "@tauri-apps/api/core";

export interface FileStatus {
    path: string;
    status: "new" | "modified" | "deleted" | "staged" | "unknown";
}

export interface LineDiff {
    line: number;
    diff_type: "added" | "modified" | "deleted";
}

export interface CommitEntry {
    hash: string;
    message: string;
    author: string;
    date: string;
    parent_hashes: string[];
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

    async readFile(path: string, revision: string = "HEAD"): Promise<string> {
        try {
            return await invoke("git_read_file", { path, revision });
        } catch (e) {
            console.warn(`Git read file failed for ${path} @ ${revision}:`, e);
            return "";
        }
    }

    async stage(repoPath: string, filePath: string): Promise<void> {
        await invoke("git_stage", { repoPath, filePath });
    }

    async unstage(repoPath: string, filePath: string): Promise<void> {
        await invoke("git_unstage", { repoPath, filePath });
    }

    async commit(repoPath: string, message: string): Promise<void> {
        await invoke("git_commit", { repoPath, message });
    }

    async getBranch(repoPath: string): Promise<string> {
        try {
            return await invoke("git_get_branch", { repoPath });
        } catch {
            return "unknown";
        }
    }

    async getLineDiff(repoPath: string, filePath: string): Promise<LineDiff[]> {
        try {
            return await invoke("git_get_line_diff", { repoPath, filePath });
        } catch (e) {
            console.warn(`Git line diff failed for ${filePath}:`, e);
            return [];
        }
    }

    async clone(url: string, path: string): Promise<void> {
        await invoke("git_clone", { url, path });
    }

    async getCommitDetails(repoPath: string, hash: string): Promise<CommitDetails> {
        return await invoke("git_get_commit_details", { repoPath, hash });
    }

    async getBlame(repoPath: string, filePath: string, line: number): Promise<BlameEntry> {
        return await invoke("git_blame", { repoPath, filePath, line });
    }
}

export interface BlameEntry {
    author: string;
    date: string; // timestamp
    hash: string;
}

export interface CommitDetails {
    hash: string;
    message: string;
    author: string;
    date: string;
    files_changed: number;
    insertions: number;
    deletions: number;
}

export const gitService = new GitService();
