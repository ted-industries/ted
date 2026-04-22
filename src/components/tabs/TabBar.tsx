import { useCallback } from "react";
import { RiCloseLine } from "@remixicon/react";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { useExtensionHost } from "../../services/extensions/extension-host";
import "./tabs.css";

export default function TabBar() {

  // Find active tab without listening to the entire tabs array
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const tabsInfo = useEditorStore((s) => s.tabs.map(t => ({ 
    path: t.path, 
    name: t.name, 
    isDirty: t.isDirty,
    type: t.type 
  })), (old, next) => JSON.stringify(old) === JSON.stringify(next));
  
  const getIcon = useExtensionHost((s) => s.getFileIconProvider());

  const handleMouseDown = useCallback((e: React.MouseEvent, path: string) => {
    if (e.button === 1) {
      e.preventDefault();
      editorStore.closeTab(path);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div className="tab-bar" onWheel={handleWheel}>
      {tabsInfo.map((tab) => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={`tab${isActive ? " tab-active" : ""}`}
            onClick={() => editorStore.setActiveTab(tab.path)}
            onMouseDown={(e) => handleMouseDown(e, tab.path)}
          >
            {(() => {
              const customHtml = getIcon ? getIcon(tab.path, false, false) : undefined;
              if (customHtml) {
                return (
                  <span
                    className="tab-icon"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 6,
                      width: 16,
                      height: 16,
                      flexShrink: 0
                    }}
                    dangerouslySetInnerHTML={{ __html: customHtml }}
                  />
                );
              }
              return null;
            })()}
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
      <div className="tab-spacer" />
    </div>
  );
}
