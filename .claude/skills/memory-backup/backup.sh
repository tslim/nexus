#!/usr/bin/env bash

set -euo pipefail

MODE="push"
if [[ "${1-}" == "--dry-run" ]]; then
  MODE="dry-run"
elif [[ "${1-}" == "--pull" ]]; then
  MODE="pull"
elif [[ "${1-}" == "--sync" ]]; then
  MODE="sync"
elif [[ $# -gt 0 ]]; then
  printf 'Unsupported argument: %s\n' "$1" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [[ -f "$SOURCE_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$SOURCE_DIR/.env"
  set +a
fi

BACKUP_DIR="${MEMORY_BACKUP_DIR:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  printf 'MEMORY_BACKUP_DIR is not set. Add it to the environment or %s/.env\n' "$SOURCE_DIR" >&2
  exit 1
fi

resolve_path() {
  python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

SOURCE_DIR_REAL="$(resolve_path "$SOURCE_DIR")"
BACKUP_DIR_REAL="$(resolve_path "$BACKUP_DIR")"

if [[ ! -d "$BACKUP_DIR_REAL" ]]; then
  printf 'Backup directory does not exist: %s\n' "$BACKUP_DIR_REAL" >&2
  exit 1
fi

if [[ ! -d "$BACKUP_DIR_REAL/.git" ]]; then
  printf 'Backup directory is not a Git repo: %s\n' "$BACKUP_DIR_REAL" >&2
  exit 1
fi

refresh_git_index() {
  local repo_dir="$1"
  local rc
  # Refresh cached stat information before clean checks. This avoids false
  # positives on filesystems with delayed metadata updates (for example iCloud).
  set +e
  git -C "$repo_dir" update-index -q --refresh
  rc=$?
  set -e
  if [[ $rc -gt 1 ]]; then
    printf 'Failed to refresh Git index in %s (git update-index exit %s).\n' "$repo_dir" "$rc" >&2
    exit "$rc"
  fi
}

has_unstaged_changes() {
  local repo_dir="$1"
  local rc
  set +e
  git -C "$repo_dir" diff --quiet
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    return 1
  elif [[ $rc -eq 1 ]]; then
    return 0
  fi
  printf 'Failed to check unstaged changes in %s (git diff exit %s).\n' "$repo_dir" "$rc" >&2
  exit "$rc"
}

has_staged_changes() {
  local repo_dir="$1"
  local rc
  set +e
  git -C "$repo_dir" diff --cached --quiet
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    return 1
  elif [[ $rc -eq 1 ]]; then
    return 0
  fi
  printf 'Failed to check staged changes in %s (git diff --cached exit %s).\n' "$repo_dir" "$rc" >&2
  exit "$rc"
}

backup_tracked_changes=false
backup_staged_changes=false
backup_untracked_files=""

refresh_git_index "$BACKUP_DIR_REAL"

if has_unstaged_changes "$BACKUP_DIR_REAL"; then
  backup_tracked_changes=true
fi

if has_staged_changes "$BACKUP_DIR_REAL"; then
  backup_staged_changes=true
fi

backup_untracked_files="$(git -C "$BACKUP_DIR_REAL" ls-files --others --exclude-standard)"

if [[ "$backup_tracked_changes" == true || "$backup_staged_changes" == true || -n "$backup_untracked_files" ]]; then
  printf 'Backup repo has uncommitted changes: %s\n' "$BACKUP_DIR_REAL" >&2
  if [[ "$backup_tracked_changes" == true ]]; then
    printf 'Tracked changes present.\n' >&2
  fi
  if [[ "$backup_staged_changes" == true ]]; then
    printf 'Staged changes present.\n' >&2
  fi
  if [[ -n "$backup_untracked_files" ]]; then
    printf 'Untracked files:\n%s\n' "$backup_untracked_files" >&2
  fi
  exit 1
fi

if [[ "$SOURCE_DIR_REAL" == "$BACKUP_DIR_REAL" ]]; then
  printf 'Backup directory must be different from the source workspace.\n' >&2
  exit 1
fi

case "$BACKUP_DIR_REAL" in
  "$SOURCE_DIR_REAL"/*)
    printf 'Backup directory cannot live inside the source workspace.\n' >&2
    exit 1
    ;;
esac

remove_path() {
  python3 - "$1" <<'PY'
import os
import shutil
import sys

path = sys.argv[1]
if os.path.isdir(path) and not os.path.islink(path):
    shutil.rmtree(path)
elif os.path.lexists(path):
    os.unlink(path)
PY
}

sync_path() {
  local from_root="$1"
  local to_root="$2"
  local relative_path="$3"
  local source_path="$from_root/$relative_path"
  local dest_path="$to_root/$relative_path"

  if [[ -d "$source_path" ]]; then
    if [[ -f "$dest_path" || -L "$dest_path" ]]; then
      remove_path "$dest_path"
    fi
    mkdir -p "$dest_path"
    rsync -ac --delete "$source_path/" "$dest_path/"
    printf 'Synced %s\n' "$relative_path"
  elif [[ -f "$source_path" ]]; then
    if [[ -d "$dest_path" ]]; then
      remove_path "$dest_path"
    fi
    mkdir -p "$(dirname "$dest_path")"
    rsync -ac "$source_path" "$dest_path"
    printf 'Synced %s\n' "$relative_path"
  else
    if [[ -e "$dest_path" || -L "$dest_path" ]]; then
      remove_path "$dest_path"
    fi
    printf 'Skipped missing %s\n' "$relative_path"
  fi
}

check_source_before_pull() {
  if git -C "$SOURCE_DIR_REAL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local staged_changes
    staged_changes="$(git -C "$SOURCE_DIR_REAL" diff --cached --name-only -- CLAUDE.md TASKS.md memory)"
    if [[ -n "$staged_changes" ]]; then
      printf 'Source memory has staged changes; pull refused to preserve the index:\n%s\n' "$staged_changes" >&2
      exit 1
    fi
    # An earlier restore can leave source Git HEAD behind the saved content.
    # Unstaged content is safe only if the byte-level check below matches it.
  fi

  # Git status does not report ignored memory files. Compare actual content
  # with the current backup tip BEFORE updating that tip or copying anything.
  python3 - "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" <<'PY'
import hashlib
import os
from pathlib import Path
import sys

source, backup = map(Path, sys.argv[1:])
paths = ('CLAUDE.md', 'TASKS.md', 'memory')
if not any(os.path.lexists(source / name) for name in paths):
    # A new workspace with no memory yet is a restore, not an overwrite.
    sys.exit(0)

def snapshot(root):
    result = {}
    def visit(path):
        key = str(path.relative_to(root))
        if path.is_symlink():
            result[key] = ('link', os.readlink(path))
        elif path.is_dir():
            result[key] = ('directory',)
            for child in path.iterdir():
                visit(child)
        elif path.is_file():
            result[key] = ('file', hashlib.sha256(path.read_bytes()).hexdigest())
        elif os.path.lexists(path):
            raise RuntimeError(f'Unsupported memory path: {path}')
    for name in paths:
        visit(root / name)
    return result

local, saved = snapshot(source), snapshot(backup)
changed = sorted(key for key in local.keys() | saved.keys()
                 if local.get(key) != saved.get(key))
if changed:
    print('Source memory differs from the current backup; pull refused to avoid overwrite.', file=sys.stderr)
    for name in changed:
        print(f'  {name}', file=sys.stderr)
    print('Back up local changes first, or explicitly reconcile both versions. Git-ignored files are protected too.', file=sys.stderr)
    sys.exit(1)
PY
}

pull_latest() {
  check_source_before_pull
  printf 'Pulling latest backup repo...\n'
  git -C "$BACKUP_DIR_REAL" pull --ff-only

  sync_path "$BACKUP_DIR_REAL" "$SOURCE_DIR_REAL" "CLAUDE.md"
  sync_path "$BACKUP_DIR_REAL" "$SOURCE_DIR_REAL" "TASKS.md"
  sync_path "$BACKUP_DIR_REAL" "$SOURCE_DIR_REAL" "memory"
  printf 'Pull complete.\n'
}

if [[ "$MODE" == "dry-run" ]]; then
  printf 'Dry run only. No files will be changed.\n'
  printf 'Source: %s\n' "$SOURCE_DIR_REAL"
  printf 'Backup: %s\n' "$BACKUP_DIR_REAL"
  for path in CLAUDE.md TASKS.md memory; do
    if [[ -e "$SOURCE_DIR_REAL/$path" ]]; then
      printf 'Would sync %s\n' "$path"
    else
      printf 'Would skip missing %s\n' "$path"
    fi
  done
  exit 0
fi

check_push_history() {
  local upstream
  if ! upstream="$(git -C "$BACKUP_DIR_REAL" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"; then
    printf 'Backup branch has no upstream. Configure its remote branch before backing up.\n' >&2
    exit 1
  fi
  printf 'Checking remote backup history...\n'
  git -C "$BACKUP_DIR_REAL" fetch
  if ! git -C "$BACKUP_DIR_REAL" merge-base --is-ancestor "$upstream" HEAD; then
    printf 'Remote backup contains commits not in the local backup. No memory files were copied or committed.\n' >&2
    printf 'Use --pull if only the remote advanced and source memory matches the saved local copy. Otherwise reconcile both histories first; do not force-push.\n' >&2
    exit 1
  fi
}

if [[ "$MODE" == "pull" || "$MODE" == "sync" ]]; then
  pull_latest
fi

if [[ "$MODE" == "pull" ]]; then
  exit 0
fi

check_push_history

sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "CLAUDE.md"
sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "TASKS.md"
sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "memory"

git -C "$BACKUP_DIR_REAL" add -A -- CLAUDE.md TASKS.md memory

if git -C "$BACKUP_DIR_REAL" diff --cached --quiet -- CLAUDE.md TASKS.md memory; then
  printf 'No backup changes to commit; checking for pending pushes.\n'
else
  SOURCE_REV="no-git"
  if git -C "$SOURCE_DIR_REAL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    SOURCE_REV="$(git -C "$SOURCE_DIR_REAL" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  fi

  TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %z')"
  COMMIT_MSG="memory-backup: $TIMESTAMP from $SOURCE_REV"
  git -C "$BACKUP_DIR_REAL" commit -m "$COMMIT_MSG"
fi

# Always retry publication, even if a previous run already made the commit.
git -C "$BACKUP_DIR_REAL" push

printf 'Backup complete.\n'
