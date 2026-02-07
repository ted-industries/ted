import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Sidebar from "./components/sidebar/Sidebar";
import TabBar from "./components/tabs/TabBar";
import Editor from "./components/editor/Editor";
import SoundLab from "./components/SoundLab";
import { editorStore, useEditorStore } from "./store/editor-store";
import "./App.css";

function App() {
  const explorerCollapsed = useEditorStore((s) => s.explorerCollapsed);
  const [showSoundLab, setShowSoundLab] = useState(false);

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
      if (e.ctrlKey && e.shiftKey && e.key === "U") {
        e.preventDefault();
        setShowSoundLab((v) => !v);
      }
      if (e.key === "Escape") {
        setShowSoundLab(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile]);

  return (
    <div className="app-layout">
      {!explorerCollapsed && (
        <div className="app-sidebar">
          <Sidebar />
        </div>
      )}
      <div className="app-main">
        <TabBar />
        <div className="app-editor">
          <Editor />
        </div>
      </div>
      {showSoundLab && <SoundLab onClose={() => setShowSoundLab(false)} />}
    </div>
  );
}

export default App;
