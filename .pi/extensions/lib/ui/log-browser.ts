import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export class LogBrowserComponent implements Component {
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
    if (matchesKey(data, Key.escape) || data === "q") {
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
      row(this.theme.fg("dim", "←/h/n newer · →/l/o older · Tab buttons · Esc/q close")),
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

