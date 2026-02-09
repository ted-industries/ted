use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Runtime};

pub struct LspSession {
    pub child: Child,
    pub stdin: Arc<Mutex<Box<dyn Write + Send>>>,
}

pub struct LspState {
    pub sessions: Arc<Mutex<HashMap<String, LspSession>>>,
}

#[derive(Serialize, Clone)]
struct LspMessageEvent {
    server_id: String,
    message: String,
}

#[derive(Serialize, Clone)]
struct LspErrorEvent {
    server_id: String,
    error: String,
}

#[derive(Serialize, Clone)]
struct LspExitEvent {
    server_id: String,
    code: Option<i32>,
}

#[tauri::command]
pub fn lsp_start<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, LspState>,
    server_id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.contains_key(&server_id) {
        return Err(format!("Server {} already running", server_id));
    }

    let mut cmd = Command::new(&command);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(ref cwd) = cwd {
        cmd.current_dir(cwd);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", command, e))?;

    let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let stdin = Arc::new(Mutex::new(Box::new(stdin) as Box<dyn Write + Send>));

    sessions.insert(
        server_id.clone(),
        LspSession {
            child,
            stdin: stdin.clone(),
        },
    );

    // Stdout reader: parse JSON-RPC Content-Length framed messages
    let app_stdout = app.clone();
    let sid_stdout = server_id.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut content_length: usize = 0;
            loop {
                let mut header = String::new();
                match reader.read_line(&mut header) {
                    Ok(0) => return,
                    Err(_) => return,
                    _ => {}
                }
                let trimmed = header.trim();
                if trimmed.is_empty() {
                    break;
                }
                if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
                    content_length = len_str.parse().unwrap_or(0);
                }
            }

            if content_length == 0 {
                continue;
            }

            let mut body = vec![0u8; content_length];
            if reader.read_exact(&mut body).is_err() {
                return;
            }

            let message = String::from_utf8_lossy(&body).to_string();
            let _ = app_stdout.emit(
                &format!("lsp-message:{}", sid_stdout),
                LspMessageEvent {
                    server_id: sid_stdout.clone(),
                    message,
                },
            );
        }
    });

    // Stderr reader: forward server log output
    let app_stderr = app.clone();
    let sid_stderr = server_id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    let _ = app_stderr.emit(
                        &format!("lsp-error:{}", sid_stderr),
                        LspErrorEvent {
                            server_id: sid_stderr.clone(),
                            error: line,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Exit watcher
    let app_exit = app.clone();
    let sid_exit = server_id.clone();
    let sessions_ref = state.sessions.clone();
    thread::spawn(move || {
        // Wait a moment then check if the child is still in our map
        loop {
            thread::sleep(std::time::Duration::from_secs(2));
            let mut sessions = sessions_ref.lock().unwrap();
            if let Some(session) = sessions.get_mut(&sid_exit) {
                match session.child.try_wait() {
                    Ok(Some(status)) => {
                        let _ = app_exit.emit(
                            &format!("lsp-exit:{}", sid_exit),
                            LspExitEvent {
                                server_id: sid_exit.clone(),
                                code: status.code(),
                            },
                        );
                        sessions.remove(&sid_exit);
                        return;
                    }
                    Ok(None) => {} // Still running
                    Err(_) => {
                        sessions.remove(&sid_exit);
                        return;
                    }
                }
            } else {
                return; // Already removed
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn lsp_send(
    state: tauri::State<'_, LspState>,
    server_id: String,
    message: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get(&server_id)
        .ok_or(format!("Server {} not found", server_id))?;

    let mut stdin = session.stdin.lock().unwrap();
    let header = format!("Content-Length: {}\r\n\r\n", message.len());
    stdin
        .write_all(header.as_bytes())
        .map_err(|e| e.to_string())?;
    stdin
        .write_all(message.as_bytes())
        .map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn lsp_stop(state: tauri::State<'_, LspState>, server_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&server_id) {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(())
}

#[tauri::command]
pub fn lsp_list(state: tauri::State<'_, LspState>) -> Result<Vec<String>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions.keys().cloned().collect())
}
