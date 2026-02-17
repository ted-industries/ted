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

#[tauri::command]
pub async fn agent_click(handle: tauri::AppHandle, label: String, selector: String) -> Result<(), String> {
    let script = format!(r#"
        (function() {{
            const el = document.querySelector("{}");
            if (el) {{
                el.click();
                // Also dispatch events to be safe
                const mouseEvent = new MouseEvent('click', {{
                    view: window,
                    bubbles: true,
                    cancelable: true
                }});
                el.dispatchEvent(mouseEvent);
            }}
        }})();
    "#, selector.replace("\"", "\\\""));
    
    agent_execute(handle, label, script).await
}

#[tauri::command]
pub async fn agent_type(handle: tauri::AppHandle, label: String, selector: String, text: String) -> Result<(), String> {
    let script = format!(r#"
        (function() {{
            const el = document.querySelector("{}");
            if (el) {{
                el.value = "{}";
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }})();
    "#, selector.replace("\"", "\\\""), text.replace("\"", "\\\""));

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
    let script = format!(r#"
        (function() {{
            const el = document.querySelector("{}");
            if (el) {{
                el.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
            }}
        }})();
    "#, selector.replace("\"", "\\\""));
    
    agent_execute(handle, label, script).await
}

#[tauri::command]
pub async fn agent_hover(handle: tauri::AppHandle, label: String, selector: String) -> Result<(), String> {
    let script = format!(r#"
        (function() {{
            const el = document.querySelector("{}");
            if (el) {{
                const mouseover = new MouseEvent('mouseover', {{
                    view: window,
                    bubbles: true,
                    cancelable: true
                }});
                const mouseenter = new MouseEvent('mouseenter', {{
                    view: window,
                    bubbles: true,
                    cancelable: true
                }});
                el.dispatchEvent(mouseover);
                el.dispatchEvent(mouseenter);
            }}
        }})();
    "#, selector.replace("\"", "\\\""));
    
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
