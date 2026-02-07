import type { editor } from "monaco-editor";

export const THEME_NAME = "ted-dark";

export const tedDarkTheme: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "d4d4d4" },
    { token: "comment", foreground: "6a9955", fontStyle: "italic" },
    { token: "keyword", foreground: "c586c0" },
    { token: "string", foreground: "ce9178" },
    { token: "number", foreground: "b5cea8" },
    { token: "type", foreground: "4ec9b0" },
    { token: "delimiter", foreground: "808080" },
  ],
  colors: {
    "editor.background": "#1a1a1a",
    "editor.foreground": "#d4d4d4",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.selectionBackground": "#264f78",
    "editorLineNumber.foreground": "#555555",
    "editorLineNumber.activeForeground": "#888888",
    "editorGutter.background": "#1a1a1a",
    "editorCursor.foreground": "#d4d4d4",
    "editor.selectionHighlightBackground": "#264f7840",
    "editorIndentGuide.background": "#2a2a2a",
    "editorIndentGuide.activeBackground": "#3a3a3a",
    "scrollbarSlider.background": "#ffffff10",
    "scrollbarSlider.hoverBackground": "#ffffff20",
    "scrollbarSlider.activeBackground": "#ffffff30",
    "editorWidget.background": "#1a1a1a",
    "editorWidget.border": "#2a2a2a",
  },
};
