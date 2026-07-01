---
name: journal-sync
description: "Pull recent Notion Journal entries into memory/journals/month_YYYY-MM_text.txt."
tools: [Bash]
---

# On load, immediately run:
```bash
bash .claude/skills/journal-sync/sync.sh
```
Do not ask for confirmation — just execute it.

## Bootstrap (run once)

If `memory/journals/README.md` doesn't exist or lacks `## Sync Tracking`, create it with this structure so the sync script can track state:

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('memory/journals/README.md')
if not p.exists() or not _has_tracking(p.read_text()):
    config = '\n## Configuration\n\n- **Data Source ID**: `cc42b6a6-bb69-481f-bab9-26b22e4b56bc`'
    s = '# Journal Archive\n\nMonthly journal extracts exported from Notion for long-range personal and work context.' + config + '\n\n## Sync Tracking\n\n> Update this section after each journal-sync. Latest journal date is the persistent high-water mark; lookback catches recently missed entries.\n\n- **Last sync**: never (first run)\n- **Entries fetched**: 0\n- **Entries added**: 0\n- **Lookback days**: 7\n- **Latest journal date**: null (created_time high-water mark)\n\n## Notes\n\n- Raw monthly files are source material and are intentionally not individually listed in `memory/index.md`.\n- Use yearly summaries first for overview, then inspect monthly extracts when exact chronology or wording matters.'
    p.write_text(s)
else:
    s = p.read_text()
    insert = '\n## Sync Tracking\n\n> Update this section after each journal-sync. Latest journal date is the persistent high-water mark; lookback catches recently missed entries.\n\n- **Last sync**: never (first run)\n- **Entries fetched**: 0\n- **Entries added**: 0\n- **Lookback days**: 7\n- **Latest journal date**: null (created_time high-water mark)\n'
    # Add Configuration section if missing.
    if 'Data Source ID' not in s:
        config = '\n## Configuration\n\n- **Data Source ID**: `cc42b6a6-bb69-481f-bab9-26b22e4b56bc`'
        s = s.replace('\n## Sync Tracking', config + '\n## Sync Tracking', 1) if '\n## Sync Tracking' in s else s + config
    p.write_text(s.replace('\n## Notes', insert + '\n## Notes', 1) if '\n## Notes' in s else s + insert)

def _has_tracking(text):
    return '## Sync Tracking' in text
PY
```

This only runs once. The sync script will then update the tracking state after each run.

## Rules

- Incremental state is `Latest journal date` in `memory/journals/README.md`.
- Query a small lookback window before that date, default **7 days**, so missed recent entries are recovered.
- Deduplicate by normalized first non-empty markdown line before writing, so minor punctuation/whitespace differences do not duplicate entries.
- Do not store or use Notion pagination cursors for routine sync.
- If more than 100 entries match, stop and do a manual backfill.

## Notes

- Default lookback means normal daily runs re-fetch a few recent entries, but dedup skips them.
- For a larger catch-up, run with `JOURNAL_SYNC_LOOKBACK_DAYS=30` or temporarily lower `Latest journal date`, then sync again.
- After changes to `memory/`, append `memory/log.md` and run the `memory-backup` skill.
