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
            const query = this.language.query(querySource);
            this.queries.set(languageName, query);
            return query;
        } catch (e) {
            console.error(`Failed to compile query for ${languageName}:`, e);
            return null;
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
                return `
                    (function_declaration name: (identifier) @def.function)
                    (method_definition name: (property_identifier) @def.method)
                    (class_declaration name: (identifier) @def.class)
                    (variable_declarator name: (identifier) @def.variable)
                    (call_expression function: (identifier) @ref.call)
                `;
            case "rust":
                return `
                    (function_item name: (identifier) @def.function)
                    (struct_item name: (type_identifier) @def.struct)
                    (impl_item type: (type_identifier) @def.impl)
                    (call_expression function: (identifier) @ref.call)
                `;
            case "python":
                return `
                    (function_definition name: (identifier) @def.function)
                    (class_definition name: (identifier) @def.class)
                    (call function: (identifier) @ref.call)
                `;
            case "c":
            case "cpp":
                return `
                    (function_definition declarator: (function_declarator declarator: (identifier) @def.function))
                    (struct_specifier name: (type_identifier) @def.struct)
                    (call_expression function: (identifier) @ref.call)
                `;
            default:
                return null;
        }
    }
}
