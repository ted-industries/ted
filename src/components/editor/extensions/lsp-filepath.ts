import { Facet } from "@codemirror/state";

/** Facet that holds the current file path for LSP extensions to read. */
export const filePathFacet = Facet.define<string, string>({
    combine: (values) => values[0] ?? "",
});
