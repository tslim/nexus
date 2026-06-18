import type { Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import type { Component, TUI } from "@mariozechner/pi-tui";
import { Key, Markdown, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { readFileSync, statSync } from "node:fs";
import { fuzzyScore, type MemoryFile } from "../memory";

type LoadIntoContextHandler = (file: MemoryFile, text: string) => void;

function decodeCodePoint(match: string, code: string, radix: number): string {
  const value = Number.parseInt(code, radix);
  if (!Number.isFinite(value)) return match;
  try {
    return String.fromCodePoint(value);
  } catch {
    return match;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (match, code: string) => decodeCodePoint(match, code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) => decodeCodePoint(match, code, 16));
}

function getHtmlAttribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeHtmlEntities(match[2] ?? "").trim() : undefined;
}

function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, ""));
}

function htmlInlineToMarkdown(input: string): string {
  return input
    .replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => {
      const alt = getHtmlAttribute(attrs, "alt");
      return alt ? `[Image: ${alt}]` : "";
    })
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, label: string) => {
      const text = stripHtmlTags(label).replace(/\s+/g, " ").trim();
      const href = getHtmlAttribute(attrs, "href");
      if (!text) return href ?? "";
      return href ? `[${text}](${href})` : text;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line).replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function firstHtmlTagContent(html: string, tagName: string): string | undefined {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  const content = match ? htmlInlineToMarkdown(match[1] ?? "") : "";
  return content || undefined;
}

function firstMetaContent(html: string, names: string[]): string | undefined {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = getHtmlAttribute(tag, "name") ?? getHtmlAttribute(tag, "property");
    if (!key || !names.includes(key.toLowerCase())) continue;
    const content = getHtmlAttribute(tag, "content");
    if (content) return content;
  }
  return undefined;
}

function htmlToMarkdownText(html: string): string {
  const normalized = html.replace(/\r\n?/g, "\n");
  const title = firstHtmlTagContent(normalized, "title");
  const description = firstMetaContent(normalized, ["description", "og:description"]);
  const bodyMatch = normalized.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let working = bodyMatch ? bodyMatch[1] ?? "" : normalized;

  working = working
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "");

  working = working
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, content: string) => {
      const text = htmlInlineToMarkdown(content);
      return text ? `\n\n${"#".repeat(Number.parseInt(level, 10))} ${text}\n\n` : "\n\n";
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, content: string) => {
      const text = htmlInlineToMarkdown(content);
      return text ? `\n- ${text}\n` : "\n";
    })
    .replace(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi, (_match, content: string) => {
      const text = htmlInlineToMarkdown(content);
      return text ? `${text} | ` : "";
    })
    .replace(/<tr\b[^>]*>|<\/tr>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|nav|ul|ol|table|blockquote)>/gi, "\n\n")
    .replace(/<(p|div|section|article|header|footer|main|aside|nav|ul|ol|table|blockquote)\b[^>]*>/gi, "\n\n");

  working = working
    .replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => {
      const alt = getHtmlAttribute(attrs, "alt");
      return alt ? `[Image: ${alt}]` : "";
    })
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs: string, label: string) => {
      const text = stripHtmlTags(label).replace(/\s+/g, " ").trim();
      const href = getHtmlAttribute(attrs, "href");
      if (!text) return href ?? "";
      return href ? `[${text}](${href})` : text;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line).replace(/[\t ]+/g, " ").trim())
    .join("\n");

  const lines = working
    .replace(/\r\n?/g, "\n")
    .split(/\n/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line, index, lines) => line || lines[index - 1]);

  const preface = [title ? `# ${title}` : undefined, description ? `> ${description}` : undefined]
    .filter(Boolean)
    .join("\n\n");
  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return [preface, body].filter(Boolean).join("\n\n").trim();
}

export class MemoryBrowserComponent implements Component {
  private query = "";
  private selected = 0;
  private scroll = 0;
  private openFile?: MemoryFile;
  private openText = "";
  private openLines: string[] = [];
  private openError?: string;
  private loadMessage?: string;
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
    private readonly onLoadIntoContext?: LoadIntoContextHandler,
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
    this.openText = "";
    this.openLines = [];
    this.openError = undefined;
    this.loadMessage = undefined;
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
    this.loadMessage = undefined;
    this.invalidateRenderedFile();
    this.scroll = 0;
    this.refresh();
  }

  private isOpenMarkdownFile(): boolean {
    return this.openFile ? /\.md(?:own)?$/i.test(this.openFile.relativePath) : false;
  }

  private isOpenHtmlFile(): boolean {
    return this.openFile ? /\.html?$/i.test(this.openFile.relativePath) : false;
  }

  private isOpenLoadableTextFile(): boolean {
    return this.openFile ? /\.(md|mdown|txt|html?)$/i.test(this.openFile.relativePath) : false;
  }

  private loadOpenFileIntoContext() {
    if (!this.openFile || !this.isOpenLoadableTextFile()) return;
    if (this.openError) {
      this.loadMessage = "Cannot load file with read error.";
      this.refresh();
      return;
    }
    const isHtml = this.isOpenHtmlFile();
    const contextText = isHtml ? htmlToMarkdownText(this.openText) : this.openText;
    this.onLoadIntoContext?.(this.openFile, contextText || this.openText);
    this.loadMessage = isHtml
      ? `Loaded cleaned text from memory/${this.openFile.relativePath} into session context.`
      : `Loaded memory/${this.openFile.relativePath} into session context.`;
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
        this.scroll = Math.max(0, this.scroll - 20);
        this.refresh();
        return;
      }
      if (matchesKey(data, Key.pageDown)) {
        this.scroll += 20;
        this.refresh();
        return;
      }
      if (data === "r" && this.isOpenMarkdownFile()) {
        this.renderMarkdown = !this.renderMarkdown;
        this.invalidateRenderedFile();
        this.scroll = 0;
        this.refresh();
        return;
      }
      if (data === "l") {
        this.loadOpenFileIntoContext();
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
      const isHtmlFile = /\.html?$/i.test(this.openFile.relativePath);
      const isLoadableTextFile = /\.(md|mdown|txt|html?)$/i.test(this.openFile.relativePath);
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
      const renderHint = isMarkdownFile ? " · r raw/markdown" : "";
      const loadHint = isLoadableTextFile ? (isHtmlFile ? " · l load cleaned context" : " · l load context") : "";
      lines.push(row(`${this.theme.fg("accent", this.theme.bold(`memory/${this.openFile.relativePath}`))} ${this.theme.fg("muted", `${modeHint}${this.scroll + 1}/${Math.max(1, renderedLines.length)}`)}`));
      lines.push(row(this.theme.fg("dim", `↑/k ↓/j scroll · PgUp/PgDn jump${renderHint}${loadHint} · Esc/b back`)));
      if (this.loadMessage) lines.push(row(this.theme.fg("success", `✓ ${this.loadMessage}`)));
      else lines.push(row());
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

