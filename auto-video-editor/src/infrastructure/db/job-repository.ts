import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { Job, NewJob, JobStatus } from "../../domain/job";
import { transitionJob } from "../../pipeline/job-state-machine";
export class JobRepository {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,checksum TEXT UNIQUE NOT NULL,file TEXT NOT NULL,originalName TEXT NOT NULL,status TEXT NOT NULL,checkpoint TEXT NOT NULL,error TEXT,approvedRevision INTEGER,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,jobId TEXT,event TEXT,at TEXT);`,
    );
  }
  private decode(row: any): Job | null {
    return row ? { ...row, checkpoint: JSON.parse(row.checkpoint) } : null;
  }
  create(input: NewJob): Job {
    const now = new Date().toISOString(),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        input.checksum,
        input.file,
        input.originalName,
        "discovered",
        "{}",
        null,
        null,
        now,
        now,
      );
    return this.findById(id)!;
  }
  findById(id: string) {
    return this.decode(
      this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id),
    );
  }
  findByChecksum(checksum: string) {
    return this.decode(
      this.db.prepare("SELECT * FROM jobs WHERE checksum=?").get(checksum),
    );
  }
  list(): Job[] {
    return this.db
      .prepare("SELECT * FROM jobs ORDER BY createdAt")
      .all()
      .map((r) => this.decode(r)!);
  }
  listByStatus(statuses: JobStatus[]) {
    return this.list().filter((j) => statuses.includes(j.status));
  }
  updateStatus(id: string, status: JobStatus, error: string | null = null) {
    const current = this.findById(id);
    if (!current) throw new Error("JOB_NOT_FOUND");
    transitionJob(current.status, status);
    this.db
      .prepare("UPDATE jobs SET status=?,error=?,updatedAt=? WHERE id=?")
      .run(status, error, new Date().toISOString(), id);
    this.event(id, { status, error });
    return this.findById(id)!;
  }
  saveCheckpoint(id: string, checkpoint: Record<string, any>) {
    const j = this.findById(id);
    if (!j) throw new Error("JOB_NOT_FOUND");
    this.db
      .prepare("UPDATE jobs SET checkpoint=?,updatedAt=? WHERE id=?")
      .run(
        JSON.stringify({ ...j.checkpoint, ...checkpoint }),
        new Date().toISOString(),
        id,
      );
  }
  approve(id: string, revision: number) {
    const j = this.findById(id);
    if (
      !j ||
      j.status !== "awaiting_review" ||
      j.checkpoint.plan?.revision !== revision ||
      j.checkpoint.previewRevision !== revision
    )
      throw new Error("APPROVAL_REQUIRES_CURRENT_PREVIEW");
    this.db
      .prepare("UPDATE jobs SET approvedRevision=?,updatedAt=? WHERE id=?")
      .run(revision, new Date().toISOString(), id);
  }
  invalidateApproval(id: string) {
    this.db.prepare("UPDATE jobs SET approvedRevision=NULL WHERE id=?").run(id);
  }
  event(id: string, event: unknown) {
    this.db
      .prepare("INSERT INTO events(jobId,event,at) VALUES(?,?,?)")
      .run(id, JSON.stringify(event), new Date().toISOString());
  }
  events(id: string) {
    return this.db
      .prepare("SELECT event,at FROM events WHERE jobId=? ORDER BY id")
      .all();
  }
  close() {
    this.db.close();
  }
}
