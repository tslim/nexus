---
name: memory-management
description: Hot-cache plus persistent wiki memory system. CLAUDE.md handles fast operational decoding, while memory/ stores durable knowledge Claude maintains over time.
---

# Memory Management

Use a two-layer memory system:

```text
CLAUDE.md          <- Hot cache (~30 people, terms, projects). Lightweight, fast.
memory/            <- Durable wiki. Unlimited scale.
  index.md         <- Top-level catalog
  log.md           <- Append-only log of changes
  glossary.md      <- Full decoder ring
  people/          <- Person pages
  projects/        <- Project pages
  context/         <- Company context (tools, channels, processes, teams)
  topics/          <- Thematic notes and reference collections
```

**CLAUDE.md is hot memory** - keep it compact (50-100 lines), storing only frequent people, active projects, and common terms. It should cover 90% of daily decoding needs. Durable detail goes in `memory/`.

## Memory Types

| Type | `CLAUDE.md` (Hot) | `memory/` (Durable) |
|------|-------------------|---------------------|
| Person | Frequent contacts only (~30) | `glossary.md` + `people/{name}.md` |
| Acronym/term | Common only (~30) | `glossary.md` (complete) |
| Project | Active only | `glossary.md` + `projects/{name}.md` |
| Topic | No | `topics/{name}.md` |
| Preference | All preferences | Optional context |
| Assumption | Critical only | Page prose with `Assumption:` |
| Open question | Critical only | Page prose with `Open question:` |
| Historical/stale | No - demote to memory/ only | Yes - keep in `memory/` |

**Promotion/Demotion:** Move items to CLAUDE.md when frequently used. Demote to memory/ only when stale or rarely needed.

## Core Workflows

### Ingest
For durable new information: meetings, project updates, decisions, recurring threads, or explicit "remember this."

- Update existing pages first
- Put durable detail in `memory/`; keep `CLAUDE.md` lean
- Log material changes to `memory/log.md`
- When creating new pages, update `memory/index.md` to keep the catalog current

### Query
For any question requiring memory lookup.

**Lookup Order (automatic decoding):**
1. Check `CLAUDE.md` (hot cache - covers 90% of cases)
2. Check `memory/index.md`
3. Check `memory/glossary.md`
4. Check the most relevant page under `memory/`
5. Check `memory/log.md` if recent changes matter
6. Ask the user if still unknown

**Two-Output Rule:**
Every query produces two outputs: (1) the answer, and (2) memory updates.

1. Decode shorthand/acronyms via lookup order above
2. Answer from the wiki, not only from recent chat
3. File durable synthesis back to memory before or alongside delivering the answer
4. Ask before creating new pages from query synthesis

**Syntheses Format:**
Add query outputs to a `## Syntheses` section on relevant pages:

```markdown
## Syntheses

### YYYY-MM-DD: Brief topic label
**Query:** [The original question]
**Insight:** [The synthesized answer]
**Related:** [Links to relevant people/projects/terms]
```

Rules:
- Append new syntheses for historical queries
- Update existing syntheses when replacing stale status (add brief history note)
- Always ask before creating a new page from query synthesis
- Log all synthesis additions to `memory/log.md`

### Lint
For reviewing memory quality.

- Report first, edit second
- Prefer targeted cleanup over broad rewrites
- Group findings into: `Fix now`, `Needs confirmation`, `Nice to improve`

## File Reference

### Templates

**CLAUDE.md** (Hot Cache - keep under 100 lines):
```markdown
# Memory

## Me
[Name], [Role] on [Team]. [One sentence about what I do.]

## People
| Who | Role |
|-----|------|
| **Todd** | Todd Martinez, Finance lead |
| **Sarah** | Sarah Chen, Engineering |
→ Full list: memory/glossary.md, profiles: memory/people/

## Terms
| Term | Meaning |
|------|---------|
| PSR | Pipeline Status Report |
| P0 | Drop everything priority |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **Phoenix** | DB migration, Q2 launch |
→ Details: memory/projects/

## Preferences
- 25-min meetings with buffers
- Async-first, Slack over email
```

**memory/glossary.md:**
```markdown
# Glossary

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| PSR | Pipeline Status Report | Weekly sales doc |

## Internal Terms
| Term | Meaning |
|------|---------|
| standup | Daily 9am sync |

## People
| Name | Profile |
|------|---------|
| Todd Martinez | [Profile](people/todd-martinez.md) |

## Projects
| Name | Reference |
|------|-----------|
| Phoenix | [Project](projects/phoenix.md) |
```

**memory/people/{name}.md:**
```markdown
# Todd Martinez

**Also known as:** Todd, T
**Role:** Finance Lead
**Team:** Finance

## Context
- Handles all PSRs and financial reporting
- Works closely with [Sales team](../context/company.md)

## Relationships
- works_on: [Project Phoenix](../projects/phoenix.md)
- reports_to: CFO

## Notes
- Cubs fan, likes talking baseball
```

**memory/projects/{name}.md:**
```markdown
# Project Phoenix

**Status:** Active
**Type:** Infrastructure migration

**Also called:** "the migration"

## What It Is
Database migration from legacy Oracle to PostgreSQL.

## Key People
- [Sarah](../people/sarah-chen.md) - tech lead
- [Todd](../people/todd-martinez.md) - budget owner

## Context
$1.2M budget, 6-month timeline.

## Syntheses
### YYYY-MM-DD: Brief topic
**Query:** [Question]
**Insight:** [Answer]
**Related:** [Links]
```

**memory/log.md:**
- Format: `YYYY-MM-DD HH:MM:SS +TZ | tag | path | message`
- Append-only, monotonic timestamps
- Log only material changes to files under `memory/`

**memory/context/company.md:**
```markdown
# Company Context

Organizational structure, tools, channels, and processes.

## Teams and Workstreams

| Track | What it covers | Key collaborators |
|-------|----------------|-------------------|
| Solutions | Daily delivery sync | [John](../people/john.md) |
| [Project X](../projects/x.md) | Description | [Person](../people/person.md) |

## Tools and Systems

| Category | Tool | Used for | Notes |
|----------|------|----------|-------|
| Core | Slack | Communication | Primary real-time |
| Dev | Framework X | App development | Core stack |

## Communication Channels

| Type | Channel | Purpose |
|------|---------|---------|
| Slack | `#team` | Daily standup |
| DM | `Leadership` | Exec coordination |

## Processes and Workflows

| Category | Process | Cadence | Purpose |
|----------|---------|---------|---------|
| Delivery | UAT loop | Per cycle | Validation |
| Meeting | Standup | Daily | Team sync |
```

### Link Format (CRITICAL)

| Writing in | Link to people | Link to projects |
|-----------|---------------|-----------------|
| `CLAUDE.md` or `TASKS.md` | `[Name](memory/people/name.md)` | `[Project](memory/projects/file.md)` |
| `memory/glossary.md` | `[Name](people/name.md)` | `[Project](projects/file.md)` |
| `memory/people/*.md` | `[Other person](othername.md)` | `[Project](../projects/file.md)` |
| `memory/projects/*.md` | `[Person](../people/name.md)` | — |

## Writing Guidelines

### Trust Rules
- Prefer attributed memory over unattributed memory
- When possible, note source and observation date
- Do not silently turn a guess into a fact
- Preserve uncertainty in wording when confidence is low

**Use these labels when helpful:**
- `Confirmed:`
- `Assumption:`
- `Preference:`
- `Open question:`

**Useful source types:** direct user instruction, task text, meeting notes, email thread, Slack thread, calendar context

### Contradictions
- Do not silently overwrite conflicting claims when both may matter
- Prefer updating the page with the newest understanding while preserving important prior context
- If the contradiction affects execution, surface it to the user
- If the new source is clearly authoritative and the conflict is minor, update directly

### Relationships and Related Pages
Use lightweight typed relationships when they improve retrieval.

**Preferred labels:** `works_on`, `reports_to`, `owns`, `blocks`, `depends_on`, `contradicts`, `collaborates_with`

**Rules:**
- Prefer a small stable set of labels
- Add relationships to the most relevant existing page
- Important pages should include explicit links in prose or a small `Relationships` or `Related` section
- Avoid decorative link spam

### Metadata
Keep metadata light. Prefer simple prose fields over heavy frontmatter.

**Useful fields:** `Status`, `Type`, `Also known as`, `Last updated`, `Source` or `Sources`

Only add metadata that will actually help retrieval, linting, or maintenance.

## Compounding Outputs

File durable outputs back into memory when they are likely to help again.

**Good candidates:**
- Meeting syntheses that change understanding
- Reusable comparisons or recommendations
- Recurring unresolved issues
- Clarifications that materially improve a person, project, or term page
- Query answers that synthesize across multiple sources

**Usually do not file:**
- Casual back-and-forth
- Temporary execution notes
- Duplicate summaries already captured elsewhere
- Simple lookups with no synthesis

**Default filing targets:**
- Person-related synthesis → `memory/people/{name}.md`
- Project-related synthesis → `memory/projects/{name}.md`
- Term clarification → `memory/glossary.md`
- Company/team/tool context → `memory/context/*.md`
- Thematic references or grouped research → `memory/topics/{name}.md`
- Cross-cutting synthesis → ask user whether to create new page

## Lint Checks

Check for:
- Stale people, project, or context pages
- Orphan pages with weak navigation
- Duplicate entities or aliases
- Missing provenance where it matters
- Contradictions between core pages
- Repeated unknown terms worth promoting into memory
- Missing relationship or related-page links on important pages
- `memory/index.md` missing entries for existing pages

## New Page Types

- Keep the core structure centered on `glossary.md`, `people/`, `projects/`, `context/`, and `topics/`
- Add new page types only when repeated use justifies them
- Add any new page type to `memory/index.md`

## Bootstrapping

`/work-start` creates:
- `CLAUDE.md`
- `memory/index.md`
- `memory/log.md`
- `memory/glossary.md`
- Core `people/`, `projects/`, `context/`, and `topics/` structures
