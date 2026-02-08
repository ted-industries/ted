import { AgentContext, LLMResult } from "./types";

export interface LLMConfig {
    provider: "ollama" | "openai" | "anthropic" | "google";
    model: string;
    baseUrl?: string;
    apiKey?: string;
}

export interface LLMProvider {
    isAvailable(): Promise<boolean>;
    generate(context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult>;
}

// --- Ollama Provider ---
export class OllamaProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> {
        try {
            const res = await fetch("http://localhost:11434/api/tags");
            return res.ok;
        } catch {
            return false;
        }
    }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        console.log("[OllamaProvider] Generating with model:", config.model);
        const response = await fetch(`${config.baseUrl || "http://localhost:11434"}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: config.model,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { temperature: 0.2, num_predict: 512 }
            })
        });

        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        console.log("[OllamaProvider] Raw response:", data.response?.substring(0, 200));
        return JSON.parse(data.response);
    }
}

// --- OpenAI Provider (and compatible) ---
export class OpenAIProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; } // Assume cloud is available

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        if (!config.apiKey) throw new Error("OpenAI API Key required");

        const response = await fetch(`${config.baseUrl || "https://api.openai.com/v1"}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: "You are a JSON-speaking coding assistant." }, // simplified
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI error: ${err}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        return JSON.parse(content);
    }
}

// --- Anthropic Provider ---
export class AnthropicProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        if (!config.apiKey) throw new Error("Anthropic API Key required");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": config.apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "dangerously-allow-browser": "true" // Tauri is technically browser-like
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
                system: "You are a JSON-speaking coding assistant. Respond with ONLY valid JSON."
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic error: ${err}`);
        }

        const data = await response.json();
        return JSON.parse(data.content[0].text);
    }
}

// --- Google Gemini Provider ---
export class GoogleProvider implements LLMProvider {
    async isAvailable(): Promise<boolean> { return true; }

    async generate(_context: AgentContext, config: LLMConfig, prompt: string): Promise<LLMResult> {
        if (!config.apiKey) throw new Error("Google API Key required");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google error: ${err}`);
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return JSON.parse(text);
    }
}
