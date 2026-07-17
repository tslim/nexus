---
name: time-log
description: Build today's mapped ZEP time-log plan from Google Calendar, preview it against ZEP, and enter it through guarded Playwright automation only after explicit approval.
compatibility: Requires the authenticated `gog` CLI, Playwright, and the memory-management workflow.
---

# Time-Log Mapping and ZEP Entry

Build the current workday's mapped table and, when explicitly requested, reconcile and enter the approved plan into ZEP. The target is always **today in `Asia/Kuching`**; do not ask for a date.

## Safety boundaries

- Use `gog` only for Calendar.
- Use the local Playwright CLI in this skill only for ZEP.
- Load and follow the `memory-management` skill before mapping.
- Read `memory/context/zep-time-mappings.md` as the canonical mapping source.
- Do not update mapping memory during this workflow.
- Calendar mapping, ZEP inspection, and ZEP preview are read-only.
- Never run the ZEP `apply` command unless the user explicitly approves the complete plan and its SHA-256 hash.
- Never edit or delete an existing ZEP entry automatically.
- Stop on ambiguous account, calendar scope, date, timezone, mapping, selector, duplicate, overlap, or verification state.

## Read Calendar

1. Resolve today's date in `Asia/Kuching`.
2. Confirm calendar scope:
   ```bash
   gog calendar calendars --json
   ```
3. Retrieve today's events from all selected calendars:
   ```bash
   gog calendar events --today --all --all-pages --json
   ```
4. Save raw JSON, if needed, outside the repository because it may contain private event data.
5. Capture each event's title, exact local start/end, status, cancellation state, calendar, and all-day/working-location type.

Stop if the account, calendar scope, date, or timezone is ambiguous.

## Filter events

Ignore declined or cancelled events. Always skip and list the reason for:

- Community meetings.
- Community projects.
- All-day events.
- Working-location events.
- Zero-duration or cross-midnight events unless the user supplies exact times.

Do not skip Daily sync events or events in the AI Agents workstream; process them as normal Calendar events and apply the usual mapping and uncertainty rules.

Do not modify Calendar.

## Map events

Resolve mappings in this order:

1. Exact title or documented alias in `memory/context/zep-time-mappings.md`.
2. Otherwise mark the mapping **uncertain** and show a candidate only when the title makes the candidate clear.
3. Require the user's correction or explicit approval for uncertain mappings.

Use exact Calendar times. Use the Calendar title as the remark unless canonical mapping memory establishes another spelling. Use canonical project, task, activity, and color conventions.

## Build the table

Use integer minutes. Build a chronological table containing included Calendar events and unallocated gaps. For a continuous 8-hour calendar-derived window:

- If included events exist, end the window at the latest included event end.
- If no included events exist, use `09:30–17:30`.
- Fill uncovered intervals with the canonical unallocated-time mapping.
- Do not inspect or assume existing ZEP entries while building the Calendar-derived plan.

Show:

| State | Time | Duration | Project | Task | Activity | Remark | Color |
|---|---|---:|---|---|---|---|---|
| Proposed | HH:MM–HH:MM | H:MM | ... | ... | ... | ... | ... |

Also report:

- Calendar source: `gog`.
- Calendar-derived total.
- Skipped events and reasons.
- Uncertain mappings.
- Whether the calendar-derived total is exactly `8:00`.

## Private plan artifact

Before ZEP preview or entry, write the complete approved plan JSON outside the repository, normally under `/tmp`, and calculate its SHA-256 hash. Use `zep-plan.example.json` as the format reference.

The CLI rejects:

- Dates other than today in `Asia/Kuching`.
- Missing or placeholder mapping values such as `Confirm`, `Uncertain`, or `TBD`.
- Missing `color` in `#RRGGBB` format or missing boolean `billable`.
- Invalid, zero-duration, cross-midnight, or overlapping plan rows.
- An `expectedMinutes` value that differs from the entry total.

Validate the artifact and print its hash without opening ZEP:

```bash
npm run zep -- validate --plan /tmp/zep-plan-YYYY-MM-DD.json
```

The artifact is private review data. Its existence alone authorizes no ZEP changes.

## One-time ZEP setup

The reusable automation files are colocated with this skill:

- `zep-cli.js` — authentication, inspection, preview, reconciliation, apply, and verification.
- `zep-page.js` — ZEP DOM locators and page actions.
- `zep-plan.example.json` — sanitized plan schema example.

Authenticate once with a dedicated browser profile outside the repository:

```bash
npm run zep -- auth
```

This opens a headed browser using `~/.local/state/nexus/zep-playwright-profile/`. ZEP authentication for this tenant always requires **Sign in with Google** when its login screen appears. The CLI clicks that control automatically when it can identify it. After Google redirects back, ZEP shows a confirmation page stating that the user is already logged in, with a **Go ahead to Time Recording** button; the CLI clicks that action automatically. Complete any remaining Google account chooser or consent step manually, wait until the main ZEP time-recording page has loaded, then press Enter. Do not attempt username/password login.

After successful login, the CLI explicitly exports Playwright storage state to `~/.local/state/nexus/zep-storage-state.json` with mode `0600`. This is required because ZEP uses session cookies that a restarted persistent Chromium profile may not restore. Preview and apply load the exported state, refresh it after successful authentication, and click the ZEP Google sign-in control if it is presented again. If Google requires interaction again, rerun `auth`.

Never store credentials, cookies, or browser state in the repository.

Before the first apply, run one read-only DOM inspection:

```bash
npm run zep -- inspect --headed
```

Inspection prints control metadata and table headers. It does not capture screenshots, video, or traces. `zep-page.js` is calibrated for ZEP's FullCalendar work-week grid and the `Record Project Time` form IDs (`datum-datepicker-input`, `von`, `bis`, `projektId`, `vorgangId`, `taetigkeit`, `fakturierbar`, `bemerkung`, `Save`, and `Cancel`). If ZEP changes this structure, recalibrate before continuing. Do not guess selectors during an apply run.

## ZEP preview

Preview is mandatory and read-only:

```bash
npm run zep -- preview --plan /tmp/zep-plan-YYYY-MM-DD.json
```

Preview must:

1. Open today's ZEP page using the dedicated authenticated profile.
2. Read recognizable existing entries from the DOM.
3. Skip exact duplicates.
4. Report missing rows and overlapping conflicts.
5. Print the exact plan SHA-256 hash.
6. Make no ZEP changes.

Stop if the entries table cannot be identified exactly, existing rows cannot be reconciled safely, or conflicts exist.

## Approval gate

After preview, show the user:

- The complete rows that would be added.
- Exact duplicates that would be skipped.
- Any conflicts.
- Total minutes.
- The plan SHA-256 hash.

Require explicit approval of that exact plan and hash. A prior approval of the Calendar mapping table does not authorize ZEP entry. If the plan file changes, its hash changes and approval must be requested again.

## Apply and verify

Only after explicit approval, run:

```bash
npm run zep -- apply \
  --plan /tmp/zep-plan-YYYY-MM-DD.json \
  --confirm-hash SHA256
```

Apply must:

1. Revalidate the plan and hash.
2. Re-read ZEP immediately before writing.
3. Refuse overlaps or conflicts.
4. Add only missing entries, sequentially.
5. Re-read the table after every save and verify the exact row.
6. Stop immediately on a mismatch and report possible partial writes.
7. Perform a final exact-row and total verification.

Do not attempt automatic rollback, editing, or deletion. Do not capture screenshots repeatedly; normal operation is DOM-based and headless. Use `--headed` only for authentication, selector calibration, or explicitly requested debugging.
