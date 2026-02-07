import type { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { css } from "@codemirror/lang-css";

const extMap: Record<string, () => Extension> = {
  ".js": () => javascript(),
  ".mjs": () => javascript(),
  ".cjs": () => javascript(),
  ".jsx": () => javascript({ jsx: true }),
  ".ts": () => javascript({ typescript: true }),
  ".tsx": () => javascript({ typescript: true, jsx: true }),
  ".py": () => python(),
  ".html": () => html(),
  ".htm": () => html(),
  ".svelte": () => html(),
  ".vue": () => html(),
  ".json": () => json(),
  ".md": () => markdown(),
  ".markdown": () => markdown(),
  ".rs": () => rust(),
  ".c": () => cpp(),
  ".cpp": () => cpp(),
  ".cc": () => cpp(),
  ".h": () => cpp(),
  ".hpp": () => cpp(),
  ".java": () => java(),
  ".xml": () => xml(),
  ".svg": () => xml(),
  ".yaml": () => yaml(),
  ".yml": () => yaml(),
  ".css": () => css(),
  ".scss": () => css(),
  ".less": () => css(),
  ".toml": () => yaml(), // close enough
};

export function getLanguageExtension(filename: string): Extension | null {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filename.slice(dot).toLowerCase();
  const factory = extMap[ext];
  return factory ? factory() : null;
}
