import { useState, useRef, useEffect, forwardRef } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { NodeData, LinkData } from "../types";

interface Props {
    graphData: { nodes: NodeData[]; links: LinkData[] };
}

export const ForceGraphMap = forwardRef<ForceGraphMethods, Props>(
    ({ graphData }, ref) => {
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

        return (
            <div className="force-graph-container" ref={containerRef}>
                <ForceGraph2D
                    ref={ref as any}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeLabel="name"
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
                    linkColor={(link: any) => link.isAgent ? "rgba(255, 215, 0, 0.5)" : "rgba(255, 255, 255, 0.1)"}
                    linkWidth={(link: any) => link.isAgent ? 2 : 1}
                    linkDirectionalParticles={(link: any) => link.isAgent ? 4 : 0}
                    linkDirectionalParticleSpeed={0.01}
                    backgroundColor="transparent"
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.4}
                    cooldownTicks={100}
                />
            </div>
        );
    }
);
