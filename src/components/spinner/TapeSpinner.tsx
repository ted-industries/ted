import { useRef, useState, useEffect, useCallback } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { playTick } from "../../utils/tick-sound";
import "./tape-spinner.css";

interface TapeSpinnerProps {
  items: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export default function TapeSpinner({
  items,
  activeIndex,
  onChange,
}: TapeSpinnerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [offset, setOffset] = useState(0);
  const itemWidth = 120;
  const lastTickIndexRef = useRef(activeIndex);
  const animFrameRef = useRef<number>(0);
  const velocityRef = useRef(0);
  const targetOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);

  // Center of an item = index * itemWidth + itemWidth/2
  // We want that to align with viewport center
  // So track translateX = viewportCenter - (index * itemWidth + itemWidth/2)
  const getOffsetForIndex = useCallback(
    (index: number) => {
      const vp = viewportRef.current;
      const viewportCenter = vp ? vp.offsetWidth / 2 : 100;
      return viewportCenter - (index * itemWidth + itemWidth / 2);
    },
    [itemWidth],
  );

  // Initialize position once mounted
  useEffect(() => {
    const off = getOffsetForIndex(activeIndex);
    setOffset(off);
    currentOffsetRef.current = off;
    targetOffsetRef.current = off;
  }, []);

  // When activeIndex changes externally, animate to it
  useEffect(() => {
    targetOffsetRef.current = getOffsetForIndex(activeIndex);
  }, [activeIndex, getOffsetForIndex]);

  const snapToNearest = useCallback(() => {
    const vp = viewportRef.current;
    const viewportCenter = vp ? vp.offsetWidth / 2 : 100;
    // Which index is currently closest to center?
    const rawIndex = Math.round(
      (viewportCenter - currentOffsetRef.current - itemWidth / 2) / itemWidth,
    );
    const clamped = Math.max(0, Math.min(items.length - 1, rawIndex));
    targetOffsetRef.current = getOffsetForIndex(clamped);

    if (clamped !== activeIndex) {
      onChange(clamped);
    }
  }, [items.length, itemWidth, activeIndex, onChange, getOffsetForIndex]);

  const checkTick = useCallback(
    (off: number) => {
      const vp = viewportRef.current;
      const viewportCenter = vp ? vp.offsetWidth / 2 : 100;
      const currentIndex = Math.round(
        (viewportCenter - off - itemWidth / 2) / itemWidth,
      );
      if (currentIndex !== lastTickIndexRef.current) {
        lastTickIndexRef.current = currentIndex;
        playTick();
      }
    },
    [itemWidth],
  );

  // Animation loop
  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      const diff = targetOffsetRef.current - currentOffsetRef.current;
      if (Math.abs(diff) > 0.3) {
        currentOffsetRef.current += diff * 0.15;
        checkTick(currentOffsetRef.current);
        setOffset(currentOffsetRef.current);
      } else if (Math.abs(diff) > 0.01) {
        currentOffsetRef.current = targetOffsetRef.current;
        setOffset(currentOffsetRef.current);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [checkTick]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY || e.deltaX;
      velocityRef.current += delta * 0.6;
      currentOffsetRef.current -= velocityRef.current;
      velocityRef.current *= 0.3;

      // Rubber-band bounds
      const maxOffset = getOffsetForIndex(0);
      const minOffset = getOffsetForIndex(items.length - 1);
      const rubber = 30;
      if (currentOffsetRef.current > maxOffset + rubber) {
        currentOffsetRef.current = maxOffset + rubber;
      } else if (currentOffsetRef.current < minOffset - rubber) {
        currentOffsetRef.current = minOffset - rubber;
      }

      checkTick(currentOffsetRef.current);
      setOffset(currentOffsetRef.current);
      snapToNearest();
    },
    [items.length, getOffsetForIndex, checkTick, snapToNearest],
  );

  const goLeft = useCallback(() => {
    const newIndex = Math.max(0, activeIndex - 1);
    if (newIndex !== activeIndex) {
      onChange(newIndex);
      playTick();
    }
  }, [activeIndex, onChange]);

  const goRight = useCallback(() => {
    const newIndex = Math.min(items.length - 1, activeIndex + 1);
    if (newIndex !== activeIndex) {
      onChange(newIndex);
      playTick();
    }
  }, [activeIndex, items.length, onChange]);

  return (
    <div
      className={`tape-spinner${isHovering ? " tape-spinner-hover" : ""}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button className="tape-chevron tape-chevron-left" onClick={goLeft}>
        <RiArrowLeftSLine size={14} />
      </button>

      <div className="tape-viewport" ref={viewportRef} onWheel={handleWheel}>
        <div className="tape-vignette tape-vignette-left" />
        <div className="tape-vignette tape-vignette-right" />
        <div
          className="tape-track"
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
