import { useEffect, useCallback, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Sidebar from "./components/sidebar/Sidebar";
import TabBar from "./components/tabs/TabBar";
import Editor from "./components/editor/Editor";
import { editorStore, useEditorStore } from "./store/editor-store";
import "./App.css";

function App() {
  const explorerCollapsed = useEditorStore((s) => s.explorerCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isDraggingRef = useRef(false);

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

  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const newWidth = Math.max(180, Math.min(500, e.clientX));
    setSidebarWidth(newWidth);
  }, []);

  useEffect(() => {
    window.addEventListener("mousedown", (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList?.contains("app-resize-handle")) {
        handleMouseDown();
      }
    });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseDown, handleMouseUp, handleMouseMove]);

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
        <>
          <div className="app-sidebar" style={{ width: `${sidebarWidth}px` }}>
            <Sidebar />
          </div>
          <div className="app-resize-handle" />
        </>
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
