import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const tedDarkTheme = EditorView.theme(
  {
    "&": {
      color: "var(--foreground)",
      backgroundColor: "var(--background)",
      fontSize: "15px",
    },
    ".cm-content": {
      caretColor: "var(--foreground)",
      fontFamily:
        "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      padding: "0",
      lineHeight: "24px",
    },
    ".cm-line": {
      padding: "0 0 0 4px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--foreground)",
      borderLeftWidth: "2px",
    },
    ".cm-content ::selection": {
      backgroundColor: "var(--selection)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--line-highlight)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      color: "var(--sidebar-fg)",
      border: "none",
      minWidth: "72px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 16px 0 8px",
      minWidth: "48px",
      textAlign: "right",
    },
    ".cm-activeLineGutter": {
      color: "var(--foreground)",
      backgroundColor: "var(--line-highlight)",
    },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "var(--selection)",
      outline: "1px solid var(--border)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--sidebar-bg)",
      color: "var(--foreground)",
      border: "1px solid var(--border)",
      borderRadius: "3px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--selection)",
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--selection)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--line-highlight)",
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
    // Indent guides
    ".cm-indentation-marker": {
      display: "inline-block",
    },
  },
  { dark: true },
);

const tedDarkHighlightStyle = HighlightStyle.define([
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "var(--syntax-comment)",
    fontStyle: "italic",
  },
  // Keywords
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword],
    color: "var(--syntax-keyword)",
    fontWeight: "600",
  },
  // Storage / modifiers
  { tag: [t.modifier, t.definitionKeyword], color: "var(--syntax-keyword)" },
  // Strings
  { tag: [t.string, t.special(t.string), t.character], color: "var(--syntax-string)" },
  // Numbers & units
  { tag: [t.number, t.integer, t.float], color: "var(--syntax-number)" },
  { tag: t.unit, color: "var(--syntax-number)" },
  // CSS color literals
  { tag: t.color, color: "var(--syntax-number)" },
  // Constants / keyword values
  { tag: [t.bool, t.null, t.atom], color: "var(--syntax-number)" },
  // Types
  { tag: [t.typeName, t.namespace], color: "var(--syntax-type)" },
  // CSS class selectors
  { tag: t.className, color: "var(--syntax-class)" },
  // Property names
  { tag: t.propertyName, color: "var(--syntax-number)" },
  // Variables
  { tag: t.variableName, color: "var(--syntax-variable)" },
  // Predefined variables
  { tag: t.special(t.variableName), color: "var(--syntax-variable)" },
  // Functions
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "var(--syntax-function)",
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
    color: "var(--syntax-operator)",
  },
  // Tags (JSX/HTML)
  { tag: t.tagName, color: "var(--syntax-tag)" },
  // Tag attributes
  { tag: t.attributeName, color: "var(--syntax-attribute)" },
  // Label names (CSS ID selectors)
  { tag: t.labelName, color: "var(--syntax-tag)" },
  // Pseudo-class names
  { tag: t.constant(t.className), color: "var(--syntax-number)" },
  // Brackets
  {
    tag: [t.bracket, t.paren, t.brace, t.squareBracket],
    color: "var(--syntax-bracket)",
  },
  // Angle brackets (JSX < > />)
  { tag: t.angleBracket, color: "var(--syntax-bracket)" },
  // Separators, punctuation (semicolons, commas, colons)
  { tag: [t.separator, t.punctuation], color: "var(--syntax-bracket)" },
  // Regex
  { tag: t.regexp, color: "var(--syntax-string)" },
  // Default identifier
  { tag: t.name, color: "var(--foreground)" },
]);

export const tedDark: Extension = [
  tedDarkTheme,
  syntaxHighlighting(tedDarkHighlightStyle),
];
