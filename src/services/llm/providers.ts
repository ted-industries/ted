import { AgentContext, LLMResult } from "./types";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export interface LLMConfig {
    provider: "ollama" | "openai" | "anthropic" | "google";
    model: string;
    baseUrl?: string;
    apiKey?: string;
}

export interface LLMProvider {
    isAvailable(): Promise<boolean>;
    generate(context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult>;
    chat(prompt: string, config: LLMConfig): Promise<string>;
}

function cleanJson(text: string): string {
    let clean = text.trim();
    if (clean.startsWith("```json")) clean = clean.slice(7);
    else if (clean.startsWith("```")) clean = clean.slice(3);
    if (clean.endsWith("```")) clean = clean.slice(0, -3);
    return clean.trim();
}

// ... helper ...

// --- Ollama Provider ---
export class OllamaProvider implements LLMProvider {
    // ... isAvailable ...
    async isAvailable(): Promise<boolean> {
        try {
            const res = await tauriFetch("http://localhost:11434/api/tags");
            return res.ok;
        } catch {
            return false;
        }
    }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        const text = await this.chat(prompt, config, true);
        return JSON.parse(cleanJson(text));
    }

    async chat(prompt: string, config: LLMConfig, forceJson = false): Promise<string> {
        const response = await tauriFetch(`${config.baseUrl || "http://localhost:11434"}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: config.model,
                prompt: prompt,
                stream: false,
                format: forceJson ? "json" : undefined,
                options: { temperature: 0.2, num_predict: 512 }
            })
        });
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.response;
    }
}

// --- OpenAI Provider ---
export class OpenAIProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        const text = await this.chat(prompt, config, true);
        return JSON.parse(cleanJson(text));
    }

    async chat(prompt: string, config: LLMConfig, forceJson = false): Promise<string> {
        if (!config.apiKey) throw new Error("OpenAI API Key required");
        const response = await tauriFetch(`${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                response_format: forceJson ? { type: "json_object" } : undefined
            })
        });
        if (!response.ok) throw new Error(`OpenAI error: ${await response.text()}`);
        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// --- Anthropic Provider ---
export class AnthropicProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        const text = await this.chat(prompt, config);
        return JSON.parse(cleanJson(text));
    }

    async chat(prompt: string, config: LLMConfig): Promise<string> {
        if (!config.apiKey) throw new Error("Anthropic API Key required");
        const response = await tauriFetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": config.apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }]
            })
        });
        if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
        const data = await response.json();
        return data.content[0].text;
    }
}

// --- Google Provider ---
export class GoogleProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        const text = await this.chat(prompt, config, true);
        return JSON.parse(cleanJson(text));
    }

    async chat(prompt: string, config: LLMConfig, forceJson = false): Promise<string> {
        if (!config.apiKey) throw new Error("Google API Key required");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        const response = await tauriFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: forceJson ? { responseMimeType: "application/json" } : undefined
            })
        });
        if (!response.ok) throw new Error(`Google error: ${await response.text()}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}
