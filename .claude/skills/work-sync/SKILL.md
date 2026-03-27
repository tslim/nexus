---
name: work-sync
description: Sync all work context from Slack, email, calendar, and Granola meeting notes to create/update task files and present a summary of changes
---

# /work-sync

Sync all work context sources and create/update individual task files in `memory/tasks/` with new action items, completed tasks, and upcoming deadlines.

## When to use

- At the start of your day to get a complete picture of pending work
- After a batch of meetings to capture new action items
- When you feel out of sync and need to refresh your task list
- Before planning your week to ensure nothing was missed

## What it does

1. **Gathers context from all sources:**
   - `/read-slack` - Recent messages mentioning you or containing action items
   - `/read-email` - Emails requiring follow-up or action
   - `/read-calendar` - Upcoming events (reference only, does NOT create tasks)
   - `/read-granola` - Meeting notes with action items

> **Calendar Policy:** Calendar events are used for context and project tracking only. They do NOT create standalone tasks. Meeting events are noted in project files, and deadlines update existing task due dates.

2. **Reads existing tasks** from `memory/tasks/TASK-*.md` files

3. **Compares and identifies:**
   - New tasks to add (not matching existing task titles)
   - Tasks that may be completed (ask user for confirmation)
   - Due dates that have passed or are approaching
   - Duplicates to consolidate

4. **Archives old completed tasks** (see Archiving section below)

5. **Creates/updates task files:**
   - New task files for new items (sequential IDs: TASK-001, TASK-002, etc.)
   - Update existing task files with new info
   - Mark completed tasks with completion date
   - Move archived tasks to `memory/tasks/completed/`

6. **Updates project context** in `memory/projects/`:
   - Create/update project files for any tagged projects
   - Link related tasks to projects
   - Track project status and milestones

7. **Updates people context** in `memory/people/`:
   - **MUST create people files for anyone mentioned in a new task** (assigners, requesters, stakeholders)
   - Track interactions and follow-ups
   - Link tasks to relevant people

8. **Presents a summary** showing:
   - Tasks added
   - Tasks updated
   - Tasks flagged for completion review
   - Tasks archived
   - Upcoming deadlines (next 3 days)
   - Tasks by source

## How to use

Simply invoke the skill:

```
/work-sync
```

The skill will guide you through confirming task additions and completions.

## Step-by-step process

### Step 1: Gather all context

Run these commands in sequence:

```
/read-slack
/read-email
/read-calendar
/read-granola
```

Capture the action items from each source.

### Step 2: Find and read existing tasks

Glob pattern: `memory/tasks/TASK-*.md`

For each file:
- Parse YAML frontmatter
- Extract: id, title, status, priority, due, source, tags
- Load into memory for comparison

### Step 3: Determine next task ID

Find the highest existing task number:
- Existing: TASK-001, TASK-002, TASK-005 → Next: TASK-006
- Gaps in numbering are OK (TASK-003, TASK-004 can be created later)

### Step 4: Compare and identify changes

For each action item found from sources:
- **Does it match an existing task?** (similar title/description)
  - Update existing task file if details changed
  - Add new source attribution if from different channel
- **Is it new?** → Create new task file with next available ID
- **Is it a duplicate?** → Skip or note additional source

For each existing task:
- **Has it been completed?** → Ask user for confirmation
- **Has the due date passed?** → Flag as overdue
- **Is it still relevant?** → Keep if yes, ask about cancellation if unclear

### Step 5: Create new task files

For each new task, create a file at `memory/tasks/TASK-XXX.md`:

```markdown
---
id: TASK-006
title: Review vendor proposal and provide feedback
status: pending
priority: high
created: 2026-03-27
due: 2026-03-30
source: email
tags: [vendor, procurement]
---

## Context

Email from procurement team requesting review of vendor proposal for new tooling.
Deadline: March 30, 2026

## Notes

Need to evaluate:
- Pricing structure
- Integration requirements
- Support SLA

## Action Log

- 2026-03-27: Task created from email
```

### Step 6: Update existing task files

If task details changed:
- Update frontmatter fields (priority, due date, status)
- Add new entries to Action Log
- Append new context if relevant

If marking complete:
```markdown
---
id: TASK-003
title: Weekly report
status: completed
priority: medium
created: 2026-03-20
due: 2026-03-27
completed: 2026-03-27
source: email
tags: []
---

## Context

Original request from manager...

## Notes

## Action Log

- 2026-03-20: Task created from email
- 2026-03-27: Completed and submitted
```

### Step 7: Archive old completed tasks

**Archive location:** `memory/tasks/completed/`

**During every /work-sync:**

1. **Identify completed tasks older than 7 days**
   - Check `completed` date in frontmatter
   - Compare to today's date

2. **Move to archive directory:**
   ```bash
   # Move file
   mv memory/tasks/TASK-003.md memory/tasks/completed/TASK-003.md
   ```

3. **Update archived task file** (add archived timestamp):
   ```markdown
   ---
   id: TASK-003
   title: Weekly report
   status: completed
   archived: 2026-03-27
   ---
   ```

4. **Active tasks remain** in `memory/tasks/` (pending, in_progress, recent completed)

### Step 8: Process calendar events

Calendar events are **reference only** - they do not create standalone tasks. Instead:

**A. Match calendar events to projects:**
- If event title matches a project tag → Add to project's Calendar Events section
- Example: "Project GO: Deal-Sync" → Add to `memory/projects/project-go.md`

**B. Update task due dates from deadlines:**
- If calendar event contains a deadline → Update existing task's `due` date
- Example: "Q2 Roadmap Due" → Find roadmap task, update due date

**C. Note meetings in project files:**
```markdown
## Calendar Events

### 2026-03-27
| Time | Event | Notes |
|------|-------|-------|
| 17:00 | Follow-ups / escalations | Solutions team sync |
| 18:00 | AI Agents: Daily Standup | Recurring |

### 2026-03-30
| Time | Event | Notes |
|------|-------|-------|
| 17:00 | GO Internal Deal Discussion | Project GO related |
```

**Do NOT create tasks for:**
- Regular meetings (standups, syncs)
- Calendar blocks (focus time, lunch)
- Events you're merely attending
- Meeting prep ("Prepare for X meeting") - the meeting itself is on your calendar
- Meetings just because they exist on the calendar
- Meetings without captured action items

**DO create tasks when:**
- Meeting notes (Granola) contain explicit action items assigned to you
- Email or Slack explicitly requests you to do something
- You decide independently that prep work is needed (create manually, not via work-sync)

**Do update existing tasks when:**
- Calendar shows a hard deadline → Update `due` date
- Meeting reveals new action item → Create task from action item (source: granola), not calendar

### Step 9: Update project files

For each task with project tags (e.g., `tags: [project-go, roadmap]`), update the corresponding project file in `memory/projects/`.

**Create project file if not exists:**

File: `memory/projects/project-go.md`
```markdown
---
name: Project GO
status: active | on_hold | completed
started: 2026-01-15
---

## Overview

Brief description of the project...

## Milestones

- [x] Kickoff completed (2026-01-15)
- [ ] Term sheet finalized (Due: 2026-03-30)
- [ ] Launch (TBD)

## Notes

Key decisions, context, links...
```

**Update existing project file:**
- Add milestones if discovered
- Append notes from meetings/emails
- DO NOT track tasks here (hard to keep in sync, use task files instead)

### Step 10: Update people files

**CRITICAL: For every new task created, create/update a people file for the person who assigned/requested it.**

For people mentioned in tasks (assigners, stakeholders, meeting attendees), create/update files in `memory/people/`.

Read Slack profile for user information if possible. 

**Create people file if not exists:**

File: `memory/people/john-doe.md`
```markdown
---
name: John Doe
role: Product Manager
team: Solutions
email: john.doe@example.com
slack_id: U0914FK5BP
---

## Overview

Working relationship context...

## Interactions

- 2026-03-27: Email - Vendor contract discussion
- 2026-03-25: Meeting - Project GO sync

## Notes

- Prefers async communication
- Key stakeholder for Project GO
```

**Update existing people file:**
- Log new interactions with dates/sources
- Update notes/preferences
- DO NOT track tasks here (hard to keep in sync, use task files instead)

### Step 10: Present summary

Show the user in table format:

**Calendar Events (Today):**
```
| Time  | Event Name                    | RSVP    |
|-------|-------------------------------|---------|
| 09:00 | AI Agents Daily Standup       | ✅ Yes  |
| 10:00 | Daily Sync - Solutions        | ⏳ Maybe|
| 14:00 | Project GO: Deal-Sync         | ✅ Yes  |
```

**Sync Summary:**
```
| Action | Count | Details |
|--------|-------|---------|
| Tasks Added  | 3     | TASK-006, TASK-007, TASK-008 |
| Tasks Updated| 1     | TASK-002 (new due date) |
| Tasks Completed | 2 | TASK-003, TASK-004 |
| Tasks Archived | 1 | TASK-001 |
| Projects Updated | 2 | project-go, q2-planning |
| People Updated | 1 | john-doe |
```

**Upcoming Deadlines (Next 3 Days):**
```
| ID | Task | Due | Priority | Source |
|----|------|-----|----------|--------|
| TASK-005 | Client presentation | Tomorrow | 🔴 High | Email |
| TASK-006 | Q2 roadmap | Apr 1 | 🔴 High | Granola |
```

**Calendar Events (Next 3 Days):**
```
| Date | Time | Event | Project |
|------|------|-------|---------|
| Mar 30 | 17:00 | GO Internal Deal Discussion | project-go |
| Mar 31 | 15:00 | Project GO: Deal-Sync | project-go |
```

**By source:**
- Slack: 1 new task
- Email: 1 new task
- Granola: 1 new task
- Calendar: 0 tasks (reference only - events noted in projects)

## Handling task decisions

### When to add a new task

- Clear action item with assignee (you)
- **NEVER from calendar events** - calendar is reference only, not a task source
- **NEVER create "meeting prep" tasks** - if you need prep, create manually
- **NEVER create tasks just because a meeting exists** - only if Granola notes show action items
- Email or Slack requests requiring action
- Granola meeting notes with explicit action items
- Mentioned in multiple sources (higher priority)

### When to ask before marking complete

- Task has been in list for >7 days
- Source indicates resolution (email reply, Slack thread conclusion)
- Task description is vague

### When to consolidate duplicates

- Same task mentioned in multiple sources
- Different wording but same outcome required
- Keep the earliest source attribution

### When to update vs create new

**Update existing:**
- Same task, new information (changed due date, additional context)
- Status change (pending → in_progress)

**Create new:**
- Distinctly different task
- Follow-up to completed task ("Review the proposal" vs "Submit the proposal")

## Task File Format Reference

```markdown
---
id: TASK-001
title: Task description
status: pending | in_progress | completed | cancelled
priority: high | medium | low
created: 2026-03-27
due: 2026-03-30
completed: 2026-03-28  # only if status is completed
source: email | slack | calendar | granola | manual
tags: [tag1, tag2]
---

## Context

Original context from source (why this task exists)

## Notes

Working notes, subtasks, ideas

## Action Log

- 2026-03-27: Task created from email
- 2026-03-28: Started work
- 2026-03-28: Completed
```

## Example output

```
/work-sync

Gathering context from all sources...

Found:
- 3 action items from Slack
- 2 follow-ups from Email
- 1 deadline from Calendar
- 4 tasks from Granola meeting notes

Reading existing tasks...
Found 15 existing tasks (12 active, 3 completed)

Comparing and updating...

## Sync Complete - Summary

**Calendar Events (Today - March 27, 2026):**
| Time  | Event                    | RSVP    |
|-------|--------------------------|---------|
| 09:00 | AI Agents Daily Standup  | ✅ Yes  |
| 10:00 | Daily Sync - Solutions   | ✅ Yes  |
| 14:00 | Follow-ups / Escalations | ✅ Yes  |

**Tasks Summary:**
| Action | Count | Details |
|--------|-------|---------|
| Added | 3 | TASK-016, TASK-017, TASK-018 |
| Updated | 1 | TASK-002 (extended due date) |
| Completed | 2 | TASK-010, TASK-012 |
| Archived | 1 | TASK-001 (completed 7+ days ago) |

**Projects Updated:**
| Project | Tasks Added | Notes |
|---------|-------------|-------|
| project-go | 2 | New milestone added |
| q2-planning | 1 | Linked to TASK-016 |

**People Updated:**
| Person | Interactions | New Tasks |
|--------|--------------|-----------|
| john-doe | 1 email | TASK-017 |

**Active Tasks by Status:**
- Pending: 8
- In Progress: 3
- Overdue: 1

**Upcoming Deadlines:**
| ID | Task | Due | Priority |
|----|------|-----|----------|
| TASK-005 | Client presentation | Today | 🔴 High |
| TASK-016 | Q2 roadmap | Apr 1 | 🔴 High |

**By source:**
- Slack: 1 new task
- Email: 1 new task
- Granola: 1 new task
- Calendar: 0 tasks (reference only - events noted in projects)

Run `/work-tasks` to see your updated task list.
```

## Memory Structure

```
memory/
├── tasks/                  # Individual task files
│   ├── TASK-001.md
│   ├── TASK-002.md
│   └── completed/          # Archived completed tasks
│       └── TASK-003.md
├── projects/               # Project context files
│   ├── project-go.md
│   └── q2-planning.md
└── people/                 # Contact/people notes
    ├── john-doe.md
    └── jane-smith.md
```

## Notes

- Task IDs are permanent and never reused
- Gaps in numbering are OK (TASK-001, TASK-003, TASK-004 is valid)
- Each task is a separate file for git tracking and easier editing
- Archive directory keeps completed history without cluttering active view
- Projects and people files provide context and link related tasks
- Use `tags: [project-name]` in tasks to auto-link to project files
- **Calendar events are reference only** - they update project calendars and task due dates, but never create standalone tasks
