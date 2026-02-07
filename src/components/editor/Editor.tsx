import { useRef, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
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
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react";
import { tedDark } from "./theme";
import "../../styles/editor.css";

const chevronDownSvg = renderToStaticMarkup(
  createElement(RiArrowDownSLine, { size: 16 }),
);
const chevronRightSvg = renderToStaticMarkup(
  createElement(RiArrowRightSLine, { size: 16 }),
);

function makeFoldMarker(open: boolean) {
  const el = document.createElement("span");
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:16px;height:16px;color:#858585;";
  el.innerHTML = open ? chevronDownSvg : chevronRightSvg;
  return el;
}

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: `import Editor from "./components/editor/Editor";
import "./App.css";

function App() {
  return <Editor />;
}

export default App;
`,
      extensions: [
        javascript({ typescript: true, jsx: true }),
        tedDark,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        foldGutter({
          openText: "\u00A0",
          closedText: "\u00A0",
          markerDOM(open) {
            return makeFoldMarker(open);
          },
        }),
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
