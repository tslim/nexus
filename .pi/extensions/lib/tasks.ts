import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 8;

export type TaskItem = {
  lineIndex: number;
  display: string;
  done: boolean;
};

export type TaskCategory = {
  name: string;
  tasks: TaskItem[];
};

export type TaskBoard = {
  categories: TaskCategory[];
  totalCount: number;
  error?: string;
};

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

export function readTaskCategories(cwd: string): TaskBoard {
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

function readTaskItemLines(cwd: string): { tasks: TaskItem[]; totalCount: number; error?: string } {
  const result = readTaskCategories(cwd);
  const active = result.categories.find((category) => category.name.toLowerCase() === "active");
  return {
    tasks: (active?.tasks ?? []).filter((task) => !task.done),
    totalCount: result.totalCount,
    error: result.error ?? (active ? undefined : "No ## Active section found"),
  };
}

function findSectionHeadingIndex(lines: string[], sectionName: string): number {
  return lines.findIndex((line) => /^##\s+/.test(line) && line.trim().toLowerCase() === `## ${sectionName.toLowerCase()}`);
}

function getTaskBody(line: string): string {
  const doneMatch = line.match(/^\s*- \[[xX]\]\s+~~(.+?)~~(?:\s*\(\d{4}-\d{2}-\d{2}\))?\s*$/);
  if (doneMatch) return doneMatch[1]!.trim();

  const openMatch = line.match(/^\s*- \[ \]\s+(.+)$/);
  if (openMatch) return openMatch[1]!.trim();

  return line.replace(/^\s*- \[[ xX]\]\s+/, "").trim();
}

function buildTaskLine(body: string, done: boolean, indent = ""): string {
  if (!done) return `${indent}- [ ] ${body}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${indent}- [x] ~~${body}~~ (${today})`;
}

export function previewTaskDoneState(result: TaskBoard, lineIndex: number, done: boolean): TaskBoard {
  const next: TaskBoard = {
    categories: result.categories.map((category) => ({
      name: category.name,
      tasks: category.tasks.map((task) => ({ ...task })),
    })),
    totalCount: result.totalCount,
    error: result.error,
  };

  const category = next.categories.find((current) => current.tasks.some((task) => task.lineIndex === lineIndex));
  if (!category) return result;

  const taskIndex = category.tasks.findIndex((task) => task.lineIndex === lineIndex);
  if (taskIndex < 0) return result;
  const task = category.tasks[taskIndex]!;
  if (task.done === done) return result;

  task.done = done;
  task.display = task.display.replace(/^\s*[☑☐]\s+/, `${done ? "☑" : "☐"} `);

  return next;
}

export function applyTaskDoneChanges(cwd: string, changes: Map<number, boolean>): TaskBoard {
  const tasksPath = join(cwd, "TASKS.md");
  if (!existsSync(tasksPath)) return { categories: [], totalCount: 0, error: "TASKS.md not found" };

  const content = readFileSync(tasksPath, "utf8");
  const originalLines = content.split(/\r?\n/);
  const moves = [...changes.entries()]
    .map(([lineIndex, done]) => ({ lineIndex, done, line: originalLines[lineIndex] }))
    .filter((move): move is { lineIndex: number; done: boolean; line: string } => {
      if (move.line === undefined) return false;
      const isDoneLine = /^\s*- \[[xX]\]\s+/.test(move.line);
      return move.done !== isDoneLine;
    });

  let lines = [...originalLines];
  for (const move of [...moves].sort((a, b) => b.lineIndex - a.lineIndex)) {
    lines.splice(move.lineIndex, 1);
  }

  for (const move of moves) {
    const destinationSection = move.done ? "Done" : "Active";
    const headingIndex = findSectionHeadingIndex(lines, destinationSection);
    if (headingIndex < 0) continue;
    const indent = move.line.match(/^(\s*)/)?.[1] ?? "";
    lines.splice(headingIndex + 1, 0, buildTaskLine(getTaskBody(move.line), move.done, indent));
  }

  writeFileSync(tasksPath, lines.join("\n"), "utf8");
  return readTaskCategories(cwd);
}

export function readTaskItems(cwd: string): { lines: string[]; omitted: number; activeCount: number; totalCount: number; error?: string } {
  const result = readTaskItemLines(cwd);
  return {
    lines: result.tasks.map((task) => task.display).slice(0, MAX_LINES),
    omitted: Math.max(0, result.tasks.length - MAX_LINES),
    activeCount: result.tasks.length,
    totalCount: result.totalCount,
    error: result.error,
  };
}

