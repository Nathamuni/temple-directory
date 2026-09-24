import fs from "fs";
import path from "path";
import { APP_DIR, ensureDataDir } from "../dataDir";

/**
 * The one place account-side data touches the disk.
 *
 * Every read-modify-write here is synchronous, so within one Node process it
 * cannot interleave with another request's write. That makes it correct for a
 * single instance (local dev, one Render instance with a disk) and wrong for
 * several instances sharing a volume — that is the point at which this module
 * is swapped for a database, and nothing outside src/lib/store should notice.
 */

function filePath(name: string): string {
  ensureDataDir();
  fs.mkdirSync(APP_DIR, { recursive: true });
  return path.join(APP_DIR, name);
}

/** Writes via a temp file + rename, so a crash mid-write never leaves half a file. */
function writeAtomic(target: string, contents: string): void {
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, target);
}

export function readJson<T>(name: string, fallback: T): T {
  const file = filePath(name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJson<T>(name: string, value: T): void {
  writeAtomic(filePath(name), JSON.stringify(value, null, 2) + "\n");
}

/** Read, change, write back — the only way callers should mutate a collection. */
export function updateJson<T>(name: string, fallback: T, change: (current: T) => T): T {
  const next = change(readJson(name, fallback));
  writeJson(name, next);
  return next;
}

/** Append-only line log (one JSON object per line). */
export function appendLine(name: string, value: unknown): void {
  fs.appendFileSync(filePath(name), JSON.stringify(value) + "\n", "utf8");
}

export function readLines<T>(name: string): T[] {
  const file = filePath(name);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
