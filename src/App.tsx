import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Explorer from "./components/explorer/Explorer";
import TabBar from "./components/tabs/TabBar";
import Editor from "./components/editor/Editor";
import { editorStore, useEditorStore } from "./store/editor-store";
import "./App.css";

function App() {
  const explorerCollapsed = useEditorStore((s) => s.explorerCollapsed);

  const handleOpenFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "All Files", extensions: ["*"] }],
    });
    if (!selected) return;
    const path = selected as string;
    try {
      const content: string = await invoke("read_file", { path });
      const name: string = await invoke("get_basename", { path });
      editorStore.openTab(path, name, content);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      }
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        editorStore.toggleExplorer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile]);

  return (
    <div className="app-layout">
      {!explorerCollapsed && (
        <div className="app-sidebar">
          <Explorer />
        </div>
      )}
      <div className="app-main">
        <TabBar />
        <div className="app-editor">
          <Editor />
        </div>
      </div>
    </div>
  );
}

export default App;
