import { useRef, useEffect, useCallback } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap, type ViewUpdate } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { foldGutter, bracketMatching, indentOnInput } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { commentKeymap } from "@codemirror/comment";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { invoke } from "@tauri-apps/api/core";
import { tedDark } from "./theme";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { getLanguageExtension } from "../../utils/languages";
import "../../styles/editor.css";

export default function DiffEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mergeViewRef = useRef<MergeView | null>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeTabPath = useEditorStore((s) => s.activeTabPath);
    const tabs = useEditorStore((s) => s.tabs);
    const settings = useEditorStore((s) => s.settings);

    const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;

    const saveFile = useCallback((path: string, content: string) => {
        const realPath = path.startsWith("diff:") ? path.slice(5) : path;
        invoke("write_file", { path: realPath, content })
            .then(() => {
                editorStore.markTabSaved(path, content);
                // Also update the original tab if it exists
                if (path.startsWith("diff:")) {
                    editorStore.markTabSaved(realPath, content);
                }
            })
            .catch((err) => console.error("Save failed:", err));
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !activeTab || !activeTab.isDiff || activeTab.originalContent === undefined) return;

        if (mergeViewRef.current) {
            // @ts-ignore
            mergeViewRef.current.destroy?.();
        }

        const langExt = getLanguageExtension(activeTab.name.replace("Diff: ", ""));

        const baseExtensions = [
            tedDark,
            EditorView.theme({
                "&": { fontSize: `${settings.fontSize}px` },
            }),
            settings.lineNumbers ? lineNumbers() : [],
            settings.indentGuides ? indentationMarkers({
                colors: {
                    light: "#ffffff10",
                    dark: "#ffffff10",
                    activeLight: "#ffffff20",
                    activeDark: "#ffffff20",
                }
            }) : [],
            highlightActiveLine(),
            highlightActiveLineGutter(),
            bracketMatching(),
            foldGutter(),
            history(),
            indentOnInput(),
            langExt ? langExt : [],
        ];

        const mergeView = new MergeView({
            a: {
                doc: activeTab.originalContent,
                extensions: [
                    ...baseExtensions,
                    EditorView.editable.of(false),
                ],
            },
            b: {
                doc: activeTab.content,
                extensions: [
                    ...baseExtensions,
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
                        ...defaultKeymap,
                        ...searchKeymap,
                        ...historyKeymap,
                        ...commentKeymap,
                        indentWithTab as any,
                    ]),
                    EditorView.updateListener.of((update: ViewUpdate) => {
                        if (update.docChanged) {
                            const content = update.state.doc.toString();
                            editorStore.updateTabContent(activeTab.path, content);

                            if (autoSaveTimerRef.current) {
                                clearTimeout(autoSaveTimerRef.current);
                            }
                            if (settings.autoSave) {
                                autoSaveTimerRef.current = setTimeout(() => {
                                    saveFile(activeTab.path, content);
                                }, 1500);
                            }
                        }
                    }),
                ],
            },
            parent: container,
            orientation: "a-b"
        });

        mergeViewRef.current = mergeView;

        return () => {
            // @ts-ignore
            mergeView.destroy?.();
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [activeTabPath, settings, saveFile]);

    if (!activeTab || !activeTab.isDiff) return null;

    return (
        <div className="editor-root diff-editor-root">
            <div className="editor-container diff-editor-container" ref={containerRef} />
        </div>
    );
}

