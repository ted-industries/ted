import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { extensionHost, useExtensionHost } from "../../services/extensions/extension-host";
import type { ExtensionInstance } from "../../services/extensions/types";
import "./extensions.css";
import { RiPlug2Fill } from "@remixicon/react";

export default function ExtensionsPanel() {
    const extensions = useExtensionHost(() => extensionHost.getExtensions());

    const handleLoadExtension = useCallback(async () => {
        try {
            const selected = await open({ directory: true, multiple: false });
            if (!selected) return;
            await extensionHost.loadFromPath(selected as string);
        } catch (err) {
            console.error("Failed to load extension:", err);
            window.dispatchEvent(
                new CustomEvent("ted:notification", {
                    detail: { message: `Failed to load: ${err}`, type: "error" },
                })
            );
        }
    }, []);

    const handleToggle = useCallback(async (id: string) => {
        await extensionHost.toggleExtension(id);
    }, []);

    return (
        <div className="extensions-panel">
            <div className="extensions-header">
                <h3>Extensions</h3>
                <button className="extensions-load-btn" onClick={handleLoadExtension}>
                    + Load
                </button>
            </div>

            <div className="extensions-list">
                {extensions.length === 0 ? (
                    <div className="extensions-empty">
                        <RiPlug2Fill size={24} />
                        <div>
                            No extensions loaded.
                            <br />
                            Click <strong>+ Load</strong> to add one, or place extensions in{" "}
                            <code>~/.ted/extensions/</code>
                        </div>
                    </div>
                ) : (
                    extensions.map((ext) => (
                        <ExtensionCard
                            key={ext.id}
                            ext={ext}
                            onToggle={handleToggle}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ExtensionCard({
    ext,
    onToggle,
}: {
    ext: ExtensionInstance;
    onToggle: (id: string) => void;
}) {
    const initial = (ext.manifest.displayName || ext.manifest.name).charAt(0);

    return (
        <div className={`ext-card status-${ext.status}`}>
            <div className="ext-icon">{initial}</div>
            <div className="ext-info">
                <div className="ext-name">
                    {ext.manifest.displayName || ext.manifest.name}
                    <span className="ext-version">v{ext.manifest.version}</span>
                </div>
                {ext.manifest.description && (
                    <div className="ext-desc">{ext.manifest.description}</div>
                )}
                {ext.status === "error" && ext.error && (
                    <div className="ext-error" title={ext.error}>
                        {ext.error}
                    </div>
                )}
            </div>
            <button
                className={`ext-toggle ${ext.status === "active" ? "active" : ""}`}
                onClick={() => onToggle(ext.id)}
                title={ext.status === "active" ? "Disable" : "Enable"}
            />
        </div>
    );
}
