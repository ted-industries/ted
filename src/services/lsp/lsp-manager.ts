import { LspClient } from "./lsp-client";
import type { LspServerConfig } from "./types";
import { editorStore } from "../../store/editor-store";
import { telemetry } from "../telemetry-service";

const DEFAULT_SERVER_CONFIGS: Record<string, LspServerConfig> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"],
    languages: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  },
  rust: {
    command: "rust-analyzer",
    args: [],
    languages: [".rs"],
  },
  python: {
    command: "pylsp",
    args: [],
    languages: [".py"],
  },
  cpp: {
    command: "clangd",
    args: ["--background-index"],
    languages: [".c", ".cpp", ".cc", ".h", ".hpp", ".cxx"],
  },
};

export class LspManager {
  private clients = new Map<string, LspClient>();
  private extensionToLanguage = new Map<string, string>();
  private openDocuments = new Map<string, string>(); // uri -> language
  private configs: Record<string, LspServerConfig>;
  private starting = new Set<string>(); // languages currently being started

  constructor() {
    this.configs = { ...DEFAULT_SERVER_CONFIGS };
    this.buildExtensionMap();
  }

  private buildExtensionMap(): void {
    this.extensionToLanguage.clear();
    for (const [lang, config] of Object.entries(this.configs)) {
      if (config.enabled === false) continue;
      for (const ext of config.languages) {
        this.extensionToLanguage.set(ext, lang);
      }
    }
  }

  updateConfigs(configs: Record<string, Partial<LspServerConfig>>): void {
    for (const [lang, override] of Object.entries(configs)) {
      if (this.configs[lang]) {
        this.configs[lang] = { ...this.configs[lang], ...override };
      } else {
        this.configs[lang] = override as LspServerConfig;
      }
    }
    this.buildExtensionMap();
  }

  getLanguageForFile(filename: string): string | null {
    const dot = filename.lastIndexOf(".");
    if (dot === -1) return null;
    const ext = filename.slice(dot).toLowerCase();
    return this.extensionToLanguage.get(ext) ?? null;
  }

  private async ensureClient(language: string): Promise<LspClient | null> {
    const existing = this.clients.get(language);
    if (existing?.isInitialized) return existing;

    // Prevent concurrent startup for the same language
    if (this.starting.has(language)) return null;

    const config = this.configs[language];
    if (!config || config.enabled === false) return null;

    const rootUri = this.getRootUri();
    if (!rootUri) return null;

    const serverId = `lsp-${language}`;
    const client = new LspClient(serverId, config);

    this.starting.add(language);
    try {
      await client.start(rootUri);
      this.clients.set(language, client);

      // Re-open any already-open documents for this language
      for (const [uri, lang] of this.openDocuments) {
        if (lang === language) {
          const tab = editorStore
            .getState()
            .tabs.find((t) => this.pathToUri(t.path) === uri);
          if (tab) {
            client.didOpen(uri, this.toLspLanguageId(language), tab.content);
          }
        }
      }

      return client;
    } catch (err) {
      console.error(`[LspManager] Failed to start ${language} server:`, err);
      telemetry.log("lsp_start_failed", { language, error: String(err) });
      return null;
    } finally {
      this.starting.delete(language);
    }
  }

  // ---- Document Lifecycle ----

  async documentOpened(path: string, content: string): Promise<void> {
    const language = this.getLanguageForFile(path);
    if (!language) return;

    const uri = this.pathToUri(path);
    this.openDocuments.set(uri, language);

    const client = await this.ensureClient(language);
    client?.didOpen(uri, this.toLspLanguageId(language), content);
  }

  documentChanged(
    path: string,
    changes: import("./types").TextDocumentContentChangeEvent[],
    fullText: string,
  ): void {
    const language = this.getLanguageForFile(path);
    if (!language) return;

    const client = this.clients.get(language);
    if (!client?.isInitialized) return;

    client.didChange(this.pathToUri(path), changes, fullText);
  }

  documentClosed(path: string): void {
    const language = this.getLanguageForFile(path);
    if (!language) return;

    const uri = this.pathToUri(path);
    this.openDocuments.delete(uri);

    const client = this.clients.get(language);
    client?.didClose(uri);

    // Shut down server if no more documents of this language are open
    const hasOtherDocs = [...this.openDocuments.values()].some(
      (l) => l === language,
    );
    if (!hasOtherDocs && client) {
      client.stop();
      this.clients.delete(language);
      telemetry.log("lsp_idle_shutdown", { language });
    }
  }

  documentSaved(path: string, text: string): void {
    const language = this.getLanguageForFile(path);
    if (!language) return;

    const client = this.clients.get(language);
    client?.didSave(this.pathToUri(path), text);
  }

  /** Get an initialized client for a file, or null. Does NOT trigger server start. */
  getClientForFile(path: string): LspClient | null {
    const language = this.getLanguageForFile(path);
    if (!language) return null;
    const client = this.clients.get(language);
    return client?.isInitialized ? client : null;
  }

  async dispose(): Promise<void> {
    const stops = [...this.clients.values()].map((c) => c.stop());
    await Promise.allSettled(stops);
    this.clients.clear();
    this.openDocuments.clear();
  }

  // ---- Path Utilities ----

  pathToUri(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    if (/^[a-zA-Z]:/.test(normalized)) {
      return `file:///${normalized}`;
    }
    return `file://${normalized}`;
  }

  uriToPath(uri: string): string {
    return decodeURIComponent(
      uri.replace("file:///", "").replace("file://", ""),
    );
  }

  private getRootUri(): string | null {
    const explorerPath = editorStore.getState().explorerPath;
    if (!explorerPath) return null;
    return this.pathToUri(explorerPath);
  }

  private toLspLanguageId(language: string): string {
    const map: Record<string, string> = {
      typescript: "typescript",
      rust: "rust",
      python: "python",
      cpp: "cpp",
    };
    return map[language] ?? language;
  }
}

export const lspManager = new LspManager();
