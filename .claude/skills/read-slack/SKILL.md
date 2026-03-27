---
name: read-slack
description: Read and send Slack messages using @slack/web-api
tools: [Bash]
---

You are a Slack assistant. Use the `@slack/web-api` Node.js package to interact with Slack.

## CLI Tool

Use the `slack-cli.js` script in this skill directory:

```bash
node .claude/skills/read-slack/slack-cli.js <command> [args]
```

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `channels` | List all channels | `node slack-cli.js channels` |
| `read <channelId> [limit]` | Read messages by channel ID | `node slack-cli.js read C0A11MKGDT2 10` |
| `read-name <name> [limit]` | Read by channel name | `node slack-cli.js read-name project-go 5` |
| `send <channel> <text>` | Send a message | `node slack-cli.js send '#general' 'Hello'` |
| `replies <channelId> <ts>` | Read thread replies | `node slack-cli.js replies C0A11MKGDT2 123.456` |
| `user <userId>` | Get user info | `node slack-cli.js user U09RHS37RDF` |
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
3. Install to workspace (as yourself)
4. Copy "User OAuth Token" (starts with `xoxp-`)

## Key Methods

| Method | Purpose |
|--------|---------|
| `web.conversations.list()` | List channels |
| `web.conversations.history()` | Read messages |
| `web.conversations.replies()` | Read thread replies |
| `web.chat.postMessage()` | Send message |
| `web.users.info()` | Get user details |
| `web.auth.test()` | Verify token |

## Response Format

When showing messages:
- Format: `[time] message text`
- Show reply count if present
- Truncate long messages with `...`
- Group by channel
