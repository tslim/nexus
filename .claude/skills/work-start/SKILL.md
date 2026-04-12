---
name: work-start
description: Setup productivity system for work
---

# Work Start

Initialize tasks, memory, and the dashboard.

Load `memory-management` and `task-management` before continuing. Follow the architecture, conventions, and reference templates defined by `memory-management` when bootstrapping or repairing the memory system.

## Setup Flow

If `dashboard.html` is missing, copy it from `./skills/dashboard.html`.

Do not use `open` or `xdg-open`. Tell the user:
- `Dashboard is ready at dashboard.html. Open it from your file browser to get started.`

## Initialization Paths

Check whether the system is already initialized, partially initialized, or empty:

- initialized:
  - `TASKS.md` exists
  - `CLAUDE.md` exists
  - memory wiki core exists:
    - `memory/SCHEMA.md`
    - `memory/index.md`
    - `memory/log.md`
    - `memory/glossary.md`
  - memory directories exist:
    - `memory/people/`
    - `memory/projects/`
    - `memory/context/`
    - `memory/topics/`
    - `memory/comparisons/`
    - `memory/queries/`

- partial:
  - some of the above exist, but not all

- empty:
  - `CLAUDE.md` and the memory wiki do not exist yet

If initialized, stop after orientation:

```text
Dashboard open. Your tasks and memory are both loaded.
- /work-update to sync tasks and refresh memory
```

If partial, repair the system.

If empty, run first-time bootstrap.

If `TASKS.md` is missing, create it using the standard task template.

## Bootstrap

Only do this when `CLAUDE.md` and the memory wiki do not exist yet.

### Questions

Ask where the user's task list lives:

```text
Where do you keep your todos or task list?
- A local file
- An app like Asana, Linear, Jira, Notion, or Todoist
- A notes file

I'll use your tasks to learn your workplace shorthand.
```

Ask what the wiki should cover:

```text
What should this wiki cover?
- My work context and operating memory
- A specific project or domain
- Something else
```

### Build From Tasks

From the task list:
- identify names, acronyms, project references, recurring channels, and internal terms
- ask only about terms you cannot decode already
- capture aliases and nicknames carefully
- identify which items belong in hot memory versus durable wiki pages

Build a small initial context from the selected task source:
- extract high-confidence people, terms, projects, channels, and recurring context
- populate `CLAUDE.md` with only the most frequent operational items
- populate `memory/glossary.md` with decoded durable terms
- create starter people, project, and context pages only when clearly supported
- leave deeper enrichment for later updates

Example:

```text
Task: "Send PSR to Todd re: Phoenix blockers"

I want to confirm:
1. PSR - what does it stand for?
2. Todd - who is Todd?
3. Phoenix - is this a project codename?
```

### Build Steps

Create the system in this order:

1. `TASKS.md`
2. `CLAUDE.md`
3. `memory/SCHEMA.md`
4. `memory/index.md`
5. `memory/log.md`
6. `memory/glossary.md`
7. `memory/people/`
8. `memory/projects/`
9. `memory/context/`
10. `memory/topics/`
11. `memory/comparisons/`
12. `memory/queries/`
13. seed initial hot-cache and durable wiki content from the selected task source

### Rules

- Keep `CLAUDE.md` lean. It is the hot cache, not the durable wiki.
- Put durable detail in `memory/`.
- Ask for the wiki domain before writing `memory/SCHEMA.md`.
- Write that confirmed domain into `memory/SCHEMA.md`.
- Use the `memory-management` reference templates for `SCHEMA.md`, `index.md`, and `log.md`.
- Create only the initial people, project, context, and topic pages supported by the user's current task context.
- Prefer a small high-confidence starting memory over a broad first-pass sync.
- Add every created durable page to `memory/index.md`.
- Record the bootstrap in `memory/log.md`.

### End State

By the end of bootstrap:
- `TASKS.md` exists
- `CLAUDE.md` exists with a lean hot cache
- the memory wiki core and directories exist
- the glossary is seeded with first-pass decoded terms
- starter durable pages exist only where clearly supported by the selected task source
- `memory/log.md` uses the single-line format defined by `memory-management`

## Repair

If the memory system exists but is incomplete:

1. Read the current memory files first.
2. Compare the existing layout against the structure defined by `memory-management`.
3. Create only the missing core files or directories.
4. Preserve existing content unless it clearly conflicts with the current schema.
5. Repair `memory/index.md` and `memory/log.md` if they are missing or outdated.
6. Do not rebuild the wiki from scratch unless the user asks.

## Report

```text
Productivity system ready:
- Tasks: TASKS.md (X items)
- Memory hot cache: CLAUDE.md
- Wiki core: memory/SCHEMA.md, memory/index.md, memory/log.md
- Seeded context: X people, X terms, X projects
- Dashboard: open in browser

Use /work-update to keep things current.
```

## Notes

- If memory is partially initialized, repair it to match the current layout.
- Skip unavailable sources and note the gap.
- Memory grows organically after bootstrap.
- Prefer a small correct starting wiki over an overbuilt one.
