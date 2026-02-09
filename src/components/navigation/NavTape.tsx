import { useRef, useState, useEffect, useCallback } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { playTick } from "../../utils/tick-sound";
import { useEditorStore } from "../../store/editor-store";
import "./NavTape.css";

interface NavTapeProps {
  items: string[];
  activeIndex: number;
  smoothIndex?: number;
  onChange: (index: number) => void;
}

export default function NavTape({
  items,
  activeIndex,
  smoothIndex = activeIndex,
  onChange,
}: NavTapeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [offset, setOffset] = useState(0);
  const volume = useEditorStore((s) => s.settings.volume);
  const itemWidth = 120;
  const lastTickIndexRef = useRef(activeIndex);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOffsetForIndex = useCallback(
    (index: number) => {
      const vp = viewportRef.current;
      const viewportCenter = vp ? vp.offsetWidth / 2 : 100;
      return viewportCenter - (index * itemWidth + itemWidth / 2);
    },
    [itemWidth],
  );

  // Sync offset from smoothIndex (provided by Sidebar)
  useEffect(() => {
    const off = getOffsetForIndex(smoothIndex);
    setOffset(off);

    // Tick sound based on smoothIndex crossings
    const currentIndex = Math.round(smoothIndex);
    if (currentIndex !== lastTickIndexRef.current) {
      lastTickIndexRef.current = currentIndex;
      playTick(volume);
    }
  }, [smoothIndex, getOffsetForIndex, volume]);

  // Mark spinning
  const markSpinning = useCallback(() => {
    setIsSpinning(true);
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = setTimeout(() => {
      setIsSpinning(false);
    }, 600);
  }, []);

  // Handle resize to keep centered
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const observer = new ResizeObserver(() => {
      setOffset(getOffsetForIndex(smoothIndex));
    });

    observer.observe(vp);
    return () => observer.disconnect();
  }, [smoothIndex, getOffsetForIndex]);

  const lastScrollTime = useRef(0);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastScrollTime.current < 150) return;

      const delta = e.deltaY || e.deltaX;
      if (Math.abs(delta) < 10) return;

      lastScrollTime.current = now;
      markSpinning();

      if (delta > 0) {
        const newIndex = Math.min(items.length - 1, activeIndex + 1);
        if (newIndex !== activeIndex) {
          onChange(newIndex);
          playTick(volume);
        }
      } else {
        const newIndex = Math.max(0, activeIndex - 1);
        if (newIndex !== activeIndex) {
          onChange(newIndex);
          playTick(volume);
        }
      }
    },
    [items.length, activeIndex, onChange, markSpinning, volume],
  );

  // Attach wheel listener natively with { passive: false } so preventDefault works
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const goLeft = useCallback(() => {
    const newIndex = Math.max(0, activeIndex - 1);
    if (newIndex !== activeIndex) {
      markSpinning();
      onChange(newIndex);
      playTick(volume);
    }
  }, [activeIndex, onChange, markSpinning, volume]);

  const goRight = useCallback(() => {
    const newIndex = Math.min(items.length - 1, activeIndex + 1);
    if (newIndex !== activeIndex) {
      markSpinning();
      onChange(newIndex);
      playTick(volume);
    }
  }, [activeIndex, items.length, onChange, markSpinning, volume]);

  const active = isSpinning || isHovering;

  return (
    <div
      className={`nav-tape${active ? " nav-tape-active" : ""}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button className="tape-chevron tape-chevron-left" onClick={goLeft}>
        <RiArrowLeftSLine size={14} />
      </button>

      <div className="tape-viewport" ref={viewportRef}>
        <div className="tape-vignette tape-vignette-left" />
        <div className="tape-vignette tape-vignette-right" />

        <div className={`tape-resting${active ? " tape-resting-hidden" : ""}`}>
          {items[activeIndex].toUpperCase()}
        </div>

        <div
          className={`tape-track${active ? " tape-track-visible" : ""}`}
          style={{ transform: `translateX(${offset}px)` }}
        >
          {items.map((item, i) => (
            <div
              key={item}
              className={`tape-item${i === activeIndex ? " tape-item-active" : ""}`}
              style={{ width: `${itemWidth}px` }}
            >
              {item.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      <button className="tape-chevron tape-chevron-right" onClick={goRight}>
        <RiArrowRightSLine size={14} />
      </button>
    </div>
  );
}
