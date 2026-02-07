import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const tedDarkTheme = EditorView.theme(
  {
    "&": {
      color: "#d4d4d4",
      backgroundColor: "#1a1a1a",
      fontSize: "15px",
    },
    ".cm-content": {
      caretColor: "#d4d4d4",
      fontFamily:
        "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      padding: "0",
      lineHeight: "24px",
    },
    ".cm-line": {
      padding: "0 0 0 4px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#aeafad",
      borderLeftWidth: "2px",
    },
    ".cm-content ::selection": {
      backgroundColor: "#ffffff15",
    },
    ".cm-activeLine": {
      backgroundColor: "#ffffff06",
    },
    ".cm-gutters": {
      backgroundColor: "#1a1a1a",
      color: "#6e7681",
      border: "none",
      minWidth: "72px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 16px 0 8px",
      minWidth: "48px",
      textAlign: "right",
    },
    ".cm-activeLineGutter": {
      color: "#c6c6c6",
      backgroundColor: "#ffffff06",
    },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "#0064001a",
      outline: "1px solid #888888",
    },
    ".cm-tooltip": {
      backgroundColor: "#252526",
      color: "#cccccc",
      border: "1px solid #454545",
      borderRadius: "3px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "#04395e",
    },
    ".cm-searchMatch": {
      backgroundColor: "#515c6a",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "#ea5c0055",
    },
    ".cm-scroller": {
      overflow: "auto",
      lineHeight: "24px",
      fontFamily:
        "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
    },
    ".cm-foldGutter": {
      width: "16px",
    },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      opacity: "0",
      transition: "opacity 0.15s",
    },
    "&:hover .cm-foldGutter .cm-gutterElement": {
      opacity: "0.6",
    },
    ".cm-foldGutter .cm-gutterElement:hover": {
      opacity: "1",
    },
    "&.cm-focused": {
      outline: "none",
    },
  },
  { dark: true },
);

const tedDarkHighlightStyle = HighlightStyle.define([
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "#606060",
    fontStyle: "italic",
  },
  // Keywords
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword],
    color: "#c678dd",
    fontWeight: "600",
  },
  // Storage / modifiers
  { tag: [t.modifier, t.definitionKeyword], color: "#c678dd" },
  // Strings
  { tag: [t.string, t.special(t.string), t.character], color: "#98c379" },
  // Numbers & units
  { tag: [t.number, t.integer, t.float], color: "#d19a66" },
  { tag: t.unit, color: "#d19a66" },
  // CSS color literals
  { tag: t.color, color: "#d19a66" },
  // Constants / keyword values
  { tag: [t.bool, t.null, t.atom], color: "#d19a66" },
  // Types
  { tag: [t.typeName, t.namespace], color: "#e5c07b" },
  // CSS class selectors
  { tag: t.className, color: "#e5c07b" },
  // Property names
  { tag: t.propertyName, color: "#d19a66" },
  // Variables
  { tag: t.variableName, color: "#e06c75" },
  // Predefined variables
  { tag: t.special(t.variableName), color: "#e06c75" },
  // Functions
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "#61afef",
  },
  // Operators
  {
    tag: [
      t.operator,
      t.derefOperator,
      t.arithmeticOperator,
      t.logicOperator,
      t.compareOperator,
    ],
    color: "#56b6c2",
  },
  // Tags (JSX/HTML)
  { tag: t.tagName, color: "#e06c75" },
  // Tag attributes
  { tag: t.attributeName, color: "#d19a66" },
  // Label names (CSS ID selectors)
  { tag: t.labelName, color: "#e06c75" },
  // Pseudo-class names
  { tag: t.constant(t.className), color: "#d19a66" },
  // Brackets
  {
    tag: [t.bracket, t.paren, t.brace, t.squareBracket],
    color: "#abb2bf",
  },
  // Angle brackets (JSX < > />)
  { tag: t.angleBracket, color: "#abb2bf" },
  // Separators, punctuation (semicolons, commas, colons)
  { tag: [t.separator, t.punctuation], color: "#abb2bf" },
  // Regex
  { tag: t.regexp, color: "#98c379" },
  // Default identifier
  { tag: t.name, color: "#d4d4d4" },
]);

export const tedDark: Extension = [
  tedDarkTheme,
  syntaxHighlighting(tedDarkHighlightStyle),
];
