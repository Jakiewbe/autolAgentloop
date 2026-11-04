// Each test file runs in its own process with its own home and the fixture rules; modules are imported after this sets
// the environment they read.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

/**
 * Removes a test's home. Windows refuses to delete a database file another handle in this process still has open, and
 * this process keeps its hub open until it exits, so the retry then the two errors that means are what is left: a
 * temporary folder not deleted is not a failed test.
 */
function removeHome(directory: string) {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EBUSY") throw error;
  }
}

export function setup(name: string, rules = "rules.fixture.json") {
  const directory = mkdtempSync(join(tmpdir(), `agent-autoloop-${name}-`));
  process.env.AGENT_AUTOLOOP_HOME = directory;
  // Where Windows keeps a startup script is this test's own folder, never the one the owner signs in with.
  if (process.platform === "win32") process.env.APPDATA = join(directory, "appdata");
  process.env.AGENT_AUTOLOOP_RULES = rules.startsWith("/") ? rules : join(import.meta.dirname, rules);
  process.env.AGENT_AUTOLOOP_PUBLIC_URL = "https://hub.test";
  after(() => removeHome(directory));
  return directory;
}

/** A moment in a test's own time, minutes after a fixed start: 10:00 in Asia/Shanghai. */
export const at = (minutes: number) => Date.parse("2026-10-18T02:00:00.000Z") + minutes * 60_000;
