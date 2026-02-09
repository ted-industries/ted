import { useState, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore, editorStore } from "../../store/editor-store";
import "./SearchPanel.css";

interface SearchResult {
    path: string;
    line_number: number;
    column: number;
    line_text: string;
    match_text: string;
}

interface FileGroup {
    path: string;
    name: string;
    matches: SearchResult[];
}

export default function SearchPanel() {
    const explorerPath = useEditorStore((s) => s.explorerPath);
    const [query, setQuery] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showReplace, setShowReplace] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [searching, setSearching] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queryRef = useRef("");

    const doSearch = useCallback(async (q: string) => {
        if (!explorerPath || !q.trim()) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const res: SearchResult[] = await invoke("ripgrep_search", {
                query: q,
                cwd: explorerPath,
                caseSensitive,
                regex: useRegex,
                maxResults: 500,
            });
            // Only update if query hasn't changed during the search
            if (queryRef.current === q) {
                setResults(res);
            }
        } catch (e) {
            console.error("[Search] rg error:", e);
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, [explorerPath, caseSensitive, useRegex]);

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        queryRef.current = value;
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!value.trim()) {
            setResults([]);
            return;
        }
        // Debounce: 200ms — tight enough to feel instant
        searchTimer.current = setTimeout(() => doSearch(value), 200);
    }, [doSearch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (searchTimer.current) clearTimeout(searchTimer.current);
            doSearch(query);
        }
    }, [doSearch, query]);

    // Group results by file
    const groups: FileGroup[] = useMemo(() => {
        const map = new Map<string, FileGroup>();
        for (const r of results) {
            let g = map.get(r.path);
            if (!g) {
                const name = r.path.split(/[\\/]/).pop() || r.path;
                g = { path: r.path, name, matches: [] };
                map.set(r.path, g);
            }
            g.matches.push(r);
        }
        return Array.from(map.values());
    }, [results]);

    const openMatch = useCallback(async (result: SearchResult) => {
        try {
            const content: string = await invoke("read_file", { path: result.path });
            const name: string = await invoke("get_basename", { path: result.path });
            editorStore.openTab(result.path, name, content);
            // TODO: scroll to line once editor supports it
        } catch (e) {
            console.error("[Search] Failed to open file:", e);
        }
    }, []);

    const handleReplaceInFile = useCallback(async (filePath: string) => {
        if (!query.trim()) return;
        try {
            await invoke("search_replace", {
                filePath,
                search: query,
                replace: replaceText,
                all: true,
            });
            // Re-search to update
            doSearch(query);
        } catch (e) {
            console.error("[Search] Replace failed:", e);
        }
    }, [query, replaceText, doSearch]);

    const handleReplaceAll = useCallback(async () => {
        if (!query.trim()) return;
        for (const g of groups) {
            try {
                await invoke("search_replace", {
                    filePath: g.path,
                    search: query,
                    replace: replaceText,
                    all: true,
                });
            } catch (e) {
                console.error("[Search] Replace failed:", g.path, e);
            }
        }
        doSearch(query);
    }, [query, replaceText, groups, doSearch]);

    const toggleFile = useCallback((path: string) => {
        setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }));
    }, []);

    // Render highlighted line text
    const renderLine = useCallback((lineText: string, matchText: string) => {
        if (!matchText) return <span className="search-line-text">{lineText}</span>;
        const idx = lineText.indexOf(matchText);
        if (idx === -1) return <span className="search-line-text">{lineText}</span>;
        return (
            <span className="search-line-text">
                {lineText.slice(0, idx)}
                <span className="search-highlight">{matchText}</span>
                {lineText.slice(idx + matchText.length)}
            </span>
        );
    }, []);

    if (!explorerPath) {
        return <div className="search-panel"><div className="search-empty">open a folder</div></div>;
    }

    return (
        <div className="search-panel">
            <div className="search-inputs">
                <div className="search-row">
                    <input
                        className="search-field"
                        placeholder="search"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                    />
                    <button
                        className={`search-toggle${caseSensitive ? " active" : ""}`}
                        onClick={() => { setCaseSensitive(!caseSensitive); if (query) doSearch(query); }}
                        title="Case Sensitive"
                    >Aa</button>
                    <button
                        className={`search-toggle${useRegex ? " active" : ""}`}
                        onClick={() => { setUseRegex(!useRegex); if (query) doSearch(query); }}
                        title="Regex"
                    >.*</button>
                    <button
                        className="search-toggle"
                        onClick={() => setShowReplace(!showReplace)}
                        title="Toggle Replace"
                    >{showReplace ? "−" : "+"}</button>
                </div>
                {showReplace && (
                    <div className="search-row">
                        <input
                            className="search-field"
                            placeholder="replace"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            spellCheck={false}
                        />
                        <button
                            className="search-action"
                            onClick={handleReplaceAll}
                            title="Replace All"
                        >⟳</button>
                    </div>
                )}
            </div>

            {results.length > 0 && (
                <div className="search-stats">
                    {results.length} results in {groups.length} files
                    {searching && " …"}
                </div>
            )}

            {results.length === 0 && query.trim() && !searching ? (
                <div className="search-empty">no results</div>
            ) : results.length === 0 && !query.trim() ? (
                <div className="search-empty">search</div>
            ) : (
                <div className="search-results">
                    {groups.map((g) => (
                        <div key={g.path} className="search-file-group">
                            <div className="search-file-header" onClick={() => toggleFile(g.path)}>
                                <span>{g.name}</span>
                                <span className="search-file-count">{g.matches.length}</span>
                                {showReplace && (
                                    <button
                                        className="search-action"
                                        onClick={(e) => { e.stopPropagation(); handleReplaceInFile(g.path); }}
                                        title="Replace in file"
                                    >⟳</button>
                                )}
                            </div>
                            {!collapsed[g.path] && g.matches.map((m, i) => (
                                <div
                                    key={`${m.line_number}-${m.column}-${i}`}
                                    className="search-match"
                                    onClick={() => openMatch(m)}
                                >
                                    <span className="search-line-num">{m.line_number}</span>
                                    {renderLine(m.line_text, m.match_text)}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
