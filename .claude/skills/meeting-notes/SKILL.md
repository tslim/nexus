---
name: meeting-notes
description: Process pasted meeting notes, infer context, extract candidate tasks and memory updates, and ask for confirmation before making changes.
---

# Meeting Notes

Process user-pasted meeting notes, summaries, or transcripts into structured follow-up, task candidates, and durable memory candidates.

## Invocation

This skill may be triggered with or without pasted content.

If the user triggers the skill without notes, ask them to paste either:
- an optional hint plus the notes / transcript, or
- just the notes / transcript

The hint may be labelled or unlabelled. Treat a short first line before a longer notes block as a likely hint, but do not require a specific format.

Example prompt:

```text
Please paste the meeting notes or transcript.

Optional: add a short hint before the notes, such as the meeting title, project, date, or attendees. Labels are optional.

Format examples:

Project Alpha weekly sync, Person A and Person B
[paste notes]

—or—

Hint: Project Alpha weekly sync, Person A and Person B
Notes:
[paste notes]

—or—

[paste notes only]
```

Do not require a transcript. Pasted meeting summaries or notes are enough.

## Flow

### 1. Load Supporting Skills

Before processing, load:
- `memory-management`
- `task-management`

Use the loaded skills' workflows for task edits, memory edits, logging, and backup requirements.

### 2. Read Current State

Use the loaded skills' workflows to read relevant task and memory context.

At minimum, inspect the current task list and memory index / hot cache well enough to infer likely context from the pasted notes.

### 2a. Optional Project Subagents

If the `Agent` tool is available and project-local agents exist under `.pi/agents/`, use them for classification when the notes contain multiple action items, project updates, durable decisions, or unclear references.

Project-local agents useful for this workflow:
- `task-reconciler` - compares extracted task candidates against `TASKS.md` and prepares triage recommendations
- `memory-curator` - classifies extracted durable update candidates against `CLAUDE.md` and `memory/`
- `activity-scanner` - optional read-only scanner for external context, only when the pasted notes need corroboration or the user asks to check Slack/email/calendar/docs

Use subagents this way:
1. First extract candidate decisions, action items, task candidates, memory candidates, and unclear references from the pasted notes in the parent agent.
2. Pass task-like candidates to `task-reconciler` before asking the user to confirm task edits.
3. Pass memory-like candidates to `memory-curator` before applying safe memory updates or asking for confirmation.
4. Use `activity-scanner` only for targeted external lookup; do not scan external sources by default for simple pasted notes.

Subagents must only collect, compare, and classify. The parent agent remains responsible for context confirmation, user confirmation, edits to `TASKS.md`, edits to `CLAUDE.md` or `memory/`, memory logging, and backup when required.

### 3. Infer Context

Identify likely project, people, topics, and related tasks from the pasted notes.

Present the inferred context to the user and ask them to confirm or correct it before continuing.

Example:

```text
I think these notes relate to:
1. Project Alpha — likely
2. Customer Beta follow-up — possible

Detected signals:
- Mentions Person A, vendor review, pilot timeline, and contract update.

Proceed with Project Alpha context?
```

If the context is unclear, ask for a hint rather than guessing.

### 4. Extract Candidates

After the user confirms or corrects the context, extract:
- decisions
- action items
- task candidates
- memory update candidates
- open questions / unclear references

For non-trivial notes, reconcile and curate before presenting the final edit proposal:
- send task candidates and relevant context to `task-reconciler` when available
- send memory candidates, decisions, and durable context updates to `memory-curator` when available
- merge subagent recommendations into the parent agent's confirmation prompt
- skip subagents for very small/simple notes where direct processing is clearer

Example:

```text
Extracted candidates:

Decisions:
- The team agreed to continue with Option B.

Action items:
1. Person A to send updated timeline.
2. You to review the proposal draft.

Task candidates:
1. Add task: Review proposal draft for Project Alpha.

Memory candidates:
1. Update existing project page with the new pilot direction.

Open questions:
- Who owns the vendor follow-up?
```

### 5. Confirm Before Edits

Before editing any files, present all proposed task and memory changes as numbered items.

Apply only the items the user confirms.

Example:

```text
Apply changes?

Tasks:
1. Add “Review proposal draft for Project Alpha”
2. Add “Follow up with Person A on timeline”

Memory:
3. Update existing Project Alpha page with new pilot direction

Reply with numbers to apply, or “none”.
```

If files are changed, follow the loaded skills' requirements for memory logs and backups.

## Notes

- Prefer updating existing task and memory context over creating new pages.
- Keep extracted tasks concise and actionable.
- Keep memory candidates durable; avoid storing transient meeting chatter.
- If the pasted notes are too vague to identify the meeting context, ask the user for a hint such as meeting title, project, date, or attendees.
- Do not block processing just because a transcript is unavailable; work from the best pasted meeting content the user provides.
