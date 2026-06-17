# Work Assistant 

This repository provides a skill-driven work assistant for [Claude Code](https://claude.com/product/claude-code) / [Opencode](https://opencode.ai) / [Pi.dev](https://pi.dev) with:

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
| `memory-backup` | Syncs `CLAUDE.md`, `TASKS.md`, and `memory/` with a separate private Git repo clone, including push, pull, and sync modes. |
| `journal-sync` | Imports recent Notion Journal entries into monthly `memory/journals/month_YYYY-MM_text.txt` files with incremental sync tracking. |

### External source readers

| Skill | Purpose |
|---|---|
| `gmail` | Reads and searches Gmail via `gog`. |
| `google-calendar` | Reads Google Calendar via `gog`. |
| `google-drive` | Reads and searches Google Drive folders and files via `gog`. |
| `slack` | Reads and sends Slack messages via `.claude/skills/slack/slack-cli.js` with `@slack/web-api`. |
| `notion` | Reads, searches, and updates Notion pages, data sources/databases, Markdown, files, and Workers via the official `ntn` CLI. |
| `notebooklm` | Manages NotebookLM notebooks, sources, chats, and generated artifacts via `notebooklm-py`. |

## Pi Agent Extensions

This repository includes custom UI extensions for [pi](https://pi.dev), the coding agent framework.

The Pi extension provides a continuous status bar widget and several interactive modals to manage your workflow directly within the TUI:

| Command | Purpose |
|---|---|
| `/tasks` | Interactive TUI modal to view `TASKS.md` categories, page through tasks, and mark open tasks as done (uses `Space` or `Enter`). |
| `/memory` | Fuzzy file browser for the `memory/` directory. Provides a scrollable file preview with markdown rendering (`r` to toggle raw source) and fast keyboard navigation. |
| `/calendar` | Overlay showing upcoming Google Calendar events via `gog`. |
| `/logs` | Interactive modal to page through `memory/log.md` entries (Older/Newer), keeping you aware of recent context changes. |

## Project-local Pi Subagents

This repo also defines project-only subagents for the [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) extension. They live under `.pi/agents/`, so they apply only to this workspace and are not installed globally.

| Agent | Purpose | Writes? |
|---|---|---|
| `activity-scanner` | General read-only scanner for Slack, Gmail, Calendar, Drive, Notion, `TASKS.md`, and memory context. Used by workflows such as `work-update` and optionally `daily-sync` to collect evidence without consuming the parent agent's context. | No |
| `task-reconciler` | Compares task candidates against `TASKS.md` and returns triage recommendations: already tracked, new candidate, stale, completion signal, waiting-on change, duplicate, or unclear. | No |
| `memory-curator` | Classifies candidate memory updates against `CLAUDE.md` and `memory/`, recommending safe existing-page updates, glossary/hot-cache candidates, new-page confirmations, or ignored transient noise. | No |

Design rules:
- Subagents collect and classify only; the parent workflow remains responsible for user confirmation and file edits.
- `work-update` may spawn `activity-scanner` agents in parallel, then use `task-reconciler` and `memory-curator` before applying confirmed task/memory changes.
- `daily-sync` may use `activity-scanner` only to draft suggested standup answers; the parent agent still asks the 3 required questions and posts the confirmed Slack reply.

If you add or rename agents, restart Pi or start a new session so the `Agent` tool schema and `/agents` menu refresh.

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
│       ├── memory-backup/
│       ├── journal-sync/
│       ├── gmail/
│       ├── google-calendar/
│       ├── google-drive/
│       ├── slack/
│       ├── notion/
│       └── notebooklm/
├── .pi/
│   ├── agents/
│   │   ├── activity-scanner.md
│   │   ├── task-reconciler.md
│   │   └── memory-curator.md
│   ├── extensions/
│   └── settings.json
├── TASKS.md         # generated/maintained by workflow
├── CLAUDE.md        # generated hot-memory file
├── package.json     # Node dependencies for local skill tooling
├── dashboard.html   # copied to root for browser use
└── memory/
    ├── glossary.md
    ├── journals/
    ├── people/
    ├── projects/
    ├── context/
    └── topics/
```

## Quick Start

1. Install dependencies with `npm install`, then configure authentication.
2. Run `/work-start`.
3. Open `dashboard.html` from your file browser.
4. Use `/work-update` regularly to keep tasks and memory fresh.
5. Use `/daily-sync` to post your standup update to the right Slack thread.
6. Optional for Pi: install `@tintinweb/pi-subagents` to enable the project-local agents in `.pi/agents/`.
7. Optional: configure `MEMORY_BACKUP_DIR` if you want to use `/memory-backup`.
8. Optional: configure Notion and run `/journal-sync` to import recent Journal entries into memory.

## Prerequisites

- Claude Code / Opencode
- `node`
- `python3`
- Node dependencies:
  - `npm install`
- `gog` CLI:
  - `brew install gogcli`
- `ntn` CLI for Notion:
  - `npm install --global ntn`
  - or use the local helper: `npm run --silent ntn -- ...`
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

### Notion (via `ntn`)

1. Create a Notion integration and copy its internal integration token.
2. Share each target page/database with the integration (`...` → `Connect to`).
3. Add the token to `.env`:
   - `NOTION_API_TOKEN=ntn_your_token_here`
   - optional: `NOTION_WORKSPACE_ID=<workspace_id>`
4. Verify:
   - `npm run --silent ntn -- api v1/users`

Use `/notion` for general Notion operations. Use `/journal-sync` to import the configured Journal data source into `memory/journals/`.

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
   - `/memory-backup` - push local memory to the backup repo
   - `/memory-backup --pull` - pull latest backup into this workspace
   - `/memory-backup --sync` - pull latest, then push local memory
   - `/memory-backup --dry-run` - preview push

`MEMORY_BACKUP_DIR` must point to a clean local clone of a separate private Git repo.

For two-computer use, run `/memory-backup --pull` or `/memory-backup --sync` when starting work, and `/memory-backup` after memory/task changes. Pull/sync refuse to overwrite local changes in `CLAUDE.md`, `TASKS.md`, or `memory/`.

## Operating Notes

- `work-update` is intentionally interactive: it asks before creating/updating tasks and memory entries.
- `CLAUDE.md` should remain compact; detailed context lives in `memory/`.
- If key files are missing, run `/work-start` to repair/bootstrap the system.
