import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Key, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

export type StatusModalData = {
  workspace: string;
  session: string;
  model: string;
  thinking: string;
  context: string;
  tasks: string;
  latestLog: string;
  backup: string;
};

export class StatusModalComponent implements Component {
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly theme: Theme,
    private readonly data: StatusModalData,
    private readonly done: () => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.enter) || data === "q") {
      this.done();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const inner = Math.max(30, width - 4);
    const top = `╭${"─".repeat(inner + 2)}╮`;
    const bottom = `╰${"─".repeat(inner + 2)}╯`;
    const row = (text = "") => {
      const clipped = truncateToWidth(text, inner);
      return `│ ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} │`;
    };
    const field = (label: string, value: string) => {
      const labelWidth = 12;
      const prefix = `${this.theme.fg("muted", label.padEnd(labelWidth))} `;
      const continuation = " ".repeat(labelWidth + 1);
      const valueWidth = Math.max(10, inner - labelWidth - 1);
      const wrapped = wrapTextWithAnsi(value, valueWidth);
      return wrapped.map((line: string, index: number) => row(`${index === 0 ? prefix : continuation}${line}`));
    };

    const lines = [
      top,
      row(this.theme.fg("accent", this.theme.bold("Nexus Status"))),
      row(this.theme.fg("dim", "Current session and local memory workspace")),
      row(),
      row(this.theme.fg("accent", this.theme.bold("Session"))),
      ...field("Workspace", this.data.workspace),
      ...field("Session", this.data.session),
      ...field("Model", this.data.model),
      ...field("Thinking", this.data.thinking),
      ...field("Context", this.data.context),
      row(),
      row(this.theme.fg("accent", this.theme.bold("Nexus"))),
      ...field("Tasks", this.data.tasks),
      ...field("Latest log", this.data.latestLog),
      ...field("Backup", this.data.backup),
      row(),
      row(this.theme.fg("dim", "Enter / Esc / q close")),
      bottom,
    ];

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
