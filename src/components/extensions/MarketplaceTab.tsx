import { useState, useEffect, useMemo, useCallback } from "react";
import { RiSearchLine, RiExternalLinkLine, RiPlug2Fill, RiAddFill, RiFolderLine } from "@remixicon/react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { extensionHost, useExtensionHost } from "../../services/extensions/extension-host";
import { extensionRegistryService, RegistryExtension } from "../../services/extensions/extension-registry-service";
import "./MarketplaceTab.css";

export default function MarketplaceTab() {
    const [view, setView] = useState<"browse" | "installed">("browse");
    const [search, setSearch] = useState("");
    const [registry, setRegistry] = useState<RegistryExtension[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);

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

        window.dispatchEvent(new CustomEvent("ted:notification", {
            detail: { message: `Installing ${ext.displayName}...`, type: "info" }
        }));

        try {
            await extensionRegistryService.installExtension(ext);

            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `${ext.displayName} installed and activated.`, type: "info" }
            }));
        } catch (err) {
            window.dispatchEvent(new CustomEvent("ted:notification", {
                detail: { message: `Failed to install ${ext.displayName}: ${err}`, type: "error" }
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
            return registry.filter(ext =>
                ext.displayName.toLowerCase().includes(s) ||
                ext.name.toLowerCase().includes(s) ||
                ext.description.toLowerCase().includes(s) ||
                ext.tags.some(t => t.toLowerCase().includes(s))
            );
        } else {
            // Filter installed instances
            return instances.filter(inst =>
                (inst.manifest.displayName || inst.manifest.name).toLowerCase().includes(s) ||
                inst.id.toLowerCase().includes(s)
            );
        }
    }, [registry, instances, search, view]);

    return (
        <div className="marketplace-tab">
            <div className="marketplace-header">
                <div className="marketplace-title">
                    <RiPlug2Fill size={15} />
                    <div className="marketplace-nav">
                        <div
                            className={`marketplace-nav-item ${view === "browse" ? "active" : ""}`}
                            onClick={() => setView("browse")}
                        >
                            browse
                        </div>
                        <div
                            className={`marketplace-nav-item ${view === "installed" ? "active" : ""}`}
                            onClick={() => setView("installed")}
                        >
                            installed ({instances.length})
                        </div>
                    </div>
                </div>
                <div className="marketplace-search">
                    <RiSearchLine size={15} />
                    <input
                        type="text"
                        placeholder={`search ${view}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {view === "installed" && (
                    <button className="item-install-btn" onClick={handleLoadLocal}>
                        <RiAddFill size={15} style={{ marginRight: 4 }} />
                        load local
                    </button>
                )}
            </div>

            <div className="marketplace-content">
                {view === "browse" && loading ? (
                    <div className="marketplace-loading">fetching registry...</div>
                ) : view === "browse" && error ? (
                    <div className="marketplace-error">{error}</div>
                ) : (
                    <div className="marketplace-grid">
                        {view === "browse" ? (
                            (filtered as RegistryExtension[]).map(ext => (
                                <RegistryItem
                                    key={ext.name}
                                    ext={ext}
                                    isInstalled={instances.some(i => i.id === ext.name)}
                                    isInstalling={installing === ext.name}
                                    onInstall={() => handleInstall(ext)}
                                />
                            ))
                        ) : (
                            (filtered as any[]).map(inst => (
                                <InstalledItem
                                    key={inst.id}
                                    inst={inst}
                                    onToggle={() => handleToggle(inst.id)}
                                />
                            ))
                        )}
                        {filtered.length === 0 && (
                            <div className="marketplace-empty">no extensions found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function RegistryItem({ ext, isInstalled, isInstalling, onInstall }: {
    ext: RegistryExtension,
    isInstalled: boolean,
    isInstalling: boolean,
    onInstall: () => void
}) {
    return (
        <div className={`marketplace-item ${isInstalled ? 'installed' : ''}`}>
            <div className="item-header">
                <span className="item-name">{ext.displayName}</span>
                <span className="item-version">v{ext.version}</span>
            </div>

            <div className="item-desc">{ext.description}</div>

            <div className="item-footer">
                <div className="item-tags">
                    {ext.tags.map(t => <span key={t} className="item-tag">{t}</span>)}
                </div>
                <div className="item-actions">
                    {isInstalled ? (
                        <div className="item-status">installed</div>
                    ) : (
                        <button
                            className="item-install-btn"
                            onClick={onInstall}
                            disabled={isInstalling}
                        >
                            {isInstalling ? "..." : "install"}
                        </button>
                    )}
                    <a
                        href={ext.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="item-repo-link"
                        title="view repository"
                    >
                        <RiExternalLinkLine size={12} />
                    </a>
                </div>
            </div>
        </div>
    );
}

function InstalledItem({ inst, onToggle }: {
    inst: any,
    onToggle: () => void
}) {
    const isActive = inst.status === "active";
    const isError = inst.status === "error";

    return (
        <div className={`marketplace-item ${isActive ? '' : 'disabled'}`}>
            <div className="item-header">
                <span className="item-name">{inst.manifest.displayName || inst.manifest.name}</span>
                <span className="item-version">v{inst.manifest.version}</span>
            </div>

            <div className="item-desc">
                {isError ? (
                    <span style={{ color: "var(--syntax-variable)" }}>{inst.error || "error loading extension"}</span>
                ) : (
                    inst.manifest.description
                )}
            </div>

            <div className="item-footer">
                <div className="item-tags">
                    <span className="item-tag">{inst.status}</span>
                </div>
                <div className="item-actions">
                    <button
                        className="item-path-btn"
                        onClick={() => revealItemInDir(inst.path)}
                        title={inst.path}
                    >
                        <RiFolderLine size={13} />
                    </button>
                    <div className="item-status" title={isActive ? "active" : "disabled"}>
                        <button
                            className={`item-toggle-btn ${isActive ? 'active' : ''}`}
                            onClick={onToggle}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
