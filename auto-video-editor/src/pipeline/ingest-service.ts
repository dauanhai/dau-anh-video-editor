import { copyFile, mkdir, open, unlink, lstat } from "node:fs/promises";
import { basename, join, extname } from "node:path";
import type { AppDirectories } from "../infrastructure/filesystem/app-directories";
import { fingerprintFile } from "../infrastructure/filesystem/file-fingerprint";
import { safeExisting } from "../infrastructure/filesystem/atomic-file";
import { JobRepository } from "../infrastructure/db/job-repository";
export class IngestService {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private repo: JobRepository,
    private dirs: AppDirectories,
    private guard: (estimate?: number) => Promise<void>,
  ) {}
  ingest(path: string): Promise<any> {
    const next = this.tail.then(() => this.accept(path));
    this.tail = next.catch(() => {});
    return next;
  }
  private async accept(path: string) {
    await this.guard((await lstat(path)).size);
    if ((await lstat(path)).isSymbolicLink())
      throw new Error("SYMLINK_NOT_ALLOWED");
    path = await safeExisting(this.dirs.inbox, path);
    if (![".mp4", ".mov", ".m4v"].includes(extname(path).toLowerCase()))
      throw new Error("UNSUPPORTED_MEDIA");
    const fingerprint = await fingerprintFile(path),
      duplicate = this.repo.findByChecksum(fingerprint.sha256);
    if (duplicate) return { kind: "duplicate", duplicateOfJobId: duplicate.id };
    const folder = join(this.dirs.processing, fingerprint.sha256);
    await mkdir(folder, { recursive: true });
    const target = join(folder, "source" + extname(path).toLowerCase());
    try {
      await copyFile(path, target);
    } catch (error) {
      await unlink(target).catch(() => {});
      throw error;
    }
    const h = await open(target, "r+");
    try {
      await h.sync();
    } finally {
      await h.close();
    }
    if (
      (await fingerprintFile(target)).sha256 !== fingerprint.sha256 ||
      (await fingerprintFile(path)).sha256 !== fingerprint.sha256
    ) {
      await unlink(target);
      throw new Error("SOURCE_CHANGED");
    }
    const job = this.repo.create({
      file: target,
      originalName: basename(path),
      checksum: fingerprint.sha256,
    });
    return { kind: "created", job };
  }
}
