# Work Assistant 

This repository provides a skill-driven work assistant for Claude Code / Opencode with:

- `TASKS.md` as the shared task board
- `CLAUDE.md` as generated working memory (hot cache)
- `memory/` as long-term structured memory
- `dashboard.html` as a visual UI for tasks + memory

## How It Works

- `work-start` bootstraps and generates `CLAUDE.md` + `memory/` when missing.
- `work-update` keeps tasks and memory current through interactive sync, using memory query for decoding and memory ingest for durable updates.
- `task-management` defines how `TASKS.md` is structured and updated.
- `memory-management` defines what belongs in hot memory vs deep memory, plus the core `ingest`, `query`, and `lint` workflows.

## Skills in This Repo

### Workflow and memory

| Skill | Purpose |
|---|---|
| `work-start` | First-run initializer: checks/creates `TASKS.md`, ensures dashboard setup, and bootstraps memory (`CLAUDE.md` + `memory/`). |
| `work-update` | Main ongoing sync flow for tasks + memory gaps, stale task triage, and context enrichment. Uses memory query for lookup/decoding and memory ingest for durable filing. |
| `daily-sync` | Collects your 3 standup answers and posts them to the current team daily thread in Slack. |
| `task-management` | Task conventions for `TASKS.md` (active, waiting, someday, done) and task update behavior. |
| `memory-management` | Two-tier memory system: compact `CLAUDE.md` hot cache + detailed `memory/` knowledge base, with explicit `ingest`, `query`, and `lint` workflows. |
| `memory-backup` | Backs up `CLAUDE.md`, `TASKS.md`, and `memory/` to a separate private Git repo clone. |

### External source readers

| Skill | Purpose |
|---|---|
| `gmail` | Reads and searches Gmail via `gog`. |
| `google-calendar` | Reads Google Calendar via `gog`. |
| `google-drive` | Reads and searches Google Drive folders and files via `gog`. |
| `slack` | Reads and sends Slack messages via `.claude/skills/slack/slack-cli.js` with `@slack/web-api`. |
| `granola` | Reads local meeting notes/transcripts via `.claude/skills/granola/granola-cli.py` |
| `notebooklm` | Manages NotebookLM notebooks, sources, chats, and generated artifacts via `notebooklm-py`. |

## Repository Structure

```text
.
├── .claude/
│   └── skills/
│       ├── dashboard.html
│       ├── work-start/
│       ├── work-update/
│       ├── daily-sync/
│       ├── task-management/
│       ├── memory-management/
│       ├── gmail/
│       ├── google-calendar/
│       ├── google-drive/
│       ├── slack/
│       ├── granola/
│       └── notebooklm/
├── TASKS.md         # generated/maintained by workflow
├── CLAUDE.md        # generated hot-memory file
├── package.json     # Node dependencies for local skill tooling
├── dashboard.html   # copied to root for browser use
└── memory/
    ├── glossary.md
    ├── people/
    ├── projects/
    └── context/
```

## Quick Start

1. Install dependencies with `npm install`, then configure authentication.
2. Run `/work-start`.
3. Open `dashboard.html` from your file browser.
4. Use `/work-update` regularly to keep tasks and memory fresh.
5. Use `/daily-sync` to post your standup update to the right Slack thread.
6. Optional: configure `MEMORY_BACKUP_DIR` if you want to use `/memory-backup`.

## Prerequisites

- Claude Code / Opencode
- `node`
- `python3`
- Node dependencies:
  - `npm install`
- `gog` CLI:
  - `brew install gogcli`
- `notebooklm` CLI:
  - `uv venv`
  - `uv pip install --python .venv/bin/python "notebooklm-py[browser]"`
  - `uv run playwright install chromium`
  - `source .venv/bin/activate`

## Authentication Setup

### Google (Gmail + Calendar + Drive via `gog`)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project.
3. Enable these APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
4. Configure OAuth consent screen.
5. Create OAuth Client credentials (Desktop App recommended).
6. Download OAuth client JSON (example: `~/Downloads/client_secret.json`).
7. Configure `gog`:
   - `gog auth credentials ~/Downloads/client_secret.json`
8. Authorize account:
   - `gog auth add you@gmail.com`
9. Set default account (optional):
   - `gog auth manage`
   - or `export GOG_ACCOUNT=you@gmail.com`

### Slack (User token with required scopes)

1. Open [Slack API Apps](https://api.slack.com/apps), then create/select your app.
2. In **OAuth & Permissions**, add **User Token Scopes**:
   - `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - `channels:read`, `groups:read`, `users:read`
   - `chat:write`
3. Install/Reinstall app to workspace.
4. Copy User OAuth token (`xoxp-...`).
5. Create `.env` file and save your token in it:
   - `SLACK_TOKEN=xoxp-your-token`
6. Verify:
   - `node .claude/skills/slack/slack-cli.js test`

### NotebookLM (via notebooklm-py)

1. Install the CLI:
   - `uv venv`
   - `uv pip install --python .venv/bin/python "notebooklm-py[browser]"`
   - `uv run playwright install chromium`
   - `source .venv/bin/activate`
2. Authenticate with Google:
   - `notebooklm login`
3. Verify the setup:
   - `notebooklm status`
   - `notebooklm list --json`
4. If auth expires or verification fails:
   - `notebooklm auth check`
   - `notebooklm login`

For parallel workflows, prefer explicit notebook IDs (`-n <id>` or `--notebook <id>`) instead of relying on `notebooklm use`.

## Memory backup

1. Clone your private backup repository somewhere outside this workspace.
2. Ensure the clone already exists, is a Git repo, and has push access configured.
3. Add `MEMORY_BACKUP_DIR` to your workspace `.env` file:
   - `MEMORY_BACKUP_DIR=/your/path/to/private-backup-repo`
4. Run the skill:
   - `/memory-backup`
   - or `/memory-backup --dry-run`

`MEMORY_BACKUP_DIR` must point to a clean local clone of a separate private Git repo.

## Operating Notes

- `work-update` is intentionally interactive: it asks before creating/updating tasks and memory entries.
- `CLAUDE.md` should remain compact; detailed context lives in `memory/`.
- If key files are missing, run `/work-start` to repair/bootstrap the system.
