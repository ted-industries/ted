use tauri::{Manager, Emitter};
use std::time::{Duration, Instant};
use std::thread;

// Helper to find a window by label
fn get_window(handle: &tauri::AppHandle, label: &str) -> Option<tauri::WebviewWindow> {
    handle.get_webview_window(label)
}

#[tauri::command]
pub async fn agent_spawn(handle: tauri::AppHandle, url: String) -> Result<String, String> {
    let id =  uuid::Uuid::new_v4().to_string();
    let label = format!("agent-{}", id);
    
    let target_url = tauri::Url::parse(&url).map_err(|e| e.to_string())?;

    tauri::WebviewWindowBuilder::new(
        &handle,
        &label,
        tauri::WebviewUrl::External(target_url)
    )
    .title("Agent Browser")
    .inner_size(1280.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(label)
}

#[tauri::command]
pub async fn agent_execute(handle: tauri::AppHandle, label: String, script: String) -> Result<(), String> {
    if let Some(window) = get_window(&handle, &label) {
        window.eval(&script).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}

// Helper to wrap script with cursor animation logic
fn with_cursor(selector: &str, action_script: &str) -> String {
    format!(r#"
        (async function() {{
            // 1. Ensure Cursor Exists
            let cursor = document.getElementById('agent-cursor');
            if (!cursor) {{
                cursor = document.createElement('div');
                cursor.id = 'agent-cursor';
                cursor.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 20px;
                    height: 20px;
                    z-index: 2147483647;
                    pointer-events: none;
                    transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                `;
                cursor.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="fill: #3b82f6; stroke: white; transform: rotate(-15deg);">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                    </svg>
                    <div style="
                        position: absolute;
                        left: 24px;
                        top: 12px;
                        background: #3b82f6;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: sans-serif;
                        font-size: 10px;
                        font-weight: bold;
                        white-space: nowrap;
                    ">Agent</div>
                `;
                document.body.appendChild(cursor);
            }}

            // 2. Find Element and Calculate Position
            const el = document.querySelector("{selector}");
            if (el) {{
                const rect = el.getBoundingClientRect();
                // Target center of element
                const x = rect.left + (rect.width / 2);
                const y = rect.top + (rect.height / 2);
                
                // 3. Move Cursor
                cursor.style.transform = `translate(${{x}}px, ${{y}}px)`;
                
                // small visual cue for click
                cursor.querySelector('svg').style.transform = 'rotate(-15deg) scale(1)';

                // 4. Wait for animation
                await new Promise(r => setTimeout(r, 800));

                // 5. Click Effect (Pulse)
                cursor.querySelector('svg').style.transform = 'rotate(-15deg) scale(0.8)';
                setTimeout(() => cursor.querySelector('svg').style.transform = 'rotate(-15deg) scale(1)', 150);

                // 6. Execute Action
                {action_script}
            }}
        }})();
    "#, selector = selector.replace("\"", "\\\""), action_script = action_script)
}

#[tauri::command]
pub async fn agent_click(handle: tauri::AppHandle, label: String, selector: String) -> Result<(), String> {
    let action_code = r#"
        el.click();
        const mouseEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        el.dispatchEvent(mouseEvent);
    "#;
    
    let script = with_cursor(&selector, action_code);
    agent_execute(handle, label, script).await
}

#[tauri::command]
pub async fn agent_type(handle: tauri::AppHandle, label: String, selector: String, text: String) -> Result<(), String> {
    let action_code = format!(r#"
        el.focus();
        el.value = "{}";
        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
    "#, text.replace("\"", "\\\""));

    let script = with_cursor(&selector, &action_code);
    agent_execute(handle, label, script).await
}

// Robust content extraction using title-hacking for data return
#[tauri::command]
pub async fn agent_get_content(handle: tauri::AppHandle, label: String) -> Result<String, String> {
    let window = get_window(&handle, &label).ok_or("Window not found")?;
    
    // 1. Inject script to set title to content
    // We prefix with AGENT_RES: to detect it
    let script = r#"
        (function() {
            const content = document.body.innerText;
            // Limit length to avoid OS issues, maybe truncate
            const safeContent = content.substring(0, 5000).replace(/\n/g, " "); 
            document.title = "AGENT_RES:" + safeContent;
        })();
    "#;
    
    window.eval(script).map_err(|e| e.to_string())?;

    // 2. Poll for title change
    let start = Instant::now();
    let timeout = Duration::from_secs(5);
    
    while start.elapsed() < timeout {
        let title = window.title().unwrap_or_default();
        if title.starts_with("AGENT_RES:") {
            // Restore title? Optional.
            // window.set_title("Agent Browser").unwrap();
            
            let content = title.trim_start_matches("AGENT_RES:").to_string();
            return Ok(content);
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    Err("Timeout waiting for content".to_string())
}

#[tauri::command]
pub async fn agent_scroll(handle: tauri::AppHandle, label: String, selector: String) -> Result<(), String> {
    // For scroll, we might not want to move the cursor to the element BEFORE scrolling, 
    // because the element might be off-screen.
    // So we scroll first, THEN maybe move cursor? 
    // Actually, let's just use the standard wrapper which will try its best.
    // If the element is off-screen, getBoundingClientRect returns off-screen coords.
    // The cursor might fly off-screen.
    // But `el.scrollIntoView` is called in the action script.
    
    // Better strategy for scroll:
    // 1. Scroll
    // 2. Move cursor to it
    
    let script = format!(r#"
        (async function() {{
             // Ensure Cursor
            let cursor = document.getElementById('agent-cursor');
            if (!cursor) {{
                 cursor = document.createElement('div');
                 cursor.id = 'agent-cursor';
                 // ... (inject style same as above for consistency, abbreviated here but should be full)
                 cursor.style.cssText = `position: fixed; top: 0; left: 0; width: 20px; height: 20px; z-index: 2147483647; pointer-events: none; transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));`;
                 cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="fill: #3b82f6; stroke: white; transform: rotate(-15deg);"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path></svg><div style="position: absolute; left: 24px; top: 12px; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-family: sans-serif; font-size: 10px; font-weight: bold; white-space: nowrap;">Agent</div>`;
                 document.body.appendChild(cursor);
            }}

            const el = document.querySelector("{}");
            if (el) {{
                el.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                
                // Update cursor pos after scroll
                await new Promise(r => setTimeout(r, 500));
                const rect = el.getBoundingClientRect();
                const x = rect.left + (rect.width / 2);
                const y = rect.top + (rect.height / 2);
                cursor.style.transform = `translate(${{x}}px, ${{y}}px)`;
            }}
        }})();
    "#, selector.replace("\"", "\\\""));
    
    agent_execute(handle, label, script).await
}

#[tauri::command]
pub async fn agent_hover(handle: tauri::AppHandle, label: String, selector: String) -> Result<(), String> {
    let action_code = r#"
        const mouseover = new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        const mouseenter = new MouseEvent('mouseenter', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        el.dispatchEvent(mouseover);
        el.dispatchEvent(mouseenter);
    "#;
    
    let script = with_cursor(&selector, action_code);
    agent_execute(handle, label, script).await
}

#[tauri::command]
pub async fn agent_close(handle: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = get_window(&handle, &label) {
        window.close().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}
