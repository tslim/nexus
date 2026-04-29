import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, Markdown, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { exec, execSync } from "node:child_process";

const WIDGET_ID = "work-status-widget";
const MAX_LINES = 8;

type ActiveTask = {
  lineIndex: number;
  display: string;
  done: boolean;
};

type TaskCategory = {
  name: string;
  tasks: ActiveTask[];
};

type TaskBrowserResult = {
  categories: TaskCategory[];
  totalCount: number;
  error?: string;
};

type CalendarEvent = {
  summary: string;
  startLabel: string;
  endLabel: string;
  location?: string;
  status?: string;
  link?: string;
  startMs: number;
  allDay: boolean;
  dayKey: string;
};

type CalendarDay = {
  dateKey: string;
  title: string;
  events: CalendarEvent[];
};

const CALENDAR_CACHE: {
  key?: string;
  days?: CalendarDay[];
  error?: string;
  loading?: Promise<void>;
} = {};

const STANDARD_OVERLAY_OPTIONS = { anchor: "center", width: "95%", maxHeight: "90%", minWidth: 80, margin: 1 };
const CALENDAR_OVERLAY_OPTIONS = {
  anchor: "center",
  width: "72%",
  maxHeight: "92%",
  minWidth: 72,
  margin: 1,
  visible: (termWidth: number) => termWidth >= 110,
};

function formatCalendarDayTitle(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatCalendarTime(value: unknown): { label: string; startMs: number; allDay: boolean; dateKey: string } | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { label: "All day", startMs: new Date(`${value}T00:00:00`).getTime(), allDay: true, dateKey: value };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    label: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date),
    startMs: date.getTime(),
    allDay: false,
    dateKey,
  };
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

function groupCalendarEvents(raw: unknown[], fromDateKey: string): CalendarDay[] {
  const events: CalendarEvent[] = raw
    .map((item) => {
      const event = item as Record<string, unknown>;
      const start = (event.start as { dateTime?: unknown; date?: unknown } | undefined) ?? {};
      const end = (event.end as { dateTime?: unknown; date?: unknown } | undefined) ?? {};
      const startTime = formatCalendarTime(start.dateTime ?? start.date);
      const endTime = formatCalendarTime(end.dateTime ?? end.date);
      const link =
        (typeof event.hangoutLink === "string" && event.hangoutLink) ||
        (typeof event.htmlLink === "string" && event.htmlLink) ||
        undefined;
      if (!startTime) return undefined;

      const dayKey = compareDateKeys(startTime.dateKey, fromDateKey) < 0 ? fromDateKey : startTime.dateKey;
      return {
        summary: typeof event.summary === "string" && event.summary ? event.summary : "(no title)",
        startLabel: startTime.label,
        endLabel: endTime?.label ?? startTime.label,
        location: typeof event.location === "string" && event.location ? event.location : undefined,
        status: typeof event.status === "string" ? event.status : undefined,
        link,
        startMs: startTime.startMs,
        allDay: startTime.allDay,
        dayKey,
      } satisfies CalendarEvent;
    })
    .filter((event): event is CalendarEvent => Boolean(event))
    .sort((a, b) => a.startMs - b.startMs || a.summary.localeCompare(b.summary));

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = event.dayKey;
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => compareDateKeys(a, b))
    .map(([dateKey, dayEvents]) => ({ dateKey, title: formatCalendarDayTitle(dateKey), events: dayEvents }));
}

function loadUpcomingCalendarDays(cwd: string, max = 30): Promise<{ days: CalendarDay[]; error?: string }> {
  const fromDateKey = getTodayKey();
  const cacheKey = `${cwd}|${max}|${fromDateKey}`;
  if (CALENDAR_CACHE.key === cacheKey && CALENDAR_CACHE.days && !CALENDAR_CACHE.loading) {
    return Promise.resolve({ days: CALENDAR_CACHE.days, error: CALENDAR_CACHE.error });
  }
  if (CALENDAR_CACHE.key === cacheKey && CALENDAR_CACHE.loading) {
    return CALENDAR_CACHE.loading.then(() => ({ days: CALENDAR_CACHE.days ?? [], error: CALENDAR_CACHE.error }));
  }

  CALENDAR_CACHE.key = cacheKey;
  CALENDAR_CACHE.loading = new Promise<void>((resolve) => {
    exec(`gog calendar events --all --from ${fromDateKey} --max ${max} --json --results-only`, { cwd, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      try {
        if (error) throw new Error(stderr || error.message);
        const output = stdout.trim();
        if (!output) {
          CALENDAR_CACHE.days = [];
          CALENDAR_CACHE.error = undefined;
          return;
        }

        const parsed = JSON.parse(output) as unknown;
        const raw = Array.isArray(parsed) ? parsed : [];
        CALENDAR_CACHE.days = groupCalendarEvents(raw, fromDateKey).filter((day) => compareDateKeys(day.dateKey, fromDateKey) >= 0);
        CALENDAR_CACHE.error = undefined;
      } catch (err) {
        CALENDAR_CACHE.days = [];
        CALENDAR_CACHE.error = err instanceof Error ? err.message : String(err);
      } finally {
        CALENDAR_CACHE.loading = undefined;
        resolve();
      }
    });
  });

  return CALENDAR_CACHE.loading.then(() => ({ days: CALENDAR_CACHE.days ?? [], error: CALENDAR_CACHE.error }));
}

function warmCalendarDays(cwd: string): void {
  void loadUpcomingCalendarDays(cwd);
}

function cleanTaskText(line: string): string {
  return line
    .replace(/^\s*- \[[ xX]\]\s*/, "")
    .replace(/_\(added \d{4}-\d{2}-\d{2}\)_/g, "")
    .replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/~~/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+-\s+$/, "")
    .trim();
}

function readTaskCategories(cwd: string): TaskBrowserResult {
  const tasksPath = join(cwd, "TASKS.md");
  if (!existsSync(tasksPath)) return { categories: [], totalCount: 0, error: "TASKS.md not found" };

  const content = readFileSync(tasksPath, "utf8");
  const allLines = content.split(/\r?\n/);
  const totalCount = allLines.filter((line) => /^\s*- \[[ xX]\]\s+/.test(line)).length;
  const categories: TaskCategory[] = [];
  let current: TaskCategory | undefined;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i] ?? "";
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { name: heading[1]!, tasks: [] };
      categories.push(current);
      continue;
    }

    const task = line.match(/^(\s*)- \[([ xX])\]\s+(.+)$/);
    if (task && current) {
      const indent = (task[1] ?? "").length > 0 ? "  " : "";
      const done = String(task[2]).toLowerCase() === "x";
      current.tasks.push({ lineIndex: i, display: `${indent}${done ? "☑" : "☐"} ${cleanTaskText(line)}`, done });
    }
  }

  if (categories.length === 0) return { categories: [], totalCount, error: "No task sections found" };
  return { categories, totalCount };
}

function readActiveTaskLines(cwd: string): { tasks: ActiveTask[]; totalCount: number; error?: string } {
  const result = readTaskCategories(cwd);
  const active = result.categories.find((category) => category.name.toLowerCase() === "active");
  return {
    tasks: (active?.tasks ?? []).filter((task) => !task.done),
    totalCount: result.totalCount,
    error: result.error ?? (active ? undefined : "No ## Active section found"),
  };
}

function markTaskDone(cwd: string, lineIndex: number): TaskBrowserResult {
  const tasksPath = join(cwd, "TASKS.md");
  if (!existsSync(tasksPath)) return { categories: [], totalCount: 0, error: "TASKS.md not found" };

  const content = readFileSync(tasksPath, "utf8");
  const allLines = content.split(/\r?\n/);
  const line = allLines[lineIndex];
  if (line === undefined || !/^\s*- \[ \]\s+/.test(line)) return readTaskCategories(cwd);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  allLines[lineIndex] = line.replace(/^(\s*)- \[ \]\s+(.+)$/, (_match, indent, text) => {
    const trimmed = String(text).trim();
    return `${indent}- [x] ~~${trimmed}~~ (${today})`;
  });
  writeFileSync(tasksPath, allLines.join("\n"), "utf8");

  return readTaskCategories(cwd);
}

function readActiveTasks(cwd: string): { lines: string[]; omitted: number; activeCount: number; totalCount: number; error?: string } {
  const result = readActiveTaskLines(cwd);
  return {
    lines: result.tasks.map((task) => task.display).slice(0, MAX_LINES),
    omitted: Math.max(0, result.tasks.length - MAX_LINES),
    activeCount: result.tasks.length,
    totalCount: result.totalCount,
    error: result.error,
  };
}

function readMemoryLogLines(cwd: string): string[] {
  const logPath = join(cwd, "memory", "log.md");
  if (!existsSync(logPath)) return [];

  return readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}\s+\|/.test(line));
}

function formatMemoryLogLine(line: string): { timestamp: string; description: string } {
  const parts = line.split("|").map((part) => part.trim());
  const timestamp = parts[0] ?? "";
  const action = parts[1] ?? "";
  const subject = parts[2] ?? "";
  const message = parts.slice(3).join(" | ");
  const description = [action, subject, message].filter(Boolean).join(" · ");

  return { timestamp, description };
}

function readLatestMemoryLog(cwd: string): { timestamp: string; description: string } | undefined {
  const latest = readMemoryLogLines(cwd).at(-1);
  return latest ? formatMemoryLogLine(latest) : undefined;
}

function readLatestBackup(cwd: string): string | undefined {
  try {
    const envPath = join(cwd, ".env");
    if (!existsSync(envPath)) return undefined;
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/^MEMORY_BACKUP_DIR=(.*)$/m);
    if (!match) return undefined;
    
    let dir = match[1]!.trim();
    if (dir.startsWith('"') && dir.endsWith('"')) {
      dir = dir.slice(1, -1);
    } else {
      dir = dir.replace(/\\ /g, " ").replace(/\\~/g, "~");
    }
    
    const out = execSync(`git -C "${dir}" log -1 --format="%cr"`, { stdio: "pipe", encoding: "utf8" });
    return out.trim();
  } catch {
    return undefined;
  }
}

type MemoryFile = {
  path: string;
  relativePath: string;
};

function readMemoryFiles(cwd: string): { files: MemoryFile[]; error?: string } {
  const memoryPath = join(cwd, "memory");
  if (!existsSync(memoryPath)) return { files: [], error: "memory/ not found" };

  const files: MemoryFile[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push({ path, relativePath: relative(memoryPath, path) });
      }
    }
  };

  visit(memoryPath);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return { files };
}

function fuzzyScore(text: string, query: string): number {
  if (!query.trim()) return 1;

  const target = text.toLowerCase();
  const needle = query.toLowerCase();
  let score = 0;
  let targetIndex = 0;
  let streak = 0;

  for (const char of needle) {
    const found = target.indexOf(char, targetIndex);
    if (found === -1) return -1;
    streak = found === targetIndex ? streak + 1 : 1;
    score += 10 + streak * 5 - Math.min(8, found - targetIndex);
    targetIndex = found + 1;
  }

  if (target.includes(needle)) score += 100;
  if (target.startsWith(needle)) score += 50;
  return score - target.length / 1000;
}

class CalendarPanelComponent implements Component {
  private dayIndex = 0;
  private days: CalendarDay[] = CALENDAR_CACHE.days ?? [];
  private error: string | undefined = CALENDAR_CACHE.error;
  private loading = !CALENDAR_CACHE.days && !CALENDAR_CACHE.error;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly cwd: string,
    private readonly done: () => void,
  ) {
    void this.load();
  }

  private async load() {
    if (CALENDAR_CACHE.cwd === this.cwd && CALENDAR_CACHE.days && !CALENDAR_CACHE.loading) {
      this.days = CALENDAR_CACHE.days;
      this.error = CALENDAR_CACHE.error;
      this.loading = false;
      this.refresh();
      return;
    }

    this.loading = true;
    this.refresh();
    await loadUpcomingCalendarDays(this.cwd, 40);
    this.days = CALENDAR_CACHE.days ?? [];
    this.error = CALENDAR_CACHE.error;
    this.loading = false;
    this.dayIndex = Math.min(this.dayIndex, Math.max(0, this.days.length - 1));
    this.refresh();
  }

  private get maxDayIndex(): number {
    return Math.max(0, this.days.length - 1);
  }

  private refresh() {
    this.invalidate();
    this.tui.requestRender();
  }

  private moveDay(delta: number) {
    const next = Math.max(0, Math.min(this.maxDayIndex, this.dayIndex + delta));
    if (next === this.dayIndex) return;
    this.dayIndex = next;
    this.refresh();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === "q") {
      this.done();
      return;
    }
    if (matchesKey(data, Key.right) || data === "l" || data === "o" || matchesKey(data, Key.pageDown)) {
      this.moveDay(1);
      return;
    }
    if (matchesKey(data, Key.left) || data === "h" || data === "n" || matchesKey(data, Key.pageUp)) {
      this.moveDay(-1);
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const inner = Math.max(34, width - 4);
    const top = `╭${"─".repeat(inner + 2)}╮`;
    const bottom = `╰${"─".repeat(inner + 2)}╯`;
    const row = (text = "") => {
      const clipped = truncateToWidth(text, inner);
      return `│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`;
    };

    const currentDay = this.days[this.dayIndex];
    const title = currentDay ? `${currentDay.title}` : this.loading ? "Loading…" : "No calendar data";
    const pageInfo = this.days.length > 0 ? `day ${this.dayIndex + 1}/${this.days.length}` : "day 0/0";

    const lines = [
      top,
      row(`${this.theme.fg("accent", this.theme.bold("Calendar"))} ${this.theme.fg("muted", `· ${title} · ${pageInfo}`)}`),
      row(this.theme.fg("dim", "←/→ day · PgUp/PgDn · Esc/q close")),
      row(),
    ];

    if (this.loading && !currentDay) {
      lines.push(row(this.theme.fg("muted", "Loading calendar events…")));
    } else if (this.error && !currentDay) {
      lines.push(row(this.theme.fg("error", `⚠ ${this.error}`)));
    } else if (!currentDay) {
      lines.push(row(this.theme.fg("muted", "No upcoming events found.")));
    } else {
      lines.push(row(this.theme.fg("accent", this.theme.bold(currentDay.title))));
      lines.push(row(this.theme.fg("dim", `${currentDay.events.length} event(s)`)));
      lines.push(row());

      for (const event of currentDay.events) {
        const time = event.allDay || event.endLabel === event.startLabel ? event.startLabel : `${event.startLabel}–${event.endLabel}`;
        const status = event.status && event.status !== "confirmed" ? ` [${event.status}]` : "";
        const meta = event.location || event.link ? ` — ${event.location ?? event.link}` : "";
        lines.push(row(`${this.theme.fg("accent", time)} ${event.summary}${status}${this.theme.fg("dim", meta)}`));
      }
    }

    lines.push(bottom);
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

class MemoryBrowserComponent implements Component {
  private query = "";
  private selected = 0;
  private scroll = 0;
  private openFile?: MemoryFile;
  private openText = "";
  private openLines: string[] = [];
  private openError?: string;
  private renderMarkdown = true;
  private renderedFileWidth?: number;
  private renderedFileMode?: "markdown" | "raw";
  private renderedFileLines?: string[];
  private readonly markdownTheme = getMarkdownTheme();
  private matchesQuery?: string;
  private matchesCache?: MemoryFile[];
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly files: MemoryFile[],
    private readonly error: string | undefined,
    private readonly done: () => void,
  ) {}

  private getMatches(): MemoryFile[] {
    if (this.matchesCache && this.matchesQuery === this.query) return this.matchesCache;

    this.matchesQuery = this.query;
    this.matchesCache = this.files
      .map((file) => ({ file, score: fuzzyScore(file.relativePath, this.query) }))
      .filter((match) => match.score >= 0)
      .sort((a, b) => b.score - a.score || a.file.relativePath.localeCompare(b.file.relativePath))
      .map((match) => match.file);
    return this.matchesCache;
  }

  private setQuery(query: string) {
    this.query = query;
    this.selected = 0;
    this.matchesQuery = undefined;
    this.matchesCache = undefined;
  }

  private invalidateRenderedFile() {
    this.renderedFileWidth = undefined;
    this.renderedFileMode = undefined;
    this.renderedFileLines = undefined;
  }

  private refresh() {
    this.invalidate();
    this.tui.requestRender();
  }

  private openSelected() {
    const file = this.getMatches()[this.selected];
    if (!file) return;

    this.openFile = file;
    this.scroll = 0;
    this.openError = undefined;
    this.invalidateRenderedFile();
    try {
      const stat = statSync(file.path);
      if (stat.size > 1024 * 1024) {
        this.openError = "File is larger than 1MB; refusing to open in modal.";
        this.openLines = [];
      } else {
        this.openText = readFileSync(file.path, "utf8");
        this.openLines = this.openText.split(/\r?\n/);
      }
    } catch (error) {
      this.openError = error instanceof Error ? error.message : String(error);
      this.openLines = [];
    }
    this.refresh();
  }

  private closeFile() {
    this.openFile = undefined;
    this.openText = "";
    this.openLines = [];
    this.openError = undefined;
    this.invalidateRenderedFile();
    this.scroll = 0;
    this.refresh();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      if (this.openFile) this.closeFile();
      else this.done();
      return;
    }
    if (data === "q") {
      this.done();
      return;
    }

    if (this.openFile) {
      if (matchesKey(data, Key.up) || data === "k") {
        this.scroll = Math.max(0, this.scroll - 1);
        this.refresh();
        return;
      }
      if (matchesKey(data, Key.down) || data === "j") {
        this.scroll++;
        this.refresh();
        return;
      }
      if (matchesKey(data, Key.pageUp)) {
        this.scroll = Math.max(0, this.scroll - 10);
        this.refresh();
        return;
      }
      if (matchesKey(data, Key.pageDown)) {
        this.scroll += 10;
        this.refresh();
        return;
      }
      if (data === "r") {
        this.renderMarkdown = !this.renderMarkdown;
        this.invalidateRenderedFile();
        this.scroll = 0;
        this.refresh();
        return;
      }
      if (data === "b") this.closeFile();
      return;
    }

    const matches = this.getMatches();
    if (matchesKey(data, Key.up) || data === "k") {
      this.selected = Math.max(0, this.selected - 1);
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.down) || data === "j") {
      this.selected = Math.min(Math.max(0, matches.length - 1), this.selected + 1);
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      this.openSelected();
      return;
    }
    if (matchesKey(data, Key.backspace) || data === "\u007f") {
      this.setQuery(this.query.slice(0, -1));
      this.refresh();
      return;
    }

    const printable = /^[ -~]$/.test(data) ? data : undefined;
    if (printable) {
      this.setQuery(this.query + printable);
      this.refresh();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const inner = Math.max(20, width - 4);
    const top = `╭${"─".repeat(inner + 2)}╮`;
    const bottom = `╰${"─".repeat(inner + 2)}╯`;
    const row = (text = "") => {
      const clipped = truncateToWidth(text, inner);
      return `│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`;
    };

    const lines = [top];

    if (this.openFile) {
      const height = 24;
      const isMarkdownFile = /\.md(?:own)?$/i.test(this.openFile.relativePath);
      const mode: "markdown" | "raw" = isMarkdownFile && this.renderMarkdown ? "markdown" : "raw";
      if (!this.renderedFileLines || this.renderedFileWidth !== inner || this.renderedFileMode !== mode) {
        this.renderedFileWidth = inner;
        this.renderedFileMode = mode;
        this.renderedFileLines = mode === "markdown" ? new Markdown(this.openText, 0, 0, this.markdownTheme).render(inner) : this.openLines;
      }
      const renderedLines = this.renderedFileLines;
      const maxScroll = Math.max(0, renderedLines.length - height);
      this.scroll = Math.min(this.scroll, maxScroll);
      const modeHint = isMarkdownFile ? `${mode} · ` : "raw · ";
      lines.push(row(`${this.theme.fg("accent", this.theme.bold(`memory/${this.openFile.relativePath}`))} ${this.theme.fg("muted", `${modeHint}${this.scroll + 1}/${Math.max(1, renderedLines.length)}`)}`));
      lines.push(row(this.theme.fg("dim", "↑/k ↓/j scroll · PgUp/PgDn jump · r raw/markdown · Esc/b back · q close")));
      lines.push(row());
      if (this.openError) {
        lines.push(row(this.theme.fg("error", `⚠ ${this.openError}`)));
      } else {
        const end = Math.min(renderedLines.length, this.scroll + height);
        for (let i = this.scroll; i < end; i++) {
          lines.push(row(renderedLines[i] ?? ""));
        }
        while (lines.length < height + 4) lines.push(row());
      }
    } else {
      const matches = this.getMatches();
      this.selected = Math.min(this.selected, Math.max(0, matches.length - 1));
      const visible = 20;
      const start = Math.max(0, Math.min(this.selected - Math.floor(visible / 2), matches.length - visible));
      const end = Math.min(matches.length, start + visible);

      lines.push(row(`${this.theme.fg("accent", this.theme.bold("Browse memory/"))} ${this.theme.fg("muted", `${matches.length}/${this.files.length} files`)}`));
      lines.push(row(`${this.theme.fg("dim", "Search:")} ${this.query || this.theme.fg("muted", "type to fuzzy search")}`));
      lines.push(row(this.theme.fg("dim", "↑/k ↓/j select · Enter open · Backspace edit · Esc/q close")));
      lines.push(row());

      if (this.error) {
        lines.push(row(this.theme.fg("error", `⚠ ${this.error}`)));
      } else if (matches.length === 0) {
        lines.push(row(this.theme.fg("warning", "No matching files.")));
      } else {
        if (start > 0) lines.push(row(this.theme.fg("muted", `… ${start} file(s) above`)));
        for (let i = start; i < end; i++) {
          const prefix = i === this.selected ? this.theme.fg("accent", "> ") : "  ";
          const text = i === this.selected ? this.theme.fg("accent", matches[i]!.relativePath) : matches[i]!.relativePath;
          lines.push(row(`${prefix}${text}`));
        }
        if (end < matches.length) lines.push(row(this.theme.fg("muted", `… ${matches.length - end} file(s) below`)));
      }
    }

    lines.push(bottom);
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

class TasksModalComponent implements Component {
  private selected = 0;
  private categoryIndex = 0;
  private page = 0;
  private readonly pageSize = 18;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private result: TaskBrowserResult,
    private readonly onToggleDone: (lineIndex: number) => TaskBrowserResult,
    private readonly done: () => void,
  ) {
    const activeIndex = this.result.categories.findIndex((category) => category.name.toLowerCase() === "active");
    this.categoryIndex = Math.max(0, activeIndex);
  }

  private get category(): TaskCategory | undefined {
    return this.result.categories[this.categoryIndex];
  }

  private get tasks(): ActiveTask[] {
    return this.category?.tasks ?? [];
  }

  private get maxPage(): number {
    return Math.max(0, Math.ceil(this.tasks.length / this.pageSize) - 1);
  }

  private refresh() {
    this.invalidate();
    this.tui.requestRender();
  }

  private clampPosition() {
    this.categoryIndex = Math.min(this.categoryIndex, Math.max(0, this.result.categories.length - 1));
    this.selected = Math.min(this.selected, Math.max(0, this.tasks.length - 1));
    this.page = Math.min(this.page, this.maxPage);
  }

  private selectCategory(delta: number) {
    if (this.result.categories.length === 0) return;
    this.categoryIndex = (this.categoryIndex + delta + this.result.categories.length) % this.result.categories.length;
    this.selected = 0;
    this.page = 0;
    this.refresh();
  }

  private selectPage(delta: number) {
    const nextPage = Math.max(0, Math.min(this.maxPage, this.page + delta));
    if (nextPage === this.page) return;
    this.page = nextPage;
    this.selected = Math.max(0, Math.min(this.tasks.length - 1, this.page * this.pageSize));
    this.refresh();
  }

  private toggleSelected() {
    const task = this.tasks[this.selected];
    if (!task || task.done) return;

    const lineIndex = task.lineIndex;
    this.result = this.onToggleDone(lineIndex);
    this.clampPosition();
    const refreshedIndex = this.tasks.findIndex((refreshed) => refreshed.lineIndex === lineIndex);
    if (refreshedIndex >= 0) {
      this.selected = refreshedIndex;
      this.page = Math.floor(refreshedIndex / this.pageSize);
    }
    this.refresh();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === "q" || matchesKey(data, Key.ctrlShift("t"))) {
      this.done();
      return;
    }

    if (matchesKey(data, Key.left) || data === "[" || data === "H") {
      this.selectCategory(-1);
      return;
    }
    if (matchesKey(data, Key.right) || data === "]" || data === "L") {
      this.selectCategory(1);
      return;
    }
    if (data === "p") {
      this.selectPage(-1);
      return;
    }
    if (data === "n") {
      this.selectPage(1);
      return;
    }

    if (this.tasks.length === 0) return;

    if (matchesKey(data, Key.up) || data === "k") {
      this.selected = Math.max(0, this.selected - 1);
      this.page = Math.floor(this.selected / this.pageSize);
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.down) || data === "j") {
      this.selected = Math.min(this.tasks.length - 1, this.selected + 1);
      this.page = Math.floor(this.selected / this.pageSize);
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.space)) {
      this.toggleSelected();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const category = this.category;
    const tasks = this.tasks;
    const openCount = tasks.filter((task) => !task.done).length;
    const doneCount = tasks.length - openCount;
    const pageStart = this.page * this.pageSize;
    const pageEnd = Math.min(tasks.length, pageStart + this.pageSize);
    const categorySummary = this.result.categories
      .map((taskCategory, index) => {
        const categoryOpenCount = taskCategory.tasks.filter((task) => !task.done).length;
        const label = `${taskCategory.name} ${categoryOpenCount}/${taskCategory.tasks.length}`;
        return index === this.categoryIndex ? this.theme.fg("accent", this.theme.bold(`[${label}]`)) : this.theme.fg("muted", label);
      })
      .join(this.theme.fg("dim", "  ·  "));

    const inner = Math.max(20, width - 4);
    const top = `╭${"─".repeat(inner + 2)}╮`;
    const bottom = `╰${"─".repeat(inner + 2)}╯`;
    const row = (text = "", preserveAnsiAndWrap = false) => {
      if (preserveAnsiAndWrap) {
        const wrappedLines = wrapTextWithAnsi(text, inner);
        return wrappedLines.map((l: string) => `│ ${l}${" ".repeat(Math.max(0, inner - visibleWidth(l)))} │`);
      }
      const clipped = truncateToWidth(text, inner);
      return [`│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`];
    };

    const lines = [
      top,
      ...row(`${this.theme.fg("accent", this.theme.bold(`TASKS.md · ${category?.name ?? "Tasks"}`))} ${this.theme.fg("muted", `${openCount} open · ${doneCount} done · category ${this.categoryIndex + 1}/${Math.max(1, this.result.categories.length)} · page ${this.page + 1}/${this.maxPage + 1}`)}`),
      ...row(this.theme.fg("dim", "←/→ category · ↑/k ↓/j move · Space/Enter mark done · n/p page · Esc/q close")),
      ...row(),
    ];

    if (this.result.error) {
      lines.push(...row(this.theme.fg("error", `⚠ ${this.result.error}`)));
    } else if (!category) {
      lines.push(...row(this.theme.fg("warning", "No task categories found.")));
    } else if (tasks.length === 0) {
      lines.push(...row(this.theme.fg("muted", `No tasks in ${category.name}.`)));
    } else {
      if (pageStart > 0) lines.push(...row(this.theme.fg("muted", `… page ${this.page} above (${pageStart} task(s))`)));
      for (let i = pageStart; i < pageEnd; i++) {
        const task = tasks[i]!;
        const prefix = i === this.selected ? this.theme.fg("accent", "> ") : "  ";
        const styled = task.done
          ? task.display.replace(/^(\s*)☑\s+/, (_match, indent) => `${indent}${this.theme.fg("success", "☑")} `)
          : task.display.replace(/^(\s*)☐\s+/, (_match, indent) => `${indent}${this.theme.fg("warning", "☐")} `);
        const text = task.done ? this.theme.fg("dim", styled) : styled;
        lines.push(...row(`${prefix}${i === this.selected ? this.theme.fg("accent", text) : text}`, true));
      }
      if (pageEnd < tasks.length) lines.push(...row(this.theme.fg("muted", `… page ${this.page + 2} below (${tasks.length - pageEnd} task(s))`)));
    }

    lines.push(...row());
    lines.push(...row(categorySummary || this.theme.fg("muted", "No categories")));
    lines.push(bottom);

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

class LogBrowserComponent implements Component {
  private page = 0;
  private selectedButton = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly entries: Array<{ timestamp: string; description: string }>,
    private readonly pageSize: number,
    private readonly done: () => void,
  ) {}

  private get maxPage(): number {
    return Math.max(0, Math.ceil(this.entries.length / this.pageSize) - 1);
  }

  private older() {
    if (this.page < this.maxPage) {
      this.page++;
      this.refresh();
    }
  }

  private newer() {
    if (this.page > 0) {
      this.page--;
      this.refresh();
    }
  }

  private refresh() {
    this.invalidate();
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.done();
      return;
    }

    if (matchesKey(data, Key.right) || data === "l" || data === "o") {
      this.older();
      return;
    }
    if (matchesKey(data, Key.left) || data === "h" || data === "n") {
      this.newer();
      return;
    }

    if (matchesKey(data, Key.tab)) {
      this.selectedButton = (this.selectedButton + 1) % 3;
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.shift("tab"))) {
      this.selectedButton = (this.selectedButton + 2) % 3;
      this.refresh();
      return;
    }

    if (matchesKey(data, Key.enter)) {
      if (this.selectedButton === 0) this.older();
      if (this.selectedButton === 1) this.newer();
      if (this.selectedButton === 2) this.done();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const inner = Math.max(20, width - 4);
    const top = `╭${"─".repeat(inner + 2)}╮`;
    const bottom = `╰${"─".repeat(inner + 2)}╯`;
    const row = (text = "") => {
      const clipped = truncateToWidth(text, inner);
      return `│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`;
    };

    const total = this.entries.length;
    const start = Math.max(0, total - (this.page + 1) * this.pageSize);
    const end = total - this.page * this.pageSize;
    const shown = this.entries.slice(start, end).reverse();
    const range = total === 0 ? "0" : `${start + 1}-${end}`;

    const lines = [
      top,
      row(`${this.theme.fg("accent", this.theme.bold("memory/log.md"))} ${this.theme.fg("muted", `entries ${range} of ${total}`)}`),
      row(this.theme.fg("dim", "←/h/n newer · →/l/o older · Tab buttons · Esc close")),
      row(),
    ];

    if (shown.length === 0) {
      lines.push(row(this.theme.fg("warning", "No memory log entries found.")));
    } else {
      for (const entry of shown) {
        lines.push(row(`${this.theme.fg("accent", entry.timestamp)} ${this.theme.fg("dim", "—")} ${entry.description}`));
      }
    }

    while (lines.length < this.pageSize + 5) lines.push(row());

    const button = (index: number, label: string, disabled = false) => {
      const text = `[ ${label} ]`;
      if (disabled) return this.theme.fg("dim", text);
      return index === this.selectedButton ? this.theme.fg("accent", this.theme.bold(text)) : text;
    };
    lines.push(row(`${button(0, "Older", this.page >= this.maxPage)}   ${button(1, "Newer", this.page === 0)}   ${button(2, "Close")}`));
    lines.push(bottom);

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

function updateWidget(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  const latestLog = readLatestMemoryLog(ctx.cwd);
  const backup = readLatestBackup(ctx.cwd);
  const result = readActiveTasks(ctx.cwd);
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
  ctx.ui.setStatus(WIDGET_ID, `${taskSummary}${logSummary}${backupSummary}`);
}

async function showTasksModal(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  const result = readTaskCategories(ctx.cwd);
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new TasksModalComponent(tui, theme, result, (lineIndex) => markTaskDone(ctx.cwd, lineIndex), done),
    {
      overlay: true,
      overlayOptions: STANDARD_OVERLAY_OPTIONS,
    },
  );
  updateWidget(ctx);
}

async function openCalendarOverlay(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;

  warmCalendarDays(ctx.cwd);
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => new CalendarPanelComponent(tui, theme, ctx.cwd, done),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: "72%",
        maxHeight: "92%",
        minWidth: 72,
        margin: 1,
        visible: (termWidth) => termWidth >= 110,
      },
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
      await showTasksModal(ctx);
    },
  });

  pi.registerCommand("tasks", {
    description: "Show TASKS.md active tasks modal",
    handler: async (_args, ctx) => {
      await showTasksModal(ctx);
    },
  });

  pi.registerCommand("tasks-refresh", {
    description: "Refresh work status line from TASKS.md and memory/log.md",
    handler: async (_args, ctx) => {
      updateWidget(ctx);
      ctx.ui.notify("Work status refreshed", "info");
    },
  });

  pi.registerCommand("browse", {
    description: "Fuzzy browse and view files under memory/",
    handler: async (_args, ctx) => {
      await showMemoryBrowser(ctx);
    },
  });

  pi.registerCommand("calendar", {
    description: "Show upcoming calendar events in a right-side panel",
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
          overlayOptions: { anchor: "center", width: "95%", maxHeight: "90%", minWidth: 80, margin: 1 },
        },
      );
      updateWidget(ctx);
    },
  });
}
