import { useState } from "react";
import { agentDriver } from "../../services/agent-driver";

export default function AgentDebug() {
    const [url, setUrl] = useState("https://google.com");
    const [label, setLabel] = useState("");
    const [selector, setSelector] = useState("textarea[name='q']");
    const [text, setText] = useState("Hello Agent");
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);

    const spawn = async () => {
        try {
            const l = await agentDriver.spawn(url);
            setLabel(l);
            log(`Spawned: ${l}`);
        } catch (e) {
            log(`Error spawn: ${e}`);
        }
    };

    const type = async () => {
        try {
            await agentDriver.type(label, selector, text);
            log(`Typed "${text}" into ${selector}`);
        } catch (e) {
            log(`Error type: ${e}`);
        }
    };

    const click = async () => {
        try {
            await agentDriver.click(label, selector);
            log(`Clicked ${selector}`);
        } catch (e) {
            log(`Error click: ${e}`);
        }
    };

    const read = async () => {
        try {
            const content = await agentDriver.getContent(label);
            log(`Read content (${content.length} chars): ${content.substring(0, 50)}...`);
        } catch (e) {
            log(`Error read: ${e}`);
        }
    };

    const scroll = async () => {
        try {
            await agentDriver.scroll(label, selector);
            log(`Scrolled to ${selector}`);
        } catch (e) {
            log(`Error scroll: ${e}`);
        }
    };

    const hover = async () => {
        try {
            await agentDriver.hover(label, selector);
            log(`Hovered ${selector}`);
        } catch (e) {
            log(`Error hover: ${e}`);
        }
    };

    const pressEnter = async () => {
        try {
            await agentDriver.execute(label, `
                (function() {
                    const el = document.querySelector("${selector.replace(/"/g, '\\"')}");
                    if (el) {
                        const down = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
                        const press = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
                        const up = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
                        el.dispatchEvent(down);
                        el.dispatchEvent(press);
                        el.dispatchEvent(up);
                        
                        // Try form submission if it's an input/textarea in a form
                        if (el.form) {
                            el.form.requestSubmit();
                        }
                    }
                })();
            `);
            log(`Pressed Enter on ${selector}`);
        } catch (e) {
            log(`Error press enter: ${e}`);
        }
    };

    const styles = {
        container: {
            padding: 24,
            color: "var(--foreground)",
            background: "var(--background)",
            height: "100%",
            display: "flex",
            flexDirection: "column" as const,
            gap: 20
        },
        header: {
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: "var(--foreground)"
        },
        row: {
            display: "flex",
            gap: 12,
            alignItems: "center"
        },
        input: {
            padding: "8px 12px",
            background: "var(--input-background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            borderRadius: 6,
            outline: "none",
            fontSize: 13,
            flex: 1
        },
        button: {
            padding: "8px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            transition: "all 0.2s"
        },
        activeWindow: {
            padding: 16,
            background: "var(--surface)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column" as const,
            gap: 16
        },
        logs: {
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: 12,
            color: "var(--foreground-muted)"
        }
    };

    return (
        <div style={styles.container}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={styles.header}>Agent Debugger</h3>
            </div>

            <div style={styles.row}>
                <input
                    style={styles.input}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="Enter URL to spawn..."
                />
                <button style={styles.button} onClick={spawn}>Spawn Window</button>
            </div>

            {label && (
                <div style={styles.activeWindow}>
                    <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "monospace" }}>
                        Active Window: {label}
                    </div>
                    <div style={styles.row}>
                        <input
                            style={styles.input}
                            value={selector}
                            onChange={e => setSelector(e.target.value)}
                            placeholder="CSS Selector"
                        />
                        <input
                            style={styles.input}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Text to Type"
                        />
                    </div>
                    <div style={styles.row}>
                        <button style={styles.button} onClick={type}>Type</button>
                        <button style={styles.button} onClick={pressEnter}>Enter</button>
                        <button style={styles.button} onClick={click}>Click</button>
                        <button style={styles.button} onClick={scroll}>Scroll</button>
                        <button style={styles.button} onClick={hover}>Hover</button>
                        <button style={styles.button} onClick={read}>Read</button>
                    </div>
                </div>
            )}

            <div style={styles.logs}>
                {logs.length === 0 && <div style={{ opacity: 0.5 }}>No logs yet...</div>}
                {logs.map((l, i) => <div key={i} style={{ marginBottom: 4 }}>{l}</div>)}
            </div>
        </div>
    );
}
