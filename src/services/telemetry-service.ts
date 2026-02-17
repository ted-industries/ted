import { invoke } from "@tauri-apps/api/core";

export type TelemetryEventType =
  | "app_start"
  | "file_open"
  | "file_save"
  | "file_close"
  | "tab_switch"
  | "typing"
  | "cursor_move"
  | "selection_change"
  | "undo"
  | "redo"
  | "command_executed"
  | "terminal_spawn"
  | "terminal_command"
  | "tree_sitter_ready"
  | "tree_sitter_parse"
  | "tree_sitter_error"
  | "tree_sitter_init"
  | "tree_sitter_boot"
  | "tree_sitter_worker_error"
  | "tree_sitter_worker_debug"
  | "tree_sitter_semantic"
  | "debug_service_not_ready"
  | "debug_service_sending_update"
  | "debug_editor_update"
  | "diff_open"
  | "lsp_start"
  | "lsp_ready"
  | "lsp_stop"
  | "lsp_start_failed"
  | "lsp_max_restarts"
  | "lsp_idle_shutdown";

export interface TelemetryEvent {
  type: TelemetryEventType;
  payload?: any;
  timestamp: number;
  isoTimestamp: string;
  sessionId: string;
  userId: string;
}

class TelemetryService {
  private buffer: TelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_DELAY = 5000;
  private readonly MAX_BUFFER_SIZE = 50;
  private sessionId: string;
  private userId: string;

  constructor() {
    this.sessionId = crypto.randomUUID();
    this.userId = this.getUserId();
    this.startFlushTimer();
    this.log("app_start", { platform: navigator.platform });
  }

  private getUserId(): string {
    let id = localStorage.getItem("ted_telemetry_user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ted_telemetry_user_id", id);
    }
    return id;
  }

  private startFlushTimer() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_DELAY);
  }

  private listeners: ((event: TelemetryEvent) => void)[] = [];

  public subscribe(listener: (event: TelemetryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const eventsToSend = [...this.buffer];
    this.buffer = [];

    // Send individually for now as our rust command accepts single strings
    // In future we could bulk send
    for (const event of eventsToSend) {
      try {
        await invoke("log_telemetry_event", { event: JSON.stringify(event) });
      } catch (err) {
        console.error("Failed to log telemetry event:", err);
        // Recover failed events? For now, just drop to avoid loops
      }
    }
  }

  public log(type: TelemetryEventType, payload?: any) {
    const event: TelemetryEvent = {
      type,
      payload,
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.buffer.push(event);

    // Notify listeners immediately for low-latency rule evaluation
    this.listeners.forEach((l) => l(event));

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  public dispose() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Flush remaining
  }
  public getRecentEventCount(
    type: TelemetryEventType,
    timeWindowMs: number,
  ): number {
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    // Count in buffer
    return this.buffer.filter((e) => e.type === type && e.timestamp >= cutoff)
      .length;
  }
}

export const telemetry = new TelemetryService();
