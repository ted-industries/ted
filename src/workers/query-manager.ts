// @ts-ignore
import { Parser, Query, QueryCapture, Tree } from "web-tree-sitter";

export class QueryManager {
    private queries: Map<string, Query> = new Map();
    private language: any; // Type is actually Language, but using any for UMD compat

    constructor(language: any) {
        this.language = language;
    }

    public getQuery(languageName: string): Query | null {
        if (this.queries.has(languageName)) {
            return this.queries.get(languageName)!;
        }

        const querySource = this.getQuerySource(languageName);
        if (!querySource) return null;

        try {
            // Try compiling the full query first
            const query = this.language.query ? this.language.query(querySource) : new Query(this.language, querySource);
            this.queries.set(languageName, query);
            return query;
        } catch {
            // If the full query fails, try each pattern individually and
            // combine only the ones the grammar actually supports.
            const patterns = querySource.split("\n").filter((p: string) => p.trim());
            const valid: string[] = [];
            for (const pattern of patterns) {
                try {
                    const test = this.language.query ? this.language.query(pattern) : new Query(this.language, pattern);
                    test.delete?.(); // free the test query
                    valid.push(pattern);
                } catch {
                    console.warn(`[QueryManager] Skipping unsupported pattern for ${languageName}: ${pattern.trim()}`);
                }
            }
            if (valid.length === 0) {
                console.warn(`[QueryManager] No valid patterns for ${languageName}`);
                return null;
            }
            try {
                const combined = valid.join("\n");
                const query = this.language.query ? this.language.query(combined) : new Query(this.language, combined);
                this.queries.set(languageName, query);
                return query;
            } catch (e) {
                console.error(`Failed to compile combined query for ${languageName}:`, e);
                return null;
            }
        }
    }

    public execute(tree: Tree, languageName: string) {
        const query = this.getQuery(languageName);
        if (!query) return [];

        const captures = query.captures(tree.rootNode);
        return this.processCaptures(captures);
    }

    private processCaptures(captures: QueryCapture[]) {
        return captures.map(c => ({
            name: c.name,
            text: c.node.text,
            type: c.node.type,
            startPosition: c.node.startPosition,
            endPosition: c.node.endPosition
        }));
    }

    private getQuerySource(language: string): string | null {
        switch (language) {
            case "typescript":
            case "tsx":
            case "javascript":
            case "jsx":
                return [
                    "(function_declaration name: (identifier) @def_function)",
                    "(method_definition name: (property_identifier) @def_method)",
                    "(class_declaration name: (identifier) @def_class)",
                    "(variable_declarator name: (identifier) @def_variable)",
                    "(call_expression function: (identifier) @ref_call)",
                ].join("\n");
            case "rust":
                return [
                    "(function_item name: (identifier) @def_function)",
                    "(struct_item name: (type_identifier) @def_struct)",
                    "(impl_item type: (type_identifier) @def_impl)",
                    "(call_expression function: (identifier) @ref_call)",
                ].join("\n");
            case "python":
                return [
                    "(function_definition name: (identifier) @def_function)",
                    "(class_definition name: (identifier) @def_class)",
                    "(call function: (identifier) @ref_call)",
                ].join("\n");
            case "c":
            case "cpp":
                return [
                    "(function_definition declarator: (function_declarator declarator: (identifier) @def_function))",
                    "(struct_specifier name: (type_identifier) @def_struct)",
                    "(call_expression function: (identifier) @ref_call)",
                ].join("\n");
            default:
                return null;
        }
    }
}
