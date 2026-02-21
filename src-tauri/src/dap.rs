use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

pub struct DapSession {
    pub id: String,
    pub writer: Arc<Mutex<TcpStream>>,
}

pub struct DapState {
    pub sessions: Arc<Mutex<Option<DapSession>>>,
}

#[tauri::command]
pub fn dap_connect<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, DapState>,
    host: String,
    port: u16,
    id: String,
) -> Result<(), String> {
    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(&addr).map_err(|e| e.to_string())?;
    let session_id = id.clone();
    
    // Set non-blocking to false for the reader thread
    stream.set_nonblocking(false).map_err(|e| e.to_string())?;
    
    let reader_stream = stream.try_clone().map_err(|e| e.to_string())?;
    let writer_stream = Arc::new(Mutex::new(stream));

    let mut sessions = state.sessions.lock().unwrap();
    *sessions = Some(DapSession {
        id: session_id.clone(),
        writer: writer_stream.clone(),
    });

    let app_clone = app.clone();
    thread::spawn(move || {
        let mut reader = reader_stream;
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_clone.emit("dap-data", serde_json::json!({
                        "id": session_id,
                        "data": data
                    }));
                }
                Err(_) => break,
            }
        }
        // Cleanup on disconnect
        let _ = app_clone.emit("dap-terminated", session_id);
    });

    Ok(())
}

#[tauri::command]
pub fn dap_send(
    state: tauri::State<'_, DapState>,
    message: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.as_ref() {
        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(message.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active DAP session".into())
    }
}

#[tauri::command]
pub fn dap_disconnect(state: tauri::State<'_, DapState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    *sessions = None;
    Ok(())
}
