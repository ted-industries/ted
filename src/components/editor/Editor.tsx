import { useRef, useEffect, useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  type ViewUpdate,
} from "@codemirror/view";
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
import { invoke } from "@tauri-apps/api/core";
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react";
import { tedDark } from "./theme";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { getLanguageExtension } from "../../utils/languages";
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

function buildExtensions(
  tabPath: string,
  langExt: Extension | null,
  saveFile: (path: string, content: string) => void,
  autoSaveTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>,
  settings: { fontSize: number; lineNumbers: boolean },
): Extension[] {
  const exts: Extension[] = [
    tedDark,
    EditorView.theme({
      "&": { fontSize: `${settings.fontSize}px` },
    }),
    settings.lineNumbers ? lineNumbers() : [],
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
      {
        key: "Mod-s",
        run: () => {
          const s = editorStore.getState();
          const tab = s.tabs.find((t) => t.path === s.activeTabPath);
          if (tab) saveFile(tab.path, tab.content);
          return true;
        },
      },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        editorStore.updateTabContent(tabPath, content);

        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          saveFile(tabPath, content);
        }, 1500);
      }
    }),
  ];

  if (langExt) {
    exts.unshift(langExt);
  }

  return exts;
}

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const prevPathRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const tabs = useEditorStore((s) => s.tabs);
  const settings = useEditorStore((s) => s.settings);
  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;

  const saveFile = useCallback((path: string, content: string) => {
    invoke("write_file", { path, content })
      .then(() => editorStore.markTabSaved(path, content))
      .catch((err) => console.error("Save failed:", err));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Save view state of previous tab before switching
    if (viewRef.current && prevPathRef.current) {
      const view = viewRef.current;
      const scroller = view.scrollDOM;
      editorStore.saveTabViewState(
        prevPathRef.current,
        scroller.scrollTop,
        scroller.scrollLeft,
        view.state.selection.main.head,
      );
    }

    // Destroy previous editor
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Clear auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    prevPathRef.current = activeTab?.path ?? null;

    if (!activeTab) return;

    const langExt = getLanguageExtension(activeTab.name);
    const extensions = buildExtensions(
      activeTab.path,
      langExt,
      saveFile,
      autoSaveTimerRef,
      settings,
    );

    const state = EditorState.create({
      doc: activeTab.content,
      extensions,
      selection: { anchor: activeTab.cursorPos },
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    // Restore scroll position
    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = activeTab.scrollTop;
      view.scrollDOM.scrollLeft = activeTab.scrollLeft;
    });

    view.focus();

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [activeTabPath, saveFile, settings]);

  const hasActiveTab = activeTab !== null;

  return (
    <div className="editor-root">
      {!hasActiveTab && (
        <div className="editor-welcome">
          <div className="editor-welcome-inner">
            <span className="editor-welcome-key">Ctrl+O</span>
            <span className="editor-welcome-text">Open a file</span>
          </div>
        </div>
      )}
      <div
        className="editor-container"
        ref={containerRef}
        style={{ display: hasActiveTab ? "block" : "none" }}
      />
    </div>
  );
}
