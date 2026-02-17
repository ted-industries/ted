import { useState, useEffect, useCallback, memo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  RiArrowDownSLine,
  RiFileTextLine,
  RiArrowLeftRightLine,
  RiFolderOpenLine,
  RiGitRepositoryLine,
} from "@remixicon/react";
import { editorStore, useEditorStore } from "../../store/editor-store";
import { gitService } from "../../services/git-service"; // Removed unused FileStatus
import "./explorer.css";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

const FileTreeItem = memo(function FileTreeItem({
  entry,
  depth,
  onFileClick,
  onDiffClick,
  activePath,
  gitStatus,
}: {
  entry: FileEntry;
  depth: number;
  onFileClick: (path: string, name: string) => void;
  onDiffClick: (path: string) => void;
  activePath: string | null;
  gitStatus: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);

  const toggle = async () => {
    if (!entry.is_dir) {
      onFileClick(entry.path, entry.name);
      return;
    }
    if (!expanded) {
      try {
        const items: FileEntry[] = await invoke("list_dir", {
          path: entry.path,
        });
        setChildren(items);
      } catch {
        return;
      }
    }
    setExpanded(!expanded);
  };

  const isActive = entry.path === activePath;
  // Normalize lookup path
  const lookupPath = entry.path.replace(/\\/g, "/").toLowerCase();
  const status = gitStatus[lookupPath];

  return (
    <>
      <div
        className={`explorer-item${isActive ? " explorer-item-active" : ""}${status ? ` git-${status}` : ""
          }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={toggle}
        title={status ? `Git: ${status}` : undefined}
      >
        {/* Indentation Guides */}
        {Array.from({ length: depth }).map((_, i) => (
          <div
            key={i}
            className="explorer-indent-guide"
            style={{ left: `${i * 12 + 18}px` }}
          />
        ))}

        {entry.is_dir ? (
          <span
            className="explorer-chevron"
            style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          >
            <RiArrowDownSLine size={14} />
          </span>
        ) : (
          <span className="explorer-chevron explorer-chevron-spacer" />
        )}
        <RiFileTextLine
          size={14}
          className={`explorer-icon${entry.is_dir ? " folder" : " file"}`}
          style={{ display: entry.is_dir ? "none" : undefined }}
        />
        <span className="explorer-item-name">{entry.name}</span>
        {status === "modified" && !entry.is_dir && (
          <div
            className="git-diff-btn"
            title="Open Diff"
            onClick={(e) => {
              e.stopPropagation();
              onDiffClick(entry.path);
            }}
          >
            <RiArrowLeftRightLine size={12} />
          </div>
        )}
      </div>
      {expanded &&
        children.map((child) => (
          <FileTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            onDiffClick={onDiffClick}
            activePath={activePath}
            gitStatus={gitStatus}
          />
        ))}
    </>
  );
});

export default function Explorer() {
  const explorerPath = useEditorStore((s) => s.explorerPath);
  const activePath = useEditorStore((s) => s.activeTabPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [rootName, setRootName] = useState("");
  const [gitStatus, setGitStatus] = useState<Record<string, string>>({});

  const refreshGitStatus = useCallback(async () => {
    if (!explorerPath) return;
    try {
      const statuses = await gitService.getStatus(explorerPath);
      const statusMap: Record<string, string> = {};

      statuses.forEach((s) => {
        // Normalize storage path
        const normPath = s.path.replace(/\\/g, "/").toLowerCase();
        statusMap[normPath] = s.status;

        // Propagate to parents
        // We need to walk up from normPath to explorerPath (normalized)
        // Note: s.path is absolute. explorerPath is absolute.

        let parentPath = normPath.substring(0, normPath.lastIndexOf("/"));
        const rootPath = explorerPath.replace(/\\/g, "/").toLowerCase();

        while (parentPath.length >= rootPath.length && parentPath.startsWith(rootPath)) {
          if (!statusMap[parentPath]) {
            // For now, mark any parent as 'modified' if a child is changed of any type
            // You could be more specific (e.g. 'new' if all children are new), but 'modified' is standard for folders
            statusMap[parentPath] = "modified";
          }
          const lastSlash = parentPath.lastIndexOf("/");
          if (lastSlash === -1) break;
          parentPath = parentPath.substring(0, lastSlash);
        }
      });
      setGitStatus(statusMap);
    } catch (e) {
      console.error("Failed to refresh git status", e);
    }
  }, [explorerPath]);


  useEffect(() => {
    if (!explorerPath) return;
    let cancelled = false;
    (async () => {
      try {
        const [items, name] = await Promise.all([
          invoke<FileEntry[]>("list_dir", { path: explorerPath }),
          invoke<string>("get_basename", { path: explorerPath }),
        ]);
        if (!cancelled) {
          setEntries(items);
          setRootName(name);
          editorStore.setProjectName(name);
          refreshGitStatus();
        }
      } catch (err) {
        console.error("Failed to list directory:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [explorerPath, refreshGitStatus]);

  // Hook into file saves or focus to refresh git status?
  // For now, let's just refresh on mount/path change.
  // Ideally, we'd have a system event or polling.
  useEffect(() => {
    // Poll ever 5s for now
    if (!explorerPath) return;
    const interval = setInterval(refreshGitStatus, 5000);
    return () => clearInterval(interval);
  }, [explorerPath, refreshGitStatus]);

  const [isCloning, setIsCloning] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const cloneInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      editorStore.setExplorerPath(selected as string);
    }
  }, []);

  const handleCloneStart = useCallback(() => {
    setIsCloning(true);
    setCloneUrl("");
    setTimeout(() => cloneInputRef.current?.focus(), 50);
  }, []);

  const handleCloneCancel = useCallback(() => {
    setIsCloning(false);
    setCloneUrl("");
  }, []);

  const handleCloneSubmit = useCallback(async () => {
    if (!cloneUrl) {
      setIsCloning(false);
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Destination Directory",
    });

    if (selected) {
      try {
        const repoName = cloneUrl.split("/").pop()?.replace(".git", "") || "repository";
        const clonePath = `${selected}${selected.endsWith("/") || selected.endsWith("\\") ? "" : "/"}${repoName}`;

        setIsCloning(false);
        await gitService.clone(cloneUrl, clonePath);
        editorStore.setExplorerPath(clonePath);
      } catch (err) {
        console.error("Failed to clone repository:", err);
        alert(`Failed to clone: ${err}`);
        setIsCloning(false);
      }
    } else {
      setIsCloning(false);
    }
  }, [cloneUrl]);

  const handleFileClick = useCallback(async (path: string, name: string) => {
    try {
      const content: string = await invoke("read_file", { path });
      editorStore.openTab(path, name, content);
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  }, []);

  const handleDiffClick = useCallback((path: string) => {
    editorStore.openDiff(path);
  }, []);

  if (!explorerPath) {
    return (
      <div className="explorer">
        <div className="explorer-empty">
          <div className="explorer-empty-actions">
            {!isCloning ? (
              <>
                <button className="explorer-open-btn" onClick={handleOpenFolder}>
                  <RiFolderOpenLine size={14} />
                  Open Folder
                </button>
                <button className="explorer-open-btn" onClick={handleCloneStart}>
                  <RiGitRepositoryLine size={14} />
                  Clone Repository
                </button>
              </>
            ) : (
              <div className="explorer-clone-input-container">
                <div className="explorer-clone-input-wrapper">
                  <RiGitRepositoryLine size={14} className="clone-icon" />
                  <input
                    ref={cloneInputRef}
                    type="text"
                    className="explorer-clone-input"
                    placeholder="REPO URL..."
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCloneSubmit();
                      if (e.key === "Escape") handleCloneCancel();
                    }}
                    onBlur={() => {
                      if (!cloneUrl) handleCloneCancel();
                    }}
                    spellCheck={false}
                  />
                </div>
                <button className="explorer-back-btn" onClick={handleCloneCancel}>
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="explorer">
      <div className="explorer-section-header" onClick={handleOpenFolder}>
        {/* <RiArrowDownSLine size={16} /> */}
        {/* <RiGitRepositoryLine size={14} style={{ marginRight: 6, opacity: 0.7 }} /> */}
        <span style={{ fontWeight: 600 }}>{rootName.toUpperCase()}</span>
        <span style={{ marginLeft: "auto", opacity: 0.5, fontSize: 10 }}>GIT</span>
      </div>
      <div className="explorer-tree">
        {entries.map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            depth={0}
            onFileClick={handleFileClick}
            onDiffClick={handleDiffClick}
            activePath={activePath}
            gitStatus={gitStatus}
          />
        ))}
      </div>
    </div>
  );
}
