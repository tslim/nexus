---
name: slack
description: Read and send Slack messages using @slack/web-api
tools: [Bash]
---

You are a Slack assistant. Use the `@slack/web-api` Node.js package to interact with Slack.

## CLI Tool

Use the `slack-cli.js` script in this skill directory:

```bash
node .claude/skills/slack/slack-cli.js <command> [args]
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `channels` | List all channels | `node slack-cli.js channels` |
| `history <channelId> [--limit N] [--days N] [--oldest ts] [--latest ts] [--json]` | Read channel history with filters | `node slack-cli.js history C0A11MKGDT2 --days 7 --json` |
| `search <query> [--channels ids] [--days N] [--limit N] [--json]` | Search Slack messages by query | `node slack-cli.js search "blocker" --channels C0A1K7R9W74` |
| `messages-filter <channelId> --pattern <regex> [--days N] [--json]` | Filter channel messages by regex | `node slack-cli.js messages-filter C0A1K7R9W74 --pattern "blocked|waiting on"` |
| `threads <channelId> [--days N] [--json]` | List parent messages with replies | `node slack-cli.js threads C0A11MKGDT2 --days 14` |
| `thread-get <channelId> <threadTs> [--json]` | Read full thread (parent + replies) | `node slack-cli.js thread-get C0A11MKGDT2 123.456` |
| `thread-scan <channelId> [--parent-pattern regex] [--reply-pattern regex] [--reply-user U...] [--days N] [--json]` | Scan threaded conversations with parent/reply filters | `node slack-cli.js thread-scan C0A1K7R9W74 --parent-pattern "daily standup" --reply-user U09NUL2LCKU --days 7` |
| `users-resolve --ids <id1,id2>` | Resolve user IDs in batch | `node slack-cli.js users-resolve --ids U1,U2 --json` |
| `channels-resolve --ids <id1,id2>` | Resolve channel IDs in batch | `node slack-cli.js channels-resolve --ids C1,C2` |
| `extract <channelId> --mode <blockers\|tasks\|decisions\|risks> [--days N] [--json]` | Extract workflow signals from messages | `node slack-cli.js extract C0A1K7R9W74 --mode blockers --days 7` |
| `export <channelId> [--format json\|csv\|md] [--out path]` | Export channel messages for analysis | `node slack-cli.js export C0A1K7R9W74 --format md --out blockers.md` |
| `send <channel> <text> [--thread-ts ts]` | Send message to channel or thread | `node slack-cli.js send C0A1K7R9W74 'Update posted' --thread-ts 123.456` |
| `files <channelId> [limit]` | List files in channel | `node slack-cli.js files C0A11MKGDT2 10` |
| `download <fileId> [path]` | Download attachment | `node slack-cli.js download F12345678 ./file.pdf` |
| `test` | Test authentication | `node slack-cli.js test` |

## Authentication

Requires `SLACK_TOKEN` environment variable with a **User Token** (starts with `xoxp-`).

User tokens have full access to channels you're already a member of. No bot installation or channel invitations needed.

Get your token from https://api.slack.com/apps:
1. Create App → From scratch
2. OAuth & Permissions → **User Token Scopes**:
   - `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - `channels:read`, `groups:read`, `users:read`
   - `chat:write`
   - `files:read`
3. Install to workspace (as yourself)
4. Copy "User OAuth Token" (starts with `xoxp-`)

## Key Methods

| Method | Purpose |
|--------|---------|
| `web.conversations.list()` | List channels |
| `web.conversations.history()` | Read messages |
| `web.conversations.replies()` | Read thread replies |
| `web.chat.postMessage()` | Send message |
| `web.files.list()` | List files in channel |
| `web.files.info()` | Get file metadata |
| `web.users.info()` | Get user details |
| `web.search.messages()` | Search message index |
| `web.auth.test()` | Verify token |

## Response Format

When showing messages:
- Format: `[time] message text`
- Show reply count if present
- Truncate long messages with `...`
- Group by channel
