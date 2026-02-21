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

const MOCK_REGISTRY: RegistryExtension[] = [
    {
        name: "ted-hello-world",
        displayName: "Hello World",
        description: "A sample starter extension for ted. Registers a command that shows a basic notification and log.",
        version: "1.0.0",
        main: "extension.js",
        author: "Ted Industries",
        repository: "https://github.com/ted-industries/ted-hello-world",
        tags: ["sample", "starter", "notification"],
        downloads: 1200,
    },
    {
        name: "ted-git-blame",
        displayName: "Git Blame",
        description: "Show git blame information in the editor status bar for the current active line.",
        version: "1.0.0",
        main: "index.js",
        author: "Tomlin7",
        repository: "https://github.com/tomlin7/ted-git-blame",
        tags: ["git", "blame", "source-control"],
        downloads: 850,
    },
    {
        name: "ted-word-count",
        displayName: "Word Count",
        description: "Displays a live word and character count for the active file in the status bar.",
        version: "1.0.0",
        main: "main.js",
        author: "Ted Industries",
        repository: "https://github.com/ted-industries/ted-word-count",
        tags: ["statusbar", "writing", "utility"],
        downloads: 450,
    },
    {
        name: "ted-recent-files",
        displayName: "Quick Open Recent",
        description: "Registers a command to list and quickly open recently accessed files with fuzzy search.",
        version: "1.0.1",
        main: "extension.js",
        author: "Ted Industries",
        repository: "https://github.com/ted-industries/ted-recent-files",
        tags: ["navigation", "productivity", "files"],
        downloads: 2100,
    }
];

class ExtensionRegistryService {
    async fetchRegistry(): Promise<RegistryExtension[]> {
        try {
            const response = await fetch(REGISTRY_URL);
            if (!response.ok) throw new Error("Failed to fetch registry");
            const data = await response.json();
            return data.length > 0 ? data : MOCK_REGISTRY;
        } catch (err) {
            console.error("[Registry] Failed to fetch remote registry, using fallback:", err);
            // Fallback to a minimal list if the server is down or during dev
            return MOCK_REGISTRY;
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
