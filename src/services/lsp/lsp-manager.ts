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
  private uriCache = new Map<string, string>(); // path -> uri

  private unsubStore: (() => void) | null = null;
  private lastExplorerPath: string | null = null;

  constructor() {
    this.configs = { ...DEFAULT_SERVER_CONFIGS };
    this.buildExtensionMap();

    // Watch for explorerPath changes — when the user opens a folder,
    // retry starting LSP servers for any already-open documents.
    this.unsubStore = editorStore.subscribe(() => {
      const explorerPath = editorStore.getState().explorerPath;
      if (explorerPath && explorerPath !== this.lastExplorerPath) {
        this.lastExplorerPath = explorerPath;
        this.retryPendingDocuments();
      }
    });
  }

  /** When explorerPath becomes available, start servers for already-tracked documents. */
  private retryPendingDocuments(): void {
    if (this.openDocuments.size === 0) return;
    console.log(
      `[LspManager] explorerPath set, retrying ${this.openDocuments.size} pending document(s)`,
    );
    for (const [uri, language] of this.openDocuments) {
      if (this.clients.has(language)) continue; // already running
      const tab = editorStore
        .getState()
        .tabs.find((t) => this.pathToUri(t.path) === uri);
      if (tab) {
        this.ensureClient(language).then((client) => {
          client?.didOpen(
            uri,
            this.getLspLanguageId(tab.path, language),
            tab.content,
          );
        });
      }
    }
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
    if (!config || config.enabled === false) {
      console.log(`[LspManager] No config or disabled for '${language}'`);
      return null;
    }

    const rootUri = this.getRootUri();
    if (!rootUri) {
      console.log(
        `[LspManager] No explorerPath set, cannot start '${language}' server`,
      );
      return null;
    }

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
            client.didOpen(
              uri,
              this.getLspLanguageId(tab.path, language),
              tab.content,
            );
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
    if (!language) {
      console.log(`[LspManager] No language match for: ${path}`);
      return;
    }

    const uri = this.pathToUri(path);
    this.openDocuments.set(uri, language);
    console.log(`[LspManager] documentOpened: ${path} (${language})`);

    const client = await this.ensureClient(language);
    if (client) {
      client.didOpen(uri, this.getLspLanguageId(path, language), content);
    }
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
    this.unsubStore?.();
    const stops = [...this.clients.values()].map((c) => c.stop());
    await Promise.allSettled(stops);
    this.clients.clear();
    this.openDocuments.clear();
  }

  // ---- Path Utilities ----

  pathToUri(path: string): string {
    let uri = this.uriCache.get(path);
    if (uri) return uri;
    const normalized = path.replace(/\\/g, "/");
    uri = /^[a-zA-Z]:/.test(normalized)
      ? `file:///${normalized}`
      : `file://${normalized}`;
    this.uriCache.set(path, uri);
    return uri;
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

  /** Map file path + language group to the exact LSP languageId */
  private getLspLanguageId(path: string, language: string): string {
    if (language === "typescript") {
      const lower = path.toLowerCase();
      if (lower.endsWith(".tsx")) return "typescriptreact";
      if (lower.endsWith(".jsx")) return "javascriptreact";
      if (
        lower.endsWith(".js") ||
        lower.endsWith(".mjs") ||
        lower.endsWith(".cjs")
      )
        return "javascript";
      return "typescript";
    }
    const map: Record<string, string> = {
      rust: "rust",
      python: "python",
      cpp: "cpp",
    };
    return map[language] ?? language;
  }
}

export const lspManager = new LspManager();
