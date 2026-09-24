import fs from "fs";
import os from "os";
import path from "path";

/**
 * Points DATA_DIR at a fresh temp directory before any app module is loaded.
 * ensureDataDir() then seeds it from the committed data/, so tests run
 * against the real 63 temples without ever writing to the repo.
 */
export function useTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "temple-dir-test-"));
  process.env.DATA_DIR = dir;
  return dir;
}
