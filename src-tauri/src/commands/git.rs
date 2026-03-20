use crate::models::git::{GitBranchInfo, GitCommitInfo, GitDiffFile, GitDiffHunk, GitDiffLine};
use git2::{BranchType, DiffOptions, Oid, Repository};

#[tauri::command]
pub fn git_list_branches(repo_path: String) -> Result<Vec<GitBranchInfo>, String> {
    let repo =
        Repository::open(&repo_path).map_err(|e| format!("Git 저장소를 열 수 없습니다: {}", e))?;
    let mut branches = Vec::new();

    // Local branches
    let branch_iter = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| e.to_string())?;
    for branch_result in branch_iter {
        let (branch, _) = branch_result.map_err(|e| e.to_string())?;
        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .unwrap_or("(invalid utf-8)")
            .to_string();
        let is_head = branch.is_head();
        let commit_hash = branch
            .get()
            .target()
            .map(|oid| oid.to_string())
            .unwrap_or_default();
        branches.push(GitBranchInfo {
            name,
            is_head,
            is_remote: false,
            commit_hash,
        });
    }

    // Remote branches
    let remote_iter = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| e.to_string())?;
    for branch_result in remote_iter {
        let (branch, _) = branch_result.map_err(|e| e.to_string())?;
        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .unwrap_or("(invalid utf-8)")
            .to_string();
        let commit_hash = branch
            .get()
            .target()
            .map(|oid| oid.to_string())
            .unwrap_or_default();
        branches.push(GitBranchInfo {
            name,
            is_head: false,
            is_remote: true,
            commit_hash,
        });
    }

    // HEAD branch first
    branches.sort_by(|a, b| b.is_head.cmp(&a.is_head));
    Ok(branches)
}

#[tauri::command]
pub fn git_get_commits(
    repo_path: String,
    branch_name: String,
    limit: usize,
) -> Result<Vec<GitCommitInfo>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;

    let oid = if branch_name.contains('/') {
        // Remote branch: refs/remotes/<name>
        let refname = format!("refs/remotes/{}", branch_name);
        repo.refname_to_id(&refname).map_err(|e| e.to_string())?
    } else {
        let branch = repo
            .find_branch(&branch_name, BranchType::Local)
            .map_err(|e| e.to_string())?;
        branch
            .get()
            .target()
            .ok_or("브랜치 타겟을 찾을 수 없습니다".to_string())?
    };

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push(oid).map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let mut commits = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit {
            break;
        }
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let time = commit.time();
        let ts = time.seconds();
        let dt = chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default();
        let offset = chrono::FixedOffset::east_opt(time.offset_minutes() * 60).unwrap_or(
            chrono::FixedOffset::east_opt(9 * 3600).unwrap(), // KST default
        );
        let local_dt = dt.with_timezone(&offset);
        let date_str = local_dt.format("%Y-%m-%d %H:%M:%S").to_string();

        let parents: Vec<String> = commit
            .parent_ids()
            .map(|id| id.to_string())
            .collect();

        commits.push(GitCommitInfo {
            hash: oid.to_string(),
            short_hash: oid.to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: ts,
            date_str,
            parents,
        });
    }

    Ok(commits)
}

#[tauri::command]
pub fn git_get_diff(repo_path: String, commit_hash: String) -> Result<Vec<GitDiffFile>, String> {
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(&commit_hash).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| e.to_string())?
                .tree()
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let num_deltas = diff.deltas().len();
    let mut files: Vec<GitDiffFile> = Vec::new();

    for i in 0..num_deltas {
        let delta = diff.get_delta(i).unwrap();
        let status = match delta.status() {
            git2::Delta::Added => "Added",
            git2::Delta::Deleted => "Deleted",
            git2::Delta::Modified => "Modified",
            git2::Delta::Renamed => "Renamed",
            git2::Delta::Copied => "Copied",
            _ => "Other",
        }
        .to_string();

        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let old_path = if status == "Renamed" {
            delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        files.push(GitDiffFile {
            path: new_path,
            status,
            old_path,
            hunks: Vec::new(),
        });
    }

    // Extract hunks and lines via Patch
    for i in 0..num_deltas {
        if let Ok(patch) = git2::Patch::from_diff(&diff, i) {
            if let Some(patch) = patch {
                let num_hunks = patch.num_hunks();
                for h in 0..num_hunks {
                    let (hunk, num_lines) = patch.hunk(h).map_err(|e| e.to_string())?;
                    let header = String::from_utf8_lossy(hunk.header()).to_string();
                    let mut lines = Vec::new();

                    for l in 0..num_lines {
                        let line = patch.line_in_hunk(h, l).map_err(|e| e.to_string())?;
                        let origin = match line.origin() {
                            '+' => "+".to_string(),
                            '-' => "-".to_string(),
                            _ => " ".to_string(),
                        };
                        lines.push(GitDiffLine {
                            origin,
                            content: String::from_utf8_lossy(line.content()).to_string(),
                            old_lineno: line.old_lineno(),
                            new_lineno: line.new_lineno(),
                        });
                    }

                    if i < files.len() {
                        files[i].hunks.push(GitDiffHunk { header, lines });
                    }
                }
            }
        }
    }

    Ok(files)
}
