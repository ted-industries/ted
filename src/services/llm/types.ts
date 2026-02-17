export interface AgentContext {
    file: {
        path: string;
        content: string;
        language: string;
        cursor: number;
        selection: { from: number; to: number };
    };
    ast: {
        complexity: number;
        hasError: boolean;
        // Simplified structure for now
        functions: string[];
    };
    git: {
        churn: number;
        lastCommit: string;
    };
    telemetry: {
        recentUndos: number;
        recentEdits: number;
    };
}

export interface LLMResult {
    suggestions: LLMSuggestion[];
}

export interface LLMSuggestion {
    type: "refactor" | "fix" | "optimize" | "style";
    message: string;
    confidence: number;
    startLine?: number;
    endLine?: number;
    replacement?: string;
}

export interface LLMService {
    generateSuggestions(context: AgentContext): Promise<LLMResult>;
    isAvailable(): Promise<boolean>;
}
