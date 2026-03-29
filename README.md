# Work Assistant (Claude Code + Skills)

This repository provides a skill-driven work assistant for Claude Code with:

- `TASKS.md` as the shared task board
- `CLAUDE.md` as generated working memory (hot cache)
- `memory/` as long-term structured memory
- `dashboard.html` as a visual UI for tasks + memory

## How It Works

- `work-start` bootstraps and generates `CLAUDE.md` + `memory/` when missing.
- `work-update` keeps tasks and memory current through interactive sync.
- `memory-management` defines what belongs in hot memory vs deep memory.

## Skills in This Repo

### Workflow and memory

| Skill | Purpose |
|---|---|
| `work-start` | First-run initializer: checks/creates `TASKS.md`, ensures dashboard setup, and bootstraps memory (`CLAUDE.md` + `memory/`). |
| `work-update` | Main ongoing sync flow for tasks + memory gaps, stale task triage, and context enrichment. |
| `task-management` | Task conventions for `TASKS.md` (active, waiting, someday, done) and task update behavior. |
| `memory-management` | Two-tier memory system: compact `CLAUDE.md` hot cache + detailed `memory/` knowledge base. |

### External source readers

| Skill | Purpose |
|---|---|
| `read-email` | Reads/searches Gmail via `gog`. |
| `read-calendar` | Reads Google Calendar via `gog`. |
| `read-google-drive` | Reads/searches Google Drive folders and files via `gog`. |
| `read-slack` | Uses `.claude/skills/read-slack/slack-cli.js` with `@slack/web-api`. |
| `read-granola` | Uses `.claude/skills/read-granola/granola-cli.py` for local meeting notes/transcripts. |

## Repository Structure

```text
.
├── .claude/
│   └── skills/
│       ├── dashboard.html
│       ├── work-start/
│       ├── work-update/
│       ├── task-management/
│       ├── memory-management/
│       ├── read-email/
│       ├── read-calendar/
│       ├── read-google-drive/
│       ├── read-slack/
│       └── read-granola/
├── TASKS.md         # generated/maintained by workflow
├── CLAUDE.md        # generated hot-memory file
├── dashboard.html   # copied to root for browser use
└── memory/
    ├── glossary.md
    ├── people/
    ├── projects/
    └── context/
```

## Quick Start

1. Install dependencies and configure authentication.
2. Run `/work-start`.
3. Open `dashboard.html` from your file browser.
4. Use `/work-update` regularly to keep tasks and memory fresh.

## Prerequisites

- Claude Code / Cursor
- `node`
- `python3`
- `gog` CLI:
  - `brew install gogcli`
- Slack Web API dependency:
  - `npm install @slack/web-api`

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
5. Export token:
   - `export SLACK_TOKEN=xoxp-your-token`
6. Verify:
   - `node .claude/skills/read-slack/slack-cli.js test`

## Operating Notes

- `work-update` is intentionally interactive: it asks before creating/updating tasks and memory entries.
- `CLAUDE.md` should remain compact; detailed context lives in `memory/`.
- If key files are missing, run `/work-start` to repair/bootstrap the system.
