import { it, expect } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobRunner } from "../../../src/pipeline/job-runner";
import { JobRepository } from "../../../src/infrastructure/db/job-repository";
import { ensureAppDirectories } from "../../../src/infrastructure/filesystem/app-directories";
import { ContentPlanner } from "../../../src/infrastructure/planning/content-planner";
import { defaultSettings } from "../../../src/domain/settings";
import { valid } from "../../fixtures/plan";
import { InboxWatcher } from "../../../src/infrastructure/filesystem/inbox-watcher";
it("rejects approval and cancellation while a revision write is pending", async () => {
  const dirs = await ensureAppDirectories(
      await mkdtemp(join(tmpdir(), "race-")),
    ),
    repo = new JobRepository(":memory:");
  const j = repo.create({
    file: "x",
    checksum: "a".repeat(64),
    originalName: "x",
  });
  for (const s of [
    "validating",
    "transcribing",
    "planning",
    "assembling",
    "previewing",
    "awaiting_review",
  ] as const)
    repo.updateStatus(j.id, s);
  repo.saveCheckpoint(j.id, {
    media: { durationMs: 2000, hasAudio: false },
    transcript: { captions: [], warnings: [] },
    plan: { ...valid, jobId: j.id },
    previewRevision: 1,
  });
  const runner = new JobRunner({
    dirs,
    repo,
    planner: new ContentPlanner(),
    guard: async () => {},
    settings: () => defaultSettings,
    preview: {
      async create() {
        return { path: join(dirs.review, "p.mp4"), revision: 2 };
      },
    },
  } as any);
  const revision = runner.revise(j.id, "reduce-effects");
  await expect(runner.approve(j.id, 1)).rejects.toThrow("JOB_BUSY");
  expect(() => runner.cancel(j.id)).toThrow("JOB_BUSY");
  await revision;
  await runner.idle();
  expect(repo.findById(j.id)?.approvedRevision).toBeNull();
  repo.close();
});
it("report failure does not reject the queue or block later jobs", async () => {
  const dirs = await ensureAppDirectories(
    await mkdtemp(join(tmpdir(), "report-")),
  );
  await rm(dirs.error, { recursive: true });
  await writeFile(dirs.error, "blocked");
  const repo = new JobRepository(":memory:");
  const jobs = ["a", "b"].map((c) =>
    repo.create({ file: c, checksum: c.repeat(64), originalName: c }),
  );
  const runner = new JobRunner({
    dirs,
    repo,
    guard: async () => {},
    settings: () => defaultSettings,
    inspector: {
      async inspect() {
        throw new Error("bad");
      },
    },
  } as any);
  for (const j of jobs) runner.enqueue(j.id);
  await runner.idle();
  expect(repo.list().map((j) => j.status)).toEqual([
    "failed_input",
    "failed_input",
  ]);
  repo.close();
});
it("real watcher reconsideres stable changes to existing files", async () => {
  const root = await mkdtemp(join(tmpdir(), "watch-")),
    file = join(root, "source.mp4"),
    seen: string[] = [];
  const watcher = new InboxWatcher(root, 100);
  await watcher.start(async (path) => {
    seen.push(path);
  });
  try {
    await writeFile(file, "first-half");
    await new Promise((r) => setTimeout(r, 1500));
    expect(seen.length).toBe(1);
    await writeFile(file, "complete-file");
    await new Promise((r) => setTimeout(r, 1500));
    expect(seen.length).toBe(2);
  } finally {
    await watcher.stop();
  }
});
