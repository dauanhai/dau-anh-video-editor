import { EventEmitter } from "node:events";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { Job, JobStatus } from "../domain/job";
import type { AppSettings } from "../domain/settings";
import type { EditPlan } from "../domain/edit-plan";
import { presets } from "../domain/preset";
import type { AppDirectories } from "../infrastructure/filesystem/app-directories";
import { atomicJson } from "../infrastructure/filesystem/atomic-file";
import { JobRepository } from "../infrastructure/db/job-repository";
import { ContentPlanner } from "../infrastructure/planning/content-planner";
import { detectPrivacy } from "../infrastructure/qc/privacy-detector";
import type { Asset } from "../infrastructure/assets/asset-matcher";
import { checkPlan } from "../infrastructure/qc/quality-checker";
type Deps = {
  dirs: AppDirectories;
  repo: JobRepository;
  inspector: { inspect(file: string): Promise<any> };
  transcription: { transcribe(job: Job, media: any): Promise<any> };
  planner: ContentPlanner;
  preview: {
    create(
      job: Job,
      plan: EditPlan,
    ): Promise<{ path: string; revision: number }>;
  };
  render: {
    renderApproved(
      job: Job,
      plan: EditPlan,
    ): Promise<{ path: string; revision: number }>;
  };
  settings: () => AppSettings;
  assets: () => Promise<Asset[]>;
  guard: (estimate?: number) => Promise<void>;
  freeze?: (plan: EditPlan) => Promise<EditPlan>;
  silence?: { detect(file: string, durationMs: number): Promise<any[]> };
};
const processing: JobStatus[] = [
  "discovered",
  "validating",
  "transcribing",
  "planning",
  "assembling",
  "previewing",
  "rendering",
];
export class JobRunner extends EventEmitter {
  private queue: string[] = [];
  private mutating = new Set<string>();
  private running = false;
  private current: string | null = null;
  private stopped = false;
  private waiters: (() => void)[] = [];
  constructor(private d: Deps) {
    super();
  }
  enqueue(id: string) {
    if (!this.queue.includes(id) && this.current !== id) this.queue.push(id);
    void this.pump().catch((error) => this.emit("fault", error));
  }
  async start() {
    this.stopped = false;
    await this.recover();
  }
  async stop() {
    this.stopped = true;
    await this.idle();
  }
  idle() {
    if (!this.running && (!this.queue.length || this.stopped))
      return Promise.resolve();
    return new Promise<void>((r) => this.waiters.push(r));
  }
  private state(id: string, status: JobStatus, error: string | null = null) {
    this.d.repo.saveCheckpoint(id, {
      progress:
        status === "completed"
          ? 100
          : Math.max(0, processing.indexOf(status)) * 10,
    });
    const j = this.d.repo.updateStatus(id, status, error);
    this.emit("change", j);
    return j;
  }
  private async pump() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.queue.length && !this.stopped) {
        const id = this.queue.shift()!;
        this.current = id;
        try {
          await this.process(id);
        } catch (error) {
          this.emit("fault", error);
        } finally {
          this.current = null;
        }
      }
    } finally {
      this.running = false;
      this.waiters.splice(0).forEach((r) => r());
    }
  }
  async recover() {
    for (const j of this.d.repo.listByStatus(processing)) this.enqueue(j.id);
  }
  private async process(id: string) {
    let stage: JobStatus = "validating";
    const { repo, dirs } = this.d;
    try {
      let job = repo.findById(id);
      if (!job || !processing.includes(job.status)) return;
      await this.d.guard();
      if (job.status === "rendering") {
        stage = "rendering";
        await this.exportJob(job);
        return;
      }
      if (job.status === "discovered") job = this.state(id, "validating");
      let media = job.checkpoint.media;
      if (!media) {
        media = await this.d.inspector.inspect(job.file);
        if (media.durationMs > this.d.settings().maxDurationMs)
          throw new Error("VIDEO_TOO_LONG");
        repo.saveCheckpoint(id, { media });
      }
      if (job.status === "validating") job = this.state(id, "transcribing");
      stage = "transcribing";
      let transcript = job.checkpoint.transcript;
      if (!transcript) {
        transcript = await this.d.transcription.transcribe(job, media);
        repo.saveCheckpoint(id, { transcript });
      }
      if (job.status === "transcribing") job = this.state(id, "planning");
      stage = "planning";
      const deadRanges =
        job.checkpoint.deadRanges ??
        (media.hasAudio && this.d.silence
          ? await this.d.silence.detect(job.file, media.durationMs)
          : []);
      repo.saveCheckpoint(id, { deadRanges });
      let plan = repo.findById(id)!.checkpoint.plan as EditPlan | undefined;
      if (!plan) {
        const s = this.d.settings();
        const tracks = (await readdir(dirs.music))
          .filter((n) => /\.(mp3|wav|m4a)$/i.test(n))
          .sort();
        plan = await this.d.planner.plan({
          deadRanges,
          jobId: id,
          checksum: job.checksum,
          file: job.file,
          media,
          transcript: transcript.captions,
          preset: presets[s.preset],
          assets: await this.d.assets(),
          brand: s.brand,
          music: tracks[0] ? join(dirs.music, tracks[0]) : undefined,
        });
        if (this.d.freeze) plan = await this.d.freeze(plan);
        plan.warnings = [
          ...new Set([
            ...plan.warnings,
            ...transcript.warnings,
            ...detectPrivacy(
              transcript.captions.map((c: any) => c.text).join(" "),
            ),
          ]),
        ];
        await atomicJson(
          join(dirs.plans, id + `.r${plan.revision}.json`),
          plan,
        );
        repo.saveCheckpoint(id, { plan });
      }
      checkPlan(plan);
      if (job.status === "planning") job = this.state(id, "assembling");
      if (job.status === "assembling") job = this.state(id, "previewing");
      stage = "previewing";
      let preview = repo.findById(id)!.checkpoint.previewPath;
      const rev = repo.findById(id)!.checkpoint.previewRevision;
      let exists = false;
      if (preview && rev === plan.revision) {
        try {
          await access(preview);
          exists = true;
        } catch {}
      }
      if (!exists) {
        const result = await this.withRetry(id, () =>
          this.d.preview.create(repo.findById(id)!, plan!),
        );
        preview = result.path;
        repo.saveCheckpoint(id, {
          previewPath: preview,
          previewRevision: plan.revision,
        });
      }
      this.state(id, "awaiting_review");
    } catch (error) {
      const current = repo.findById(id);
      if (!current || current.status === "cancelled") return;
      const status: JobStatus =
        stage === "rendering"
          ? "failed_render"
          : stage === "previewing"
            ? "failed_preview"
            : stage === "planning"
              ? "failed_planning"
              : stage === "transcribing"
                ? "failed_transcription"
                : "failed_input";
      const message =
        error instanceof Error ? error.message : "PROCESSING_ERROR";
      this.state(id, status, message);
      await atomicJson(join(dirs.error, id + ".json"), {
        jobId: id,
        status,
        error: message,
        at: new Date().toISOString(),
      }).catch((reportError) => {
        repo.event(id, { reportError: "ERROR_REPORT_UNAVAILABLE" });
        this.emit("fault", reportError);
      });
    }
  }
  private async withRetry<T>(id: string, fn: () => Promise<T>) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fn();
      } catch (e) {
        this.d.repo.event(id, {
          attempt,
          error: e instanceof Error ? e.message : "RENDER_ERROR",
        });
        if (attempt === 3) throw e;
      }
    }
    throw new Error("RETRY_EXHAUSTED");
  }
  private async exportJob(job: Job) {
    const plan = job.checkpoint.plan;
    const result = await this.withRetry(job.id, () =>
      this.d.render.renderApproved(job, plan),
    );
    this.d.repo.saveCheckpoint(job.id, {
      outputPath: result.path,
      outputRevision: result.revision,
    });
    this.state(job.id, "completed");
  }
  async approve(id: string, revision: number) {
    if (this.current === id || this.mutating.has(id))
      throw new Error("JOB_BUSY");
    this.d.repo.approve(id, revision);
    this.state(id, "rendering");
    this.enqueue(id);
  }
  async revise(id: string, command: string, note = "") {
    if (this.mutating.has(id)) throw new Error("JOB_BUSY");
    this.mutating.add(id);
    try {
      const j = this.d.repo.findById(id);
      if (!j || j.status !== "awaiting_review" || this.current === id)
        throw new Error("JOB_NOT_READY");
      if (note.length > 500) throw new Error("NOTE_TOO_LONG");
      const plan = this.d.planner.revise(j.checkpoint.plan, command);
      if (command === "custom-note")
        plan.warnings.push("MANUAL_NOTE_REQUIRES_EDITOR");
      this.d.repo.invalidateApproval(id);
      await atomicJson(
        join(this.d.dirs.plans, id + `.r${plan.revision}.json`),
        plan,
      );
      this.d.repo.saveCheckpoint(id, {
        plan,
        note,
        previewPath: null,
        previewRevision: null,
      });
      this.state(id, "assembling");
      this.enqueue(id);
    } finally {
      this.mutating.delete(id);
    }
  }
  cancel(id: string) {
    if (this.current === id || this.mutating.has(id))
      throw new Error("JOB_BUSY");
    this.queue = this.queue.filter((x) => x !== id);
    this.state(id, "cancelled");
  }
  retry(id: string) {
    const j = this.d.repo.findById(id);
    const map: Partial<Record<JobStatus, JobStatus>> = {
      failed_input: "validating",
      failed_transcription: "transcribing",
      failed_planning: "planning",
      failed_preview: "previewing",
      failed_render: "rendering",
    };
    if (!j || !map[j.status]) throw new Error("NOT_RETRYABLE");
    this.state(id, map[j.status]!);
    this.enqueue(id);
  }
}
