import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { readTaskCategories, readTaskItems, applyTaskDoneChanges } from "./lib/tasks";
import { readMemoryFiles, readMemoryLogLines, formatMemoryLogLine, readLatestMemoryLog } from "./lib/memory";
import { readLatestBackup, runMemoryBackup } from "./lib/backup";
import { warmCalendarDays } from "./lib/calendar";
import { STANDARD_OVERLAY_OPTIONS, CALENDAR_OVERLAY_OPTIONS } from "./lib/ui/overlay";
import { TasksModalComponent } from "./lib/ui/tasks-modal";
import { CalendarPanelComponent } from "./lib/ui/calendar-panel";
import { MemoryBrowserComponent } from "./lib/ui/memory-browser";
import { LogBrowserComponent } from "./lib/ui/log-browser";

const WIDGET_ID = "nexus";

function updateWidget(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  const latestLog = readLatestMemoryLog(ctx.cwd);
  const backup = readLatestBackup(ctx.cwd);
  const result = readTaskItems(ctx.cwd);
  const theme = ctx.ui.theme;

  const taskSummary = result.error
    ? theme.fg("error", result.error)
    : `${theme.fg("accent", String(result.activeCount))} task(s)`;

  let logSummary = "";
  if (latestLog) {
    const timeMatch = latestLog.timestamp.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}:\d{2})/);
    const shortTime = timeMatch ? `${timeMatch[3]}-${timeMatch[2]}-${timeMatch[1]} ${timeMatch[4]}` : latestLog.timestamp;
    const parts = latestLog.description.split(" · ");
    const shortDesc = parts.slice(0, 2).join(" ");
    logSummary = ` · ${theme.fg("muted", "log")} ${theme.fg("muted", shortTime)} ${theme.fg("dim", shortDesc)}`;
  }

  const backupSummary = backup ? ` · ${theme.fg("muted", "backup")} ${theme.fg("dim", backup)}` : "";

  ctx.ui.setWidget(WIDGET_ID, undefined);
  ctx.ui.setStatus(WIDGET_ID, `${theme.fg("dim", "· ")}${taskSummary}${logSummary}${backupSummary}`);
}

async function openTasksModal(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  const result = readTaskCategories(ctx.cwd);
  const pendingChanges = new Map<number, boolean>();
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new TasksModalComponent(
      tui,
      theme,
      result,
      pendingChanges,
      done,
    ),
    {
      overlay: true,
      overlayOptions: STANDARD_OVERLAY_OPTIONS,
    },
  );
  if (pendingChanges.size > 0) {
    applyTaskDoneChanges(ctx.cwd, pendingChanges);
    runMemoryBackup(ctx.cwd);
  }
  updateWidget(ctx);
}

async function openCalendarOverlay(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  warmCalendarDays(ctx.cwd);
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new CalendarPanelComponent(tui, theme, ctx.cwd, done),
    {
      overlay: true,
      overlayOptions: CALENDAR_OVERLAY_OPTIONS,
    },
  );
}

async function showMemoryBrowser(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  const result = readMemoryFiles(ctx.cwd);
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new MemoryBrowserComponent(tui, theme, result.files, result.error, done),
    {
      overlay: true,
      overlayOptions: STANDARD_OVERLAY_OPTIONS,
    },
  );
  updateWidget(ctx);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    updateWidget(ctx);
    warmCalendarDays(ctx.cwd);
  });

  pi.on("turn_end", async (_event, ctx) => {
    updateWidget(ctx);
    warmCalendarDays(ctx.cwd);
  });

  pi.registerShortcut("ctrl+shift+t", {
    description: "Show TASKS.md active tasks modal",
    handler: async (ctx) => {
      await openTasksModal(ctx);
    },
  });

  pi.registerCommand("tasks", {
    description: "Show TASKS.md active tasks modal",
    handler: async (_args, ctx) => {
      await openTasksModal(ctx);
    },
  });

  pi.registerCommand("memory", {
    description: "Fuzzy browse and view files under memory/",
    handler: async (_args, ctx) => {
      await showMemoryBrowser(ctx);
    },
  });

  pi.registerCommand("calendar", {
    description: "Show upcoming calendar events overlay",
    handler: async (_args, ctx) => {
      await openCalendarOverlay(ctx);
    },
  });

  pi.registerCommand("logs", {
    description: "Browse memory/log.md entries with Older/Newer buttons. Usage: /logs [page-size]",
    handler: async (args, ctx) => {
      const pageSize = Math.min(Math.max(Number.parseInt(args.trim() || "12", 10) || 12, 5), 30);
      const entries = readMemoryLogLines(ctx.cwd).map(formatMemoryLogLine);
      await ctx.ui.custom<void>(
        (tui, theme, _keybindings, done) => new LogBrowserComponent(tui, theme, entries, pageSize, done),
        {
          overlay: true,
          overlayOptions: STANDARD_OVERLAY_OPTIONS,
        },
      );
      updateWidget(ctx);
    },
  });
}
