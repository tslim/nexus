---
name: daily-sync
description: Collect 3 daily standup answers and post them as a reply in the correct team thread.
tools: [Bash, question]
---

# Skill: daily-sync

Post a structured daily update to the active daily thread in `<DAILY_SYNC_CHANNEL_NAME>`.

## Channel

- Channel: `<DAILY_SYNC_CHANNEL_NAME>`
- Channel ID: `<DAILY_SYNC_CHANNEL_ID>`

## Required Questions (ask exactly these 3)

1. What did you complete since the last update?
2. What are you focusing on today?
3. Any blockers or dependencies?

Ask these one-by-one (or as one 3-part prompt), collect answers, then post once all 3 are answered.

## Suggested Answers (default behavior)

Before asking the 3 required questions, draft suggested answers using:
- Your most recent prior daily standup reply, especially the previous day's `:hammer: Today:` items
- Current session history (recent user-assistant work completed in this session)
- `TASKS.md` status and recent edits
- `memory/projects/*.md` and `memory/people/*.md` context relevant to active work

### Prior Update Continuity

Before drafting suggestions:
1. Find your most recent prior daily standup reply in the same channel.
2. Extract the bullets under `:hammer: Today:`.
3. Use those bullets as the starting suggestion for today's `:white_check_mark: Yesterday:`.
4. Cross-check against current session history and `TASKS.md`.
5. If an item appears incomplete or uncertain, leave it out or shorten it rather than overstating progress.

Then present the 3 questions with the `question` tool (not plain text), and include the suggested answer as an option for each question.

For each question:
- Option 1 must be the suggested answer, labeled as recommended.
- Keep option labels short (e.g., `Use suggestion`).
- Put the detailed suggested content in the option description.
- Keep custom input enabled so the user can type their own answer.

For the first question:
- Option 1 must be exactly the previous standup's `:hammer: Today:` bullet list, unchanged, labeled as recommended.
- You may include a second option with a refined version based on current evidence, but do not replace the exact carry-forward option.

Use this exact question structure:

1. What did you complete since the last update?
2. What are you focusing on today?
3. Any blockers or dependencies?

Rules:
- Keep suggestions concise and factual. Do not invent progress.
- Format each suggested answer as bullet-ready content. Prefer one or more lines starting with `- ` so the posted update can be converted into Slack rich text bullets.
- Prefer deriving the recommended `Yesterday` bullets from the previous standup's `Today` section, then refine using current evidence.
- For Question 1, always preserve one exact carry-forward option from the previous standup's `Today` section.
- Treat the previous day's `Today` section as a draft for continuity, not as proof of completion.
- If confidence is low for any field, leave it blank and ask the user to fill it.
- Treat user corrections as final.
- If the user selects the suggested options, post directly without re-asking.

## Thread Selection ("correct thread")

Use the Slack CLI from `slack` skill:

1. Get recent parent-thread candidates:
```bash
node .claude/skills/slack/slack-cli.js threads <DAILY_SYNC_CHANNEL_ID> --days 2 --limit 50 --json
```
2. Optionally validate recent reply style from your prior updates:
```bash
node .claude/skills/slack/slack-cli.js thread-scan <DAILY_SYNC_CHANNEL_ID> --parent-pattern "daily standup" --reply-user <YOUR_SLACK_USER_ID> --reply-pattern ":white_check_mark:|:hammer:|:construction:" --days 14 --json
```
3. Choose the best match in this order:
   - Text matches `daily sync`, `standup`, or `daily update`
   - Posted today
   - Highest reply activity
4. If multiple candidates are still ambiguous, ask the user to choose one.
5. If no suitable thread is found, ask user for thread link/ts and do not post blindly.

## Posting Format

Post this structure as one threaded reply:

- Keep the `- ` bullet prefix for each answer line.
- If a section has multiple items, use multiple `- ` lines under that heading.
- Send the final message with `--rich-text` so Slack renders the list items as actual bullets.
- Keep a blank line between `Yesterday`, `Today`, and `Blockers` sections so the rich text renderer preserves visual separation.

```text
:white_check_mark: Yesterday: 
- <answer 1>

:hammer: Today: 
- <answer 2>

:construction: Blockers: 
- <answer 3 or "None">
```

Then send using:

```bash
node .claude/skills/slack/slack-cli.js send <DAILY_SYNC_CHANNEL_ID> "<formatted message>" --thread-ts <thread_ts> --rich-text
```

## Response Back to User

After posting, report:
- Thread used (`thread_ts`)
- Message timestamp returned by Slack
- A short confirmation that the update was posted successfully
