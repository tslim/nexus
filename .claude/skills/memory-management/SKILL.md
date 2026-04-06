---
name: memory-management
description: Hot-cache plus persistent wiki memory system. CLAUDE.md handles fast operational decoding, while memory/ stores durable knowledge Claude maintains over time.
---

# Memory Management

Use a two-layer memory system:

```text
CLAUDE.md          <- Hot cache for frequent people, terms, projects, preferences
memory/
  index.md         <- Top-level catalog
  log.md           <- Append-only log of memory file changes
  glossary.md      <- Terms, aliases, decoder ring
  people/          <- Person pages
  projects/        <- Project pages
  context/         <- Company, team, tool context
```

## Purpose

- `CLAUDE.md` is for fast decoding during active work
- `memory/` is the durable wiki
- Prefer enriching existing memory over creating fragments

## Lookup Order

When the user uses shorthand or asks for context:

1. Check `CLAUDE.md`
2. Check `memory/index.md`
3. Check `memory/glossary.md`
4. Check the most relevant page under `memory/`
5. Check `memory/log.md` if recent memory changes may matter
6. Ask the user if still unknown

## Core Workflows

### Decode
- Use for shorthand, acronyms, nicknames, codenames, and implied context
- Goal: resolve meaning quickly and accurately

### Ingest
- Use for durable new information: meetings, project updates, decisions, recurring threads, or explicit "remember this"
- Update existing pages first
- Keep `CLAUDE.md` short; put durable detail in `memory/`

### Query
- Use for synthesized answers across memory
- Answer from the wiki, not only from recent chat
- If the answer will help a future session, file it back into memory

### Lint
- Use to review memory quality
- Report first, edit second
- Prefer targeted cleanup over broad rewrites

## File Rules

### `CLAUDE.md`
- Keep compact, roughly 50-100 lines
- Store only frequent people, terms, active projects, and preferences

### `memory/log.md`
- Format: `YYYY-MM-DD HH:MM:SS +TZ | tag | path | message`
- Append-only
- Add new entries only at the end
- Keep timestamps monotonic
- Log only material changes to files under `memory/`

### Link Format

| Writing in | Link to people | Link to projects |
|-----------|---------------|-----------------|
| `CLAUDE.md` or `TASKS.md` | `[Name](memory/people/name.md)` | `[Project](memory/projects/file.md)` |
| `memory/glossary.md` | `[Name](people/name.md)` | `[Project](projects/file.md)` |
| `memory/people/*.md` | `[Other person](othername.md)` | `[Project](../projects/file.md)` |
| `memory/projects/*.md` | `[Person](../people/name.md)` | - |

## Memory Types

| Type | `CLAUDE.md` | `memory/` |
|------|-------------|-----------|
| Person | frequent only | `glossary.md` + `people/{name}.md` |
| Acronym/term | frequent only | `glossary.md` |
| Project | active only | `glossary.md` + `projects/{name}.md` |
| Preference | yes | optional if needed for context |
| Assumption | no, unless critical | page prose with `Assumption:` |
| Open question | no, unless critical | page prose with `Open question:` |
| Historical/stale | no | keep in `memory/` |

## Trust Rules

- Prefer attributed memory over unattributed memory
- When possible, note source and observation date
- Do not silently turn a guess into a fact
- Preserve uncertainty in wording when confidence is low

Use these labels when helpful:
- `Confirmed:`
- `Assumption:`
- `Preference:`
- `Open question:`

Useful source types:
- direct user instruction
- task text
- meeting notes
- email thread
- Slack thread
- calendar context

## Contradictions

- Do not silently overwrite conflicting claims when both may matter
- Prefer updating the page with the newest understanding while preserving important prior context
- If the contradiction affects execution, surface it to the user
- If the new source is clearly authoritative and the conflict is minor, update directly

## Compounding Outputs

File durable outputs back into memory when they are likely to help again.

Good candidates:
- meeting syntheses that change understanding
- reusable comparisons or recommendations
- recurring unresolved issues
- clarifications that materially improve a person, project, or term page

Usually do not file:
- casual back-and-forth
- temporary execution notes
- duplicate summaries already captured elsewhere

Default filing targets:
- person-related synthesis -> `memory/people/{name}.md`
- project-related synthesis -> `memory/projects/{name}.md`
- term clarification -> `memory/glossary.md`
- company/team/tool context -> `memory/context/*.md`

## Relationships And Related Pages

Use lightweight typed relationships when they improve retrieval.

Preferred labels:
- `works_on`
- `reports_to`
- `owns`
- `blocks`
- `depends_on`
- `contradicts`
- `collaborates_with`

Rules:
- Prefer a small stable set of labels
- Add relationships to the most relevant existing page
- Important person and project pages should include explicit links in prose or a small `Relationships` or `Related` section
- Avoid decorative link spam

## Lint Checks

Check for:
- stale people, project, or context pages
- orphan pages with weak navigation
- duplicate entities or aliases
- missing provenance where it matters
- contradictions between core pages
- repeated unknown terms worth promoting into memory
- missing relationship or related-page links on important pages

Group lint output into:
- `Fix now`
- `Needs confirmation`
- `Nice to improve`

## Metadata

Keep metadata light. Prefer simple prose fields over heavy frontmatter.

Useful fields:
- `Status`
- `Type`
- `Also known as`
- `Last updated`
- `Source` or `Sources`

Only add metadata that will actually help retrieval, linting, or maintenance.

## New Page Types

- Keep the core structure centered on `glossary.md`, `people/`, `projects/`, and `context/`
- Add new page types only when repeated use justifies them
- Add any new page type to `memory/index.md`

## Bootstrapping

`/work-start` should create:
- `CLAUDE.md`
- `memory/index.md`
- `memory/log.md`
- `memory/glossary.md`
- core `people/`, `projects/`, and `context/` structures
