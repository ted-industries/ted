use git2::{Repository, StatusOptions, DiffOptions};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "modified", "new", "deleted", "staged"
}


#[derive(Serialize, Clone)]
pub struct CommitEntry {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[tauri::command]
pub fn git_status(path: String) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    let workdir = repo.workdir().unwrap_or(std::path::Path::new(""));

    for entry in statuses.iter() {
        let status = entry.status();
        let entry_path = entry.path().unwrap_or("");
        
        // Ensure we return absolute path matching frontend expectation
        let path = workdir.join(entry_path).to_string_lossy().to_string();
        
        let status_str = if status.is_wt_new() {
            "new"
        } else if status.is_wt_modified() {
            "modified"
        } else if status.is_wt_deleted() {
            "deleted"
        } else if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
            "staged"
        } else {
            "unknown"
        };
        
        results.push(FileStatus {
            path,
            status: status_str.to_string(),
        });
    }

    Ok(results)
}

#[tauri::command]
pub fn git_diff(repo_path: String, file_path: String) -> Result<String, String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    
    // Check if the file exists in HEAD (to diff against)
    // For simplicity, we diff index to workdir for now (unstaged changes)
    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);
    opts.context_lines(3);

    let index = repo.index().map_err(|e| e.to_string())?;
    let diff = repo.diff_index_to_workdir(Some(&index), Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut diff_str = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        match origin {
            '+' | '-' | ' ' => {
                diff_str.push(origin);
                diff_str.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
            }
            _ => {}
        }
        true
    }).map_err(|e| e.to_string())?;

    Ok(diff_str)
}

#[tauri::command]
pub fn git_log(repo_path: String, limit: usize) -> Result<Vec<CommitEntry>, String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    
    let mut commits = Vec::new();
    let mut count = 0;

    for oid in revwalk {
        if count >= limit { break; }
        
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        
        let author = commit.author();
        let date = commit.time();
        
        // Format date simply for now
        let date_str = format!("{}", date.seconds()); 

        commits.push(CommitEntry {
            hash: commit.id().to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: author.name().unwrap_or("Unknown").to_string(),
            date: date_str,
        });

        count += 1;
    }

    Ok(commits)
}

#[tauri::command]
pub fn git_read_file(path: String, revision: String) -> Result<String, String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    let workdir = repo.workdir().ok_or("Not a working directory")?;
    
    // Convert absolute path to relative path for git
    let abs_path = std::path::Path::new(&path);
    let rel_path = abs_path.strip_prefix(workdir).map_err(|e| e.to_string())?;
    let rel_path_str = rel_path.to_string_lossy().replace("\\", "/");

    let spec = format!("{}:{}", revision, rel_path_str);
    let obj = repo.revparse_single(&spec).map_err(|e| e.to_string())?;
    
    let blob = obj.as_blob().ok_or("Object is not a blob")?;
    let content = std::str::from_utf8(blob.content()).map_err(|e| e.to_string())?;
    
    Ok(content.to_string())
}

#[tauri::command]
pub fn git_stage(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    
    // Absolute to relative
    let workdir = repo.workdir().ok_or("Not a working directory")?;
    let abs_path = std::path::Path::new(&file_path);
    let rel_path = abs_path.strip_prefix(workdir).map_err(|e| e.to_string())?;

    index.add_path(rel_path).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(repo_path: String, file_path: String) -> Result<(), String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    
    // Absolute to relative
    let workdir = repo.workdir().ok_or("Not a working directory")?;
    let abs_path = std::path::Path::new(&file_path);
    let rel_path = abs_path.strip_prefix(workdir).map_err(|e| e.to_string())?;

    // Unstaging is essentially resetting the path in the index to HEAD
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let head_tree = head_commit.tree().map_err(|e| e.to_string())?;

    repo.reset_default(Some(head_tree.as_object()), [rel_path].iter()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    let sig = repo.signature().map_err(|e| e.to_string())?;
    
    let head = repo.head().map_err(|e| e.to_string())?;
    let parent_commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent_commit]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_get_branch(repo_path: String) -> Result<String, String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    let head = repo.head().map_err(|e| e.to_string())?;
    
    if head.is_branch() {
        Ok(head.shorthand().unwrap_or("unknown").to_string())
    } else {
        Ok(head.name().unwrap_or("Detached HEAD").to_string())
    }
}

#[derive(Serialize, Clone)]
pub struct LineDiff {
    pub line: u32,
    pub diff_type: String, // "added", "modified", "deleted"
}

#[tauri::command]
pub fn git_get_line_diff(repo_path: String, file_path: String) -> Result<Vec<LineDiff>, String> {
    let repo = Repository::discover(&repo_path).map_err(|e| e.to_string())?;
    
    // Absolute to relative
    let workdir = repo.workdir().ok_or("Not a working directory")?;
    let abs_path = std::path::Path::new(&file_path);
    let rel_path = abs_path.strip_prefix(workdir).map_err(|e| e.to_string())?;
    let rel_path_str = rel_path.to_string_lossy().replace("\\", "/");

    let mut opts = DiffOptions::new();
    opts.pathspec(&rel_path_str);
    opts.context_lines(0); // We only want changed lines

    let index = repo.index().map_err(|e| e.to_string())?;
    let diff = repo.diff_index_to_workdir(Some(&index), Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    diff.foreach(
        &mut |_delta, _hunk| true,
        None,
        None,
        Some(&mut |_delta, _hunk, line| {
            let origin = line.origin();
            match origin {
                '+' => {
                    if let Some(lineno) = line.new_lineno() {
                        results.push(LineDiff {
                            line: lineno,
                            diff_type: "added".to_string(),
                        });
                    }
                }
                '-' => {
                    if let Some(lineno) = line.old_lineno() {
                        results.push(LineDiff {
                            line: lineno,
                            diff_type: "deleted".to_string(),
                        });
                    }
                }
                _ => {}
            }
            true
        }),
    ).map_err(|e| e.to_string())?;

    // Post-process to detect modifications: 
    // If a hunk has both additions and deletions in the same logical area,
    // simplify to 'modified' for the gutter bar.
    // For now, let's keep it simple and just return what we have.
    // The frontend can decide how to render overlapping lines.
    
    Ok(results)
}
