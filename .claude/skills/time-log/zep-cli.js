#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline/promises");
const { chromium } = require("playwright");
const { ZepPage } = require("./zep-page");

const DEFAULT_URL = "https://www.zep-online.de/zepyopesogmbh";
const TIMEZONE = "Asia/Kuching";
const PLACEHOLDER_RE = /^(confirm|uncertain|unknown|tbd|todo|\.\.\.)$/i;

function usage(exitCode = 0) {
  console.log(`Usage:
  npm run zep -- auth [--headed]
  npm run zep -- inspect [--headed]
  npm run zep -- validate --plan /tmp/zep-plan-YYYY-MM-DD.json
  npm run zep -- preview --plan /tmp/zep-plan-YYYY-MM-DD.json [--headed]
  npm run zep -- apply --plan /tmp/zep-plan-YYYY-MM-DD.json --confirm-hash SHA256 [--headed]

Environment:
  ZEP_URL            ZEP tenant URL (default: ${DEFAULT_URL})
  ZEP_PROFILE_DIR    Dedicated browser profile outside the repository
  ZEP_STORAGE_STATE  Saved session-cookie state outside the repository
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
    } else if (rest[index + 1] && !rest[index + 1].startsWith("--")) {
      flags[rawKey] = rest[index + 1];
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }
  return { command, flags };
}

function todayInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function timeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
  if (!match) throw new Error(`Invalid HH:MM time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function duration(entry) {
  return timeToMinutes(entry.end) - timeToMinutes(entry.start);
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTask(value) {
  const task = normalize(value);
  const repeated = /^(.*?)\s+\((.*?)\)$/.exec(task);
  return repeated && normalize(repeated[1]) === normalize(repeated[2]) ? normalize(repeated[1]) : task;
}

function normalizedEntry(entry) {
  return {
    start: normalize(entry.start),
    end: normalize(entry.end),
    project: normalize(entry.project),
    task: normalizeTask(entry.task),
    activity: normalize(entry.activity),
    remark: normalize(entry.remark),
    color: normalize(entry.color).toUpperCase(),
  };
}

function exactMatch(left, right) {
  const a = normalizedEntry(left);
  const b = normalizedEntry(right);
  return Object.keys(a).every((key) => a[key] === b[key]);
}

function overlaps(left, right) {
  return timeToMinutes(left.start) < timeToMinutes(right.end)
    && timeToMinutes(right.start) < timeToMinutes(left.end);
}

function loadPlan(planPath) {
  if (!planPath) throw new Error("--plan is required");
  const resolved = path.resolve(planPath);
  const raw = fs.readFileSync(resolved);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const plan = JSON.parse(raw.toString("utf8"));
  validatePlan(plan);
  return { plan, hash, resolved };
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new Error("Plan must be a JSON object");
  if (plan.version !== 1) throw new Error("Plan version must be 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date || "")) throw new Error("Plan date must use YYYY-MM-DD");
  if (plan.timezone !== TIMEZONE) throw new Error(`Plan timezone must be ${TIMEZONE}`);
  const today = todayInTimezone(TIMEZONE);
  if (plan.date !== today) throw new Error(`Time-log plans must target today (${today} in ${TIMEZONE}), not ${plan.date}`);
  if (!Array.isArray(plan.entries) || plan.entries.length === 0) throw new Error("Plan must contain at least one entry");

  const required = ["start", "end", "project", "task", "activity", "remark", "color"];
  for (const [index, rawEntry] of plan.entries.entries()) {
    const entry = normalizedEntry(rawEntry);
    for (const field of required) {
      if (!entry[field]) throw new Error(`Entry ${index + 1} is missing ${field}`);
      if (PLACEHOLDER_RE.test(entry[field])) throw new Error(`Entry ${index + 1} has unresolved ${field}: ${entry[field]}`);
    }
    if (!/^#[0-9A-F]{6}$/.test(entry.color)) throw new Error(`Entry ${index + 1} color must use #RRGGBB`);
    if (typeof rawEntry.billable !== "boolean") throw new Error(`Entry ${index + 1} billable must be true or false`);
    if (duration(entry) <= 0) throw new Error(`Entry ${index + 1} has zero, negative, or cross-midnight duration`);
  }

  const sorted = [...plan.entries].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let index = 1; index < sorted.length; index += 1) {
    if (overlaps(sorted[index - 1], sorted[index])) {
      throw new Error(`Plan entries overlap: ${sorted[index - 1].start}–${sorted[index - 1].end} and ${sorted[index].start}–${sorted[index].end}`);
    }
  }

  const total = plan.entries.reduce((sum, entry) => sum + duration(entry), 0);
  if (!Number.isInteger(plan.expectedMinutes) || plan.expectedMinutes !== total) {
    throw new Error(`expectedMinutes must equal the entry total (${total})`);
  }
}

function reconcile(planEntries, existingEntries) {
  const exact = [];
  const pending = [];
  const conflicts = [];

  for (const planned of planEntries) {
    const duplicate = existingEntries.find((existing) => exactMatch(planned, existing));
    if (duplicate) {
      exact.push(planned);
      continue;
    }
    const overlapping = existingEntries.filter((existing) => overlaps(planned, existing));
    if (overlapping.length) conflicts.push({ planned, existing: overlapping });
    else pending.push(planned);
  }
  return { exact, pending, conflicts };
}

function printEntry(entry, prefix = "-") {
  console.log(`${prefix} ${entry.start}–${entry.end} | ${entry.project} | ${entry.task} | ${entry.activity} | ${entry.remark} | ${entry.color}`);
}

function printReconciliation(plan, hash, existing, result) {
  console.log(`Plan: ${plan.date} (${plan.timezone})`);
  console.log(`SHA-256: ${hash}`);
  console.log(`Plan total: ${plan.expectedMinutes} minutes`);
  console.log(`Existing recognizable entries: ${existing.length}`);
  console.log(`Exact duplicates to skip: ${result.exact.length}`);
  result.exact.forEach((entry) => printEntry(entry));
  console.log(`Missing entries to add: ${result.pending.length}`);
  result.pending.forEach((entry) => printEntry(entry));
  console.log(`Conflicts: ${result.conflicts.length}`);
  for (const conflict of result.conflicts) {
    printEntry(conflict.planned, "PLANNED");
    conflict.existing.forEach((entry) => printEntry(entry, "EXISTING"));
  }
}

function stateDirectory() {
  return path.resolve(path.join(os.homedir(), ".local", "state", "nexus"));
}

function profileDirectory() {
  return path.resolve(
    process.env.ZEP_PROFILE_DIR
      || path.join(stateDirectory(), "zep-playwright-profile"),
  );
}

function storageStateFile() {
  return path.resolve(
    process.env.ZEP_STORAGE_STATE
      || path.join(stateDirectory(), "zep-storage-state.json"),
  );
}

async function saveStorageState(context, stateFile) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  await context.storageState({ path: stateFile });
  fs.chmodSync(stateFile, 0o600);
}

async function launch(headless, { persistent = false } = {}) {
  const stateFile = storageStateFile();
  const options = {
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false,
  };

  if (persistent) {
    const profile = profileDirectory();
    fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
    fs.chmodSync(profile, 0o700);
    const context = await chromium.launchPersistentContext(profile, { ...options, headless });
    const page = context.pages()[0] || await context.newPage();
    return { context, page, profile, stateFile, browser: null };
  }

  if (!fs.existsSync(stateFile)) {
    throw new Error("Saved ZEP authentication state is missing. Run `npm run zep -- auth` first.");
  }
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ ...options, storageState: stateFile });
  const page = await context.newPage();
  return { context, page, profile: null, stateFile, browser };
}

async function closeSession(session) {
  await session.context.close();
  if (session.browser) await session.browser.close();
}

async function withZep(flags, callback) {
  const session = await launch(!flags.headed);
  try {
    const zep = new ZepPage(session.page, process.env.ZEP_URL || DEFAULT_URL);
    await zep.goto();
    const actions = await zep.advanceAuthentication();
    if (actions.length) console.log(`Authentication actions: ${actions.join(", ")}`);
    if (await zep.authenticationRequired()) {
      console.log("Waiting for ZEP to restore the authenticated session...");
      await zep.waitForAuthentication(flags.headed ? 20000 : 10000);
      await zep.advanceAuthentication();
    }
    await zep.assertAuthenticated();
    await saveStorageState(session.context, session.stateFile);
    return await callback(zep, session);
  } finally {
    await closeSession(session);
  }
}

async function auth(flags) {
  const session = await launch(false, { persistent: true });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    await session.page.goto(process.env.ZEP_URL || DEFAULT_URL, { waitUntil: "domcontentloaded" });
    const zep = new ZepPage(session.page, process.env.ZEP_URL || DEFAULT_URL);
    const actions = await zep.advanceAuthentication();
    console.log(`Browser profile: ${session.profile}`);
    if (actions.length) console.log(`Authentication actions: ${actions.join(", ")}`);
    if (await zep.authenticationRequired()) {
      console.log("Complete any remaining Google account or consent screen in the browser.");
      await zep.waitForAuthentication(20000);
      const laterActions = await zep.advanceAuthentication();
      if (laterActions.length) console.log(`Authentication actions: ${laterActions.join(", ")}`);
    }
    console.log("Wait for the main ZEP page. Do not create or edit time entries.");
    await rl.question("Press Enter after the authenticated ZEP page is visible: ");
    await zep.assertAuthenticated();
    await saveStorageState(session.context, session.stateFile);
    console.log(`Authentication state saved: ${session.stateFile}`);
  } finally {
    rl.close();
    await closeSession(session);
  }
}

async function inspect(flags) {
  await withZep({ ...flags, headed: flags.headed !== false }, async (zep) => {
    console.log(JSON.stringify(await zep.inspect(), null, 2));
    console.log("Inspection was read-only. No screenshots were captured.");
  });
}

async function validate(flags) {
  const loaded = loadPlan(flags.plan);
  console.log(`Valid plan: ${loaded.plan.date} (${loaded.plan.timezone})`);
  console.log(`Entries: ${loaded.plan.entries.length}`);
  console.log(`Total: ${loaded.plan.expectedMinutes} minutes`);
  console.log(`SHA-256: ${loaded.hash}`);
}

async function preview(flags) {
  const loaded = loadPlan(flags.plan);
  await withZep(flags, async (zep) => {
    await zep.openDate(loaded.plan.date);
    const existing = await zep.readEntries();
    const result = reconcile(loaded.plan.entries, existing);
    printReconciliation(loaded.plan, loaded.hash, existing, result);
    if (result.conflicts.length) process.exitCode = 2;
    console.log("Preview was read-only. No ZEP entries were changed.");
  });
}

async function apply(flags) {
  const loaded = loadPlan(flags.plan);
  if (!flags["confirm-hash"]) throw new Error("apply requires --confirm-hash from an approved preview");
  if (flags["confirm-hash"] !== loaded.hash) throw new Error("--confirm-hash does not match the plan file");

  await withZep(flags, async (zep) => {
    await zep.openDate(loaded.plan.date);
    let existing = await zep.readEntries();
    let result = reconcile(loaded.plan.entries, existing);
    printReconciliation(loaded.plan, loaded.hash, existing, result);
    if (result.conflicts.length) throw new Error("Refusing to apply a plan with overlapping ZEP entries");

    for (const entry of result.pending) {
      console.log(`Adding ${entry.start}–${entry.end}: ${entry.remark}`);
      await zep.createEntry(loaded.plan.date, entry);
      existing = await zep.readEntries();
      if (!existing.some((candidate) => exactMatch(entry, candidate))) {
        throw new Error(`ZEP did not show the newly added ${entry.start}–${entry.end} entry; stopped after a possible partial write`);
      }
    }

    existing = await zep.readEntries();
    result = reconcile(loaded.plan.entries, existing);
    if (result.pending.length || result.conflicts.length) {
      throw new Error("Final verification failed; review ZEP for partial writes");
    }
    console.log(`Verified ${loaded.plan.entries.length} planned entries in ZEP. Total: ${loaded.plan.expectedMinutes} minutes.`);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage(1);
  if (argv[0] === "--help" || argv[0] === "-h") usage(0);
  const { command, flags } = parseArgs(argv);
  if (flags.help) usage(0);
  if (command === "auth") return auth(flags);
  if (command === "inspect") return inspect(flags);
  if (command === "validate") return validate(flags);
  if (command === "preview") return preview(flags);
  if (command === "apply") return apply(flags);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
