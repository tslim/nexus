---
name: memory-backup
description: Backup CLAUDE.md, TASKS.md, and memory/ to a private Git repo using `bash .claude/skills/memory-backup/backup.sh`.
---

# Memory Backup

Run the backup script for the current workspace. It syncs only:
- `CLAUDE.md`
- `TASKS.md`
- `memory/`

## Usage

Use Bash to run the script directly:

```bash
bash .claude/skills/memory-backup/backup.sh            # push local memory to backup repo
bash .claude/skills/memory-backup/backup.sh --pull     # pull latest backup into this workspace
bash .claude/skills/memory-backup/backup.sh --sync     # pull latest, then push local memory
bash .claude/skills/memory-backup/backup.sh --dry-run  # preview push
```

Do not run `memory-backup` itself as a shell command; it is just the skill name.

## Setup

Set `MEMORY_BACKUP_DIR` in your workspace `.env` file to the local path of a separate Git clone for your private backup repo.

Example:

```bash
MEMORY_BACKUP_DIR=/your/path/to/memory-backups/
```

Requirements for `MEMORY_BACKUP_DIR`:
- It must already exist.
- It must be a Git repo.
- It should be clean before each run.
- It should point to a private repo clone with push access configured.

## Instructions

The script is the only thing that should perform the backup. Do not manually reconstruct the copy, add, commit, or push flow with ad hoc shell commands unless the user explicitly asks to debug the script itself.

## What the script does

- Loads `MEMORY_BACKUP_DIR` from the environment or workspace `.env`
- Verifies the destination is a Git repo separate from the source workspace
- Push mode: fetches the upstream and refuses remote-ahead or diverged history before copying files. If safe, mirrors only `CLAUDE.md`, `TASKS.md`, and `memory/`, commits changes, then pushes.
- Push retries pending commits even if there are no new file changes. A previous failed push must not be reported as complete just because the files match.
- Pull mode: refuses staged source changes and checks actual file content against the current backup copy before running `git pull --ff-only`, then restores those files. Unstaged content already saved in the backup is safe even if the workspace's Git HEAD is older.
- Sync mode: guarded pull first, then guarded push.
- Pull/sync protect Git-ignored memory too. If existing workspace content differs from the current backup, they stop rather than guess which version to keep. An empty workspace can be restored.
- Copies use checksums, not only file size and modification time, so same-size edits with matching timestamps are not skipped.
- Remote divergence is not merged or rebased automatically. Preserve both histories and workspace files, inspect the changes, and reconcile explicitly. Never force-push to resolve it.

## Notes

- The backup repo keeps the same relative structure for easy restore.
- This command does not back up other files, even if they exist in the workspace. Skill code and presentation files are not included.
- Git status alone is not a valid clean check when memory paths are ignored. Check actual content before restoring or reconciling.
- Run isolated regression tests with `python3 .claude/skills/memory-backup/test_backup.py`. Tests use temporary repositories and a local bare remote; they must not access the real backup or GitHub.
- If `TASKS.md` or `memory/` do not exist, the script skips them cleanly.
