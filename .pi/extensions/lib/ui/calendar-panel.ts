import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { execFile } from "node:child_process";
import { CALENDAR_CACHE, loadUpcomingCalendarDays, type CalendarDay } from "../calendar";

export class CalendarPanelComponent implements Component {
  private dayIndex = 0;
  private eventIndex = 0;
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
    this.eventIndex = 0;
    this.refresh();
  }

  private moveEvent(delta: number) {
    const events = this.days[this.dayIndex]?.events ?? [];
    if (events.length === 0) return;
    this.eventIndex = Math.max(0, Math.min(events.length - 1, this.eventIndex + delta));
    this.refresh();
  }

  private selectedLink(): string | undefined {
    return this.days[this.dayIndex]?.events[this.eventIndex]?.link;
  }

  private openSelectedLink() {
    const link = this.selectedLink();
    if (!link) return;
    execFile("open", [link], () => {});
  }

  private copySelectedLink() {
    const link = this.selectedLink();
    if (!link) return;
    const child = execFile("pbcopy", () => {});
    child.stdin?.end(link);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || data === "q") {
      this.done();
      return;
    }
    if (data === "o") {
      this.openSelectedLink();
      return;
    }
    if (data === "y") {
      this.copySelectedLink();
      return;
    }
    if (matchesKey(data, Key.up) || data === "k") {
      this.moveEvent(-1);
      return;
    }
    if (matchesKey(data, Key.down) || data === "j") {
      this.moveEvent(1);
      return;
    }
    if (matchesKey(data, Key.right) || data === "l" || matchesKey(data, Key.pageDown)) {
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
      const clipped = truncateToWidth(text, inner, "…", true);
      return `│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`;
    };

    const currentDay = this.days[this.dayIndex];
    const title = currentDay ? `${currentDay.title}` : this.loading ? "Loading…" : "No calendar data";
    const pageInfo = this.days.length > 0 ? `day ${this.dayIndex + 1}/${this.days.length}` : "day 0/0";

    const lines = [
      top,
      row(`${this.theme.fg("accent", this.theme.bold("Calendar"))} ${this.theme.fg("muted", `· ${title} · ${pageInfo}`)}`),
      row(this.theme.fg("dim", "←/→ day · ↑/↓ event · o open · y copy · Esc/q close")),
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

      this.eventIndex = Math.min(this.eventIndex, Math.max(0, currentDay.events.length - 1));
      for (let i = 0; i < currentDay.events.length; i++) {
        const event = currentDay.events[i]!;
        const prefix = i === this.eventIndex ? this.theme.fg("accent", "> ") : "  ";
        const time = event.allDay || event.endLabel === event.startLabel ? event.startLabel : `${event.startLabel}–${event.endLabel}`;
        const status = event.status && event.status !== "confirmed" ? ` [${event.status}]` : "";
        const location = event.location ? ` — ${event.location}` : "";
        const link = event.link ? ` — ${event.link}` : "";
        const text = `${this.theme.fg("accent", time)} ${event.summary}${status}${this.theme.fg("dim", `${location}${link}`)}`;
        lines.push(row(`${prefix}${i === this.eventIndex ? this.theme.fg("accent", text) : text}`));
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

