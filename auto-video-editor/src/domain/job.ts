export const jobStatuses = [
  "discovered",
  "validating",
  "transcribing",
  "planning",
  "assembling",
  "previewing",
  "awaiting_review",
  "rendering",
  "completed",
  "blocked_missing_asset",
  "failed_input",
  "failed_transcription",
  "failed_planning",
  "failed_preview",
  "failed_render",
  "cancelled",
] as const;
export type JobStatus = (typeof jobStatuses)[number];
export type Job = {
  id: string;
  file: string;
  originalName: string;
  checksum: string;
  status: JobStatus;
  checkpoint: Record<string, any>;
  error: string | null;
  approvedRevision: number | null;
  createdAt: string;
  updatedAt: string;
};
export type NewJob = Pick<Job, "file" | "originalName" | "checksum">;
