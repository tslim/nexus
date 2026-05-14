---
name: memory-backup
description: Backup CLAUDE.md, TASKS.md, and memory/ to a private Git repo
---

# Memory Backup

Run the backup script for the current workspace. This command syncs only:
- `CLAUDE.md`
- `TASKS.md`
- `memory/`

## Usage

```bash
/memory-backup            # push local memory to backup repo
/memory-backup --pull     # pull latest backup into this workspace
/memory-backup --sync     # pull latest, then push local memory
/memory-backup --dry-run  # preview push
```

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

Use Bash to run:

```bash
bash .claude/skills/memory-backup/backup.sh
```

Other modes:

```bash
bash .claude/skills/memory-backup/backup.sh --pull
bash .claude/skills/memory-backup/backup.sh --sync
bash .claude/skills/memory-backup/backup.sh --dry-run
```

The script is the only thing that should perform the backup. Do not manually reconstruct the copy, add, commit, or push flow with ad hoc shell commands unless the user explicitly asks to debug the script itself.

## What the script does

- Loads `MEMORY_BACKUP_DIR` from the environment or workspace `.env`
- Verifies the destination is a Git repo separate from the source workspace
- Push mode: mirrors only `CLAUDE.md`, `TASKS.md`, and `memory/` into the backup repo, commits only if changed, then pushes
- Pull mode: runs `git pull --ff-only` in the backup repo, then copies those files into the workspace
- Sync mode: pull first, then push
- Pull/sync refuse to overwrite local changes under `CLAUDE.md`, `TASKS.md`, or `memory/`

## Notes

- The backup repo keeps the same relative structure for easy restore.
- This command does not back up other files, even if they exist in the workspace.
- If `TASKS.md` or `memory/` do not exist, the script skips them cleanly.
