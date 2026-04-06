---
name: work-update
description: Sync work context from external sources, update tasks and memory, and report changes
---

# Work Update

> If you see unfamiliar placeholders or need to check which skills are available in `.claude/skills`

Load `memory-management` and `task-management` before continuing.

## Flow

### 1. Load state
- Read `TASKS.md` and `memory/`
- If missing, suggest `/work-start`

### 2. Sync tasks from external sources
Check available sources such as:
- project trackers like Asana, Linear, or Jira
- GitHub Issues: `gh issue list --assignee=@me`

Compare external tasks against `TASKS.md`:
- new external task -> offer to add
- matching task already tracked -> skip
- task missing externally -> flag as potentially stale
- completed externally -> offer to mark done

### 3. Scan activity
Gather recent signals from available sources:
- chat
- email
- documents
- calendar
- notes

### 4. Flag missing tasks
Surface likely todos not tracked in `TASKS.md`.

Also surface durable memory candidates from the same activity, such as:
- repeated stakeholders not in `memory/people/`
- recurring projects or terms not in memory
- durable status, ownership, or relationship updates for existing pages

### 5. Triage stale tasks
Review active tasks for:
- past due dates
- 30+ day age
- missing project/person context

Present triage options like done, reschedule, or move to someday.

### 6. Decode task gaps
For each task, try to decode people, projects, acronyms, tools, and links.
Track what is known and what still needs clarification.

### 7. Suggest memory updates
Group findings into:
- new people
- new projects or topics
- cleanup suggestions

Policy:
- safe enrichments to existing `memory/` pages may be applied during `work-update`
- major new memory additions must be confirmed first
- if durability is unclear, present a suggestion instead of editing memory

### 8. Fill memory gaps
Ask about unknown terms or people.

Prefer updating existing pages.
Only create a new memory page when the entity is clearly durable and likely to recur.

### 9. Capture enrichment
Useful enrichments include:
- links added to existing project or person pages
- clear status changes
- durable relationships or ownership notes
- deadlines worth preserving in project context

Safe enrichment examples:
- add a new link to an existing project page
- update an existing project status from a clear source
- add a collaborator or relationship to an existing page

Still require confirmation:
- new person page
- new project page
- weakly supported term promoted into `CLAUDE.md`

If `work-update` materially changes a file under `memory/`, append a log entry to `memory/log.md` using the standard format.

### 10. Report
Summarize:
- task changes
- memory changes
- unresolved gaps

If memory changed, say whether it was:
- a safe update to an existing page
- a suggested but unconfirmed new memory
- a gap that still needs clarification

### 11. Memory backup
If this run changed `CLAUDE.md`, `TASKS.md`, or anything under `memory/`, trigger `memory-backup`.

## Notes

- This command is interactive
- External links should be preserved when available
- Fuzzy title matching is fine for task comparison
- Safe enrichments to existing memory pages are allowed; net-new memory entities still require confirmation
- If nothing changed, skip backup
