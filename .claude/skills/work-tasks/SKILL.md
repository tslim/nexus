---
name: work-tasks
description: Show pending tasks from memory/tasks/ directory with optional filtering by priority
---

# /work-tasks

Display pending work tasks from individual task files in `memory/tasks/` with optional filtering by priority level.

## When to use

- Quick check of your pending tasks
- Review high priority items that need attention
- See what's due soon
- Get an overview of workload by priority

## Usage

```
/work-tasks                          # Show all pending tasks
/work-tasks high                     # Show only high priority tasks
/work-tasks medium                   # Show only medium priority tasks
/work-tasks low                      # Show only low priority tasks
/work-tasks stats                    # Show task statistics summary
/work-tasks --all                    # Include completed/cancelled tasks
```

## Process

### Step 1: Find task files

Glob all files matching: `memory/tasks/TASK-*.md`

Exclude files in: `memory/tasks/completed/` (archived tasks)

### Step 2: Parse task files

For each file, extract YAML frontmatter:

```yaml
---
id: TASK-001
title: Task description
status: pending | in_progress | completed | cancelled
priority: high | medium | low
created: 2026-03-27
due: 2026-03-30
source: email | slack | calendar | granola | manual
tags: [project-x, follow-up]
---
```

Parse into task object:
```javascript
{
  id: "TASK-001",
  title: "Task description",
  status: "pending", // pending | in_progress | completed | cancelled
  priority: "high",  // high | medium | low
  due: "2026-03-30", // YYYY-MM-DD or null
  source: "email",   // email | slack | calendar | granola | manual
  tags: ["project-x"]
}
```

### Step 3: Filter tasks

Default filters (can be overridden with flags):
- Exclude `status: completed` and `status: cancelled`
- Include `status: pending` and `status: in_progress`

Priority filter (if specified):
- `high` → only `priority: high`
- `medium` → only `priority: medium`
- `low` → only `priority: low`

### Step 4: Categorize by urgency

Based on `due` date (compared to today's date):

1. **Overdue** - `due < today` (any status except completed/cancelled)
2. **Today** - `due == today`
3. **This Week** - `due` within next 7 days
4. **Pending** - no due date OR `due > 7 days`

### Step 5: Sort within each category

Sort order:
1. Priority (high → medium → low)
2. Due date (earlier first, if same priority)
3. Task ID (ascending, if same priority and due)

### Step 6: Display tasks

```
## Work Tasks

### 🔴 Overdue
| ID | Task | Source | Due |
|----|------|--------|-----|
| TASK-002 | Vietnam Banking Setup - Golden Owl Feedback | Email | Mar 25 |

### 📅 Today
| ID | Task | Priority | Source |
|----|------|----------|--------|
| TASK-010 | Alvis <> Solutions Meeting | 🟡 Medium | Calendar |
| TASK-016 | Follow-ups / Escalations Meeting | 🟡 Medium | Calendar |

### 📆 This Week
| ID | Task | Priority | Due | Source |
|----|------|----------|-----|--------|
| TASK-009 | Project GO Deal-Sync Preparation | 🔴 High | Mar 31 | Calendar |
| TASK-011 | David <> Solutions Meeting | 🟡 Medium | Mar 31 | Calendar |

### 📋 Pending (No Due Date)
| ID | Task | Priority | Source |
|----|------|----------|--------|
| TASK-001 | Vibe Coding Proposal - Real World Use Cases | 🔴 High | Email |
| TASK-003 | Project GO Term Sheet Update | 🔴 High | Email |
```

**Priority indicators:**
- 🔴 High
- 🟡 Medium
- 🟢 Low

**Source indicators:**
- 📧 Email
- 💬 Slack
- 📅 Calendar
- 📝 Granola
- ✏️ Manual

### Step 7: Show statistics

Always include at the bottom:

```
**Summary:** 18 total | 🔴 6 High | 🟡 11 Medium | 🟢 1 Low | 🔴 1 Overdue
```

Or with `--all` flag:
```
**Summary:** 25 total | 18 active | 6 completed | 1 cancelled | 🔴 1 Overdue
```

## Example output

```
/work-tasks

## Work Tasks

### 🔴 Overdue
| ID | Task | Source | Due |
|----|------|--------|-----|
| TASK-002 | Vietnam Banking Setup - Golden Owl Feedback | 📧 Email | Mar 25 |

### 📅 Today
| ID | Task | Priority | Source |
|----|------|----------|--------|
| TASK-010 | Alvis <> Solutions Meeting | 🟡 Medium | 📅 Calendar |
| TASK-016 | Follow-ups / Escalations Meeting | 🟡 Medium | 📅 Calendar |

### 📆 This Week
| ID | Task | Priority | Due | Source |
|----|------|----------|-----|--------|
| TASK-009 | Project GO Deal-Sync Preparation | 🔴 High | Mar 31 | 📅 Calendar |
| TASK-015 | GO Internal Deal Discussion | 🔴 High | Mar 30 | 📅 Calendar |

### 📋 Pending (No Due Date)
| ID | Task | Priority | Source |
|----|------|----------|--------|
| TASK-001 | Vibe Coding Proposal - Real World Use Cases | 🔴 High | 📧 Email |
| TASK-003 | Project GO Term Sheet Update | 🔴 High | 📧 Email |
| TASK-006 | PRV Agent Project Kickoff Follow-up | 🟡 Medium | 📝 Granola |
| TASK-017 | Block for RL (Reinforcement Learning) | 🟢 Low | 📅 Calendar |

**Summary:** 18 total | 🔴 6 High | 🟡 11 Medium | 🟢 1 Low | 🔴 1 Overdue
```

## Reading task details

To view full details of a specific task:

```
Read: memory/tasks/TASK-001.md
```

This will show the complete task file with context, notes, and action log.

## Notes

- Tasks are read-only in this skill (use /work-sync to create/modify tasks)
- Each task is a separate file for easy git tracking
- Overdue tasks are shown first regardless of priority filter
- Task IDs are permanent (TASK-001, TASK-002, etc.) and don't change
