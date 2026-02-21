import { useState, useEffect, useMemo } from "react";
import { RiSearchLine, RiExternalLinkLine, RiPlug2Fill } from "@remixicon/react";
import { extensionHost, useExtensionHost } from "../../services/extensions/extension-host";
import { extensionRegistryService, RegistryExtension } from "../../services/extensions/extension-registry-service";
import "./MarketplaceTab.css";

export default function MarketplaceTab() {
    const [search, setSearch] = useState("");
    const [registry, setRegistry] = useState<RegistryExtension[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);

    const installedExtensions = useExtensionHost(() => extensionHost.getExtensions());

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

    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return registry.filter(ext =>
            ext.displayName.toLowerCase().includes(s) ||
            ext.name.toLowerCase().includes(s) ||
            ext.description.toLowerCase().includes(s) ||
            ext.tags.some(t => t.toLowerCase().includes(s))
        );
    }, [registry, search]);

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

    return (
        <div className="marketplace-tab">
            <div className="marketplace-header">
                <div className="marketplace-title">
                    <RiPlug2Fill size={18} />
                    <h2>Extension Marketplace</h2>
                </div>
                <div className="marketplace-search">
                    <RiSearchLine size={16} />
                    <input
                        type="text"
                        placeholder="Search extensions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="marketplace-content">
                {loading ? (
                    <div className="marketplace-loading">Loading registry...</div>
                ) : error ? (
                    <div className="marketplace-error">{error}</div>
                ) : (
                    <div className="marketplace-grid">
                        {filtered.map(ext => (
                            <ExtensionItem
                                key={ext.name}
                                ext={ext}
                                isInstalled={installedExtensions.some(i => i.id === ext.name)}
                                isInstalling={installing === ext.name}
                                onInstall={() => handleInstall(ext)}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <div className="marketplace-empty">No extensions found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ExtensionItem({ ext, isInstalled, isInstalling, onInstall }: {
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
