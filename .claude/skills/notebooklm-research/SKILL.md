---
name: notebooklm-research
description: >
  Orchestrates deep research projects by creating NotebookLM notebooks and
  automatically populating them with sources from across the organization —
  Slack threads, Gmail conversations, Google Drive docs, Granola meeting notes,
  and web research. Applies structured knowledge management (Three-Tiered
  Architecture, Focus & Peel, ACG) on top of the notebooklm CLI to produce
  podcasts, reports, mind maps, and other artifacts.
  Triggers on: "notebooklm research", "research project", "deep research",
  "consolidate into notebooklm", "create a research notebook".
---

# NotebookLM Deep Research Orchestrator

This skill is the **strategy layer** that sits on top of `read-notebooklm` (the CLI
execution layer). It knows *why* and *how* to organize research, while `read-notebooklm`
knows *what commands to run*. Together they form a complete research automation pipeline.

## Dependencies

This skill delegates CLI execution to `read-notebooklm` and source gathering to the
workspace's reader skills:

| Skill | Path | Role |
|-------|------|------|
| `read-notebooklm` | `.claude/skills/read-notebooklm/SKILL.md` | NotebookLM CLI — create, add, generate, download |
| `read-slack` | `.claude/skills/read-slack/SKILL.md` | Fetch Slack threads/files by channel or search |
| `read-email` | `.claude/skills/read-email/SKILL.md` | Search/read Gmail threads |
| `read-google-drive` | `.claude/skills/read-google-drive/SKILL.md` | Search/download Google Drive docs |
| `read-granola` | `.claude/skills/read-granola/SKILL.md` | Fetch meeting notes and transcripts |

**Before running any workflow, read `read-notebooklm`'s SKILL.md for CLI syntax.**

## When This Skill Runs

| Trigger | Behavior |
|---------|----------|
| "Research [topic] across my org" | Full pipeline: gather sources → create notebook → ingest → analyze |
| "Create a research notebook for [project]" | Targeted notebook with project-specific sources |
| "Consolidate everything about [topic] into NotebookLM" | Scans Slack, email, Drive, meetings for relevant material |
| "Generate a podcast/report about [project]" | Source collection + artifact generation |
| "Deep dive into [topic]" | Applies Focus & Peel / ACG methodology via CLI chat |

---

## Step 1: Preflight Check

Before any workflow, verify the CLI is ready:

```bash
notebooklm status
```

If it reports "No notebook selected" — that's fine (we'll create one).
If it reports auth errors → run `notebooklm login`.

---

## Step 2: Three-Tiered Notebook Architecture

Organize notebooks intentionally. When the user asks to research a topic, determine
which tier the notebook belongs to:

### Tier 1 — Foundation Notebooks (long-lived)
For core reference material that rarely changes.
- **Naming:** `Foundation: [Domain]` (e.g., `Foundation: Yopeso Tech Stack`)
- **Content:** Company docs, architecture diagrams, onboarding materials
- **When to create:** Only if one doesn't already exist for this domain

### Tier 2 — Project Notebooks (active research, 1-6 months)
For specific investigations, client projects, or sprints.
- **Naming:** `Research: [Project/Topic]` (e.g., `Research: AI Connector Architecture`)
- **Content:** Active materials — 10-50 sources max
- **When to create:** Default for most research requests

### Tier 3 — Synthesis Notebooks (cross-domain)
For pulling insights across multiple Project notebooks.
- **Naming:** `Synthesis: [Theme]` (e.g., `Synthesis: Q1 2026 Strategy`)
- **Content:** Only synthesized reports/docs exported from Tier 2 notebooks. No raw sources.
- **When to create:** When user needs to connect dots across projects

**To create a notebook:**
```bash
notebooklm create "Research: AI Connector Architecture" --json
```
Parse the returned `id` and set context:
```bash
notebooklm use <notebook_id>
```

**To check existing notebooks:**
```bash
notebooklm list --json
```
Reuse an existing notebook if title matches. Do not create duplicates.

---

## Step 3: Source Gathering — The Org Sweep

This is where the skill's power lies. For a given research topic, systematically
pull relevant material from across the user's organization.

### 3a. Identify Source Channels

Cross-reference the topic with `CLAUDE.md` to identify:
- **Slack channels:** Look up the `## Slack Channels → Projects` table
- **People:** Who is involved? (for email/Slack `from:` filters)
- **Google Drive folders:** Known shared folders for the project
- **Meeting titles:** Keywords for Granola search

### 3b. Gather Sources (run in parallel where possible)

**Slack — threads and files:**
```bash
# Search for relevant threads
node .claude/skills/read-slack/slack-cli.js search "AI Connector architecture" 20

# Read specific channel history
node .claude/skills/read-slack/slack-cli.js read C0A8YSCACU8 30

# Download shared files
node .claude/skills/read-slack/slack-cli.js files C0A8YSCACU8 10
node .claude/skills/read-slack/slack-cli.js download <fileId> /tmp/slack-doc.pdf
```

**Email — thread contents:**
```bash
# Search for relevant email threads
gog gmail search 'subject:AI Connector newer_than:30d' --max 20 --json

# Read full thread for context
gog gmail thread get <threadId>

# Download attachments
gog gmail attachment <messageId> <attachmentId> --output /tmp/email-attachment.pdf
```

**Google Drive — documents and files:**
```bash
# Search for relevant docs
gog drive search "AI Connector architecture" --max 20

# Export Google Docs as text
gog docs cat <docId>
gog docs export <docId> --format md --out /tmp/drive-doc.md

# Download other file types
gog drive download <fileId> --out /tmp/drive-file.pdf
```

**Granola — meeting notes and transcripts:**
```bash
# Search meetings by title
python3 .claude/skills/read-granola/granola-cli.py search-title "AI Connector"

# Search within notes content
python3 .claude/skills/read-granola/granola-cli.py search-notes "architecture decision"

# Get full meeting details
python3 .claude/skills/read-granola/granola-cli.py get <doc_id>

# Get transcript
python3 .claude/skills/read-granola/granola-cli.py transcript <doc_id>
```

### 3c. Triage and Prioritize

Not everything found should be ingested. Before adding to NotebookLM, triage:

1. **Primary Sources** — Direct project docs, architecture decisions, key emails
2. **Supporting Evidence** — Meeting notes, Slack discussions that provide context
3. **Reference Material** — Background docs, external articles
4. **Skip** — Duplicates, low-signal chatter, stale/superseded docs

**Source limits by plan:** Standard: 50, Plus: 100, Pro: 300 per notebook.
Stay well under the limit to keep AI responses focused.

### 3d. Naming Convention for Sources

Before uploading, rename/title sources to be self-documenting:
- **Slack:** `Slack-[Channel]-[Date]-[Topic]` (e.g., `Slack-AIConnector-Mar2026-OAuthFlow`)
- **Email:** `Email-[From]-[Date]-[Subject]` (e.g., `Email-Andrei-Mar15-SnowflakeMCP`)
- **Drive:** Keep original title if descriptive; otherwise prefix with type
- **Meeting:** `Meeting-[Date]-[Title]` (e.g., `Meeting-Mar20-SprintDemo`)

---

## Step 4: Ingest Sources into NotebookLM

### URLs and web pages — add directly:
```bash
notebooklm source add "https://docs.example.com/architecture" --json
```

### Local files — add from disk:
```bash
notebooklm source add /tmp/slack-doc.pdf --json
notebooklm source add /tmp/drive-doc.md --json
notebooklm source add /tmp/email-attachment.pdf --json
```

### Text content without a file — write to temp file first:
For Slack threads, email bodies, or meeting transcripts that exist only as text:
```bash
# Write content to a temporary markdown file
cat > /tmp/source-slack-thread.md << 'SRCEOF'
# Slack Thread: AI Connector OAuth Discussion
Channel: #permira-aiconnector-internal | Date: Mar 15, 2026

[Paste or pipe the thread content here]
SRCEOF

notebooklm source add /tmp/source-slack-thread.md --json
```

### Web research — use NotebookLM's built-in deep research:
```bash
# Fast mode (5-10 sources, seconds)
notebooklm source add-research "Snowflake Cortex Search best practices" --mode fast

# Deep mode (20+ sources, 2-5 minutes) — spawn as background task
notebooklm source add-research "MCP OAuth proxy patterns" --mode deep --no-wait
```

### Wait for all sources to index before proceeding:
```bash
notebooklm source list --json
```
All sources must show `status: ready` before chat or generation.

---

## Step 5: Deep Research Workflows (via CLI Chat)

Once sources are indexed, use structured prompting methodologies through the CLI.

### The "Focus and Peel" Method
Iterative deepening — start narrow, expand outward.

```bash
# Step 1: Focus
notebooklm ask "What are the key architectural decisions documented in these sources?"

# Step 2: Peel
notebooklm ask "For each architectural decision, what assumptions were made about future requirements? What trade-offs were explicitly discussed?"

# Step 3: Synthesize
notebooklm ask "Which decisions appear most critical to the system's success? What are the risks if any of these assumptions prove wrong?"
```

### The ACG Workflow (Analyze, Challenge, Gap)
Critical analysis framework.

```bash
# Analyze
notebooklm ask "Extract the core arguments, proposals, and evidence from these sources about [topic]."

# Challenge
notebooklm ask "Identify weak assumptions, contradictions, or methodological gaps across these sources regarding [topic]. Where do people disagree?"

# Gap
notebooklm ask "Based on everything in these sources, what important questions about [topic] remain unanswered? What information is missing?"
```

### Selective Source Querying
Query specific source subsets for precision:
```bash
# List sources to get IDs
notebooklm source list --json

# Query only the Slack sources
notebooklm ask "Summarize the key decisions made in these Slack threads" -s <slack_src_id1> -s <slack_src_id2>

# Query only the meeting notes
notebooklm ask "What action items were assigned across these meetings?" -s <meeting_src_id>
```

### Save Key Findings as Notes
```bash
notebooklm ask "Produce a structured summary of all key findings, organized by theme" --save-as-note --note-title "Research Summary: [Topic]"
```

---

## Step 6: Artifact Generation

Transform research into deliverables. Always confirm with user before generating
(these are long-running and may be rate-limited).

**Output path:** All downloaded artifacts go to `memory/documents/<ProjectFolder>/` — see
CLAUDE.md `## Document Storage` for the project-to-folder mapping. Create the folder if needed.

### Briefing Report (recommended first artifact)
```bash
notebooklm generate report --format briefing-doc --append "Focus on decisions, risks, and open questions. Target audience: VP-level leadership."
```

### Audio Overview (podcast)
```bash
notebooklm generate audio "Focus on the key architectural decisions and their trade-offs. Make it accessible to a non-technical executive audience." --format deep-dive --json
```

### Mind Map
```bash
notebooklm generate mind-map
notebooklm download mind-map memory/documents/PERMIRA/mindmap.json
```

### Study Guide / Onboarding Doc
```bash
notebooklm generate report --format study-guide --append "Target audience: new team members joining this project"
```

### Slide Deck
```bash
notebooklm generate slide-deck --format detailed --json
```

**For long-running artifacts**, spawn a background agent to wait and download.
Use `memory/documents/<ProjectFolder>/` as the output path (see CLAUDE.md `## Document Storage`):
```
Task(
  prompt="Wait for artifact {artifact_id} in notebook {notebook_id} to complete.
          Use: notebooklm artifact wait {artifact_id} -n {notebook_id} --timeout 1200
          Then: notebooklm download audio memory/documents/PERMIRA/podcast.mp3 -a {artifact_id} -n {notebook_id}
          Report the result.",
  subagent_type="generalPurpose"
)
```

---

## Step 7: Cross-Notebook Synthesis (Tier 3)

When the user needs insights that span multiple project notebooks:

1. **Export key findings from each Tier 2 notebook:**
```bash
# Set context to Notebook A
notebooklm use <notebook_a_id>
notebooklm ask "Produce a comprehensive synthesis document covering all key findings, decisions, and open questions" --save-as-note --note-title "Synthesis Export: [Project A]"
notebooklm download report memory/documents/<ProjectFolder>/synthesis-a.md
```

2. **Create a Tier 3 Synthesis notebook:**
```bash
notebooklm create "Synthesis: Q1 2026 Cross-Project Review" --json
notebooklm use <synthesis_id>
```

3. **Upload the synthesis exports as sources:**
```bash
notebooklm source add memory/documents/<ProjectFolder>/synthesis-a.md --json
notebooklm source add memory/documents/<ProjectFolder>/synthesis-b.md --json
```

4. **Run cross-domain analysis:**
```bash
notebooklm ask "Across these project syntheses, what common themes or connections emerge? Where do projects share dependencies or risks?"
notebooklm ask "What strategic recommendations emerge from looking at all projects together?"
```

---

## Step 8: Living Documents (Continuous Updates)

For ongoing research, keep notebooks current:

### Periodic Re-ingestion
Schedule re-runs of the source gathering sweep (Step 3) to pick up new
Slack threads, emails, and Drive docs since the last sweep.

```bash
# Check what's already in the notebook
notebooklm source list --json

# Add only NEW sources (compare against existing titles to avoid duplicates)
# Delete stale sources if superseded
notebooklm source delete-by-title "Slack-AIConnector-Feb2026-OldDesign"
```

### Google Docs Live Link
For topics with a living synthesis document:
1. Create a Google Doc: "Research Synthesis: [Topic]"
2. Structure it: *Current Best Answers, Recent Findings, Emerging Questions, Contradictions*
3. Add as source: `notebooklm source add "https://docs.google.com/document/d/..."`
4. NotebookLM re-indexes automatically when the Doc is updated

---

## Actionable Prompts Library

Use these with `notebooklm ask "..."` after sources are loaded:

**Trend Analysis:**
> "These sources span [time period]. Identify the major trends in thinking,
> methodology, or findings about [topic]. For each trend, describe its
> evolution and whether it is accelerating."

**Persona-Based Strategic Analysis:**
> "Act as a strategic analyst focused on competitive advantages. Analyze
> these sources for strategic implications rather than surface summaries.
> Where sources discuss competitor features, explicitly evaluate their
> likelihood of success."

**Contradiction Resolution:**
> "Identify the most significant contradictions across these sources
> regarding [topic]. Explain what assumptions lead to different conclusions,
> and assess which position is better supported by the evidence."

**Decision Extraction:**
> "Extract every decision, commitment, or agreement documented in these
> sources. For each, note who made it, when, what the alternatives were,
> and whether it has been revisited since."

**Risk and Dependency Map:**
> "Identify all risks, blockers, and dependencies mentioned across these
> sources. Classify each as technical, organizational, or external.
> Rate severity as high/medium/low."

**Stakeholder Summary:**
> "Produce a 2-page executive summary suitable for [audience]. Focus on
> outcomes, decisions, and next steps. Avoid technical jargon."

---

## Example: Full Pipeline for a Project Research Notebook

User says: *"Create a research notebook for the AI Connector project"*

**Execution plan:**

1. **Preflight:** `notebooklm status` — verify auth
2. **Check existing:** `notebooklm list --json` — look for existing AI Connector notebook
3. **Create:** `notebooklm create "Research: AI Connector" --json` → get `notebook_id`
4. **Set context:** `notebooklm use <notebook_id>`
5. **Gather from Slack:**
   - Search `#permira-aiconnector-internal` (C0A8YSCACU8) and `#permira-aiconnector-general` (C0A8ZC8CV2S)
   - Download any shared PDFs/docs
6. **Gather from Email:**
   - `gog gmail search 'subject:AI Connector newer_than:60d' --max 30 --json`
   - Read key threads, download attachments
7. **Gather from Drive:**
   - `gog drive search "AI Connector" --max 20`
   - Export relevant Google Docs
8. **Gather from Meetings:**
   - `python3 .claude/skills/read-granola/granola-cli.py search-title "AI Connector"`
   - Export notes from key meetings
9. **Web Research:**
   - `notebooklm source add-research "Snowflake Cortex ChatGPT Enterprise integration" --mode fast`
10. **Triage:** Review gathered material, select top 20-40 most relevant sources
11. **Ingest:** `notebooklm source add` for each selected source
12. **Wait:** Confirm all sources show `status: ready`
13. **Initial Analysis:**
    - Run Focus & Peel to extract key architecture decisions
    - Run ACG to identify gaps and contradictions
    - Save findings as notebook notes
14. **Generate Artifact:** Offer to generate a briefing doc, podcast, or mind map
15. **Report to user:** Summary of what was created, source count, key initial findings
