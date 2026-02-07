import MonacoEditor, { type BeforeMount } from "@monaco-editor/react";
import { THEME_NAME, tedDarkTheme } from "./theme";
import "../../styles/editor.css";

const handleBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(THEME_NAME, tedDarkTheme);
};

export default function Editor() {
  return (
    <div className="editor-wrapper">
      <MonacoEditor
        defaultLanguage="typescript"
        defaultValue="// Welcome to ted"
        theme={THEME_NAME}
        beforeMount={handleBeforeMount}
        options={{
          fontSize: 14,
          lineHeight: 24,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          fontLigatures: true,
          padding: { top: 16, bottom: 16 },
          minimap: { enabled: false },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
          lineNumbersMinChars: 4,
          glyphMargin: false,
          folding: true,
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          overviewRulerLanes: 0,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
