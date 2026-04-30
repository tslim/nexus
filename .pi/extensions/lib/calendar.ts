import { execFile } from "node:child_process";

export type CalendarEvent = {
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

export type CalendarDay = {
  dateKey: string;
  title: string;
  events: CalendarEvent[];
};

export const CALENDAR_CACHE: {
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
      const conferenceData = event.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
      const conferenceLink = conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video" && typeof entry.uri === "string")?.uri;
      const descriptionLink = typeof event.description === "string" ? event.description.match(/https?:\/\/\S+/)?.[0] : undefined;
      const link =
        (typeof event.hangoutLink === "string" && event.hangoutLink) ||
        conferenceLink ||
        descriptionLink ||
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

export function loadUpcomingCalendarDays(cwd: string, max = 30): Promise<{ days: CalendarDay[]; error?: string }> {
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
    execFile("gog", ["calendar", "events", "--all", "--from", fromDateKey, "--max", String(max), "--json", "--results-only"], { cwd, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
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

export function warmCalendarDays(cwd: string): void {
  void loadUpcomingCalendarDays(cwd);
}

