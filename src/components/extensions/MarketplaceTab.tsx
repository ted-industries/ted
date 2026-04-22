import { useState, useEffect, useMemo, useCallback } from "react";
import {
    RiSearchLine, RiAddFill, RiArrowRightSLine,
    RiExternalLinkLine, RiArrowLeftLine, RiCheckboxCircleFill,
    RiCommandLine, RiGlobalLine, RiDownloadLine, RiUserLine, RiGithubLine
} from "@remixicon/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { extensionHost, useExtensionHost } from "../../services/extensions/extension-host";
import { extensionRegistryService, RegistryExtension } from "../../services/extensions/extension-registry-service";
import "./MarketplaceTab.css";

// Assets
const BANNER_IMG = "/marketplace_banner.png";

export default function MarketplaceTab() {
    const [view, setView] = useState<"browse" | "installed">("browse");
    const [search, setSearch] = useState("");
    const [registry, setRegistry] = useState<RegistryExtension[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const [detailExt, setDetailExt] = useState<any | null>(null);

    const instances = useExtensionHost(() => extensionHost.getExtensions());

    useEffect(() => {
        fetchRegistry();
    }, []);

    const fetchRegistry = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await extensionRegistryService.fetchRegistry();
            setRegistry(data);
        } catch (err) {
            setError("Failed to fetch extension registry.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadLocal = useCallback(async () => {
        try {
            const selected = await open({ directory: true, multiple: false });
            if (!selected) return;
            await extensionHost.loadFromPath(selected as string);
            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `Extension loaded from local path.`, type: "info" }
            }));
        } catch (err) {
            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `Failed to load local extension: ${err}`, type: "error" }
            }));
        }
    }, []);

    const handleInstall = async (ext: RegistryExtension) => {
        if (installing) return;
        setInstalling(ext.name);
        try {
            await extensionRegistryService.installExtension(ext);
            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `${ext.displayName} added to Ted.`, type: "info" }
            }));
        } catch (err) {
            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `Failed to add ${ext.displayName}: ${err}`, type: "error" }
            }));
        } finally {
            setInstalling(null);
        }
    };

    const handleToggle = async (id: string) => {
        await extensionHost.toggleExtension(id);
    };

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        if (view === "browse") {
            return registry.filter((ext: RegistryExtension) =>
                ext.displayName.toLowerCase().includes(s) ||
                ext.name.toLowerCase().includes(s) ||
                ext.description.toLowerCase().includes(s) ||
                (ext.tags || []).some((t: string) => t.toLowerCase().includes(s))
            );
        } else {
            return instances.filter(inst =>
                (inst.manifest.displayName || inst.manifest.name).toLowerCase().includes(s) ||
                inst.id.toLowerCase().includes(s)
            );
        }
    }, [registry, instances, search, view]);

    if (detailExt) {
        return (
            <div className="marketplace-tab">
                <ExtensionDetailView
                    ext={detailExt}
                    onBack={() => setDetailExt(null)}
                    isInstalled={instances.some(i => i.id === (detailExt.name || detailExt.id))}
                    isInstalling={installing === detailExt.name}
                    onInstall={() => handleInstall(detailExt)}
                    onToggle={() => handleToggle(detailExt.id || detailExt.name)}
                />
            </div>
        );
    }

    return (
        <div className="marketplace-tab">
            <div className="marketplace-top-nav">
                <div className="nav-toggles">
                    <div
                        className={`nav-toggle-item ${view === "browse" ? "active" : ""}`}
                        onClick={() => setView("browse")}
                    >
                        Browse
                    </div>
                    <div
                        className={`nav-toggle-item ${view === "installed" ? "active" : ""}`}
                        onClick={() => setView("installed")}
                    >
                        Installed ({instances.length})
                    </div>
                </div>
                <div className="nav-actions">
                    {view === "installed" && (
                        <button className="nav-btn" onClick={handleLoadLocal}>
                            <RiAddFill size={16} /> Load Local
                        </button>
                    )}
                </div>
            </div>

            <div className="browse-container">
                <h1 className="browse-hero-text">Make Ted work your way</h1>

                <div className="browse-search-wrapper">
                    <div className="search-box">
                        <RiSearchLine size={18} />
                        <input
                            type="text"
                            placeholder={`Search ${view}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {view === "browse" && (
                    <div className="hero-banner" style={{ backgroundImage: `url(${BANNER_IMG})`, backgroundSize: 'cover' }}>
                        <div className="banner-content">
                            <div className="banner-pill">
                                <RiCommandLine size={14} />
                                <div className="banner-pill-text">
                                    Expand Ted's capabilities with community extensions
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="marketplace-section">
                    <div className="section-header">
                        {view === "browse" ? "Marketplace" : "Your Extensions"}
                    </div>
                    <div className="section-grid">
                        {loading && view === "browse" ? (
                            <div style={{ color: 'var(--market-text-muted)', textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>
                                Fetching extensions...
                            </div>
                        ) : filtered.length > 0 ? (
                            filtered.map((item: any) => (
                                <PluginCard
                                    key={item.id || item.name}
                                    item={item}
                                    isInstalled={instances.some(i => i.id === (item.name || item.id))}
                                    isInstalling={installing === item.name}
                                    onInstall={() => handleInstall(item)}
                                    onClick={() => setDetailExt(item)}
                                    view={view}
                                    onToggle={() => handleToggle(item.id)}
                                />
                            ))
                        ) : (
                            <div style={{ color: 'var(--market-text-muted)', textAlign: 'center', gridColumn: '1/-1', padding: '40px' }}>
                                No extensions found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PluginCard({ item, isInstalled, isInstalling, onInstall, onClick, view, onToggle }: any) {
    const name = item.displayName || item.manifest?.displayName || item.name || item.id;
    const description = item.description || item.manifest?.description;
    const version = item.version || item.manifest?.version;
    const isActive = item.status === "active";

    return (
        <div className="plugin-card" onClick={onClick}>
            <div className="plugin-icon">
                <RiCommandLine size={20} color="#8e8e8e" />
            </div>
            <div className="plugin-info">
                <div className="plugin-name">
                    {name}
                    <span style={{ fontSize: '10px', color: 'var(--market-text-muted)', marginLeft: '8px' }}>v{version}</span>
                </div>
                <div className="plugin-desc">{description}</div>
            </div>
            <div className="plugin-actions" onClick={e => e.stopPropagation()}>
                {view === "browse" ? (
                    <div className="plugin-add-btn" onClick={onInstall}>
                        {isInstalled ? <RiCheckboxCircleFill size={18} color="#4CAF50" /> : isInstalling ? "..." : <RiAddFill size={18} />}
                    </div>
                ) : (
                    <button
                        className={`plugin-toggle-btn ${isActive ? 'active' : ''}`}
                        onClick={onToggle}
                        style={{
                            width: '32px', height: '16px', borderRadius: '10px',
                            background: isActive ? '#ffffff' : 'rgba(255,255,255,0.1)',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: isActive ? '#000000' : '#8e8e8e',
                            position: 'absolute', top: '2px', left: isActive ? '18px' : '2px',
                            transition: 'all 0.2s'
                        }} />
                    </button>
                )}
            </div>
        </div>
    );
}

function ExtensionDetailView({ ext, onBack, isInstalled, isInstalling, onInstall, onToggle }: any) {
    const [readme, setReadme] = useState<string | null>(null);
    const [loadingReadme, setLoadingReadme] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoadingReadme(true);
            try {
                const content = await extensionRegistryService.fetchReadme(ext);
                setReadme(content);
            } catch (err) {
                console.error("Failed to fetch readme:", err);
            } finally {
                setLoadingReadme(false);
            }
        };
        load();
    }, [ext]);

    // Normalize data
    const instance = useExtensionHost(h => h.getExtensions().find(i => i.id === (ext.name || ext.id)));
    
    const name = ext.displayName || ext.manifest?.displayName || ext.name || ext.id;
    const version = ext.version || ext.manifest?.version;
    const description = ext.description || ext.manifest?.description;
    const author = ext.author || ext.manifest?.author || "Unknown Author";
    const repository = ext.repository || ext.manifest?.repository;
    const tags = ext.tags || (ext.manifest?.keywords || []);
    const status = instance?.status || ext.status || (isInstalled ? "installed" : "available");
    const downloads = ext.downloads || 0;

    return (
        <div className="marketplace-tab">
            <div className="marketplace-top-nav">
                <div className="detail-nav" onClick={onBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RiArrowLeftLine size={16} /> Marketplace <span className="breadcrumb-sep">/</span> {name}
                </div>
                <div className="nav-actions">
                    {!isInstalled ? (
                        <button className="nav-btn primary" onClick={onInstall} disabled={isInstalling}>
                            {isInstalling ? "Adding..." : "Add to Ted"}
                        </button>
                    ) : (
                        <button className="nav-btn primary" onClick={onToggle}>
                            {status === 'active' ? "Disable" : "Enable"}
                        </button>
                    )}
                </div>
            </div>

            <div className="detail-container">
                <div className="detail-layout">
                    <div className="detail-main-info">
                        <div className="detail-header-row">
                            <div className="detail-large-icon">
                                <RiCommandLine size={32} color="#8e8e8e" />
                            </div>
                            <div className="detail-title-block">
                                <h1>{name}</h1>
                                <div className="detail-short-desc">{description}</div>
                            </div>
                        </div>

                        <div className="detail-long-desc">
                            {loadingReadme ? (
                                <div style={{ color: 'var(--market-text-muted)', padding: '20px 0' }}>Fetching documentation...</div>
                            ) : (
                                <div className="markdown-body">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {readme || "No documentation provided."}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="detail-info-sidebar">
                        <h3>Information</h3>
                        <div className="info-table">
                            <div className="info-row">
                                <div className="info-label">Version</div>
                                <div className="info-value">{version}</div>
                            </div>
                            <div className="info-row">
                                <div className="info-label">Author</div>
                                <div className="info-value" style={{ gap: '4px' }}>
                                    <RiUserLine size={14} /> {author}
                                </div>
                            </div>
                            {downloads > 0 && (
                                <div className="info-row">
                                    <div className="info-label">Downloads</div>
                                    <div className="info-value" style={{ gap: '4px' }}>
                                        <RiDownloadLine size={14} /> {downloads.toLocaleString()}
                                    </div>
                                </div>
                            )}
                            {repository && (
                                <div className="info-row">
                                    <div className="info-label">Repository</div>
                                    <div className="info-value">
                                        <a href={repository} target="_blank" rel="noopener noreferrer" className="info-link">
                                            <RiGithubLine size={14} /> GitHub
                                        </a>
                                    </div>
                                </div>
                            )}
                            <div className="info-row">
                                <div className="info-label">Status</div>
                                <div className="info-value">{status}</div>
                            </div>
                        </div>

                        {tags.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <h3 style={{ fontSize: '13px', marginBottom: '12px' }}>Tags</h3>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {tags.map((tag: string) => (
                                        <span key={tag} style={{
                                            fontSize: '11px', padding: '4px 8px', borderRadius: '4px',
                                            background: 'rgba(255,255,255,0.05)', color: 'var(--market-text-muted)'
                                        }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
