import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { telemetry } from "../telemetry-service";
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  ServerCapabilities,
  TextDocumentContentChangeEvent,
  CompletionItem,
  CompletionList,
  Hover,
  Location,
  Diagnostic,
  Position,
  LspServerConfig,
} from "./types";

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
  method: string;
  timer: ReturnType<typeof setTimeout>;
}

export type DiagnosticsListener = (
  uri: string,
  diagnostics: Diagnostic[],
) => void;

export class LspClient {
  private serverId: string;
  private config: LspServerConfig;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private capabilities: ServerCapabilities | null = null;
  private _initialized = false;
  private documentVersions = new Map<string, number>();
  private unlistenMessage: UnlistenFn | null = null;
  private unlistenError: UnlistenFn | null = null;
  private unlistenExit: UnlistenFn | null = null;
  private diagnosticsListeners: DiagnosticsListener[] = [];
  private _syncKind = 1; // default Full
  private restartCount = 0;
  private readonly MAX_RESTARTS = 3;
  private readonly RESTART_BACKOFF_BASE = 2000;
  private rootUri: string | null = null;
  /** Track last request ID per feature slot so we can cancel superseded requests */
  private activeFeatureRequest = new Map<string, number>();

  constructor(serverId: string, config: LspServerConfig) {
    this.serverId = serverId;
    this.config = config;
  }

  // ---- Lifecycle ----

  async start(rootUri: string): Promise<void> {
    this.rootUri = rootUri;
    telemetry.log("lsp_start", {
      serverId: this.serverId,
      command: this.config.command,
    });

    const cwd = rootUri.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");

    await invoke("lsp_start", {
      serverId: this.serverId,
      command: this.config.command,
      args: this.config.args,
      cwd,
    });

    this.unlistenMessage = await listen<{ server_id: string; message: string }>(
      `lsp-message:${this.serverId}`,
      (event) => this.handleMessage(event.payload.message),
    );

    this.unlistenError = await listen<{ server_id: string; error: string }>(
      `lsp-error:${this.serverId}`,
      (event) => {
        console.warn(`[LSP:${this.serverId}] stderr:`, event.payload.error);
      },
    );

    this.unlistenExit = await listen<{
      server_id: string;
      code: number | null;
    }>(`lsp-exit:${this.serverId}`, () => {
      console.warn(`[LSP:${this.serverId}] Server exited`);
      this.handleServerExit();
    });

    // LSP Initialize handshake
    const initResult = (await this.request(
      "initialize",
      {
        processId: null,
        capabilities: {
          textDocument: {
            completion: {
              completionItem: {
                snippetSupport: false,
                documentationFormat: ["markdown", "plaintext"],
              },
            },
            hover: { contentFormat: ["markdown", "plaintext"] },
            definition: {},
            references: {},
            typeDefinition: {},
            publishDiagnostics: { relatedInformation: true },
            synchronization: { didSave: true },
          },
          workspace: { workspaceFolders: true },
        },
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: "root" }],
      },
      15000,
    )) as { capabilities: ServerCapabilities };

    this.capabilities = initResult.capabilities;

    const sync = this.capabilities?.textDocumentSync;
    if (typeof sync === "number") {
      this._syncKind = sync;
    } else if (sync && typeof sync === "object") {
      this._syncKind = sync.change ?? 1;
    }

    this.notify("initialized", {});
    this._initialized = true;
    this.restartCount = 0;

    telemetry.log("lsp_ready", {
      serverId: this.serverId,
      capabilities: Object.keys(this.capabilities || {}),
    });
  }

  async stop(): Promise<void> {
    if (!this._initialized) {
      // Still try to kill the process in case it's hanging
      try {
        await invoke("lsp_stop", { serverId: this.serverId });
      } catch {
        /* ignore */
      }
      this.cleanup();
      return;
    }

    try {
      await this.request("shutdown", null, 5000);
      this.notify("exit", null);
    } catch {
      // Server may already be dead
    }

    try {
      await invoke("lsp_stop", { serverId: this.serverId });
    } catch {
      /* ignore */
    }
    this.cleanup();
    telemetry.log("lsp_stop", { serverId: this.serverId });
  }

  private cleanup(): void {
    this.unlistenMessage?.();
    this.unlistenError?.();
    this.unlistenExit?.();
    this.unlistenMessage = null;
    this.unlistenError = null;
    this.unlistenExit = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Client stopped"));
    }
    this.pending.clear();
    this.documentVersions.clear();
    this._initialized = false;
  }

  private async handleServerExit(): Promise<void> {
    this.cleanup();
    if (!this.rootUri) return;

    this.restartCount++;
    if (this.restartCount > this.MAX_RESTARTS) {
      console.error(`[LSP:${this.serverId}] Max restarts exceeded`);
      telemetry.log("lsp_max_restarts", { serverId: this.serverId });
      return;
    }

    const delay =
      this.RESTART_BACKOFF_BASE * Math.pow(2, this.restartCount - 1);
    console.warn(
      `[LSP:${this.serverId}] Restarting in ${delay}ms (attempt ${this.restartCount})`,
    );
    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.start(this.rootUri);
    } catch (err) {
      console.error(`[LSP:${this.serverId}] Restart failed:`, err);
    }
  }

  // ---- JSON-RPC Transport ----

  private request(
    method: string,
    params: unknown,
    timeout = 10000,
  ): Promise<unknown> {
    const id = this.nextId++;
    const message: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LSP '${method}' timed out after ${timeout}ms`));
      }, timeout);

      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        method,
        timer,
      });

      invoke("lsp_send", {
        serverId: this.serverId,
        message: JSON.stringify(message),
      }).catch((err) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      });
    });
  }

  private notify(method: string, params: unknown): void {
    const message: JsonRpcNotification = { jsonrpc: "2.0", method, params };
    invoke("lsp_send", {
      serverId: this.serverId,
      message: JSON.stringify(message),
    }).catch((err) => {
      console.error(
        `[LSP:${this.serverId}] Notification '${method}' failed:`,
        err,
      );
    });
  }

  cancelRequest(id: number): void {
    this.notify("$/cancelRequest", { id });
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Cancelled"));
      this.pending.delete(id);
    }
  }

  private handleMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error(`[LSP:${this.serverId}] Invalid JSON:`, raw.slice(0, 200));
      return;
    }

    // Response to a request
    if ("id" in msg && ("result" in msg || "error" in msg)) {
      const pending = this.pending.get(msg.id as number);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id as number);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Server notification
    if ("method" in msg && !("id" in msg)) {
      this.handleNotification(msg.method as string, msg.params);
      return;
    }

    // Server request (e.g., window/showMessage) - acknowledge
    if ("method" in msg && "id" in msg) {
      invoke("lsp_send", {
        serverId: this.serverId,
        message: JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: null }),
      }).catch(() => {
        /* ignore */
      });
    }
  }

  private handleNotification(method: string, params: unknown): void {
    switch (method) {
      case "textDocument/publishDiagnostics": {
        const p = params as { uri: string; diagnostics: Diagnostic[] };
        for (const listener of this.diagnosticsListeners) {
          listener(p.uri, p.diagnostics);
        }
        break;
      }
      case "window/logMessage": {
        const p = params as { message: string };
        console.log(`[LSP:${this.serverId}]`, p.message);
        break;
      }
    }
  }

  // ---- Document Sync ----

  didOpen(uri: string, languageId: string, text: string): void {
    this.documentVersions.set(uri, 1);
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  didChange(
    uri: string,
    changes: TextDocumentContentChangeEvent[],
    fullText: string,
  ): void {
    const version = (this.documentVersions.get(uri) ?? 0) + 1;
    this.documentVersions.set(uri, version);

    if (this._syncKind === 1 /* Full */) {
      this.notify("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text: fullText }],
      });
    } else {
      this.notify("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: changes,
      });
    }
  }

  didClose(uri: string): void {
    this.documentVersions.delete(uri);
    this.notify("textDocument/didClose", {
      textDocument: { uri },
    });
  }

  didSave(uri: string, text?: string): void {
    this.notify("textDocument/didSave", {
      textDocument: { uri },
      text,
    });
  }

  // ---- LSP Feature Requests ----

  /**
   * Send a feature request, auto-cancelling any previous in-flight request
   * for the same slot (e.g. "completion", "hover"). This prevents stale
   * responses and reduces server load during rapid interactions.
   */
  private async featureRequest<T>(
    slot: string,
    method: string,
    params: unknown,
    timeout: number,
  ): Promise<T | null> {
    // Cancel previous in-flight request for this slot
    const prevId = this.activeFeatureRequest.get(slot);
    if (prevId !== undefined) {
      this.cancelRequest(prevId);
    }
    const id = this.nextId; // peek — request() will increment
    this.activeFeatureRequest.set(slot, id);
    try {
      const result = await this.request(method, params, timeout);
      return result as T;
    } catch {
      return null;
    } finally {
      // Only clear if this is still the active request for the slot
      if (this.activeFeatureRequest.get(slot) === id) {
        this.activeFeatureRequest.delete(slot);
      }
    }
  }

  async completion(
    uri: string,
    position: Position,
  ): Promise<CompletionItem[] | CompletionList | null> {
    if (!this.capabilities?.completionProvider) return null;
    return this.featureRequest(
      "completion",
      "textDocument/completion",
      { textDocument: { uri }, position },
      5000,
    );
  }

  async hover(uri: string, position: Position): Promise<Hover | null> {
    if (!this.capabilities?.hoverProvider) return null;
    return this.featureRequest(
      "hover",
      "textDocument/hover",
      { textDocument: { uri }, position },
      5000,
    );
  }

  async definition(
    uri: string,
    position: Position,
  ): Promise<Location | Location[] | null> {
    if (!this.capabilities?.definitionProvider) return null;
    return this.featureRequest(
      "definition",
      "textDocument/definition",
      { textDocument: { uri }, position },
      5000,
    );
  }

  async references(
    uri: string,
    position: Position,
  ): Promise<Location[] | null> {
    if (!this.capabilities?.referencesProvider) return null;
    return this.featureRequest(
      "references",
      "textDocument/references",
      {
        textDocument: { uri },
        position,
        context: { includeDeclaration: true },
      },
      10000,
    );
  }

  async typeDefinition(
    uri: string,
    position: Position,
  ): Promise<Location | Location[] | null> {
    if (!this.capabilities?.typeDefinitionProvider) return null;
    return this.featureRequest(
      "typeDefinition",
      "textDocument/typeDefinition",
      { textDocument: { uri }, position },
      5000,
    );
  }

  // ---- Subscriptions ----

  onDiagnostics(listener: DiagnosticsListener): () => void {
    this.diagnosticsListeners.push(listener);
    return () => {
      this.diagnosticsListeners = this.diagnosticsListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  // ---- Getters ----

  get isInitialized(): boolean {
    return this._initialized;
  }
  get serverCapabilities(): ServerCapabilities | null {
    return this.capabilities;
  }
  get id(): string {
    return this.serverId;
  }
  get syncMode(): number {
    return this._syncKind;
  }
}
