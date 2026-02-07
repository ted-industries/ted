import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from "@codemirror/view";
import { css } from "@codemirror/lang-css";
import {
  foldGutter,
  foldKeymap,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { tedDark } from "./theme";

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: `.editor-wrapper {
    height: 100vh;
    width: 100vw;
    padding: 8px;
    box-sizing: border-box;
    background-color: #111111;
}

.editor-wrapper .cm-editor {
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
}

.cm-editor.cm-focused {
    outline: none;
}

.cm-scroller {`,
      extensions: [
        css(),
        tedDark,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        bracketMatching(),
        foldGutter(),
        history(),
        indentOnInput(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  return <div className="editor-wrapper" ref={containerRef} />;
}
