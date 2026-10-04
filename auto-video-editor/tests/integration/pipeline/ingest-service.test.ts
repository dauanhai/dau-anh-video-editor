import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureAppDirectories } from "../../../src/infrastructure/filesystem/app-directories";
import { JobRepository } from "../../../src/infrastructure/db/job-repository";
import { IngestService } from "../../../src/pipeline/ingest-service";
import { StabilityTracker } from "../../../src/infrastructure/filesystem/inbox-watcher";
it("waits for stable metadata", () => {
  const tracker = new StabilityTracker(100);
  expect(tracker.observe("x", 1, 1, 0)).toBe(false);
  expect(tracker.observe("x", 2, 2, 100)).toBe(false);
  expect(tracker.observe("x", 2, 2, 150)).toBe(false);
  expect(tracker.observe("x", 2, 2, 250)).toBe(true);
});
it("deduplicates renamed footage without deleting originals", async () => {
  const dirs = await ensureAppDirectories(
    await mkdtemp(join(tmpdir(), "ingest-")),
  );
  const repo = new JobRepository(":memory:");
  const service = new IngestService(repo, dirs, async () => {});
  const a = join(dirs.inbox, "a.mp4"),
    b = join(dirs.inbox, "b.mp4");
  await writeFile(a, "video");
  await writeFile(b, "video");
  const first = await service.ingest(a);
  const second = await service.ingest(b);
  expect(first.kind).toBe("created");
  expect(second.kind).toBe("duplicate");
  expect(await readFile(a, "utf8")).toBe("video");
  expect(repo.list()).toHaveLength(1);
  repo.close();
});
it("rejects sources outside inbox and symlink escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "escape-"));
  const dirs = await ensureAppDirectories(root);
  const outside = join(root, "private.mp4");
  await writeFile(outside, "private");
  const link = join(dirs.inbox, "link.mp4");
  await symlink(outside, link);
  const repo = new JobRepository(":memory:");
  const s = new IngestService(repo, dirs, async () => {});
  await expect(s.ingest(outside)).rejects.toThrow();
  await expect(s.ingest(link)).rejects.toThrow();
  repo.close();
});
