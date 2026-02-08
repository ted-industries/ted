import { useRef, useEffect } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { MergeView } from "@codemirror/merge";
import { foldGutter, bracketMatching, indentOnInput } from "@codemirror/language";
import { history } from "@codemirror/commands";
import { tedDark } from "./theme";
import { useEditorStore } from "../../store/editor-store";
import { getLanguageExtension } from "../../utils/languages";
import "../../styles/editor.css";

export default function DiffEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mergeViewRef = useRef<MergeView | null>(null);
    const activeTabPath = useEditorStore((s) => s.activeTabPath);
    const tabs = useEditorStore((s) => s.tabs);
    const settings = useEditorStore((s) => s.settings);

    const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !activeTab || !activeTab.isDiff || activeTab.originalContent === undefined) return;

        if (mergeViewRef.current) {
            // @ts-ignore
            mergeViewRef.current.destroy?.();
        }

        const langExt = getLanguageExtension(activeTab.name);

        const commonExtensions = [
            tedDark,
            EditorView.theme({
                "&": { fontSize: `${settings.fontSize}px` },
            }),
            settings.lineNumbers ? lineNumbers() : [],
            highlightActiveLine(),
            highlightActiveLineGutter(),
            bracketMatching(),
            foldGutter(),
            history(),
            indentOnInput(),
            langExt ? langExt : [],
            EditorView.editable.of(false), // Diff view is usually read-only
        ];

        const mergeView = new MergeView({
            a: {
                doc: activeTab.originalContent,
                extensions: commonExtensions,
            },
            b: {
                doc: activeTab.content,
                extensions: commonExtensions,
            },
            parent: container,
            orientation: "a-b"
        });

        mergeViewRef.current = mergeView;

        return () => {
            // @ts-ignore
            mergeView.destroy?.();
        };
    }, [activeTab, settings]);

    if (!activeTab || !activeTab.isDiff) return null;

    return (
        <div className="editor-root diff-editor-root">
            <div className="editor-container diff-editor-container" ref={containerRef} />
        </div>
    );
}
