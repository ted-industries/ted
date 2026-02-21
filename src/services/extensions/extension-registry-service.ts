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

    private async getInstallDir(name: string): Promise<string> {
        const configDir: string = await invoke("get_user_config_dir");
        const parent = configDir.replace(/[\\/][^\\/]+$/, "");
        return `${parent}/extensions/${name}`;
    }
}

export const extensionRegistryService = new ExtensionRegistryService();
