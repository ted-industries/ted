import { extensionHost } from "./extension-host";
import { invoke } from "@tauri-apps/api/core";

export interface RegistryExtension {
    name: string;
    displayName: string;
    description: string;
    version: string;
    main: string;
    author: string;
    repository: string;
    tags: string[];
    downloads: number;
}

const REGISTRY_URL = "https://registry.ted.tomlin7.com/v1";

class ExtensionRegistryService {
    async fetchRegistry(): Promise<RegistryExtension[]> {
        const response = await fetch(REGISTRY_URL);
        if (!response.ok) throw new Error(`Registry error: ${response.statusText}`);
        return await response.json();
    }

    async installExtension(ext: RegistryExtension) {
        const installDir = await this.getInstallDir(ext.name);

        // 1. Clean up existing install
        await invoke("delete_dir", { path: installDir });

        // 2. Handle potential monorepo path
        // URL format: https://github.com/owner/repo/tree/main/path/to/ext
        if (ext.repository.includes("/tree/")) {
            const parts = ext.repository.split("/tree/");
            const repoUrl = parts[0];
            const subparts = parts[1].split("/");
            // const branch = subparts[0]; // e.g., 'main'
            const subPath = subparts.slice(1).join("/"); // e.g., 'registry/extensions/hello-world'

            // Clone root repo to a temp location
            const configDir: string = await invoke("get_user_config_dir");
            const tempDir = `${configDir.replace(/[\\/][^\\/]+$/, "")}/temp_clone_${Math.random().toString(36).substring(7)}`;

            try {
                await invoke("git_clone", { url: repoUrl, path: tempDir });
                await invoke("move_dir", {
                    src: `${tempDir}/${subPath}`,
                    dst: installDir
                });
            } finally {
                await invoke("delete_dir", { path: tempDir });
            }
        } else {
            // Standalone repository clone
            await invoke("git_clone", {
                url: ext.repository,
                path: installDir
            });
        }

        // 3. Load into host
        await extensionHost.loadFromPath(installDir);
    }

    async fetchReadme(ext: any): Promise<string> {
        try {
            // If it's a local instance with a known path
            if (ext.path) {
                const readmePath = `${ext.path}/README.md`;
                return await invoke("read_file", { path: readmePath });
            }

            // If it's a registry extension, fetch from repo
            if (ext.repository) {
                let rawUrl = "";
                if (ext.repository.includes("github.com")) {
                    // https://github.com/owner/repo/tree/main/path -> https://raw.githubusercontent.com/owner/repo/main/path/README.md
                    if (ext.repository.includes("/tree/")) {
                        rawUrl = ext.repository
                            .replace("github.com", "raw.githubusercontent.com")
                            .replace("/tree/", "/") + "/README.md";
                    } else {
                        // Standard repo
                        rawUrl = ext.repository.replace("github.com", "raw.githubusercontent.com") + "/main/README.md";
                    }
                }

                if (rawUrl) {
                    const res = await fetch(rawUrl);
                    if (res.ok) return await res.text();
                }
            }
        } catch (e) {
            console.warn("Failed to fetch README:", e);
        }
        return "No README available for this extension.";
    }

    private async getInstallDir(name: string): Promise<string> {
        const configDir: string = await invoke("get_user_config_dir");
        const parent = configDir.replace(/[\\/][^\\/]+$/, "");
        return `${parent}/extensions/${name}`;
    }
}

export const extensionRegistryService = new ExtensionRegistryService();
