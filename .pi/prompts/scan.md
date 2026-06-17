---
description: Schedule hourly activity-scanner for work-update signals
---
Schedule `activity-scanner` every hour for this Pi session.

Use this exact scheduled subagent intent:

Scan Slack, Gmail, Calendar, `TASKS.md`, and relevant memory for work-update signals from the last hour. Return concise high-confidence findings only. Include Scanner metadata. Focus on blockers, commitments, missing tasks, waiting-on changes, completion signals, and durable memory candidates. Do not edit files, post messages, or mutate external systems.
