export type SuggestionType = "behavior" | "ast" | "git" | "other";

export interface SuggestionAction {
    label: string;
    handler: () => void;
}

export interface Suggestion {
    id: string; // unique
    sourceRuleId: string;
    type: SuggestionType;
    message: string;
    action?: SuggestionAction;
    confidence: number; // 0-1
    timestamp: number;
    lastShownAt?: number;
    cooldownUntil?: number;
    contextSnapshot?: any;
    priority: number;
}

export interface Rule {
    id: string;
    signalTypes: SuggestionType[]; // Subscribe to these signals
    evaluate(signal: any, context: any): Promise<Suggestion | null>;
    cooldown: number; // ms
    lastTriggered: number;
    priority: number;
}
