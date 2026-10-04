import { it, expect } from "vitest";
import { estimateCapacity } from "../../../src/infrastructure/filesystem/disk-space-guard";
it("source snapshot alone cannot exceed free capacity and duration increases render estimate", () => {
  expect(
    estimateCapacity({ sourceBytes: 12 * 1024 ** 3, durationMs: 1000 }),
  ).toBeGreaterThan(12 * 1024 ** 3);
  expect(
    estimateCapacity({ sourceBytes: 1000, durationMs: 3600000 }),
  ).toBeGreaterThan(estimateCapacity({ sourceBytes: 1000, durationMs: 1000 }));
});
