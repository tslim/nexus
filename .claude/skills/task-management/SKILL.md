---
name: task-management
description: Simple task management using a shared TASKS.md file.
---

# Task Management

Tasks live in `TASKS.md` in the current working directory.

## File Rules

- Always use `TASKS.md`
- If it does not exist, create it with this template:

```markdown
# Tasks

## Active

## Waiting On

## Someday

## Done
```

## Dashboard

On first task interaction:

1. Check for `dashboard.html`
2. If missing, copy it from `./skills/dashboard.html`
3. Tell the user: `I've added the dashboard. Run /work-start to set up the full system.`

## Task Format

- Task: `- [ ] **Task title** - [Project](memory/projects/file.md) link, Note with [Person](memory/people/name.md) link _(added YYYY-MM-DD)_`
- Executable subtask: `  - [ ] Sub-step`
- Context note: `  - Context note`
- Done: `- [x] ~~Task~~ (date)`

## Common Actions

### List tasks
- Read `TASKS.md`
- Summarize `Active` and `Waiting On`
- Highlight overdue or urgent items

### Add a task
- Add to `Active`
- Include context if given: person, project, due date, waiting status

### Complete a task
- Change `[ ]` to `[x]`
- Add strikethrough and completion date
- Move it to `Done`

### Waiting on
- Use `Waiting On` for dependencies or pending replies
- Include who or what is blocking progress when known

## Conventions

- Bold the task title
- Include `for [person]` when it is a commitment
- Include `due [date]` for deadlines
- Include `since [date]` for waiting items
- Prefer checkbox sub-steps for actionable work
- Use plain sub-bullets only for context or constraints
- Keep `Done` to about one week of recent completions

## Extracting Tasks

When summarizing meetings or conversations, offer to add:
- commitments the user made
- action items assigned to them
- follow-ups that clearly need tracking

Ask before adding extracted tasks.
