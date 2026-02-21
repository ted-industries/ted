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

const REGISTRY_URL = "https://registry.ted.tomlin7.com/extensions.json";

class ExtensionRegistryService {
    async fetchRegistry(): Promise<RegistryExtension[]> {
        try {
            const response = await fetch(REGISTRY_URL);
            if (!response.ok) throw new Error("Failed to fetch registry");
            return await response.json();
        } catch (err) {
            console.error("[Registry] Failed to fetch:", err);
            // Fallback to a minimal list if the server is down or during dev
            return [];
        }
    }

    async installExtension(ext: RegistryExtension) {
        const installDir = await this.getInstallDir(ext.name);

        // 1. Create directory via Tauri
        await invoke("create_dir", { path: installDir });

        // 2. Resolve URLs for files
        // For production, we assume a structured registry path on GitHub
        // e.g. https://raw.githubusercontent.com/ted-industries/extensions/main/registry/extensions/<name>/
        const baseUrl = ext.repository
            .replace("github.com", "raw.githubusercontent.com")
            .replace("/tree/main/", "/main/");

        // We need the manifest and the main entry point
        const files = ["package.json", ext.main];

        for (const filename of files) {
            const fileUrl = `${baseUrl}/${filename}`;
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`Failed to download ${filename}`);
            const content = await response.text();

            await invoke("write_file", {
                path: `${installDir}/${filename}`,
                content
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
