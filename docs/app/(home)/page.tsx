"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const taskGroups = [
  {
    title: "core",
    tasks: [
      { name: "tree-sitter syntax highlighting", done: true },
      { name: "multi-pane buffer management", done: true },
      { name: "semantic theming system", done: true },
      { name: "high-density file tree (20px)", done: true },
      { name: "telemetry & behavior tracking", done: true },
      { name: "detached window support", done: false },
    ],
  },
  {
    title: "git",
    tasks: [
      { name: "visual commit graph & history", done: true },
      { name: "line-level blame (ghost text)", done: true },
      { name: "integrated status & management", done: true },
      { name: "asynchronous git providers", done: true },
      { name: "inline diff visualization", done: false },
      { name: "remote sync (push/pull)", done: false },
    ],
  },
  {
    title: "agent",
    tasks: [
      { name: "tool-calling execution loop", done: true },
      { name: "action trace observability", done: true },
      { name: "file-system tools (read/write)", done: true },
      { name: "multi-file planning", done: false },
      { name: "semantic search (rag)", done: false },
    ],
  },
  {
    title: "planned",
    tasks: [
      { name: "semantic search & code graph", done: false },
      { name: "sandboxed execution environment", done: false },
      { name: "multi-file planning loops", done: false },
      { name: "plugin system (wasm/ipc)", done: false },
      { name: "remote development (ssh)", done: false },
      { name: "lsp stability & performance", done: false },
    ],
  },
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
  const [activeGroup, setActiveGroup] = useState<string | null>(taskGroups[0].title);

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full bg-black text-white overflow-hidden py-12 md:py-22 flex items-center justify-center">
      <AnimatedDither />

      <div className="relative z-10 flex flex-col items-center gap-12 md:gap-20 px-6 max-w-5xl w-full">
        {/* Hero Section */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-6xl font-bold tracking-tighter text-white">ted</h1>
          <p className="text-neutral-400 text-sm font-mono tracking-wide">
            minimal code editor for agents
          </p>
        </div>

        {/* Explorable Task Explorer */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 border border-neutral-900 bg-black/50 backdrop-blur-sm min-h-[400px]">
          {/* Sidebar / Categories */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-neutral-900 p-6 flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-4">
                project segments
              </span>
              {taskGroups.map((group) => {
                const completed = group.tasks.filter((t) => t.done).length;
                const total = group.tasks.length;
                const isActive = activeGroup === group.title;

                return (
                  <button
                    key={group.title}
                    onClick={() => setActiveGroup(group.title)}
                    className={`group flex items-center justify-between py-2 text-left transition-all ${isActive ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-1 rounded-full ${isActive ? "bg-white" : "bg-neutral-800"}`} />
                      <span className="text-sm font-mono lowercase tracking-tight">
                        {group.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono opacity-40">
                      {completed}/{total}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-6 border-t border-neutral-900/50">
              <Link
                href="/docs"
                className="text-[11px] font-mono text-neutral-500 hover:text-white transition-colors flex items-center gap-2 group"
              >
                read documentation
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </div>

          {/* Task Detail Pane */}
          <div className="md:col-span-8 p-8 md:p-12 flex flex-col gap-8 bg-neutral-950/30">
            {activeGroup && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex flex-col gap-1.5 mb-8">
                  <h2 className="text-xl font-bold tracking-tight">
                    {activeGroup}
                  </h2>
                  <div className="w-12 h-0.5 bg-neutral-800" />
                </div>

                <div className="grid grid-cols-1 gap-y-4">
                  {taskGroups
                    .find((g) => g.title === activeGroup)
                    ?.tasks.map((task) => (
                      <div key={task.name} className="flex items-start gap-4 group">
                        <div
                          className={`mt-1 w-4 h-4 border border-neutral-800 flex items-center justify-center shrink-0 transition-colors ${task.done ? "bg-neutral-900 border-neutral-700" : "bg-transparent group-hover:border-neutral-600"
                            }`}
                        >
                          {task.done && (
                            <div className="w-1.5 h-1.5 bg-neutral-300" />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`text-sm font-mono leading-tight ${task.done ? "text-neutral-200" : "text-neutral-500"
                              }`}
                          >
                            {task.name}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/docs"
          className="text-neutral-500 text-xs font-mono hover:text-white transition-colors border-b border-neutral-800 hover:border-neutral-500 pb-1 mt-8"
        >
          v0.4.0-alpha
        </Link>
      </div>
    </div>
  );
}
