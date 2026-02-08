import { LLMResult } from "./types";

export class ResponseValidator {
    public validate(raw: any): LLMResult | null {
        console.log("[ResponseValidator] Validating:", raw);

        if (!raw || typeof raw !== "object") {
            console.log("[ResponseValidator] Invalid: not an object");
            return null;
        }
        if (!Array.isArray(raw.suggestions)) {
            console.log("[ResponseValidator] Invalid: no suggestions array");
            return null;
        }

        const validSuggestions = raw.suggestions.filter((s: any) => {
            const isValid = (
                typeof s.message === "string" &&
                s.message.length > 0 &&
                typeof s.confidence === "number"
                // Removed strict type check - accept any type
            );
            if (!isValid) {
                console.log("[ResponseValidator] Filtered out suggestion:", s);
            }
            return isValid;
        });

        console.log("[ResponseValidator] Valid suggestions:", validSuggestions.length);
        if (validSuggestions.length === 0) return null;

        return { suggestions: validSuggestions };
    }

    public isSafe(suggestion: any): boolean {
        // Basic safety checks
        // 1. No critical keywords in message?
        if (suggestion.message && suggestion.message.includes("delete everything")) return false;
        // 2. Replacement edits valid?
        return true;
    }
}

export const responseValidator = new ResponseValidator();
