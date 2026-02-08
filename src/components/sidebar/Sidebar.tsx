import { useState, useCallback, useRef, useEffect } from "react";
import NavTape from "../navigation/NavTape";
import Explorer from "../explorer/Explorer";
import SourceControl from "../source-control/SourceControl";
import "./sidebar.css";

const PANELS = ["explorer", "search", "source control", "extensions"];

export default function Sidebar() {
  const [activePanel, setActivePanel] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const lastScrollTime = useRef(0);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 350); // Matches CSS transition duration
  }, []);

  const handleChange = useCallback((index: number) => {
    if (index !== activePanel) {
      startAnimation();
      setActivePanel(index);
    }
  }, [activePanel, startAnimation]);

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
            const next = Math.min(PANELS.length - 1, activePanel + 1);
            if (next !== activePanel) {
              startAnimation();
              setActivePanel(next);
            }
          } else {
            const prev = Math.max(0, activePanel - 1);
            if (prev !== activePanel) {
              startAnimation();
              setActivePanel(prev);
            }
          }
        }
      }
    },
    [activePanel, startAnimation]
  );

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  return (
    <div className="sidebar" onWheel={handleWheel}>
      <NavTape
        items={PANELS}
        activeIndex={activePanel}
        onChange={handleChange}
      />

      <div className="sidebar-content">
        <div
          className={`sidebar-panel-container ${isAnimating ? "is-animating" : ""}`}
          style={{ transform: `translateX(-${activePanel * 100}%)` }}
        >
          <div className="sidebar-panel">
            <Explorer />
          </div>
          <div className="sidebar-panel">
            <div className="sidebar-placeholder">Search</div>
          </div>
          <div className="sidebar-panel">
            <SourceControl />
          </div>
          <div className="sidebar-panel">
            <div className="sidebar-placeholder">Extensions</div>
          </div>
        </div>
      </div>
    </div>
  );
}
