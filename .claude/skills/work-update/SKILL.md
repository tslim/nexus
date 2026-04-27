---
name: work-update
description: Sync work context from external sources, update tasks and memory, and report changes
---

# Work Update

Refresh tasks and memory from ongoing work activity.

Load `memory-management` and `task-management` before continuing. This command assumes `/work-start` has already initialized `TASKS.md`, `CLAUDE.md`, and the memory wiki.

## Flow

### 1. Load State

Read:
- `TASKS.md`
- `CLAUDE.md`
- `memory/index.md`
- `memory/glossary.md`

Read when needed:
- `memory/log.md`
- specific pages under `memory/`

If `TASKS.md`, `CLAUDE.md`, or core wiki files are missing, suggest `/work-start`.

### 2. Sync Tasks From External Sources

Before checking a source, look for and load the relevant skill from `.claude/skills` when available.

Check available task sources such as:
- project trackers like Asana, Linear, or Jira
- GitHub Issues: `gh issue list --assignee=@me`

Compare external tasks against `TASKS.md`:
- new external task -> offer to add
- matching task already tracked -> skip
- task missing externally -> flag as potentially stale
- completed externally -> offer to mark done

#### `TASKS.md` Confirmation Rules

Do not edit `TASKS.md` directly from scanned activity unless the user confirms the change.

During task sync and activity scan:
- Collect candidate task additions, completions, stale items, and waiting-state changes.
- Compare each candidate against existing `TASKS.md` entries.
- Present a short triage prompt before editing.
- If the user chooses no changes, leave `TASKS.md` untouched.
- Only apply confirmed task edits.

Safe without confirmation:
- Reading `TASKS.md`
- Reporting possible stale tasks
- Reporting likely missing tasks
- Reporting external completion signals

Requires confirmation:
- Adding a task
- Completing a task
- Moving a task between `Active`, `Waiting On`, `Someday`, and `Done`
- Changing task wording, due dates, links, or subtasks

### 3. Scan Recent Activity

Before checking a source, look for and load the relevant skill from `.claude/skills` when available.

Gather recent signals from available sources:
- chat
- email
- documents
- calendar
- notes

Use the activity scan to surface:
- task updates
- likely missing tasks
- durable memory candidates
- status, ownership, relationship, or terminology changes worth preserving

### 4. Flag Missing Or Stale Tasks

Surface likely todos not tracked in `TASKS.md`.

Review active tasks for:
- past due dates
- 30+ day age
- missing project or person context
- external completion signals

Present triage options such as:
- done
- reschedule
- move to someday
- keep active

These triage options are suggestions until the user confirms the `TASKS.md` edit.

### 5. Resolve Unknowns

For each task or activity item, use the memory lookup order:

1. `CLAUDE.md`
2. `memory/index.md`
3. `memory/glossary.md`
4. relevant pages under `memory/`
5. `memory/log.md` if recent changes matter

Track what is known and what still needs clarification.

Ask about unknown terms, people, projects, or context only when the lookup order does not resolve them.

### 6. Ingest Durable Updates

Follow `memory/SCHEMA.md` when creating or updating durable wiki pages.

Process updates in this order:
1. update existing pages when the new information fits naturally
2. add meaningful markdown links when creating new cross-references
3. create a new page only when the information does not fit an existing page cleanly
4. file substantial reusable outputs into `memory/queries/` or `memory/comparisons/` when appropriate
5. update `memory/index.md` for every new, renamed, deleted, or reclassified durable page
6. append the action to `memory/log.md`

Useful enrichments include:
- links added to existing project, person, topic, or context pages
- clear status changes
- durable relationships or ownership notes
- recurring terms added to `memory/glossary.md`
- deadlines or milestones worth preserving in project context
- reusable comparisons or synthesized answers

For recurring query or comparison outputs, prefer a stable filename and update the existing page instead of creating a dated duplicate.

### 7. Apply Confirmation Rules

Safe to apply during `work-update`:
- enrich an existing memory page
- add a clear glossary entry
- add links or relationships to an existing page
- update `memory/index.md` or `memory/log.md`
- file a clearly valuable durable update into an existing page

Still require confirmation:
- new person page
- new project page
- new context page
- new topic page
- new comparison or query page when the value is uncertain
- weakly supported term promoted into `CLAUDE.md`

If durability is unclear, present a suggestion instead of editing memory.

### 8. Report

Summarize:
- task changes
- hot-cache changes
- wiki changes
- filed outputs
- unresolved gaps

Example structure:

```text
Work update complete:
- Task changes: X added, X updated, X stale
- Hot cache changes: X
- Wiki changes: X pages updated, X pages created
- Filed outputs: X queries, X comparisons
- Unresolved gaps: X
```

If memory changed, say whether it was:
- a safe update to an existing page
- a newly created page after confirmation
- a filed query or comparison
- a suggested but unconfirmed addition
- a gap that still needs clarification

### 9. Memory Backup

If this run changed `CLAUDE.md`, `TASKS.md`, or anything under `memory/`, trigger `memory-backup`.

## Notes

- This command is interactive.
- External links should be preserved when available.
- Fuzzy title matching is fine for task comparison.
- Prefer updating existing pages over creating new ones.
- Use `/work-start` to initialize missing task or memory foundations.
- If nothing changed, skip backup.
