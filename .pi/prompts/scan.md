---
description: Schedule workday activity scans and an end-of-day work-update
---
Create two scheduled scan jobs in this Pi session. Both use `activity-scanner`: one recurring daytime job and one final end-of-day job. When the final scan completes, the parent session starts `work-update`.

Schedule the routine scans for 9am, 12pm, and 3pm Monday-Friday using:

`0 0 9,12,15 * * 1-5`

Use this exact routine-scan intent:

> Scan Slack, Gmail, Calendar, `TASKS.md`, and relevant memory for recent work-update signals. Return concise high-confidence findings only. Include Scanner metadata with the run time and sources scanned. Focus on blockers, commitments, missing tasks, waiting-on changes, completion signals, and durable memory candidates. Do not edit files, post messages, or mutate external systems.

Schedule the end-of-day scan for 6pm Monday-Friday using:

`0 0 18 * * 1-5`

Use this exact end-of-day intent:

> Run the final activity scan of the workday. Scan Slack, Gmail, Calendar, `TASKS.md`, and relevant memory for recent work-update signals. Return concise high-confidence findings only. Include Scanner metadata with the run time, sources scanned, and `Run type: scheduled-end-of-day`. Focus on blockers, commitments, missing tasks, waiting-on changes, completion signals, and durable memory candidates. Do not edit files, post messages, or mutate external systems. End the result with a `## Parent follow-up` section containing: `End-of-day scan complete. Start the work-update workflow now in the parent session, reusing all visible scanner results from today.`

When the end-of-day scan's completion notification arrives, follow its `## Parent follow-up` instruction in this parent session. Start the `work-update` workflow only after that specific scan has completed; do not use a fixed-delay timer. `work-update` remains interactive and must preserve its normal confirmation rules before changing tasks or memory.
