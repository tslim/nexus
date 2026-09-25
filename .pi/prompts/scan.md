---
description: Schedule three daytime scans and an end-of-day work-update
---
Set up exactly two scheduled `Agent` jobs in this Pi parent session. Both jobs must use `activity-scanner`.

Do not run a scanner immediately. Do not create one job for each daytime run. Create one recurring daytime job that fires three times, plus one end-of-day job.

## Job 1: daytime scans

Make one `Agent` call with these values:

- `subagent_type`: `activity-scanner`
- `description`: `Scan daytime work activity`
- `schedule`: `0 0 9,12,15 * * 1-5`
- `thinking`: `medium`
- `max_turns`: `25`

Use this prompt exactly:

> Scan Slack, Gmail, Calendar, `TASKS.md`, and relevant memory for recent work-update signals. Return concise high-confidence findings only. Include `## Scanner metadata` with the run time, sources scanned, and `Run type: scheduled-routine`. Focus on blockers, commitments, missing tasks, waiting-on changes, completion signals, and durable memory candidates. Do not edit files, post messages, or mutate external systems.

This single recurring job must produce the 09:00, 12:00, and 15:00 weekday scans.

## Job 2: end-of-day scan

Make one `Agent` call with these values:

- `subagent_type`: `activity-scanner`
- `description`: `Scan end-of-day work activity`
- `schedule`: `0 0 18 * * 1-5`
- `thinking`: `medium`
- `max_turns`: `25`

Use this prompt exactly:

> Run the final activity scan of the workday. Scan Slack, Gmail, Calendar, `TASKS.md`, and relevant memory for recent work-update signals. Return concise high-confidence findings only. Include `## Scanner metadata` with the run time, sources scanned, and `Run type: scheduled-end-of-day`. Focus on blockers, commitments, missing tasks, waiting-on changes, completion signals, and durable memory candidates. Do not edit files, post messages, or mutate external systems. End the result with a `## Parent follow-up` section containing: `End-of-day scan complete. Start the work-update workflow now in the parent session. Retrieve and reuse the full results from all of today's scheduled scans. Preserve all work-update confirmation rules.`

## Required parent-session handling

Scheduled completion notifications contain only a short result preview. The parent must use the full results as follows.

For every daytime completion notification:

1. Extract the `<task-id>` from the notification.
2. Immediately call `get_subagent_result` with that task ID.
3. Keep the full tool result in this parent conversation for the end-of-day work update.
4. Reply briefly that the full scan result was captured. Do not start `work-update` yet.

For the end-of-day completion notification:

1. Extract the `<task-id>` and call `get_subagent_result` for the full end-of-day result.
2. Confirm that the full results for today's 09:00, 12:00, and 15:00 scans are already in this parent conversation. Retrieve any missing result by its notification task ID.
3. If a full result is unavailable, run one catch-up `activity-scanner` for the missing period and report the gap. Do not treat a truncated preview as a complete result.
4. Load `.claude/skills/work-update/SKILL.md` and run the `work-update` flow in this parent conversation.
5. Reuse and deduplicate all full scanner results from the current workday.
6. Keep `work-update` interactive. Preserve its confirmation rules before task or memory changes. Do not launch `work-update` as a detached agent.

Start `work-update` only after the end-of-day scan completes. Do not use a fixed-delay timer.

## Session and scheduling rules

- Scheduled jobs and results are scoped to the Pi session that created them.
- `/new` or another thread cannot receive these results.
- The user must keep this session active at the scheduled times, or resume this same session before the next run.
- Do not pass `inherit_context`, `resume`, or `run_in_background: false` to either scheduled `Agent` call.
- Make exactly two scheduled `Agent` calls. Do not create additional scheduled jobs.
- If a job with the same description already exists, do not create a renamed duplicate. Report the conflict and tell the user to manage it through `/agents → Scheduled jobs`.

After both `Agent` calls succeed, report:

- that exactly two jobs were scheduled
- the daytime cron and its three run times
- the end-of-day cron and its run time
- both job IDs and next-run times from the tool results
- that full scan results will be retrieved into this same parent conversation before `work-update` runs
