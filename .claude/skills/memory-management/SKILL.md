---
name: memory-management
description: Hot-cache plus persistent wiki memory system. CLAUDE.md handles fast operational decoding, while memory/ stores the deeper, durable knowledge base Claude maintains over time.
---

# Memory Management

Memory makes Claude your workplace collaborator - someone who speaks your internal language and maintains a durable knowledge base over time.

## The Goal

Transform shorthand into understanding:

```
User: "ask todd to do the PSR for oracle"
              ↓ Claude decodes
"Ask Todd Martinez (Finance lead) to prepare the Pipeline Status Report
 for the Oracle Systems deal ($2.3M, closing Q2)"
```

Without memory, that request is meaningless. With memory, Claude knows:
- **todd** → Todd Martinez, Finance lead, prefers Slack
- **PSR** → Pipeline Status Report (weekly sales doc)
- **oracle** → Oracle Systems deal, not the company

## Architecture

```
CLAUDE.md          ← Hot cache (~30 people, common terms)
memory/
  index.md         ← Top-level catalog of wiki pages
  log.md           ← Chronological log of memory artifact changes
  glossary.md      ← Decoder ring + durable term reference
  people/          ← Complete profiles
  projects/        ← Project details and evolving context
  context/         ← Company, teams, tools
```

This is still a two-tier system, but the deep tier is now treated as a persistent wiki layer, not only a lookup store. `CLAUDE.md` stays optimized for fast decoding during day-to-day work. `memory/` is where durable context accumulates, gets enriched, and remains available across sessions.

**CLAUDE.md (Hot Cache):**
- Top ~30 people you interact with most
- ~30 most common acronyms/terms
- Active projects (5-15)
- Your preferences
- **Goal: Cover 90% of daily decoding needs**

**memory/ (Persistent Wiki Layer):**
- Durable markdown knowledge base maintained over time
- Stores richer context than fits in `CLAUDE.md`
- Compatible with current `glossary.md`, `people/`, `projects/`, and `context/`
- Navigated through `memory/index.md` and `memory/log.md` as it grows

**memory/glossary.md, people/, projects/, context/:**
- Rich detail when needed for execution
- Full profiles, history, context
- Living knowledge artifacts that can be updated as understanding improves

## Lookup Flow

```
User: "ask todd about the PSR for phoenix"

1. Check CLAUDE.md (hot cache)
   → Todd? ✓ Todd Martinez, Finance
   → PSR? ✓ Pipeline Status Report
   → Phoenix? ✓ DB migration project

2. If not found → check memory/index.md and memory/glossary.md
   → Index helps route to the right durable page

3. If still not found → search memory/people/, projects/, context/

4. If still not found → ask user
   → "What does X mean? I'll remember it."
```

This tiered approach keeps `CLAUDE.md` lean (~100 lines) while allowing `memory/` to grow into a compiled, durable knowledge base.

## File Locations

- **Working memory:** `CLAUDE.md` in current working directory
- **Persistent wiki:** `memory/` subdirectory
- **Wiki catalog:** `memory/index.md`
- **Wiki log:** `memory/log.md`

## Link Format (CRITICAL — always use these when writing to files)
| Writing in | Link to people | Link to projects |
|-----------|---------------|-----------------|
| CLAUDE.md or TASKS.md | `[Name](memory/people/name.md)` | `[Project](memory/projects/file.md)` |
| memory/glossary.md | `[Name](people/name.md)` | `[Project](projects/file.md)` |
| memory/people/*.md | `[Other person](othername.md)` | `[Project](../projects/file.md)` |
| memory/projects/*.md | `[Person](../people/name.md)` | — |

## Working Memory Format (CLAUDE.md)

Use tables for compactness. Target ~50-80 lines total.

```markdown
# Memory

## Me
[Name], [Role] on [Team]. [One sentence about what I do.]

## People
| Who | Role |
|-----|------|
| **Todd** | Todd Martinez, Finance lead |
| **Sarah** | Sarah Chen, Engineering (Platform) |
| **Greg** | Greg Wilson, Sales |
→ Full list: memory/glossary.md, profiles: memory/people/

## Terms
| Term | Meaning |
|------|---------|
| PSR | Pipeline Status Report |
| P0 | Drop everything priority |
| standup | Daily 9am sync |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **Phoenix** | DB migration, Q2 launch |
| **Horizon** | Mobile app redesign |
→ Details: memory/projects/

## Preferences
- 25-min meetings with buffers
- Async-first, Slack over email
- No meetings Friday afternoons
```

## Persistent Wiki Format (memory/)

**memory/glossary.md** - The decoder ring and term reference:
```markdown
# Glossary

Workplace shorthand, acronyms, and internal language.

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| PSR | Pipeline Status Report | Weekly sales doc |
| OKR | Objectives & Key Results | Quarterly planning |
| P0/P1/P2 | Priority levels | P0 = drop everything |

## Internal Terms
| Term | Meaning |
|------|---------|
| standup | Daily 9am sync in #engineering |
| the migration | Project Phoenix database work |
| ship it | Deploy to production |
| escalate | Loop in leadership |

## Nicknames → Full Names
| Nickname | Person |
|----------|--------|
| Todd | Todd Martinez (Finance) |
| T | Also Todd Martinez |

## Project Codenames
| Codename | Project |
|----------|---------|
| Phoenix | Database migration |
| Horizon | New mobile app |
```

**memory/people/{name}.md:**
```markdown
# Todd Martinez

**Also known as:** Todd, T
**Role:** Finance Lead
**Team:** Finance
**Reports to:** CFO (Michael Chen)

## Communication
- Prefers Slack DM
- Quick responses, very direct
- Best time: mornings

## Context
- Handles all PSRs and financial reporting
- Key contact for deal approvals over $500k
- Works closely with Sales on forecasting

## Relationships
- reports_to: CFO (Michael Chen)
- works_on: [Project Phoenix](../projects/project-phoenix.md)
- collaborates_with: [Greg Wilson](greg-wilson.md)

## Notes
- Cubs fan, likes talking baseball
```

**memory/projects/{name}.md:**
```markdown
# Project Phoenix

**Codename:** Phoenix
**Also called:** "the migration"
**Status:** Active, launching Q2

## What It Is
Database migration from legacy Oracle to PostgreSQL.

## Key People
- Sarah - tech lead
- Todd - budget owner
- Greg - stakeholder (sales impact)

## Relationships
- owns: Todd Martinez
- depends_on: Horizon project
- blocks: -

## Context
$1.2M budget, 6-month timeline. Critical path for Horizon project.
```

**memory/context/company.md:**
```markdown
# Company Context

## Tools & Systems
| Tool | Used for | Internal name |
|------|----------|---------------|
| Slack | Communication | - |
| Asana | Engineering tasks | - |
| Salesforce | CRM | "SF" or "the CRM" |
| Notion | Docs/wiki | - |

## Teams
| Team | What they do | Key people |
|------|--------------|------------|
| Platform | Infrastructure | Sarah (lead) |
| Finance | Money stuff | Todd (lead) |
| Sales | Revenue | Greg |

## Processes
| Process | What it means |
|---------|---------------|
| Weekly sync | Monday 10am all-hands |
| Ship review | Thursday deploy approval |
```

**memory/index.md** - Top-level catalog:
```markdown
# Memory Index

## Core Files
- [glossary.md](glossary.md) - Decoder ring
- [log.md](log.md) - Chronological change history

## Directories
- `people/`
- `projects/`
- `context/`
```

**memory/log.md** - Chronological record of memory artifact changes:
```markdown
# Memory Log

2026-04-06 17:50:25 +0800 | phase-2 | memory/log.md | Added index and log primitives to the persistent wiki layer.
```

`memory/log.md` is append-only. Add new entries only at the end of the file and keep timestamps monotonic.

## Core Workflows

Use these four workflows when operating on memory:

### 1. Decode
- Use when the user references shorthand, acronyms, nicknames, codenames, or implied context.
- Goal: resolve meaning quickly so execution is accurate.
- Default lookup order:
  1. `CLAUDE.md`
  2. `memory/index.md`
  3. `memory/glossary.md`
  4. relevant pages under `memory/`
  5. ask the user if still unknown

### 2. Ingest
- Use when new durable source material appears: meetings, project updates, decisions, recurring threads, or explicit "remember this" input.
- Goal: integrate information into the persistent wiki, not just answer once.
- Default behavior:
  - enrich existing pages first
  - update `memory/index.md` only when navigation changes
  - append to `memory/log.md` when a `memory/` artifact materially changes
  - avoid creating duplicate fragments

### 3. Query
- Use when the user asks for synthesized understanding across memory.
- Goal: answer from the wiki layer, not only from raw chat context.
- If the result is durable and likely reusable, prefer filing it back into memory instead of leaving it only in chat.

### 4. Lint
- Use when reviewing memory quality, staleness, gaps, duplication, or structural issues.
- Goal: detect what needs cleanup or enrichment.
- In this phase, lint can identify issues, but cleanup rules remain conservative until later phases.

## How to Interact

### Decoding User Input (Tiered Lookup)

**Always** decode shorthand before acting on requests:

```
1. CLAUDE.md (hot cache)     → Check first, covers 90% of cases
2. memory/index.md           → Route to the right durable page
3. memory/glossary.md        → Full glossary if not in hot cache
4. memory/people/, projects/ → Rich detail when needed
5. Ask user                  → Unknown term? Learn it.
```

Example:
```
User: "ask todd to do the PSR for oracle"

CLAUDE.md lookup:
  "todd" → Todd Martinez, Finance ✓
  "PSR" → Pipeline Status Report ✓
  "oracle" → (not in hot cache)

memory/glossary.md lookup:
  "oracle" → Oracle Systems deal ($2.3M) ✓

Now Claude can act with full context.
```

### Adding Memory

When user says "remember this" or "X means Y", treat it as an ingest action:

1. **Glossary items** (acronyms, terms, shorthand):
   - Add to memory/glossary.md
   - If frequently used, add to CLAUDE.md Quick Glossary

2. **People:**
   - Create/update memory/people/{name}.md
   - Add to CLAUDE.md Key People if important
   - **Capture nicknames** - critical for decoding

3. **Projects:**
   - Create/update memory/projects/{name}.md
   - Add to CLAUDE.md Active Projects if current
   - **Capture codenames** - "Phoenix", "the migration", etc.

4. **Preferences:** Add to CLAUDE.md Preferences section

When memory already exists, prefer enriching the existing wiki pages instead of creating duplicate fragments. Preserve the current structure unless there is a strong reason to expand it.

### Ingest Guidance

- Ingest durable context into `memory/`, not `CLAUDE.md`, unless it is part of the hot cache.
- Prefer updating an existing person/project/glossary/context page before creating anything new.
- Keep `CLAUDE.md` short and operational.
- If ingest materially changes a file under `memory/`, add a short single-line entry to `memory/log.md` with the format `YYYY-MM-DD HH:MM:SS +TZ | tag | path | message`.

### Provenance And Trust Rules

- Prefer attributed memory over unattributed memory.
- When possible, record where a claim came from, when it was observed, and how certain it is.
- Do not silently upgrade a guess into a fact.
- If confidence is low, preserve the uncertainty in the wording.

Use these trust categories when updating memory:

- **Fact** - stable information with clear grounding, such as a confirmed role, project name, date, or explicit statement from a reliable source.
- **Assumption** - a working interpretation that is useful but not fully confirmed.
- **Preference** - a user or stakeholder preference, working style, or communication habit.
- **Open question** - something unresolved that should not be stored as settled truth.

When a page includes uncertain information, prefer labels in the prose such as:
- `Confirmed:` for high-confidence facts
- `Assumption:` for working interpretations
- `Preference:` for behavioral or communication patterns
- `Open question:` for unresolved items

Provenance can be lightweight. Good sources include:
- task text
- meeting notes
- email thread
- Slack thread
- calendar context
- direct user instruction

If a source is not worth storing explicitly, still keep the wording conservative.

### Contradiction Handling

- Never silently overwrite a conflicting claim if both the old and new information may matter.
- Prefer updating the page to show the newest understanding while noting that a prior view existed.
- If the contradiction is operationally important, surface it to the user.
- If the conflict is minor and the newer source is clearly authoritative, update the page and keep the wording factual.

Example approach:
- old: `Role: Finance Lead`
- new conflicting input: `Now acting as Interim CFO`
- update: note the new role clearly and mention the transition instead of erasing context blindly

### Recalling Memory

When user asks "who is X" or "what does X mean", treat it as a decode/query action:

1. Check CLAUDE.md first
2. Check `memory/index.md` if the target page is not obvious
3. Check the most relevant page under `memory/` for full detail
4. Check `memory/log.md` if recent changes may matter
5. If not found: "I don't know what X means yet. Can you tell me?"

### Progressive Disclosure

1. Load CLAUDE.md for quick parsing of any request
2. Dive into memory/ when you need full context for execution
3. Example: drafting an email to todd about the PSR
   - CLAUDE.md tells you Todd = Todd Martinez, PSR = Pipeline Status Report
   - memory/people/todd-martinez.md tells you he prefers Slack, is direct

### Persistent Wiki Mindset

- Treat `memory/` as the durable knowledge layer, not only a fallback lookup table
- Keep `CLAUDE.md` optimized for speed and frequency, not completeness
- Prefer enriching existing pages over scattering facts across many small notes
- Preserve compatibility with current `glossary.md`, `people/`, `projects/`, and `context/`
- Use `memory/index.md` as the top-level entry point into the persistent wiki layer
- Use `memory/log.md` to understand recent changes to `memory/` artifacts when relevant

### Query Guidance

- Answer from the compiled wiki layer when possible.
- Use `CLAUDE.md` for fast disambiguation, then drill into `memory/` for richer context.
- Prefer synthesized answers that reflect the current state of memory, not isolated fragments.
- Distinguish confirmed memory from assumptions when answering.
- Prefer linked pages and typed relationships over scattered mentions when reconstructing context.

### Compounding Outputs

- Durable outputs should compound into the wiki when they are likely to be useful again.
- Do not file transient chatter, one-off phrasing, or low-signal summaries.
- Prefer enriching an existing page over creating a new artifact.

Good candidates to file back into memory:
- meeting syntheses that change project or stakeholder understanding
- comparisons, recommendations, or decision support likely to be reused
- recurring unresolved issues or follow-up themes
- clarifications that materially improve a person, project, or term page

Usually do not file:
- casual back-and-forth with no durable value
- temporary execution notes that belong only in the current chat
- duplicate summaries of information already captured well elsewhere

Default filing targets:
- person-related synthesis → `memory/people/{name}.md`
- project-related synthesis → `memory/projects/{name}.md`
- term clarification → `memory/glossary.md`
- company/team/tool context → `memory/context/*.md`

When deciding whether to file, use this rule of thumb:
- if the answer would be useful in a future session, store it
- if it only helps the current turn, leave it in chat

If a durable answer materially changes a file under `memory/`, add a short entry to `memory/log.md`.

### Lint Guidance

- Flag stale or inconsistent memory, but do not aggressively restructure without a clear reason.
- Prefer small, targeted cleanup over broad rewrites.
- Surface gaps clearly when memory is incomplete.
- Check for claims that need provenance, confidence downgrades, or contradiction notes.
- Check for missing related-page links and missing relationship labels on important people and projects.

Lint should check for:
- stale people, project, or context pages
- orphan pages with weak or no navigational links
- duplicate entities, aliases, or near-duplicate terms
- claims missing provenance or trust labeling where needed
- contradictions between core pages
- repeated unknown terms that should be promoted into memory

Lint output should be a concise report grouped into:
- `Fix now` - high-signal issues that will hurt future retrieval
- `Needs confirmation` - ambiguous merges, contradictions, or uncertain updates
- `Nice to improve` - weak links, missing related sections, or low-priority cleanup

Default lint behavior:
- report first, edit second
- prefer targeted fixes over broad normalization
- do not merge entities automatically when ambiguity remains
- ask the user before making meaning-changing cleanup

### Relationship Conventions

Use lightweight typed relationships in page prose when they add retrieval value.

Preferred labels:
- `works_on`
- `reports_to`
- `owns`
- `blocks`
- `depends_on`
- `contradicts`
- `collaborates_with`

Rules:
- Use typed relationships only when they clarify structure or navigation.
- Prefer a small stable set of labels over inventing synonyms.
- Add them to the most relevant existing page instead of creating standalone relationship files.
- When two pages are strongly connected, add at least one explicit cross-link in prose or a related section.

### Related-Page Conventions

- Important person and project pages should include either explicit links in context sections or a small `Relationships` or `Related` section.
- Prefer backlinks that help future retrieval, not decorative link spam.
- When updating a core page, consider whether one or two related pages should also be updated for consistency.

## Bootstrapping

Use `/work-start` to initialize by scanning your chat, calendar, email, and documents. A fresh bootstrap should create `CLAUDE.md`, `memory/index.md`, `memory/log.md`, `memory/glossary.md`, and the core `people/`, `projects/`, and `context/` structures.

## Conventions

- **Bold** terms in CLAUDE.md for scannability
- Keep CLAUDE.md under ~100 lines (the "hot 30" rule)
- Filenames: lowercase, hyphens (`todd-martinez.md`, `project-phoenix.md`)
- Always capture nicknames and alternate names
- Glossary tables for easy lookup
- When something's used frequently, promote it to CLAUDE.md
- When something goes stale, demote it to memory/ only
- Prefer durable synthesis in `memory/` and concise operational summaries in `CLAUDE.md`
- Prefer explicit typed relationships on important pages when they improve retrieval

### Metadata Conventions

Keep metadata lightweight and only add it when it improves maintenance or retrieval.

Preferred fields in page prose or simple header blocks:
- `Status`
- `Type`
- `Also known as`
- `Last updated`
- `Source` or `Sources` when provenance matters

Rules:
- Do not add metadata just for symmetry.
- Prefer human-readable metadata already used by the repo over introducing heavy frontmatter everywhere.
- Add new metadata fields only when they are likely to be queried, linted, or maintained.

### New Page Types

- Keep the core structure centered on `glossary.md`, `people/`, `projects/`, and `context/`.
- Add new page types only when repeated use justifies them.
- Prefer extending existing pages before creating new top-level categories.
- If a new page type is introduced later, add it to `memory/index.md` and keep the naming convention simple.

## What Goes Where

| Type | CLAUDE.md (Hot Cache) | memory/ (Persistent Wiki) |
|------|----------------------|---------------------------|
| Person | Top ~30 frequent contacts | glossary.md + people/{name}.md |
| Acronym/term | ~30 most common | glossary.md (complete list) |
| Project | Active projects only | glossary.md + projects/{name}.md |
| Nickname | In Key People if top 30 | glossary.md (all nicknames) |
| Company context | Quick reference only | context/company.md |
| Preferences | All preferences | - |
| Assumptions | Only if operationally important | Keep in page prose with clear `Assumption:` labeling |
| Open questions | Only if critical to near-term execution | Keep in page prose with clear `Open question:` labeling |
| Historical/stale | ✗ Remove | ✓ Keep in memory/ |

## Promotion / Demotion

**Promote to CLAUDE.md when:**
- You use a term/person frequently
- It's part of active work

**Demote to memory/ only when:**
- Project completed
- Person no longer frequent contact
- Term rarely used

This keeps CLAUDE.md fresh and relevant.
