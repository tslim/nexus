import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile, execSync } from "node:child_process";

export function readLatestBackup(cwd: string): string | undefined {
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

export function runMemoryBackup(cwd: string): void {
  const script = join(cwd, ".claude", "skills", "memory-backup", "backup.sh");
  if (!existsSync(script)) return;

  execFile("bash", [script], { cwd }, () => {
    // best-effort only
  });
}

