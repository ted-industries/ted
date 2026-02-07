import type { editor } from "monaco-editor";

export const THEME_NAME = "ted-dark";

export const tedDarkTheme: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "d4d4d4" },

    // Comments
    { token: "comment", foreground: "6a9955", fontStyle: "italic" },

    // Keywords: import, export, const, function, return, default, etc.
    { token: "keyword", foreground: "c586c0" },
    { token: "keyword.control", foreground: "c586c0" },

    // Storage/modifiers
    { token: "storage", foreground: "569cd6" },
    { token: "storage.type", foreground: "569cd6" },

    // Strings
    { token: "string", foreground: "ce9178" },
    { token: "string.key.json", foreground: "9cdcfe" },
    { token: "string.value.json", foreground: "ce9178" },

    // Numbers and constants
    { token: "number", foreground: "b5cea8" },
    { token: "constant", foreground: "569cd6" },

    // Types and interfaces
    { token: "type", foreground: "4ec9b0" },
    { token: "type.identifier", foreground: "4ec9b0" },

    // Variables and properties
    { token: "variable", foreground: "9cdcfe" },
    { token: "variable.predefined", foreground: "4fc1ff" },
    { token: "identifier", foreground: "d4d4d4" },

    // Functions
    { token: "entity.name.function", foreground: "dcdcaa" },

    // Delimiters and brackets
    { token: "delimiter", foreground: "808080" },
    { token: "delimiter.bracket", foreground: "ffd700" },
    { token: "delimiter.parenthesis", foreground: "ffd700" },
    { token: "delimiter.curly", foreground: "ffd700" },
    { token: "delimiter.square", foreground: "ffd700" },
    { token: "delimiter.angle", foreground: "808080" },

    // Operators
    { token: "operator", foreground: "d4d4d4" },

    // Tags (JSX/HTML)
    { token: "tag", foreground: "569cd6" },
    { token: "metatag", foreground: "569cd6" },
    { token: "tag.attribute.name", foreground: "9cdcfe" },

    // Regex
    { token: "regexp", foreground: "d16969" },
  ],
  colors: {
    // Editor
    "editor.background": "#1a1a1a",
    "editor.foreground": "#d4d4d4",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.selectionBackground": "#264f78",
    "editor.selectionHighlightBackground": "#264f7840",
    "editor.wordHighlightBackground": "#575757b8",

    // Line numbers
    "editorLineNumber.foreground": "#555555",
    "editorLineNumber.activeForeground": "#888888",

    // Gutter
    "editorGutter.background": "#1a1a1a",

    // Cursor
    "editorCursor.foreground": "#d4d4d4",

    // Indent guides
    "editorIndentGuide.background": "#2a2a2a",
    "editorIndentGuide.activeBackground": "#3a3a3a",

    // Scrollbar
    "scrollbarSlider.background": "#ffffff10",
    "scrollbarSlider.hoverBackground": "#ffffff20",
    "scrollbarSlider.activeBackground": "#ffffff30",

    // Hover widget / popups
    "editorWidget.background": "#161616",
    "editorWidget.border": "#3a3a3a",
    "editorWidget.foreground": "#cccccc",
    "editorHoverWidget.background": "#161616",
    "editorHoverWidget.border": "#3a3a3a",
    "editorHoverWidget.foreground": "#cccccc",
    "editorHoverWidget.statusBarBackground": "#161616",
    "editorSuggestWidget.background": "#161616",
    "editorSuggestWidget.border": "#3a3a3a",
    "editorSuggestWidget.foreground": "#d4d4d4",
    "editorSuggestWidget.selectedBackground": "#04395e",

    // Bracket match
    "editorBracketMatch.background": "#0064001a",
    "editorBracketMatch.border": "#888888",

    // Find / search
    "editor.findMatchBackground": "#515c6a",
    "editor.findMatchHighlightBackground": "#ea5c0055",
  },
};
