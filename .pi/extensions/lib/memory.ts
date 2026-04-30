import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export function readMemoryLogLines(cwd: string): string[] {
  const logPath = join(cwd, "memory", "log.md");
  if (!existsSync(logPath)) return [];

  return readFileSync(logPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}\s+\|/.test(line));
}

export function formatMemoryLogLine(line: string): { timestamp: string; description: string } {
  const parts = line.split("|").map((part) => part.trim());
  const timestamp = parts[0] ?? "";
  const action = parts[1] ?? "";
  const subject = parts[2] ?? "";
  const message = parts.slice(3).join(" | ");
  const description = [action, subject, message].filter(Boolean).join(" · ");

  return { timestamp, description };
}

export function readLatestMemoryLog(cwd: string): { timestamp: string; description: string } | undefined {
  const latest = readMemoryLogLines(cwd).at(-1);
  return latest ? formatMemoryLogLine(latest) : undefined;
}

export type MemoryFile = {
  path: string;
  relativePath: string;
};

export function readMemoryFiles(cwd: string): { files: MemoryFile[]; error?: string } {
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

export function fuzzyScore(text: string, query: string): number {
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

