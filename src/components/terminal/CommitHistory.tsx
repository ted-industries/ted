import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { useEditorStore } from "../../store/editor-store";
import { gitService, CommitEntry, CommitDetails } from "../../services/git-service";
import { calculateGraph, GraphNode, GraphLink } from "../../utils/git-graph-utils";
import "./CommitHistory.css";

const LANE_WIDTH = 8;
const NODE_RADIUS = 3;
const GRAPH_PADDING_LEFT = 10;

const LANE_COLORS = [
    "#58A6FF", // Blue
    "#8957E5", // Purple
    "#D29922", // Orange
    "#3FB950", // Green
    "#F85149", // Red
    "#BC8CFF", // Light Purple
    "#1F6FEB", // Dark Blue
];

interface RowPosition {
    hash: string;
    y: number;
    height: number;
}

function GitGraph({ nodes, links, rowPositions }: { nodes: GraphNode[], links: GraphLink[], rowPositions: Map<string, RowPosition> }) {
    const maxLane = useMemo(() => Math.max(0, ...nodes.map(n => n.lane)), [nodes]);
    const width = (maxLane + 1) * LANE_WIDTH + GRAPH_PADDING_LEFT + 5;

    // We need the total height from the last row
    const totalHeight = useMemo(() => {
        if (nodes.length === 0) return 0;
        const lastHash = nodes[nodes.length - 1].hash;
        const lastPos = rowPositions.get(lastHash);
        return lastPos ? lastPos.y + lastPos.height : 0;
    }, [nodes, rowPositions]);

    return (
        <svg width={width} height={totalHeight} className="ch-graph">
            {links.map((link, i) => {
                const fromNode = nodes[link.from.index];
                const toNode = nodes[link.to.index];

                if (!fromNode || !toNode) return null;

                const fromPos = rowPositions.get(fromNode.hash);
                const toPos = rowPositions.get(toNode.hash);

                if (!fromPos || !toPos) return null;

                const x1 = link.from.lane * LANE_WIDTH + GRAPH_PADDING_LEFT;
                const y1 = fromPos.y + fromPos.height / 2;
                const x2 = link.to.lane * LANE_WIDTH + GRAPH_PADDING_LEFT;
                const y2 = toPos.y + toPos.height / 2;
                const color = LANE_COLORS[link.from.lane % LANE_COLORS.length];

                // Orthogonal path: Vertical from child to parent's row, then Horizontal to parent's lane
                const path = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;

                return (
                    <path
                        key={`link-${i}`}
                        d={path}
                        stroke={color}
                        fill="none"
                        className="ch-graph-link"
                    />
                );
            })}
            {nodes.map((node) => {
                const pos = rowPositions.get(node.hash);
                if (!pos) return null;

                const color = LANE_COLORS[node.lane % LANE_COLORS.length];

                return (
                    <circle
                        key={`node-${node.hash}`}
                        cx={node.lane * LANE_WIDTH + GRAPH_PADDING_LEFT}
                        cy={pos.y + pos.height / 2}
                        r={NODE_RADIUS}
                        fill={color}
                        className="ch-graph-node"
                    />
                );
            })}
        </svg>
    );
}

function CommitDetailPopup({ commit, position, details }: { commit: CommitEntry, position: { x: number, y: number }, details?: CommitDetails }) {
    const dateObj = new Date(parseInt(commit.date) * 1000);
    const fullDate = dateObj.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    });

    return (
        <div className="ch-popup" style={{ left: position.x, top: position.y }}>
            <div className="ch-popup-header">
                <span className="ch-popup-author">{commit.author}</span>
                <span className="ch-popup-date">{fullDate}</span>
            </div>

            <div className="ch-popup-message">{commit.message}</div>

            {details && (
                <div className="ch-popup-stats">
                    {details.files_changed} files changed, {details.insertions}(+) {details.deletions}(-)
                </div>
            )}

            <div className="ch-popup-footer">
                <span className="ch-popup-hash">{commit.hash.slice(0, 8)}</span>
            </div>
        </div>
    );
}

export default function CommitHistory() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const [commits, setCommits] = useState<CommitEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [rowPositions, setRowPositions] = useState<Map<string, RowPosition>>(new Map());
    const [hoveredCommit, setHoveredCommit] = useState<CommitEntry | null>(null);
    const [commitDetails, setCommitDetails] = useState<Map<string, CommitDetails>>(new Map());
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const loadHistory = useCallback(async () => {
        if (!explorerPath) return;
        setIsLoading(true);
        try {
            const history = await gitService.getLog(explorerPath, 100);
            setCommits(history);
        } catch (e) {
            console.error("Failed to load history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [explorerPath]);

    const graphData = useMemo(() => calculateGraph(commits), [commits]);
    const maxLane = useMemo(() => Math.max(0, ...graphData.nodes.map(n => n.lane)), [graphData]);

    useLayoutEffect(() => {
        if (!listRef.current) return;

        const updatePositions = () => {
            const newPositions = new Map<string, RowPosition>();
            const items = listRef.current?.querySelectorAll('.ch-item');
            const containerTop = listRef.current?.getBoundingClientRect().top || 0;

            items?.forEach((item) => {
                const hash = item.getAttribute('data-hash');
                if (hash) {
                    const rect = item.getBoundingClientRect();
                    newPositions.set(hash, {
                        hash,
                        y: rect.top - containerTop,
                        height: rect.height
                    });
                }
            });
            setRowPositions(newPositions);
        };

        updatePositions();

        // Also update on resize
        const observer = new ResizeObserver(updatePositions);
        observer.observe(listRef.current);
        return () => observer.disconnect();
    }, [commits, graphData]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseMove = (e: React.MouseEvent, commit: CommitEntry) => {
        // Track position instantly
        const newX = Math.min(window.innerWidth - 300, e.clientX + 10);
        const newY = Math.max(10, e.clientY - 120);
        setPopupPos({ x: newX, y: newY });

        // If the popup is already visible for this commit, just stay visible and track position
        if (hoveredCommit?.hash === commit.hash) return;

        // Otherwise, restart the debounce timer. 
        // This ensures the popup only appears if the mouse STOPS moving for 400ms.
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredCommit(commit);
            if (!commitDetails.has(commit.hash) && explorerPath) {
                gitService.getCommitDetails(explorerPath, commit.hash)
                    .then(details => setCommitDetails(prev => new Map(prev).set(commit.hash, details)))
                    .catch(e => console.error("Failed to fetch commit details:", e));
            }
        }, 400);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setHoveredCommit(null);
    };

    if (!explorerPath) return <div className="ch-empty">Open a folder to see history.</div>;

    const gutterWidth = (maxLane + 1) * LANE_WIDTH + GRAPH_PADDING_LEFT + 10;

    return (
        <div className="commit-history" ref={containerRef}>
            {isLoading && commits.length === 0 ? (
                <div className="ch-loading">Loading history...</div>
            ) : commits.length === 0 ? (
                <div className="ch-empty">No commits found.</div>
            ) : (
                <div className="ch-main-container">
                    <div className="ch-graph-container">
                        <GitGraph nodes={graphData.nodes} links={graphData.links} rowPositions={rowPositions} />
                    </div>
                    <div className="ch-list" ref={listRef}>
                        {commits.map((commit) => (
                            <div
                                key={commit.hash}
                                className="ch-item"
                                data-hash={commit.hash}
                                style={{ paddingLeft: `${gutterWidth}px` }}
                                onMouseMove={(e) => handleMouseMove(e, commit)}
                                onMouseLeave={handleMouseLeave}
                            >
                                <div className="ch-item-left">
                                    <span className="ch-hash">{commit.hash.slice(0, 7)}</span>
                                </div>
                                <div className="ch-item-main">
                                    <span className="ch-message">{commit.message}</span>
                                </div>
                                <div className="ch-item-right">
                                    <span className="ch-author">{commit.author.split(' ')[0]}</span>
                                    <span className="ch-date">{commit.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {hoveredCommit && (
                <CommitDetailPopup
                    commit={hoveredCommit}
                    position={popupPos}
                    details={commitDetails.get(hoveredCommit.hash)}
                />
            )}
        </div>
    );
}
