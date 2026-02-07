use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtyPair, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};
use std::collections::HashMap;

pub struct TerminalSession {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub pty_pair: PtyPair,
}

pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

#[tauri::command]
pub fn spawn_terminal<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, TerminalState>,
    id: String,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    
    // In portable-pty 0.8, the method is 'openpty' (no underscore)
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let shell = "powershell.exe";
    #[cfg(not(target_os = "windows"))]
    let shell = "bash";

    let mut cmd = CommandBuilder::new(shell);
    
    let _child = pty_pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let reader = pty_pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pty_pair.master.take_writer().map_err(|e| e.to_string())?;

    let writer = Arc::new(Mutex::new(writer));
    let sessions = state.sessions.clone();
    
    sessions.lock().unwrap().insert(id.clone(), TerminalSession {
        writer: writer.clone(),
        pty_pair,
    });

    let app_clone = app.clone();
    let id_clone = id.clone();

    thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0u8; 4096];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let data = String::from_utf8_lossy(&buffer[..n]).to_string();
            let _ = app_clone.emit(&format!("terminal-data:{}", id_clone), data);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_to_terminal(
    state: tauri::State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        let mut writer = session.writer.lock().unwrap();
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_terminal(
    state: tauri::State<'_, TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        session.pty_pair.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}
