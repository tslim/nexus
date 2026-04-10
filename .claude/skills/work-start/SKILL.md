---
name: work-start
description: Setup productivity system for work
---

# Work Start

Initialize tasks, memory, and the dashboard.

Load `memory-management` and `task-management` before continuing. Follow the architecture, conventions, and reference templates defined by `memory-management` when bootstrapping or repairing the memory system.

## Setup Flow

Check for:
- `TASKS.md`
- `CLAUDE.md`
- `memory/SCHEMA.md`
- `memory/index.md`
- `memory/log.md`
- `memory/glossary.md`
- `memory/people/`
- `memory/projects/`
- `memory/context/`
- `memory/topics/`
- `memory/comparisons/`
- `memory/queries/`
- `dashboard.html`

Create what is missing:
- `TASKS.md` -> use the standard task template
- `dashboard.html` -> copy from `./skills/dashboard.html`
- if memory is partially initialized, create any missing core file or directory using the templates and structure defined by `memory-management`

Do not use `open` or `xdg-open`. Tell the user:
- `Dashboard is ready at dashboard.html. Open it from your file browser to get started.`

If tasks and memory already exist, stop after orientation:

```text
Dashboard open. Your tasks and memory are both loaded.
- /work-update to sync tasks and refresh memory
```

## First-Run Bootstrap

Only do this if `CLAUDE.md` and the memory wiki do not exist yet.

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

## Bootstrap Order

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

Rules:
- Keep `CLAUDE.md` lean. It is the hot cache, not the durable wiki.
- Put durable detail in `memory/`.
- Ask for the wiki domain before writing `memory/SCHEMA.md`.
- Write that confirmed domain into `memory/SCHEMA.md`.
- Use the `memory-management` reference templates for `SCHEMA.md`, `index.md`, and `log.md`.
- Create only the initial people, project, context, and topic pages supported by the user's current task context.
- Prefer a small high-confidence starting memory over a broad first-pass sync.
- Add every created durable page to `memory/index.md`.
- Record the bootstrap in `memory/log.md`.

## Partial Repair

If the memory system exists but is incomplete:

1. Read the current memory files first.
2. Compare the existing layout against the structure defined by `memory-management`.
3. Create only the missing core files or directories.
4. Preserve existing content unless it clearly conflicts with the current schema.
5. Repair `memory/index.md` and `memory/log.md` if they are missing or outdated.
6. Do not rebuild the wiki from scratch unless the user asks.

## Bootstrap Outputs

Create:
- `TASKS.md`
- `CLAUDE.md`
- `memory/SCHEMA.md`
- `memory/index.md`
- `memory/log.md`
- `memory/glossary.md`
- `memory/people/{name}.md`
- `memory/projects/{name}.md`
- `memory/context/company.md`
- `memory/topics/`
- `memory/comparisons/`
- `memory/queries/`

Seed:
- `CLAUDE.md` with a lean hot cache of frequent people, active projects, common terms, and preferences
- `memory/glossary.md` with the first-pass decoded terms and references
- starter `memory/people/{name}.md` and `memory/projects/{name}.md` pages when clearly supported by the selected task source
- `memory/context/company.md` when enough organizational context is available

`memory/log.md` should use the single-line format defined by `memory-management`.

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
