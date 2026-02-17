import { invoke } from "@tauri-apps/api/core";

export interface AgentDriver {
    spawn(url: string): Promise<string>;
    execute(label: string, script: string): Promise<void>;
    click(label: string, selector: string): Promise<void>;
    type(label: string, selector: string, text: string): Promise<void>;
    scroll(label: string, selector: string): Promise<void>;
    hover(label: string, selector: string): Promise<void>;
    getContent(label: string): Promise<string>;
    close(label: string): Promise<void>;
}

export const agentDriver: AgentDriver = {
    spawn: async (url: string) => {
        return await invoke("agent_spawn", { url });
    },
    execute: async (label: string, script: string) => {
        return await invoke("agent_execute", { label, script });
    },
    click: async (label: string, selector: string) => {
        return await invoke("agent_click", { label, selector });
    },
    type: async (label: string, selector: string, text: string) => {
        return await invoke("agent_type", { label, selector, text });
    },
    scroll: async (label: string, selector: string) => {
        return await invoke("agent_scroll", { label, selector });
    },
    hover: async (label: string, selector: string) => {
        return await invoke("agent_hover", { label, selector });
    },
    getContent: async (label: string) => {
        return await invoke("agent_get_content", { label });
    },
    close: async (label: string) => {
        return await invoke("agent_close", { label });
    }
};
