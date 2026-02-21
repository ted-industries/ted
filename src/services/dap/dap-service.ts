import { DAPRequest, DAPResponse, DAPEvent } from "./types";

export class DAPService {
    private socket: WebSocket | null = null;
    private seq = 1;
    private pendingRequests = new Map<number, (res: DAPResponse) => void>();
    private eventListeners = new Map<string, ((event: DAPEvent) => void)[]>();

    async connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(url);
            this.socket.onopen = () => resolve();
            this.socket.onerror = (err) => reject(err);
            this.socket.onmessage = (msg) => this.handleMessage(msg.data);
        });
    }

    private handleMessage(data: string) {
        const msg = JSON.parse(data);
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
        if (!this.socket) throw new Error("Not connected");

        const request: DAPRequest = {
            seq: this.seq++,
            type: "request",
            command,
            arguments: args
        };

        return new Promise((resolve) => {
            this.pendingRequests.set(request.seq, resolve);
            this.socket!.send(JSON.stringify(request));
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
        return this.sendRequest("disconnect");
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
}

export const dapService = new DAPService();
