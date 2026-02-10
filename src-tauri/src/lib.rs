mod git;
mod lsp;
mod terminal;

use lsp::LspState;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use terminal::TerminalState;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".output",
    "__pycache__",
    ".cache",
    ".parcel-cache",
    "coverage",
    ".idea",
    ".vscode",
];

const IGNORED_FILES: &[&str] = &[".DS_Store", "Thumbs.db", "desktop.ini"];

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
fn log_telemetry_event(handle: tauri::AppHandle, event: String) -> Result<(), String> {
    use std::io::Write;
    use tauri::path::BaseDirectory;

    let log_path = handle
        .path()
        .resolve("telemetry.jsonl", BaseDirectory::AppConfig)
        .map_err(|e| e.to_string())?;

    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;

    writeln!(file, "{}", event).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 10 * 1024 * 1024 {
        return Err("File exceeds 10MB limit".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("Not a directory".into());
    }

    let mut entries: Vec<FileEntry> = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if metadata.is_dir() && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }

        if !metadata.is_dir() && IGNORED_FILES.contains(&name.as_str()) {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn get_basename(path: String) -> String {
    Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone())
}

#[derive(Serialize, Clone)]
pub struct SearchMatch {
    pub path: String,
    pub line_number: u64,
    pub column: u64,
    pub line_text: String,
    pub match_text: String,
}

#[tauri::command]
fn ripgrep_search(query: String, cwd: String, case_sensitive: bool, regex: bool, max_results: Option<u32>) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let max = max_results.unwrap_or(500);
    let mut cmd = std::process::Command::new("rg");
    cmd.arg("--json")
        .arg("--max-count").arg("100")  // max matches per file
        .arg("--max-filesize").arg("1M")
        .current_dir(&cwd);

    if !case_sensitive {
        cmd.arg("--ignore-case");
    }
    if !regex {
        cmd.arg("--fixed-strings");
    }

    cmd.arg("--").arg(&query);

    let output = cmd.output().map_err(|e| format!("Failed to run rg: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut results: Vec<SearchMatch> = Vec::new();

    for line in stdout.lines() {
        if results.len() >= max as usize {
            break;
        }

        let parsed: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        if parsed["type"] != "match" {
            continue;
        }

        let data = &parsed["data"];
        let path_text = data["path"]["text"].as_str().unwrap_or("");
        let line_number = data["line_number"].as_u64().unwrap_or(0);
        let line_text = data["lines"]["text"].as_str().unwrap_or("").trim_end().to_string();

        // Get first submatch
        if let Some(submatches) = data["submatches"].as_array() {
            for sm in submatches {
                let match_text = sm["match"]["text"].as_str().unwrap_or("").to_string();
                let col = sm["start"].as_u64().unwrap_or(0);

                let full_path = Path::new(&cwd).join(path_text).to_string_lossy().to_string();

                results.push(SearchMatch {
                    path: full_path,
                    line_number,
                    column: col,
                    line_text: line_text.clone(),
                    match_text,
                });

                if results.len() >= max as usize {
                    break;
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
fn search_replace(file_path: String, search: String, replace: String, all: bool) -> Result<u32, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;

    let (new_content, count) = if all {
        let count = content.matches(&search).count() as u32;
        (content.replace(&search, &replace), count)
    } else {
        if let Some(pos) = content.find(&search) {
            let mut new = String::with_capacity(content.len());
            new.push_str(&content[..pos]);
            new.push_str(&replace);
            new.push_str(&content[pos + search.len()..]);
            (new, 1)
        } else {
            (content, 0)
        }
    };

    if count > 0 {
        fs::write(&file_path, &new_content).map_err(|e| e.to_string())?;
    }

    Ok(count)
}

#[tauri::command]
fn get_user_config_dir(handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::path::BaseDirectory;
    handle
        .path()
        .resolve("settings.json", BaseDirectory::Config)
        .map(|p: std::path::PathBuf| p.to_string_lossy().to_string())
        .map_err(|e: tauri::Error| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .manage(TerminalState {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        })
        .manage(LspState {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            list_dir,
            get_basename,
            get_user_config_dir,
            terminal::spawn_terminal,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            log_telemetry_event,
            git::git_status,
            git::git_diff,
            git::git_log,
            git::git_read_file,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_get_branch,
            git::git_get_line_diff,
            git::git_churn,
            git::git_clone,
            lsp::lsp_start,
            lsp::lsp_send,
            lsp::lsp_stop,
            lsp::lsp_list,
            ripgrep_search,
            search_replace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
