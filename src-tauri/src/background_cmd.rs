use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::process::Stdio;
use serde::Serialize;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::process::Command;
use tauri::State;
use uuid::Uuid;

// Structure to hold process state
pub struct BackgroundProcess {
    child: Option<tokio::process::Child>, // Option so we can take it when finished
    stdout_buffer: Arc<Mutex<Vec<u8>>>,
    stderr_buffer: Arc<Mutex<Vec<u8>>>,
    is_finished: bool,
    exit_code: Option<i32>,
}

// Global state container
pub struct ProcessState {
    pub processes: Arc<Mutex<HashMap<String, BackgroundProcess>>>,
}

#[derive(Serialize)]
pub struct CmdResult {
    pub status: String, // "completed" | "running" | "error"
    pub pid: Option<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn exec_background_cmd(
    state: State<'_, ProcessState>, 
    command: String, 
    cwd: String, 
    timeout_ms: Option<u64>
) -> Result<CmdResult, String> {
    let timeout_val = timeout_ms.unwrap_or(5000); // Default 5s
    
    // Prepare command
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c").arg(&command);
        c
    };



    if !cwd.is_empty() {
        cmd.current_dir(&cwd);
    }
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Spawn
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;
    
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    // Buffers
    let stdout_buf = Arc::new(Mutex::new(Vec::new()));
    let stderr_buf = Arc::new(Mutex::new(Vec::new()));
    
    let out_clone = stdout_buf.clone();
    let err_clone = stderr_buf.clone();

    // Spawn background readers
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut buf = [0; 1024];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let mut file = out_clone.lock().unwrap();
                    file.extend_from_slice(&buf[..n]);
                }
                Err(_) => break,
            }
        }
    });

    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut buf = [0; 1024];
        loop {
            match reader.read(&mut buf).await {
                Ok(0) => break, 
                Ok(n) => {
                    let mut file = err_clone.lock().unwrap();
                    file.extend_from_slice(&buf[..n]);
                }
                Err(_) => break,
            }
        }
    });

    // Generate PID
    let pid = Uuid::new_v4().to_string();

    // Check with timeout
    let timeout_duration = std::time::Duration::from_millis(timeout_val);
    
    // We clone what we need to verify status
    // Note: We can't easily "peek" at the child without wait(), but wait() takes ownership if not careful or requires &mut
    // tokio::process::Child doesn't have try_wait() that is easy to use with timeout logic without a bit of gymnastics OR just race logic.
    
    // Strategy: Race `child.wait()` vs `sleep(timeout)`.
    
    tokio::select! {
        status_res = child.wait() => {
            // Finished within timeout
            match status_res {
                Ok(status) => {
                    // Read whatever is in buffers
                    let stdout_out = String::from_utf8_lossy(&stdout_buf.lock().unwrap()).to_string();
                    let stderr_out = String::from_utf8_lossy(&stderr_buf.lock().unwrap()).to_string();
                    
                    Ok(CmdResult {
                        status: "completed".to_string(),
                        pid: Some(pid),
                        stdout: stdout_out,
                        stderr: stderr_out,
                        exit_code: status.code(),
                    })
                }
                Err(e) => Err(format!("Process error: {}", e))
            }
        }
        _ = tokio::time::sleep(timeout_duration) => {
            // Timed out, store process
            let mut processes = state.processes.lock().unwrap();
            processes.insert(pid.clone(), BackgroundProcess {
                child: Some(child),
                stdout_buffer: stdout_buf.clone(),
                stderr_buffer: stderr_buf.clone(),
                is_finished: false,
                exit_code: None,
            });
            
            // Get partial output
            let stdout_out = String::from_utf8_lossy(&stdout_buf.lock().unwrap()).to_string();
            let stderr_out = String::from_utf8_lossy(&stderr_buf.lock().unwrap()).to_string();

            Ok(CmdResult {
                status: "running".to_string(),
                pid: Some(pid),
                stdout: stdout_out,
                stderr: stderr_out,
                exit_code: None,
            })
        }
    }
}

#[tauri::command]
pub async fn check_background_cmd(state: State<'_, ProcessState>, pid: String) -> Result<CmdResult, String> {
    let mut processes = state.processes.lock().unwrap();
    let proc = processes.get_mut(&pid).ok_or("Process not found")?;
    
    if proc.is_finished {
        return Ok(CmdResult {
            status: "completed".to_string(),
            pid: Some(pid),
            stdout: String::from_utf8_lossy(&proc.stdout_buffer.lock().unwrap()).to_string(),
            stderr: String::from_utf8_lossy(&proc.stderr_buffer.lock().unwrap()).to_string(),
            exit_code: proc.exit_code,
        });
    }

    // Check if finished now
    // We need to destructively check child if we want to use `.try_wait()` on tokio::process::Child?
    // standard Tokio Child try_wait is: `pub fn try_wait(&mut self) -> Result<Option<ExitStatus>>`
    // So we need mutable access to child.
    
    if let Some(child) = &mut proc.child {
        match child.try_wait() {
            Ok(Some(status)) => {
                proc.is_finished = true;
                proc.exit_code = status.code();
                
                Ok(CmdResult {
                    status: "completed".to_string(),
                    pid: Some(pid),
                    stdout: String::from_utf8_lossy(&proc.stdout_buffer.lock().unwrap()).to_string(),
                    stderr: String::from_utf8_lossy(&proc.stderr_buffer.lock().unwrap()).to_string(),
                    exit_code: proc.exit_code,
                })
            },
            Ok(None) => {
                // Still running
                Ok(CmdResult {
                    status: "running".to_string(),
                    pid: Some(pid),
                    stdout: String::from_utf8_lossy(&proc.stdout_buffer.lock().unwrap()).to_string(),
                    stderr: String::from_utf8_lossy(&proc.stderr_buffer.lock().unwrap()).to_string(),
                    exit_code: None,
                })
            },
            Err(e) => Err(format!("Error checking process: {}", e))
        }
    } else {
        Err("Invalid process state".to_string())
    }
}

#[tauri::command]
pub async fn kill_background_cmd(state: State<'_, ProcessState>, pid: String) -> Result<(), String> {
    let child_opt = {
        let mut processes = state.processes.lock().unwrap();
        processes.remove(&pid).and_then(|mut p| p.child.take())
    };

    if let Some(mut child) = child_opt {
        let _ = child.kill().await;
    }
    Ok(())
}
