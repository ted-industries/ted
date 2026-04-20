import React, { useState, useRef, useEffect, forwardRef, memo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { NodeData, LinkData } from "../types";

interface Props {
    graphData: { nodes: NodeData[]; links: LinkData[] };
    onNodeClick?: (node: NodeData) => void;
    viewMode: string;
}

export const ForceGraphMap = memo(forwardRef<ForceGraphMethods, Props>(
    ({ graphData, onNodeClick, viewMode }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

        useEffect(() => {
            if (!containerRef.current) return;
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height
                    });
                }
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }, []);

        useEffect(() => {
            const fg = (ref as any)?.current;
            if (!fg) return;

            if (viewMode === "swarms") {
                fg.resumeAnimation();
            } else {
                fg.pauseAnimation();
            }
        }, [viewMode, ref]);

        return (
            <div className="force-graph-container" ref={containerRef}>
                <ForceGraph2D
                    ref={ref as any}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeLabel="name"
                    onNodeClick={onNodeClick as any}
                    nodeCanvasObject={(node: any, ctx: any) => {
                        // Custom Drawing for nodes
                        if (node.group === "agent") {
                            const size = node.isThinking ? 10 : 8;
                            ctx.beginPath();
                            ctx.moveTo(node.x, node.y - size);
                            ctx.lineTo(node.x - size, node.y + size);
                            ctx.lineTo(node.x + size, node.y + size);
                            ctx.fillStyle = node.color || "#ffd700";
                            ctx.fill();

                            if (node.isThinking) {
                                ctx.lineWidth = 1;
                                ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                                ctx.stroke();
                            }
                        } else {
                            const size = node.val || 2;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
                            ctx.fillStyle = node.color ? node.color : (node.group === "dir" ? "rgba(100, 150, 255, 0.8)" : "rgba(200, 200, 200, 0.6)");
                            ctx.fill();
                        }
                    }}
                    linkCanvasObjectMode={() => "after"}
                    linkCanvasObject={(link: any, ctx: any) => {
                        const start = link.source;
                        const end = link.target;
                        if (typeof start !== 'object' || typeof end !== 'object') return;

                        if (link.isAgent) {
                            // Torch Light Effect
                            const grad = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
                            grad.addColorStop(0, "rgba(255, 215, 0, 0.5)");
                            grad.addColorStop(1, "rgba(255, 215, 0, 0.0)");

                            ctx.beginPath();
                            ctx.moveTo(start.x, start.y);
                            ctx.lineTo(end.x, end.y);
                            ctx.lineWidth = 12;
                            ctx.strokeStyle = grad;
                            ctx.lineCap = "round";
                            ctx.stroke();

                            // Core beam
                            ctx.beginPath();
                            ctx.moveTo(start.x, start.y);
                            ctx.lineTo(end.x, end.y);
                            ctx.lineWidth = 1;
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                            ctx.stroke();
                        } else {
                            ctx.beginPath();
                            ctx.moveTo(start.x, start.y);
                            ctx.lineTo(end.x, end.y);
                            ctx.lineWidth = 1;
                            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
                            ctx.stroke();
                        }
                    }}
                    linkDirectionalParticles={(link: any) => link.isAgent ? 4 : 0}
                    linkDirectionalParticleSpeed={0.015}
                    backgroundColor="transparent"
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.4}
                    cooldownTicks={100}
                />
            </div>
        );
    }
));

