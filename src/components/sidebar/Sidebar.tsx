import { useState, useCallback } from "react";
import TapeSpinner from "../spinner/TapeSpinner";
import Explorer from "../explorer/Explorer";
import "./sidebar.css";

const PANELS = ["explorer", "search", "source control", "extensions"];

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState(0);

  const handleChange = useCallback((index: number) => {
    setActivePanel(index);
  }, []);

  return (
    <div className="sidebar">
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
