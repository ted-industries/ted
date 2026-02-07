import { useCallback } from "react";
import { RiCloseLine } from "@remixicon/react";
import { editorStore, useEditorStore } from "../../store/editor-store";
import "./tabs.css";

export default function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);

  const handleMouseDown = useCallback((e: React.MouseEvent, path: string) => {
    if (e.button === 1) {
      e.preventDefault();
      editorStore.closeTab(path);
    }
  }, []);

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={`tab${isActive ? " tab-active" : ""}`}
            onClick={() => editorStore.setActiveTab(tab.path)}
            onMouseDown={(e) => handleMouseDown(e, tab.path)}
          >
            <span className="tab-label">{tab.name}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                editorStore.closeTab(tab.path);
              }}
            >
              {tab.isDirty ? (
                <span className="tab-dirty" />
              ) : (
                <RiCloseLine size={14} />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
