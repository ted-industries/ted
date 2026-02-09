import { AgentContext, LLMResult, LLMService } from "./types";
import { editorStore } from "../../store/editor-store";
import {
    LLMProvider,
    LLMConfig,
    OllamaProvider,
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider
} from "./providers";

export class ConfigurableLLMService implements LLMService {
    private providers: Record<string, LLMProvider> = {
        ollama: new OllamaProvider(),
        openai: new OpenAIProvider(),
        anthropic: new AnthropicProvider(),
        google: new GoogleProvider()
    };

    async isAvailable(): Promise<boolean> {
        const config = editorStore.getState().settings.llm;
        const provider = this.providers[config.provider];
        if (!provider) return false;
        return provider.isAvailable();
    }

    async generateSuggestions(context: AgentContext): Promise<LLMResult> {
        const config = editorStore.getState().settings.llm as LLMConfig;
        const provider = this.providers[config.provider];

        if (!provider) {
            console.error(`[LLMService] Unknown provider: ${config.provider}`);
            return { suggestions: [] };
        }

        const prompt = this.buildPrompt(context);

        try {
            return await provider.generate(context, config, prompt);
        } catch (err) {
            console.error(`[LLMService] Generation failed (${config.provider}):`, err);
            return { suggestions: [] };
        }
    }

    private buildPrompt(context: AgentContext): string {
        const { file, ast, git, telemetry } = context;

        return `You are Ted, an intelligent coding assistant. Analyze this code and find improvements.

RESPOND WITH THIS EXACT JSON FORMAT:
{"suggestions": [{"type": "refactor", "message": "description here", "confidence": 0.8}]}

If code is perfect, use: {"suggestions": []}

CONTEXT:
- File: ${file.path} (${file.language})
- Git Churn: ${git.churn} commits
- Recent Undos: ${telemetry.recentUndos}
- Complexity: ${ast.complexity}

CODE:
\`\`\`${file.language}
${this.getFocusedCode(file.content, file.cursor)}
\`\`\`

Find ONE improvement. Consider: naming, structure, performance, readability, best practices.`;
    }

    private getFocusedCode(content: string, cursor: number): string {
        const lines = content.split('\n');
        const cursorLine = content.slice(0, cursor).split('\n').length - 1;
        // Only send ±20 lines around cursor — enough context, much less tokens
        const start = Math.max(0, cursorLine - 20);
        const end = Math.min(lines.length, cursorLine + 20);
        return lines.slice(start, end).join('\n');
    }
}

export const llmService = new ConfigurableLLMService();
