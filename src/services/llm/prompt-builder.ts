import { AgentContext } from "./types";

export class PromptBuilder {
    public build(context: AgentContext): string {
        const { file, ast, git, telemetry } = context;

        return `
SYSTEM: You are Ted, an intelligent coding assistant. 
Analyze the following code context and suggest improvements.
Respond ONLY with a valid JSON object in this format:
{
  "suggestions": [
    { 
      "type": "refactor" | "fix" | "optimize" | "style", 
      "message": "Start with a verb, be concise", 
      "confidence": 0.0-1.0 
    }
  ]
}

CONTEXT:
File: ${file.path} (${file.language})
Git Churn: ${git.churn} commits (High churn indicates instability)
Recent Undos: ${telemetry.recentUndos} (High undos indicate user struggle)
AST Complexity: ${ast.complexity}

CODE:
\`\`\`${file.language}
${this.truncate(file.content, 2000)}
\`\`\`

TASK:
Identify ONE high-value improvement. If code is good, return empty suggestions list.
High value means:
1. Simplifying complex logic
2. Fixing potential bugs
3. Improving readability for large functions
`;
    }

    private truncate(str: string, max: number): string {
        return str.length > max ? str.slice(0, max) + "\n... (truncated)" : str;
    }
}

export const promptBuilder = new PromptBuilder();
