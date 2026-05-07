import type { Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, Markdown, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { readFileSync, statSync } from "node:fs";
import { fuzzyScore, type MemoryFile } from "../memory";

export class MemoryBrowserComponent implements Component {
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
    if (matchesKey(data, Key.up)) {
      this.selected = Math.max(0, this.selected - 1);
      this.refresh();
      return;
    }
    if (matchesKey(data, Key.down)) {
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

    // In search mode, printable characters must belong to the query. Do not
    // steal letters such as q/j/k for shortcuts; use Esc to close and arrows
    // to navigate while searching.
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
      lines.push(row(this.theme.fg("dim", "↑/k ↓/j scroll · PgUp/PgDn jump · r raw/markdown · Esc/b back")));
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
      lines.push(row(this.theme.fg("dim", "↑/↓ select · Enter open · Backspace edit · Esc close")));
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

