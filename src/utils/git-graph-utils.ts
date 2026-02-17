import { CommitEntry } from "../services/git-service";

export interface GraphNode {
    hash: string;
    lane: number;
    parents: string[];
    index: number; // Row index
}

export interface GraphLink {
    from: { lane: number, index: number };
    to: { lane: number, index: number };
}

/**
 * Calculates lanes for each commit to draw a git graph.
 * This is a simplified version of git graph algorithms.
 */
export function calculateGraph(commits: CommitEntry[]): { nodes: GraphNode[], links: GraphLink[] } {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const hashToNode = new Map<string, GraphNode>();

    // activeLanes[laneIndex] = hash of the commit/parent currently occupying that lane
    const activeLanes: (string | null)[] = [];

    commits.forEach((commit, index) => {
        // Find if this commit is already in a lane
        let lane = activeLanes.indexOf(commit.hash);

        if (lane === -1) {
            // New branch or root, find the first null slot or add new
            lane = activeLanes.indexOf(null);
            if (lane === -1) {
                lane = activeLanes.length;
                activeLanes.push(commit.hash);
            } else {
                activeLanes[lane] = commit.hash;
            }
        }

        const node: GraphNode = {
            hash: commit.hash,
            lane,
            parents: commit.parent_hashes,
            index
        };

        nodes.push(node);
        hashToNode.set(commit.hash, node);

        // This lane is now "consumed" by this commit.
        // We will assign its parents to lanes for the next row.
        activeLanes[lane] = null;

        commit.parent_hashes.forEach((parentHash, pIndex) => {
            // Check if this parent is already assigned a lane in this row 
            // (e.g. from another branch merging into it)
            let parentLane = activeLanes.indexOf(parentHash);

            if (parentLane === -1) {
                // Not assigned yet. Assign it to a lane.
                // For the first parent (primary line), try to keep it in the same lane as the child if possible.
                if (pIndex === 0 && activeLanes[lane] === null) {
                    activeLanes[lane] = parentHash;
                } else {
                    // Find the leftmost available slot
                    const nextFree = activeLanes.indexOf(null);
                    if (nextFree === -1) {
                        activeLanes.push(parentHash);
                    } else {
                        activeLanes[nextFree] = parentHash;
                    }
                }
            }
        });
    });

    // Create links between commits and their parents
    commits.forEach((commit, index) => {
        const node = nodes[index];
        commit.parent_hashes.forEach(parentHash => {
            const parentNode = nodes.find(n => n.hash === parentHash);
            if (parentNode) {
                links.push({
                    from: { lane: node.lane, index: node.index },
                    to: { lane: parentNode.lane, index: parentNode.index }
                });
            } else {
                // Parent not in current batch, draw line straight down
                links.push({
                    from: { lane: node.lane, index: node.index },
                    to: { lane: node.lane, index: index + 1 }
                });
            }
        });
    });

    return { nodes, links };
}
