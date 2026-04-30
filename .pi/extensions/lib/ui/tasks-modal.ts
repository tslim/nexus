import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, matchesKey, visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { previewTaskDoneState, type TaskBoard, type TaskItem } from "../tasks";

export class TasksModalComponent implements Component {
  private selected = 0;
  private categoryIndex = 0;
  private page = 0;
  private readonly pageSize = 18;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private result: TaskBoard,
    private readonly pendingChanges: Map<number, boolean>,
    private readonly done: () => void,
  ) {
    const activeIndex = this.result.categories.findIndex((category) => category.name.toLowerCase() === "active");
    this.categoryIndex = Math.max(0, activeIndex);
  }

  private get category(): TaskCategory | undefined {
    return this.result.categories[this.categoryIndex];
  }

  private get tasks(): TaskItem[] {
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
    if (!task) return;

    const lineIndex = task.lineIndex;
    const nextDone = !task.done;
    this.pendingChanges.set(lineIndex, nextDone);
    this.result = previewTaskDoneState(this.result, lineIndex, nextDone);
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
      ...row(this.theme.fg("dim", "←/→ category · ↑/k ↓/j move · Space/Enter toggle (Done/Active) · n/p page · Esc/q close")),
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
    const pendingSummary = this.pendingChanges.size > 0 ? `${this.theme.fg("warning", `${this.pendingChanges.size} pending change(s)`)} ${this.theme.fg("dim", "· saved on close")}` : this.theme.fg("dim", "No pending changes");
    lines.push(...row(pendingSummary));
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

