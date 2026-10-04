import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobRepository } from "../../../src/infrastructure/db/job-repository";
import { JobRunner } from "../../../src/pipeline/job-runner";
import { ensureAppDirectories } from "../../../src/infrastructure/filesystem/app-directories";
import { presets } from "../../../src/domain/preset";
import { ContentPlanner } from "../../../src/infrastructure/planning/content-planner";
import { defaultSettings } from "../../../src/domain/settings";
it("processes to review, resumes transcript checkpoint and gates export", async () => {
  const dirs = await ensureAppDirectories(
    await mkdtemp(join(tmpdir(), "runner-")),
  );
  const repo = new JobRepository(join(dirs.root, "db.sqlite"));
  let calls = 0;
  const j = repo.create({
    file: "x",
    checksum: "a".repeat(64),
    originalName: "x.mp4",
  });
  for (const s of ["validating", "transcribing", "planning"] as const)
    repo.updateStatus(j.id, s);
  repo.saveCheckpoint(j.id, {
    media: {
      durationMs: 2000,
      width: 160,
      height: 240,
      fps: 30,
      hasAudio: true,
    },
    transcript: { captions: [], warnings: [] },
  });
  const deps = {
    dirs,
    repo,
    inspector: {
      async inspect() {
        return {
          durationMs: 2000,
          width: 160,
          height: 240,
          fps: 30,
          hasAudio: true,
        };
      },
    },
    transcription: {
      async transcribe() {
        calls++;
        return { captions: [], warnings: [] };
      },
    },
    planner: new ContentPlanner(),
    preview: {
      async create(job: any, plan: any) {
        const path = join(dirs.review, job.id + ".mp4");
        await writeFile(path, "preview");
        return { path, revision: plan.revision };
      },
    },
    render: {
      async renderApproved() {
        return { path: "done.mp4", revision: 1 };
      },
    },
    settings: () => defaultSettings,
    assets: async () => [],
    guard: async () => {},
  };
  const runner = new JobRunner(deps);
  await runner.recover();
  await runner.idle();
  expect(repo.findById(j.id)?.status).toBe("awaiting_review");
  expect(calls).toBe(0);
  await expect(runner.approve(j.id, 2)).rejects.toThrow();
  await runner.revise(j.id, "reduce-effects");
  await runner.idle();
  expect(repo.findById(j.id)?.checkpoint.plan.revision).toBe(2);
  expect(calls).toBe(0);
  await runner.approve(j.id, 2);
  await runner.idle();
  expect(repo.findById(j.id)?.status).toBe("completed");
  repo.close();
});
it("keeps the batch moving after an invalid source", async () => {
  const dirs = await ensureAppDirectories(
    await mkdtemp(join(tmpdir(), "fail-")),
  );
  const repo = new JobRepository(":memory:");
  const j = repo.create({
    file: "broken",
    checksum: "b".repeat(64),
    originalName: "bad.mp4",
  });
  const runner = new JobRunner({
    dirs,
    repo,
    guard: async () => {},
    inspector: {
      async inspect() {
        throw new Error("bad");
      },
    },
    settings: () => defaultSettings,
  } as any);
  runner.enqueue(j.id);
  await runner.idle();
  expect(repo.findById(j.id)?.status).toBe("failed_input");
  expect(await readFile(join(dirs.error, j.id + ".json"), "utf8")).toContain(
    "failed_input",
  );
  repo.close();
});
