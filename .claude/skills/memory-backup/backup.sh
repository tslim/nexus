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

if [[ -n "$(git -C "$BACKUP_DIR_REAL" status --porcelain)" ]]; then
  printf 'Backup repo has uncommitted changes: %s\n' "$BACKUP_DIR_REAL" >&2
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
    rsync -a --delete "$source_path/" "$dest_path/"
    printf 'Synced %s\n' "$relative_path"
  elif [[ -f "$source_path" ]]; then
    if [[ -d "$dest_path" ]]; then
      remove_path "$dest_path"
    fi
    mkdir -p "$(dirname "$dest_path")"
    rsync -a "$source_path" "$dest_path"
    printf 'Synced %s\n' "$relative_path"
  else
    if [[ -e "$dest_path" || -L "$dest_path" ]]; then
      remove_path "$dest_path"
    fi
    printf 'Skipped missing %s\n' "$relative_path"
  fi
}

pull_latest() {
  printf 'Pulling latest backup repo...\n'
  git -C "$BACKUP_DIR_REAL" pull --ff-only

  if git -C "$SOURCE_DIR_REAL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local local_changes
    local_changes="$(git -C "$SOURCE_DIR_REAL" status --porcelain -- CLAUDE.md TASKS.md memory)"
    if [[ -n "$local_changes" ]]; then
      printf 'Local memory files have changes; pull skipped to avoid overwrite:\n%s\n' "$local_changes" >&2
      exit 1
    fi
  fi

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

if [[ "$MODE" == "pull" || "$MODE" == "sync" ]]; then
  pull_latest
fi

if [[ "$MODE" == "pull" ]]; then
  exit 0
fi

sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "CLAUDE.md"
sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "TASKS.md"
sync_path "$SOURCE_DIR_REAL" "$BACKUP_DIR_REAL" "memory"

git -C "$BACKUP_DIR_REAL" add -A -- CLAUDE.md TASKS.md memory

if git -C "$BACKUP_DIR_REAL" diff --cached --quiet -- CLAUDE.md TASKS.md memory; then
  printf 'No backup changes to commit.\n'
  exit 0
fi

SOURCE_REV="no-git"
if git -C "$SOURCE_DIR_REAL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SOURCE_REV="$(git -C "$SOURCE_DIR_REAL" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %z')"
COMMIT_MSG="memory-backup: $TIMESTAMP from $SOURCE_REV"

git -C "$BACKUP_DIR_REAL" commit -m "$COMMIT_MSG"
git -C "$BACKUP_DIR_REAL" push

printf 'Backup complete.\n'
