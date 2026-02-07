"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const features = [
  "syntax highlighting",
  "multiple tabs",
  "file tree explorer",
  "command palette",
  "integrated terminal",
  "git integration",
];

// Simple 2D hash for smooth-ish noise without a full simplex library
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) >>> 0;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Value noise: smooth interpolation between hashed grid values
function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);

  const v00 = (hash(ix, iy) & 0xffff) / 0xffff;
  const v10 = (hash(ix + 1, iy) & 0xffff) / 0xffff;
  const v01 = (hash(ix, iy + 1) & 0xffff) / 0xffff;
  const v11 = (hash(ix + 1, iy + 1) & 0xffff) / 0xffff;

  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

// Layered noise for richer movement
function fbm(x: number, y: number): number {
  return (
    noise(x, y) * 0.6 + noise(x * 2, y * 2) * 0.3 + noise(x * 4, y * 4) * 0.1
  );
}

// Bayer 4x4 threshold matrix for ordered dithering
const bayer4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function AnimatedDither() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const pixelSize = 3;
    const scale = 0.012; // noise zoom
    const speed = 0.0004; // slow drift

    function resize() {
      canvas!.width = Math.ceil(window.innerWidth / pixelSize);
      canvas!.height = Math.ceil(window.innerHeight / pixelSize);
      canvas!.style.width = window.innerWidth + "px";
      canvas!.style.height = window.innerHeight + "px";
    }

    resize();
    window.addEventListener("resize", resize);

    function draw(time: number) {
      const w = canvas!.width;
      const h = canvas!.height;
      const imageData = ctx!.createImageData(w, h);
      const data = imageData.data;
      const t = time * speed;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const n = fbm(x * scale + t, y * scale + t * 0.7);
          const threshold = bayer4[y & 3][x & 3] / 16;
          const on = n > threshold * 0.5 + 0.25;

          const i = (y * w + x) * 4;
          if (on) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 20;
          }
        }
      }

      ctx!.putImageData(imageData, 0, 0);
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function HomePage() {
  return (
    <div className="relative h-[calc(100vh-64px)] w-full bg-black text-white overflow-hidden flex items-center justify-center">
      <AnimatedDither />

      <div className="relative z-10 flex flex-col items-center gap-16 px-6 max-w-2xl">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl font-bold tracking-tight text-white">ted</h1>
          <p className="text-neutral-500 text-sm font-mono">
            a minimal code editor — coming soon
          </p>
        </div>

        <div className="w-full">
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest mb-6 text-center">
            planned features
          </p>
          <div className="grid grid-cols-2 gap-x-12 gap-y-3">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-neutral-700 shrink-0" />
                <span className="text-neutral-400 text-sm font-mono">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/docs"
          className="text-neutral-600 text-xs font-mono hover:text-neutral-400 transition-colors border-b border-neutral-800 hover:border-neutral-600 pb-0.5"
        >
          read the docs →
        </Link>
      </div>
    </div>
  );
}
