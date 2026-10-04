import type { JobStatus } from "../domain/job";
const flow: JobStatus[] = [
  "discovered",
  "validating",
  "transcribing",
  "planning",
  "assembling",
  "previewing",
  "awaiting_review",
  "rendering",
  "completed",
];
export function transitionJob(current: JobStatus, next: JobStatus) {
  if (current === next) return next;
  const failure =
    next.startsWith("failed_") || next === "blocked_missing_asset";
  const retry: Partial<Record<JobStatus, JobStatus[]>> = {
    failed_input: ["validating"],
    failed_transcription: ["transcribing"],
    failed_planning: ["planning"],
    failed_preview: ["previewing"],
    failed_render: ["rendering"],
    blocked_missing_asset: ["assembling"],
    awaiting_review: ["assembling"],
  };
  if (
    (current !== "completed" &&
      current !== "cancelled" &&
      (failure || next === "cancelled")) ||
    flow[flow.indexOf(current) + 1] === next ||
    (retry[current] ?? []).includes(next)
  )
    return next;
  throw new Error(`INVALID_TRANSITION: ${current} -> ${next}`);
}
