import { watch } from "chokidar";
import { stat, lstat, open, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export class StabilityTracker {
  private seen = new Map<
    string,
    { size: number; mtime: number; since: number }
  >();
  constructor(private stableMs: number) {}
  observe(path: string, size: number, mtime: number, now: number) {
    const old = this.seen.get(path);
    if (!old || old.size !== size || old.mtime !== mtime) {
      this.seen.set(path, { size, mtime, since: now });
      return false;
    }
    return now - old.since >= this.stableMs;
  }
}
async function assertExclusive(path: string) {
  if (process.platform === "win32") {
    await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$ErrorActionPreference='Stop'; $h=[System.IO.File]::Open($env:DAU_ANH_CHECK_FILE,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::None); $h.Dispose()",
      ],
      {
        env: { ...process.env, DAU_ANH_CHECK_FILE: path },
        timeout: 10000,
        windowsHide: true,
      },
    );
  } else {
    const h = await open(path, "r");
    await h.close();
  }
}
export class InboxWatcher {
  private watcher: ReturnType<typeof watch> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handled = new Map<string, string>();
  private pending = new Set<string>();
  constructor(
    private root: string,
    private stableMs = 10000,
    private onError: (e: unknown) => void = () => {},
  ) {}
  setStabilityMs(ms: number) {
    this.stableMs = ms;
  }
  async start(callback: (p: string) => Promise<void>) {
    const tracker = new StabilityTracker(this.stableMs);
    const handle = async (p: string) => {
      if (this.pending.has(p)) return;
      this.pending.add(p);
      try {
        if (
          ![".mp4", ".mov", ".m4v"].includes(extname(p).toLowerCase()) ||
          (await lstat(p)).isSymbolicLink()
        )
          return;
        const a = await stat(p),
          version = `${a.size}:${a.mtimeMs}`;
        if (this.handled.get(p) === version) return;
        await assertExclusive(p);
        const b = await stat(p);
        if (a.size !== b.size || a.mtimeMs !== b.mtimeMs) return;
        await callback(p);
        this.handled.set(p, version);
      } catch (e) {
        this.onError(e);
      } finally {
        this.pending.delete(p);
      }
    };
    this.watcher = watch(this.root, {
      depth: 0,
      ignoreInitial: false,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: this.stableMs,
        pollInterval: 100,
      },
      ignored: (p) => /\.(tmp|part|crdownload)$/i.test(p),
    });
    this.watcher.on("add", (p) => void handle(p));
    this.watcher.on("change", (p) => void handle(p));
    this.watcher.on("error", this.onError);
    this.timer = setInterval(
      () => {
        void (async () => {
          for (const entry of await readdir(this.root, {
            withFileTypes: true,
          })) {
            if (!entry.isFile()) continue;
            const p = join(this.root, entry.name),
              s = await stat(p);
            if (tracker.observe(p, s.size, s.mtimeMs, Date.now()))
              await handle(p);
          }
        })().catch(this.onError);
      },
      Math.max(1000, this.stableMs),
    );
    this.timer.unref();
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.watcher?.close();
    while (this.pending.size) await new Promise((r) => setTimeout(r, 10));
    this.watcher = null;
  }
}
