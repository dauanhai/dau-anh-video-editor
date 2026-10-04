import { it, expect } from "vitest";
import { JobRepository } from "../../../src/infrastructure/db/job-repository";
import { transitionJob } from "../../../src/pipeline/job-state-machine";
it("persists unique checksums and checkpoints", () => {
  const repo = new JobRepository(":memory:");
  const j = repo.create({
    file: "a.mp4",
    checksum: "a".repeat(64),
    originalName: "a.mp4",
  });
  expect(repo.findById(j.id)?.status).toBe("discovered");
  expect(() =>
    repo.create({ file: "b.mp4", checksum: j.checksum, originalName: "b.mp4" }),
  ).toThrow();
  repo.saveCheckpoint(j.id, { media: { durationMs: 1000 } });
  expect(repo.findByChecksum(j.checksum)?.checkpoint.media.durationMs).toBe(
    1000,
  );
  repo.updateStatus(j.id, "validating");
  expect(repo.listByStatus(["validating"])).toHaveLength(1);
  repo.close();
});
it("gates state changes and allows failed render retry", () => {
  expect(() => transitionJob("discovered", "rendering")).toThrow();
  expect(() => transitionJob("completed", "planning")).toThrow();
  expect(transitionJob("failed_render", "rendering")).toBe("rendering");
});
