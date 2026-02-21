import { useState, useCallback, useRef, useEffect } from "react";
import NavTape from "../navigation/NavTape";
import Explorer from "../explorer/Explorer";
import SourceControl from "../source-control/SourceControl";
import SearchPanel from "../search/SearchPanel";
import AgentsPanel from "../agent/AgentsPanel";
import DebugPanel from "../debug/DebugPanel";
import { useEditorStore } from "../../store/editor-store";
import "./sidebar.css";

const PANELS = ["agent", "explorer", "search", "source control", "debug", "extensions"];

export default function Sidebar() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [smoothIndex, setSmoothIndex] = useState(1);
  const uiBlur = useEditorStore((s) => s.settings.uiBlur);
  const lastScrollTime = useRef(0);
  const targetIndexRef = useRef(1);
  const smoothIndexRef = useRef(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation Loop for smooth transitions
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;

      const diff = targetIndexRef.current - smoothIndexRef.current;
      if (Math.abs(diff) > 0.001) {
        smoothIndexRef.current += diff * 0.15; // Same LERP as NavTape
        setSmoothIndex(smoothIndexRef.current);

        if (!isAnimating && uiBlur) setIsAnimating(true);
        if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = setTimeout(() => setIsAnimating(false), 80);
      } else if (Math.abs(diff) > 0) {
        smoothIndexRef.current = targetIndexRef.current;
        setSmoothIndex(smoothIndexRef.current);
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    return () => {
      running = false;
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, [isAnimating]);

  const handleChange = useCallback((index: number) => {
    if (index !== activeIndex) {
      setActiveIndex(index);
      targetIndexRef.current = index;
    }
  }, [activeIndex]);

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
            const next = Math.min(PANELS.length - 1, activeIndex + 1);
            if (next !== activeIndex) handleChange(next);
          } else {
            const prev = Math.max(0, activeIndex - 1);
            if (prev !== activeIndex) handleChange(prev);
          }
        }
      }
    },
    [activeIndex, handleChange]
  );

  return (
    <div className="sidebar" onWheel={handleWheel}>
      <NavTape
        items={PANELS}
        activeIndex={activeIndex}
        smoothIndex={smoothIndex}
        onChange={handleChange}
      />

      <div className="sidebar-content">
        <div
          className={`sidebar-panel-container ${isAnimating ? "is-animating" : ""}`}
          style={{
            transform: `translateX(-${smoothIndex * 100}%)`,
            transition: "none" // We are driving it via smoothIndex
          }}
        >
          <div className="sidebar-panel">
            <AgentsPanel />
          </div>
          <div className="sidebar-panel">
            <Explorer />
          </div>
          <div className="sidebar-panel">
            <SearchPanel />
          </div>
          <div className="sidebar-panel">
            <SourceControl />
          </div>
          <div className="sidebar-panel">
            <DebugPanel />
          </div>
          <div className="sidebar-panel">
            <div className="sidebar-placeholder">Extensions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

