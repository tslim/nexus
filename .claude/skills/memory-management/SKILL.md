---
name: memory-management
description: Memory workflow for ingest, query, and lint operations, using a fast operational cache alongside a durable wiki in `memory/`.
---

# Memory Management

Build and maintain a persistent, compounding markdown wiki in `memory/`, with `CLAUDE.md` as a hot cache for fast operational decoding. Keep `CLAUDE.md` lean. It is the hot cache for frequent operational decoding, not the durable wiki.

Unlike chat-only memory, this system keeps durable context current over time. `CLAUDE.md` is for frequent people, terms, projects, and preferences. `memory/` is the durable wiki for richer, longer-lived knowledge.

The wiki is plain markdown and can be read in any editor.

## Architecture

```text
CLAUDE.md          <- Hot cache for frequent people, terms, projects, and preferences
memory/
├── SCHEMA.md      <- Structure rules and page conventions
├── index.md       <- Content catalog for the durable wiki
├── log.md         <- Chronological action log
├── glossary.md    <- Decoder ring for acronyms, shorthand, aliases, and internal names
├── people/        <- Person pages
├── projects/      <- Project and workstream pages
├── context/       <- Shared organizational context
├── topics/        <- Thematic notes and reference collections
├── comparisons/   <- Side-by-side analyses worth keeping
└── queries/       <- Filed query results worth keeping
```

## Schema

`memory/SCHEMA.md` is the source of truth for wiki structure and conventions.

Follow it when creating or updating durable wiki pages:
- page types
- naming
- frontmatter
- linking
- indexing
- page structure expectations

Do not duplicate schema rules in this skill unless needed for execution workflow.

## Reference Templates

### `memory/SCHEMA.md`

~~~markdown
# Memory Schema

## Domain
[What this wiki covers]

## Conventions
- File names: lowercase, hyphens, no spaces
- New durable pages start with YAML frontmatter:
  ```yaml
  ---
  title: Page Title
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  type: person | project | context | topic | comparison | query | glossary | schema | index | log
  tags: [tag1, tag2]
  sources: []
  ---
  ```
- Use standard markdown links for new links between wiki pages
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md`
- Every material under `memory/` change must be appended to `log.md`
- Core files may use `schema`, `index`, or `log` as their frontmatter type

## Compact Pages
- Prefer synthesis over chronology; merge or replace stale bullets before appending.
- People pages: aim for 15-35 lines; keep identity, context, work areas, relationships, and durable milestones.
- Active project pages: aim for 40-80 lines; completed projects: 25-60 lines. Longer pages need useful timelines, decision tables, or references.

## People Pages
One page per recurring collaborator or stakeholder. Include:
- Identity and role
- Context or current work
- Key facts or identifiers when useful
- Relationships to projects, teams, or people
- Durable milestones only

## Project Pages
One page per project or workstream. Include:
- Status and type
- What it is
- Key people
- Current state, active work, decisions, risks, or durable recent activity
- Relevant references

## Context Pages
Shared organizational reference pages. Include:
- Teams and workstreams
- Tools and systems
- Channels
- Processes and operating norms

## Topic Pages
One page per thematic note or reference collection. Include:
- Definition or framing
- Current state of knowledge
- Links, references, or observations
- Related pages

## Comparison Pages
Side-by-side analyses. Include:
- What is being compared and why
- Dimensions of comparison (table preferred)
- Verdict or synthesis
- Sources

## Query Pages
Filed query results worth keeping. Include:
- Original question
- Synthesized answer
- Scope or assumptions
- Related pages
- Sources

## Glossary
Central decoder ring for acronyms, internal terms, aliases, and other shorthand that needs quick decoding.
~~~

### `memory/index.md`

```markdown
# Memory Index

> Content catalog for the durable wiki under `memory/`.
> Read this first to find relevant files for any memory-backed query.

## Glossary
- [Glossary](glossary.md) - Decoder ring for acronyms, shorthand, aliases, and internal names.

## People
<!-- people pages listed here -->

## Projects
<!-- project pages listed here -->

## Context
<!-- context pages listed here -->

## Topics
<!-- topic pages listed here -->

## Comparisons
<!-- comparison pages listed here -->

## Queries
<!-- filed query results listed here -->

## Core Files
- [SCHEMA.md](SCHEMA.md) - Structural rules for the durable wiki.
- [log.md](log.md) - Chronological record of notable memory-system changes.
```

### `memory/log.md`

```markdown
# Memory Log

> Chronological record of all memory actions. Append-only.
> Format: `YYYY-MM-DD HH:MM:SS +TZ | action | subject | message`

YYYY-MM-DD 00:00:00 +0800 | create | Memory initialized | Created `SCHEMA.md`, `index.md`, and `log.md`
```

Before appending to `memory/log.md`, get the actual local timestamp with:

```bash
date '+%Y-%m-%d %H:%M:%S %z'
```

Use that exact timestamp in each appended log entry. Do not estimate, round, or invent timestamps.

## Core Operations

### 1. Ingest

When the user provides durable information such as project updates, decisions, recurring threads, meeting context, or explicit "remember this" instructions:

1. Read `memory/index.md` to identify likely target pages.
2. Read the relevant existing pages before making changes.
3. Update existing pages first when the information fits naturally.
4. Create a new page only when the information does not fit an existing page cleanly.
5. Follow `memory/SCHEMA.md` for page structure and conventions.
6. Add meaningful cross-references with standard markdown links when creating new links.
7. Update `memory/index.md` for every new, renamed, deleted, or reclassified page.
8. Append the action to `memory/log.md`.
9. Report which files were created or updated.

Guidelines:
- Put durable detail in `memory/`.
- Prefer targeted updates over broad rewrites.
- Keep pages compact: synthesize, merge, or replace bullets instead of appending routine chronology.
- Size guide: people 15-35 lines, active projects 40-80, completed projects 25-60; exceed only for useful timelines, decision tables, or references.
- Ask before mass-updating if the ingest would touch 10 or more existing pages.

### 2. Query

When the user asks a question that depends on stored memory:

1. Read `CLAUDE.md` for fast decoding.
2. Read `memory/index.md` to identify relevant pages.
3. Read `memory/glossary.md` if term or shorthand decoding is needed.
4. Read the most relevant durable wiki pages.
5. Synthesize the answer from the compiled wiki, not only the current chat.
6. File valuable outputs back into memory when they are likely to help again.
7. Append the action to `memory/log.md` when the query produces a durable memory update.

Preferred filing targets:
- person-specific durable update -> relevant `memory/people/` page
- project-specific durable update -> relevant `memory/projects/` page
- company, process, tool, or channel context -> relevant `memory/context/` page
- thematic reference collection -> relevant `memory/topics/` page
- reusable side-by-side analysis -> `memory/comparisons/`
- reusable standalone synthesized answer -> `memory/queries/`
- term or alias clarification -> `memory/glossary.md`

Guidelines:
- Simple factual lookups do not always require a durable write-back.
- Substantial comparisons, status snapshots, and cross-source syntheses usually should be preserved.
- Use stable filenames for recurring query or comparison pages, and update the existing page when the same durable question comes up again.
- Ask before creating a brand new page when the filing value is uncertain.

### 3. Lint

When the user asks to lint, health-check, or audit the memory wiki:

1. Scan for contradictions across related pages.
2. Find orphan or weakly linked pages.
3. Check for stale content in important pages.
4. Validate frontmatter for durable pages against `memory/SCHEMA.md`:
   - required keys exist (`title`, `created`, `updated`, `type`, `tags`, `sources`)
   - `type` matches the page category
   - `updated` reflects recent edits when content changed
   - core files also pass frontmatter validation, including `memory/log.md`
   - core files use allowed core types
5. Identify missing dedicated pages for repeatedly referenced people, projects, terms, or topics.
6. Verify that every durable page appears in `memory/index.md`.
7. Verify that new durable pages follow `memory/SCHEMA.md`.
8. Report findings first with specific file paths and suggested actions.
9. Append the lint action to `memory/log.md` if changes were made or findings were formally recorded.

Group findings into:
- Fix now
- Needs confirmation
- Nice to improve

## Working With The Wiki

### Searching

Use this lookup order by default:
1. `CLAUDE.md`
2. `memory/index.md`
3. `memory/glossary.md`
4. relevant pages under `memory/`
5. `memory/log.md` if recent changes matter

For larger memory lookups:
- search `memory/` by filename to find candidate pages
- search markdown content when the relevant page is unclear
- use `memory/index.md` as the navigation layer, not as a substitute for reading source pages

### Batch Updates

When multiple related updates arrive at once:
- read all relevant pages first
- identify overlapping people, projects, and topics
- update pages in one pass to avoid redundant edits
- update `memory/index.md` once at the end
- append the corresponding actions to `memory/log.md`

## Pitfalls

- Do not skip `memory/index.md` and `memory/log.md` updates.
- Do not create duplicate pages when an existing page should be updated.
- Do not create isolated pages without meaningful cross-references.
- Do not let `CLAUDE.md` grow into the durable wiki.
- Do not silently replace conflicting claims when the conflict affects execution.
- Do not ignore `memory/SCHEMA.md` when creating new pages.
- Do not file casual chat or temporary execution notes as durable memory.
