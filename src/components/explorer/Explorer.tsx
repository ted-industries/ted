import { useState, useEffect, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiFileTextLine,
  RiFolderAddLine,
} from "@remixicon/react";
import { editorStore, useEditorStore } from "../../store/editor-store";
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
  activePath,
}: {
  entry: FileEntry;
  depth: number;
  onFileClick: (path: string, name: string) => void;
  activePath: string | null;
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

  return (
    <>
      <div
        className={`explorer-item${isActive ? " explorer-item-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={toggle}
      >
        {entry.is_dir ? (
          <span className="explorer-chevron">
            {expanded ? (
              <RiArrowDownSLine size={16} />
            ) : (
              <RiArrowRightSLine size={16} />
            )}
          </span>
        ) : (
          <span className="explorer-chevron explorer-chevron-spacer" />
        )}
        <RiFileTextLine
          size={15}
          className={`explorer-icon${entry.is_dir ? " folder" : " file"}`}
          style={{ display: entry.is_dir ? "none" : undefined }}
        />
        <span className="explorer-item-name">{entry.name}</span>
      </div>
      {expanded &&
        children.map((child) => (
          <FileTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            onFileClick={onFileClick}
            activePath={activePath}
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
        }
      } catch (err) {
        console.error("Failed to list directory:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [explorerPath]);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      editorStore.setExplorerPath(selected as string);
    }
  }, []);

  const handleFileClick = useCallback(async (path: string, name: string) => {
    try {
      const content: string = await invoke("read_file", { path });
      editorStore.openTab(path, name, content);
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  }, []);

  if (!explorerPath) {
    return (
      <div className="explorer">
        <div className="explorer-empty">
          <button className="explorer-open-btn" onClick={handleOpenFolder}>
            <RiFolderAddLine size={16} />
            Open Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explorer">
      <div className="explorer-section-header" onClick={handleOpenFolder}>
        <RiArrowDownSLine size={16} />
        <span>{rootName.toUpperCase()}</span>
      </div>
      <div className="explorer-tree">
        {entries.map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            depth={0}
            onFileClick={handleFileClick}
            activePath={activePath}
          />
        ))}
      </div>
    </div>
  );
}
