import { useState, useCallback, useRef } from "react";
import TapeSpinner from "../spinner/TapeSpinner";
import Explorer from "../explorer/Explorer";
import "./sidebar.css";

const PANELS = ["explorer", "search", "source control", "extensions"];

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState(0);
  const lastScrollTime = useRef(0);

  const handleChange = useCallback((index: number) => {
    setActivePanel(index);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastScrollTime.current < 150) return;

        const delta = e.deltaY || e.deltaX;
        if (Math.abs(delta) > 10) {
          lastScrollTime.current = now;
          if (delta > 0) {
            setActivePanel((prev) => Math.min(PANELS.length - 1, prev + 1));
          } else {
            setActivePanel((prev) => Math.max(0, prev - 1));
          }
        }
      }
    },
    []
  );

  return (
    <div className="sidebar" onWheel={handleWheel}>
      <TapeSpinner
        items={PANELS}
        activeIndex={activePanel}
        onChange={handleChange}
      />
      <div className="sidebar-content">
        {activePanel === 0 && <Explorer />}
        {activePanel === 1 && (
          <div className="sidebar-placeholder">Search</div>
        )}
        {activePanel === 2 && (
          <div className="sidebar-placeholder">Source Control</div>
        )}
        {activePanel === 3 && (
          <div className="sidebar-placeholder">Extensions</div>
        )}
      </div>
    </div>
  );
}
