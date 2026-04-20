export interface FileEntry {
    name: string;
    path: string;
    is_dir: boolean;
}

export interface NodeData {
    id: string;
    name: string;
    group: "dir" | "file" | "agent";
    val: number;
    color?: string;
    x?: number;
    y?: number;
    isThinking?: boolean;
    targetNode?: string;
    depth?: number;
}

export interface LinkData {
    source: string;
    target: string;
    isAgent?: boolean;
}

export interface Trace {
    type: "tool" | "result";
    text: string;
}
