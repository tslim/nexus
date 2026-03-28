# Work Assistant (Claude Code + Skills)

This repository is a personal work assistant setup for Claude Code.  
It helps you capture and organize work across email, Slack, calendar, and meeting notes into a simple file-based task system under `memory/`.

## Important First Step

Before using this repo, add your profile and channels in `CLAUDE.local.md`:

- `## About Me`
- `### Slack Channels`

These sections are user-specific and should reflect your own identity, team context, and channel IDs.

## What This Assistant Does

- Tracks tasks in markdown files (`memory/tasks/TASK-*.md`)
- Keeps project context in `memory/projects/`
- Keeps people context in `memory/people/`
- Syncs context from multiple sources and turns it into actionable follow-ups
- Uses Claude Code skills for repeatable workflows

## Included Skills (Repo)

These are the core skills in `.claude/skills/`:

| Skill | What it does |
|---|---|
| `read-email` | Uses `gog` to search/read Gmail threads, summarize senders/subjects, and surface action items. |
| `read-calendar` | Uses `gog` to view calendar events, availability, conflicts, and meeting details. |
| `read-slack` | Uses `slack-cli.js` with Slack Web API to list channels, read messages/threads, and send messages. |
| `read-granola` | Uses `granola-cli.py` to read/search local Granola meeting notes and transcripts. |
| `work-sync` | Main aggregation workflow: reads all sources, updates `memory/tasks/`, and maintains `projects/` and `people/` context. |
| `work-tasks` | Displays pending tasks with optional filtering (priority, status views, quick summaries). |

## Repository Structure

```text
.
├── CLAUDE.md
├── .claude/
│   └── skills/
│       ├── read-calendar/
│       ├── read-email/
│       ├── read-granola/
│       ├── read-slack/
│       ├── work-sync/
│       └── work-tasks/
└── memory/
    ├── MEMORY.md
    ├── tasks/
    ├── projects/
    └── people/
```

## Prerequisites

- Claude Code / Cursor setup
- macOS (current setup target)
- `node` (for Slack CLI helper)
- Slack Web API package (required by `.claude/skills/read-slack/slack-cli.js`):
  - `npm install @slack/web-api`
- `python3` (for Granola CLI helper)
- `gog` CLI for Gmail/Calendar:
  - `brew install gogcli`

## Authentication Setup

### Google (Gmail + Calendar via `gog`)

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project.
3. Enable APIs:
   - Gmail API
   - Google Calendar API
4. Configure OAuth consent screen (External/Internal as needed).
5. Create OAuth Client ID credentials (Desktop App is recommended for local CLI usage).
6. Download the OAuth client JSON (for example: `~/Downloads/client_secret.json`).
7. Configure `gog` with your credentials:
   - `gog auth credentials ~/Downloads/client_secret.json`
8. Add and authorize your Google account:
   - `gog auth add you@gmail.com`
9. Optionally set a default account:
   - `gog auth manage`
   - or `export GOG_ACCOUNT=you@gmail.com`

### Slack (User Token for Slack Web API)

1. Go to [Slack API Apps](https://api.slack.com/apps) and create/select an app.
2. In **OAuth & Permissions**, add **User Token Scopes**:
   - `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - `channels:read`, `groups:read`, `users:read`
   - `chat:write`
3. Install/Reinstall the app to workspace.
4. Copy the **User OAuth Token** (starts with `xoxp-`).
5. Export token in your shell:
   - `export SLACK_TOKEN=xoxp-your-token`
6. Verify Slack auth works:
   - `node .claude/skills/read-slack/slack-cli.js test`

## Typical Workflow

1. Run `/work-sync` to pull latest context from all sources.
2. Review current priorities with `/work-tasks`.
3. Focus on high-priority tasks (`/work-tasks high`).
4. Repeat sync after key meetings or message bursts.

## Notes

- Task files are intentionally plain markdown for easy review and git history.
- Calendar is treated as context (events/deadlines), not an automatic task generator.
- Completed tasks can be archived by the sync workflow into `memory/tasks/completed/`.
