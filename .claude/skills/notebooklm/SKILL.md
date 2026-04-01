---
name: notebooklm
description: Complete API for Google NotebookLM - full programmatic access including features not in the web UI. Create notebooks, add sources, generate all artifact types, download in multiple formats. Activates on explicit /notebooklm or intent like "create a podcast about X"
---

# NotebookLM

Complete programmatic access to Google NotebookLM—including capabilities not exposed in the web UI. Create notebooks, add sources (URLs, YouTube, PDFs, audio, video, images), chat with content, generate all artifact types, and download results in multiple formats.

## Installation

Install NotebookLM into a local virtual environment in the current directory.

**From PyPI (Recommended):**
```bash
uv venv
uv pip install --python .venv/bin/python "notebooklm-py[browser]"
uv run playwright install chromium
source .venv/bin/activate
```

**From GitHub (use latest release tag, NOT main branch):**
```bash
uv venv
LATEST_TAG=$(curl -s https://api.github.com/repos/teng-lin/notebooklm-py/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
uv pip install --python .venv/bin/python "git+https://github.com/teng-lin/notebooklm-py@${LATEST_TAG}[browser]"
uv run playwright install chromium
source .venv/bin/activate
```

## Prerequisites

**IMPORTANT:** Before using any command, you MUST authenticate:

```bash
source .venv/bin/activate
notebooklm login          # Opens browser for Google OAuth
notebooklm list           # Verify authentication works
```

If commands fail with authentication errors, re-run `notebooklm login`.

### CI/CD, Multiple Accounts, and Parallel Agents

| Variable | Purpose |
|----------|---------|
| `NOTEBOOKLM_HOME` | Custom config directory (default: `~/.notebooklm`) |
| `NOTEBOOKLM_PROFILE` | Active profile name (default: `default`) |
| `NOTEBOOKLM_AUTH_JSON` | Inline auth JSON - no file writes needed |

**Parallel agents:** The CLI stores notebook context in a shared file (`~/.notebooklm/context.json`). Multiple concurrent agents using `notebooklm use` can overwrite each other's context.

**Solutions for parallel workflows:**
1. **Always use explicit notebook ID** (recommended): Pass `-n <notebook_id>` (for `wait`/`download` commands) or `--notebook <notebook_id>` (for others) instead of relying on `use`
2. **Per-agent isolation via profiles:** `export NOTEBOOKLM_PROFILE=agent-$ID`
3. **Per-agent isolation via home:** `export NOTEBOOKLM_HOME=/tmp/agent-$ID`
4. **Use full UUIDs:** Avoid partial IDs in automation

## Agent Setup Verification

Before starting workflows, verify the CLI is ready:

1. `notebooklm status` → Should show "Authenticated as: email@..."
2. `notebooklm list --json` → Should return valid JSON (even if empty notebooks list)
3. If either fails → Run `notebooklm login`

## When This Skill Activates

**Explicit:** User says "/notebooklm", "use notebooklm", or mentions the tool by name

**Intent detection:** Recognize requests like:
- "Create a podcast about [topic]"
- "Summarize these URLs/documents"
- "Generate a quiz from my research"
- "Turn this into an audio overview"
- "Create flashcards for studying"
- "Generate a video explainer"
- "Make an infographic"
- "Create a mind map of the concepts"
- "Download the quiz as markdown"
- "Add these sources to NotebookLM"

## Autonomy Rules

**Run automatically (no confirmation):**
- `notebooklm status` - check context
- `notebooklm auth check` - diagnose auth issues
- `notebooklm list` - list notebooks
- `notebooklm source list` - list sources
- `notebooklm artifact list` - list artifacts
- `notebooklm language list` - list supported languages
- `notebooklm language get` - get current language
- `notebooklm language set` - set language (global setting)
- `notebooklm artifact wait` - wait for artifact completion (in subagent context)
- `notebooklm source wait` - wait for source processing (in subagent context)
- `notebooklm research status` - check research status
- `notebooklm research wait` - wait for research (in subagent context)
- `notebooklm use <id>` - set context (single-agent only)
- `notebooklm create` - create notebook
- `notebooklm ask "..."` - chat queries (without `--save-as-note`)
- `notebooklm history` - display conversation history (read-only)
- `notebooklm source add` - add sources
- `notebooklm profile list` - list profiles
- `notebooklm profile create` - create profile
- `notebooklm profile switch` - switch active profile
- `notebooklm doctor` - check environment health

**Ask before running:**
- `notebooklm delete` - destructive
- `notebooklm generate *` - long-running, may fail
- `notebooklm download *` - writes to filesystem
- `notebooklm artifact wait` - long-running (when in main conversation)
- `notebooklm source wait` - long-running (when in main conversation)
- `notebooklm research wait` - long-running (when in main conversation)
- `notebooklm ask "..." --save-as-note` - writes a note
- `notebooklm history --save` - writes a note

## Quick Reference

| Task | Command |
|------|---------|
| Authenticate | `.venv/bin/notebooklm login` |
| Diagnose auth issues | `.venv/bin/notebooklm auth check` |
| Diagnose auth (full) | `.venv/bin/notebooklm auth check --test` |
| List notebooks | `.venv/bin/notebooklm list` |
| Create notebook | `.venv/bin/notebooklm create "Title"` |
| Set context | `.venv/bin/notebooklm use <notebook_id>` |
| Show context | `.venv/bin/notebooklm status` |
| Add URL source | `.venv/bin/notebooklm source add "https://..."` |
| Add file | `.venv/bin/notebooklm source add ./file.pdf` |
| Add YouTube | `.venv/bin/notebooklm source add "https://youtube.com/..."` |
| List sources | `.venv/bin/notebooklm source list` |
| Delete source by ID | `.venv/bin/notebooklm source delete <source_id>` |
| Delete source by exact title | `.venv/bin/notebooklm source delete-by-title "Exact Title"` |
| Wait for source processing | `.venv/bin/notebooklm source wait <source_id>` |
| Web research (fast) | `.venv/bin/notebooklm source add-research "query"` |
| Web research (deep) | `.venv/bin/notebooklm source add-research "query" --mode deep --no-wait` |
| Check research status | `.venv/bin/notebooklm research status` |
| Wait for research | `.venv/bin/notebooklm research wait --import-all` |
| Chat | `.venv/bin/notebooklm ask "question"` |
| Chat (specific sources) | `.venv/bin/notebooklm ask "question" -s src_id1 -s src_id2` |
| Chat (with references) | `.venv/bin/notebooklm ask "question" --json` |
| Chat (save answer as note) | `.venv/bin/notebooklm ask "question" --save-as-note` |
| Chat (save with title) | `.venv/bin/notebooklm ask "question" --save-as-note --note-title "Title"` |
| Show conversation history | `.venv/bin/notebooklm history` |
| Save all history as note | `.venv/bin/notebooklm history --save` |
| Continue specific conversation | `.venv/bin/notebooklm ask "question" -c <conversation_id>` |
| Save history with title | `.venv/bin/notebooklm history --save --note-title "My Research"` |
| Get source fulltext | `.venv/bin/notebooklm source fulltext <source_id>` |
| Get source guide | `.venv/bin/notebooklm source guide <source_id>` |
| Generate podcast | `.venv/bin/notebooklm generate audio "instructions"` |
| Generate podcast (JSON) | `.venv/bin/notebooklm generate audio --json` |
| Generate podcast (specific sources) | `.venv/bin/notebooklm generate audio -s src_id1 -s src_id2` |
| Generate video | `.venv/bin/notebooklm generate video "instructions"` |
| Generate report | `.venv/bin/notebooklm generate report --format briefing-doc` |
| Generate report (append) | `.venv/bin/notebooklm generate report --format study-guide --append "Target audience: beginners"` |
| Generate quiz | `.venv/bin/notebooklm generate quiz` |
| Revise a slide | `.venv/bin/notebooklm generate revise-slide "prompt" --artifact <id> --slide 0` |
| Check artifact status | `.venv/bin/notebooklm artifact list` |
| Wait for completion | `.venv/bin/notebooklm artifact wait <artifact_id>` |
| Download audio | `.venv/bin/notebooklm download audio ./output.mp3` |
| Download video | `.venv/bin/notebooklm download video ./output.mp4` |
| Download slide deck (PDF) | `.venv/bin/notebooklm download slide-deck ./slides.pdf` |
| Download slide deck (PPTX) | `.venv/bin/notebooklm download slide-deck ./slides.pptx --format pptx` |
| Download report | `.venv/bin/notebooklm download report ./report.md` |
| Download mind map | `.venv/bin/notebooklm download mind-map ./map.json` |
| Download data table | `.venv/bin/notebooklm download data-table ./data.csv` |
| Download quiz | `.venv/bin/notebooklm download quiz quiz.json` |
| Download quiz (markdown) | `.venv/bin/notebooklm download quiz --format markdown quiz.md` |
| Download flashcards | `.venv/bin/notebooklm download flashcards cards.json` |
| Download flashcards (markdown) | `.venv/bin/notebooklm download flashcards --format markdown cards.md` |
| Delete notebook | `.venv/bin/notebooklm notebook delete <id>` |
| List languages | `.venv/bin/notebooklm language list` |
| Get language | `.venv/bin/notebooklm language get` |
| Set language | `.venv/bin/notebooklm language set zh_Hans` |
| List profiles | `.venv/bin/notebooklm profile list` |
| Create profile | `.venv/bin/notebooklm profile create work` |
| Switch profile | `.venv/bin/notebooklm profile switch work` |
| Delete profile | `.venv/bin/notebooklm profile delete old` |
| Rename profile | `.venv/bin/notebooklm profile rename old new` |
| Use profile (one-off) | `.venv/bin/notebooklm -p work list` |
| Health check | `.venv/bin/notebooklm doctor` |
| Health check (auto-fix) | `.venv/bin/notebooklm doctor --fix` |

**Partial IDs:** Use first 6+ characters of UUIDs. Must be unique prefix. For automation, prefer full UUIDs.

## Command Output Formats

Commands with `--json` return structured data for parsing:

```
$ .venv/bin/notebooklm create "Research" --json
{"id": "abc123de-...", "title": "Research"}

$ .venv/bin/notebooklm source add "https://example.com" --json
{"source_id": "def456...", "title": "Example", "status": "processing"}

$ .venv/bin/notebooklm generate audio "Focus on key points" --json
{"task_id": "xyz789...", "status": "pending"}

$ .venv/bin/notebooklm ask "What is X?" --json
{"answer": "X is... [1] [2]", "conversation_id": "...", "turn_number": 1, "is_follow_up": false, "references": [...]}
```

## Generation Types

All generate commands support `-s, --source`, `--language`, `--json`, `--retry N`.

| Type | Command | Options | Download |
|------|---------|---------|----------|
| Podcast | `generate audio` | `--format [deep-dive\|brief\|critique\|debate]`, `--length [short\|default\|long]` | .mp3 |
| Video | `generate video` | `--format [explainer\|brief]`, `--style [auto\|classic\|whiteboard\|kawaii\|anime\|watercolor\|retro-print\|heritage\|paper-craft]` | .mp4 |
| Slide Deck | `generate slide-deck` | `--format [detailed\|presenter]`, `--length [default\|short]` | .pdf / .pptx |
| Slide Revision | `generate revise-slide "prompt" --artifact <id> --slide N` | `--wait`, `--notebook` | *(re-downloads parent deck)* |
| Infographic | `generate infographic` | `--orientation [landscape\|portrait\|square]`, `--detail [concise\|standard\|detailed]`, `--style [auto\|sketch-note\|professional\|bento-grid\|editorial\|instructional\|bricks\|clay\|anime\|kawaii\|scientific]` | .png |
| Report | `generate report` | `--format [briefing-doc\|study-guide\|blog-post\|custom]`, `--append "extra instructions"` | .md |
| Mind Map | `generate mind-map` | *(sync, instant)* | .json |
| Data Table | `generate data-table` | description required | .csv |
| Quiz | `generate quiz` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |
| Flashcards | `generate flashcards` | `--difficulty [easy\|medium\|hard]`, `--quantity [fewer\|standard\|more]` | .json/.md/.html |

## Features Beyond the Web UI

| Feature | Command | Description |
|---------|---------|-------------|
| Batch downloads | `.venv/bin/notebooklm download <type> --all` | Download all artifacts of a type at once |
| Quiz/Flashcard export | `.venv/bin/notebooklm download quiz --format json` | Export as JSON, Markdown, or HTML |
| Mind map extraction | `.venv/bin/notebooklm download mind-map` | Export hierarchical JSON |
| Data table export | `.venv/bin/notebooklm download data-table` | Download structured tables as CSV |
| Slide deck as PPTX | `.venv/bin/notebooklm download slide-deck --format pptx` | Editable .pptx (web UI only offers PDF) |
| Slide revision | `.venv/bin/notebooklm generate revise-slide "prompt" --artifact <id> --slide N` | Modify individual slides |
| Report template append | `.venv/bin/notebooklm generate report --format study-guide --append "..."` | Custom instructions on built-in templates |
| Source fulltext | `.venv/bin/notebooklm source fulltext <id>` | Retrieve indexed text content |
| Save chat to note | `.venv/bin/notebooklm ask "..." --save-as-note` / `.venv/bin/notebooklm history --save` | Save answers as notebook notes |

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| Auth/cookie error | Session expired | `.venv/bin/notebooklm auth check` then `.venv/bin/notebooklm login` |
| "No notebook context" | Context not set | Use `-n <id>` or `.venv/bin/notebooklm use <id>` |
| "No result found for RPC ID" | Rate limiting | Wait 5-10 min, retry |
| `GENERATION_FAILED` | Google rate limit | Wait and retry later |
| Download fails | Generation incomplete | Check `.venv/bin/notebooklm artifact list` for status |
| Invalid notebook/source ID | Wrong ID | `.venv/bin/notebooklm list` to verify |

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | Error | Check stderr |
| 2 | Timeout (wait commands) | Extend timeout or check manually |

## Processing Times

| Operation | Typical time | Suggested timeout |
|-----------|--------------|-------------------|
| Source processing | 30s - 10 min | 600s |
| Research (fast) | 30s - 2 min | 180s |
| Research (deep) | 15 - 30+ min | 1800s |
| Notes / Mind-map | instant | n/a |
| Quiz, flashcards | 5 - 15 min | 900s |
| Report, data-table | 5 - 15 min | 900s |
| Audio generation | 10 - 20 min | 1200s |
| Video generation | 15 - 45 min | 2700s |

## Troubleshooting

```bash
.venv/bin/notebooklm --help
.venv/bin/notebooklm auth check
.venv/bin/notebooklm auth check --test
.venv/bin/notebooklm doctor
.venv/bin/notebooklm doctor --fix
```
