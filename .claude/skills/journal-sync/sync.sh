#!/usr/bin/env bash
set -euo pipefail

DATA_SOURCE_ID="cc42b6a6-bb69-481f-bab9-26b22e4b56bc"
README="memory/journals/README.md"
LOOKBACK_DAYS="${JOURNAL_SYNC_LOOKBACK_DAYS:-7}"
mkdir -p memory/journals

# Read latest tracking state.
LATEST_DATE=$(perl -ne 'print $1 if /^- \*\*Latest journal date\*\*: ([^ ]+)/' "$README")
SINCE_DATE=""
if [ -n "$LATEST_DATE" ] && [ "$LATEST_DATE" != "null" ]; then
  SINCE_DATE=$(python3 - "$LATEST_DATE" "$LOOKBACK_DAYS" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
raw, days = sys.argv[1], int(sys.argv[2])
dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
dt = (dt - timedelta(days=days)).astimezone(timezone.utc)
print(dt.isoformat(timespec='milliseconds').replace('+00:00', 'Z'))
PY
)
fi

: > /tmp/sync_warnings.log
: > /tmp/journal_sync_written.log
: > /tmp/journal_sync_skipped.log

# Query latest entries, with small lookback for missed recent entries.
if [ -n "$SINCE_DATE" ]; then
  jq -n --arg since "$SINCE_DATE" '{
    filter: { timestamp: "created_time", created_time: { after: $since } },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
    page_size: 100
  }' | npm run --silent ntn -- api v1/data_sources/$DATA_SOURCE_ID/query > /tmp/notion_response.json
else
  jq -n '{
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
    page_size: 100
  }' | npm run --silent ntn -- api v1/data_sources/$DATA_SOURCE_ID/query > /tmp/notion_response.json
fi

if [ "$(jq -r '.has_more' /tmp/notion_response.json)" = "true" ]; then
  echo "WARNING: More than 100 journal entries matched; run a manual backfill before updating tracking." | tee -a /tmp/sync_warnings.log
  exit 1
fi

jq '[.results[] | {
  id,
  date: .created_time,
  name: ((.properties.Name.title // []) | map(.plain_text) | join(""))
}] | sort_by(.date)' /tmp/notion_response.json > /tmp/sorted_entries.json

# Fetch markdown and append only non-duplicates (iterate IDs directly).
sorted_file=/tmp/sorted_entries.json
jq -r '.[].id' /tmp/sorted_entries.json | while IFS= read -r id; do
  name=$(jq -r ".[] | select(.id == \"$id\") | .name" "$sorted_file")
  date=$(jq -r ".[] | select(.id == \"$id\") | .date" "$sorted_file")

  if [[ ! "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
    echo "WARNING: Malformed date '$date', skipping '$name' ($id)" >> /tmp/sync_warnings.log
    continue
  fi

  month_file="memory/journals/month_${date:0:7}_text.txt"
  if ! raw=$(npm run --silent ntn -- api "v1/pages/${id}/markdown" </dev/null 2>>/tmp/sync_warnings.log); then
    echo "WARNING: Failed markdown fetch for '$name' ($id)" >> /tmp/sync_warnings.log
    continue
  fi

  markdown=$(printf '%s' "$raw" | jq -r '.markdown // empty')
  first_line=$(printf '%s\n' "$markdown" | awk 'NF {print; exit}')

  if [ -z "$markdown" ] || [ -z "$first_line" ]; then
    echo "WARNING: Empty markdown for '$name' ($id), skipping" >> /tmp/sync_warnings.log
  else
    # Quick dedup: check if first line of content already exists in file
    if grep -qFx "$first_line" "$month_file" 2>/dev/null; then
      echo "SKIP: '$name' already exists in $month_file" | tee -a /tmp/journal_sync_skipped.log
    else
      { printf '\n---\n%s\n' "$name"; printf '%s\n' "$markdown"; } >> "$month_file"
      echo "WRITTEN: '$name' to $month_file" | tee -a /tmp/journal_sync_written.log
    fi
  fi

  sleep 0.1
done

ENTRY_COUNT=$(jq 'length' /tmp/sorted_entries.json)
ADDED_COUNT=$(grep -c '^WRITTEN:' /tmp/journal_sync_written.log 2>/dev/null || true)
SYNC_DATE=$(date '+%Y-%m-%d %H:%M:%S %z')
FETCHED_LATEST=$(jq -r 'map(.date) | max // empty' /tmp/sorted_entries.json)
NEW_LATEST="${LATEST_DATE:-null}"
if [ "$ENTRY_COUNT" -gt 0 ] && [ -n "$FETCHED_LATEST" ] && [ ! -s /tmp/sync_warnings.log ]; then
  NEW_LATEST="$FETCHED_LATEST"
fi

# Update README tracking state.
python3 - <<PY
from pathlib import Path
p = Path('$README')
s = p.read_text()
start = s.index('## Sync Tracking')
try:
    end = s.index('\n## ', start + 1) + 1
except ValueError:
    end = len(s)
section = f'''## Sync Tracking\n\n> Update this section after each journal-sync. Latest journal date is the persistent high-water mark; lookback catches recently missed entries.\n\n- **Last sync**: {"$SYNC_DATE"}\n- **Entries fetched**: {"$ENTRY_COUNT"}\n- **Entries added**: {"$ADDED_COUNT"}\n- **Lookback days**: {"$LOOKBACK_DAYS"}\n- **Latest journal date**: {"$NEW_LATEST"} (created_time high-water mark)\n\n'''
p.write_text(s[:start] + section + s[end:])
PY

if [ -s /tmp/sync_warnings.log ]; then
  echo "Warnings during sync:"
  cat /tmp/sync_warnings.log
else
  echo "No warnings — fetched $ENTRY_COUNT, added $ADDED_COUNT."
fi
