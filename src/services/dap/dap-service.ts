import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DAPRequest, DAPResponse, DAPEvent } from "./types";

export class DAPService {
    private seq = 1;
    private pendingRequests = new Map<number, (res: DAPResponse) => void>();
    private eventListeners = new Map<string, ((event: DAPEvent) => void)[]>();
    private buffer = "";
    private isConnected = false;
    private isInitialized = false;
    private currentSessionId: string | null = null;
    private unlistenFns: UnlistenFn[] = [];

    private async init() {
        if (this.isInitialized) return;

        const un1 = await listen("dap-data", (event) => {
            const { id, data } = event.payload as { id: string, data: string };
            if (id === this.currentSessionId) {
                this.handleRawData(data);
            }
        });

        const un2 = await listen("dap-terminated", (event) => {
            const id = event.payload as string;
            if (id === this.currentSessionId) {
                this.isConnected = false;
                this.currentSessionId = null;
                const listeners = this.eventListeners.get("terminated") || [];
                listeners.forEach(l => l({ seq: 0, type: "event", event: "terminated" }));
            }
        });

        this.unlistenFns.push(un1, un2);
        this.isInitialized = true;
    }

    async connect(host: string, port: number): Promise<void> {
        await this.init();
        const sessionId = Math.random().toString(36).substring(7);
        this.currentSessionId = sessionId;
        await invoke("dap_connect", { host, port, id: sessionId });
        this.isConnected = true;
        this.buffer = "";
    }

    private handleRawData(data: string) {
        this.buffer += data;

        while (true) {
            // Find start of Content-Length header and discard any garbage before it
            const headerIndex = this.buffer.indexOf("Content-Length:");
            if (headerIndex === -1) {
                if (this.buffer.length > 8192) this.buffer = ""; // Anti-clog
                break;
            }
            if (headerIndex > 0) {
                this.buffer = this.buffer.substring(headerIndex);
            }

            // Find end of header section
            const bodyStartIndex = this.buffer.indexOf("\r\n\r\n");
            if (bodyStartIndex === -1) break;

            const headerContent = this.buffer.substring(15, bodyStartIndex).trim();
            const contentLength = parseInt(headerContent);
            const bodyEndIndex = bodyStartIndex + 4 + contentLength;

            if (this.buffer.length < bodyEndIndex) break;

            const jsonStr = this.buffer.substring(bodyStartIndex + 4, bodyEndIndex);
            this.buffer = this.buffer.substring(bodyEndIndex);

            try {
                this.handleMessage(JSON.parse(jsonStr));
            } catch (e) {
                console.error("DAP Parse Error:", e, jsonStr);
            }
        }
    }

    private handleMessage(msg: any) {
        if (msg.type === "response") {
            const handler = this.pendingRequests.get(msg.request_seq);
            if (handler) {
                handler(msg as DAPResponse);
                this.pendingRequests.delete(msg.request_seq);
            }
        } else if (msg.type === "event") {
            const listeners = this.eventListeners.get(msg.event) || [];
            listeners.forEach(l => l(msg as DAPEvent));
        }
    }

    async sendRequest(command: string, args?: any): Promise<DAPResponse> {
        if (!this.isConnected) throw new Error("Not connected");

        const request: DAPRequest = {
            seq: this.seq++,
            type: "request",
            command,
            arguments: args
        };

        const jsonStr = JSON.stringify(request);
        const payload = `Content-Length: ${jsonStr.length}\r\n\r\n${jsonStr}`;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(request.seq, (res) => {
                if (res.success) {
                    resolve(res);
                } else {
                    reject(new Error(res.message || `DAP request ${command} failed`));
                }
            });
            invoke("dap_send", { message: payload }).catch(err => {
                console.error("DAP Send Error:", err);
                this.pendingRequests.delete(request.seq);
                reject(err);
            });
        });
    }

    onEvent(event: string, listener: (e: DAPEvent) => void) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.push(listener);
        this.eventListeners.set(event, listeners);
    }

    // ---- Lifecycle Methods ----

    async initialize(adapterId: string): Promise<DAPResponse> {
        return this.sendRequest("initialize", {
            adapterID: adapterId,
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: "path",
        });
    }

    async launch(args: any): Promise<DAPResponse> {
        return this.sendRequest("launch", args);
    }

    async attach(args: any): Promise<DAPResponse> {
        return this.sendRequest("attach", args);
    }

    async terminate(): Promise<DAPResponse> {
        return this.sendRequest("terminate");
    }

    async disconnect(): Promise<DAPResponse> {
        await invoke("dap_disconnect");
        this.isConnected = false;
        return { seq: 0, type: "response", request_seq: 0, success: true, command: "disconnect" };
    }

    // ---- Execution Control ----

    async continue(threadId: number): Promise<DAPResponse> {
        return this.sendRequest("continue", { threadId });
    }

    async next(threadId: number): Promise<DAPResponse> {
        return this.sendRequest("next", { threadId });
    }

    async stepIn(threadId: number): Promise<DAPResponse> {
        return this.sendRequest("stepIn", { threadId });
    }

    async stepOut(threadId: number): Promise<DAPResponse> {
        return this.sendRequest("stepOut", { threadId });
    }

    // ---- State Retrieval ----

    async getStackTrace(threadId: number): Promise<DAPResponse> {
        return this.sendRequest("stackTrace", { threadId });
    }

    async getScopes(frameId: number): Promise<DAPResponse> {
        return this.sendRequest("scopes", { frameId });
    }

    async getVariables(variablesReference: number): Promise<DAPResponse> {
        return this.sendRequest("variables", { variablesReference });
    }

    async setBreakpoints(path: string, lines: number[]): Promise<DAPResponse> {
        return this.sendRequest("setBreakpoints", {
            source: { path },
            breakpoints: lines.map(l => ({ line: l })),
            lines,
            sourceModified: false
        });
    }

    async configurationDone(): Promise<DAPResponse> {
        return this.sendRequest("configurationDone");
    }
}

export const dapService = new DAPService();
