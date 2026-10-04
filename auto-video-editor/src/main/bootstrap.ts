import { freezePlanAssets } from "../infrastructure/render/asset-snapshot";
import { estimateCapacity } from "../infrastructure/filesystem/disk-space-guard";
import { SilenceDetector } from "../infrastructure/media/silence-detector";
import { join, resolve } from "node:path";
import { appendFile } from "node:fs/promises";
import { ensureAppDirectories } from "../infrastructure/filesystem/app-directories";
import { assertCapacity } from "../infrastructure/filesystem/disk-space-guard";
import { JobRepository } from "../infrastructure/db/job-repository";
import { SettingsStore } from "../infrastructure/security/settings-store";
import { MediaInspector } from "../infrastructure/media/media-inspector";
import { LocalWhisperProvider } from "../infrastructure/transcription/transcription-engine";
import { CachedTranscriptionEngine } from "../infrastructure/transcription/cached-transcription-engine";
import { ContentPlanner } from "../infrastructure/planning/content-planner";
import { indexAssets } from "../infrastructure/assets/asset-indexer";
import { MediaServer } from "../infrastructure/render/media-server";
import { RemotionRenderer } from "../infrastructure/render/remotion-bundle";
import { PreviewService } from "../infrastructure/render/preview-service";
import { RenderService } from "../infrastructure/render/render-service";
import { JobRunner } from "../pipeline/job-runner";
import { IngestService } from "../pipeline/ingest-service";
import { InboxWatcher } from "../infrastructure/filesystem/inbox-watcher";
export async function bootstrap(
  root: string,
  project: string,
  packaged = false,
  resources = "",
) {
  const dirs = await ensureAppDirectories(root),
    repo = new JobRepository(dirs.db),
    settings = new SettingsStore(root);
  await settings.load();
  const guard = (estimate = 0) =>
    assertCapacity(
      root,
      Math.max(
        estimate,
        estimateCapacity({
          sourceBytes: estimate,
          durationMs: settings.value.maxDurationMs,
        }),
      ),
      undefined,
      settings.value.minFreeBytes,
    );
  const media = new MediaServer(root);
  await media.start();
  const inspector = new MediaInspector(
      process.env.DAU_ANH_FFPROBE || "ffprobe",
    ),
    transcription = new CachedTranscriptionEngine(
      dirs.transcripts,
      new LocalWhisperProvider(
        packaged
          ? join(resources, "scripts/transcribe.py")
          : join(project, "scripts/transcribe.py"),
      ),
    ),
    planner = new ContentPlanner();
  const renderer = new RemotionRenderer(
    packaged
      ? join(resources, "remotion")
      : join(project, "src/remotion/index.ts"),
    media,
    process.env.DAU_ANH_BROWSER,
    packaged,
    packaged ? join(resources, "remotion-binaries") : undefined,
  );
  const runner = new JobRunner({
    dirs,
    repo,
    inspector,
    transcription,
    planner,
    freeze: (plan) =>
      freezePlanAssets(plan, root, join(dirs.processing, plan.jobId, "assets")),
    silence: new SilenceDetector(),
    preview: new PreviewService(dirs, renderer, guard),
    render: new RenderService(dirs, guard, renderer),
    settings: () => settings.value,
    assets: () => indexAssets(dirs.broll, inspector),
    guard,
  });
  const ingest = new IngestService(repo, dirs, guard);
  const watcher = new InboxWatcher(
    dirs.inbox,
    settings.value.stabilityMs,
    (e) =>
      void log({
        event: "watcher_error",
        error: e instanceof Error ? e.message : "WATCHER_ERROR",
      }),
  );
  async function log(value: unknown) {
    try {
      await appendFile(
        join(dirs.logs, new Date().toISOString().slice(0, 10) + ".jsonl"),
        JSON.stringify(value) + "\n",
      );
    } catch {
      /* Durable job state remains in SQLite if text log storage fails. */
    }
  }
  runner.on(
    "change",
    (j) => void log({ jobId: j.id, status: j.status, at: j.updatedAt }),
  );
  async function syncWatcher() {
    await watcher.stop();
    watcher.setStabilityMs(settings.value.stabilityMs);
    if (settings.value.watch)
      await watcher.start(async (path) => {
        const result = await ingest.ingest(path);
        if (result.kind === "created") runner.enqueue(result.job.id);
      });
  }
  await runner.start();
  await syncWatcher();
  return {
    dirs,
    repo,
    settings,
    runner,
    media,
    syncWatcher,
    async close() {
      await watcher.stop();
      await runner.stop();
      await media.stop();
      repo.close();
    },
  };
}
export type EditorBackend = Awaited<ReturnType<typeof bootstrap>>;
