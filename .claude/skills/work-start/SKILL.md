---
name: work-start
description: Setup productivity system for work
---

# Work Start

Initialize tasks, memory, and the dashboard.

Load `memory-management` and `task-management` before continuing.

## Setup Flow

Check for:
- `TASKS.md`
- `CLAUDE.md`
- `memory/`
- `memory/index.md`
- `memory/log.md`
- `dashboard.html`

Create what is missing:
- `TASKS.md` -> use the standard task template
- `dashboard.html` -> copy from `./skills/dashboard.html`
- if `memory/` exists but `memory/index.md` or `memory/log.md` is missing, create the missing file(s)

Do not use `open` or `xdg-open`. Tell the user:
- `Dashboard is ready at dashboard.html. Open it from your file browser to get started.`

If tasks and memory already exist, stop after orientation:

```text
Dashboard open. Your tasks and memory are both loaded.
- /work-update to sync tasks and check memory
- /work-update --comprehensive for a deep scan of all activity
```

## First-Run Bootstrap

Only do this if `CLAUDE.md` and `memory/` do not exist yet.

Ask where the user's task list lives:

```text
Where do you keep your todos or task list?
- A local file
- An app like Asana, Linear, Jira, Notion, or Todoist
- A notes file

I'll use your tasks to learn your workplace shorthand.
```

From the task list:
- identify names, acronyms, project references, and internal terms
- ask only about terms you cannot decode already
- capture nicknames carefully

Example:

```text
Task: "Send PSR to Todd re: Phoenix blockers"

I want to confirm:
1. PSR - what does it stand for?
2. Todd - who is Todd?
3. Phoenix - is this a project codename?
```

## Optional Comprehensive Scan

Offer a deeper scan of:
- chat
- email
- documents
- calendar

Present findings grouped into:
- `Ready to add`
- `Needs clarification`
- `Low confidence`

## Bootstrap Outputs

Create:
- `CLAUDE.md`
- `memory/index.md`
- `memory/log.md`
- `memory/glossary.md`
- `memory/people/{name}.md`
- `memory/projects/{name}.md`
- `memory/context/company.md`

`memory/log.md` should use the append-only format defined by `memory-management`.

## Report

```text
Productivity system ready:
- Tasks: TASKS.md (X items)
- Memory: X people, X terms, X projects
- Wiki primitives: memory/index.md, memory/log.md
- Dashboard: open in browser

Use /work-update to keep things current.
```

## Notes

- If memory is partially initialized, create missing core files to match the current layout
- Skip unavailable sources and note the gap
- Memory grows organically after bootstrap
