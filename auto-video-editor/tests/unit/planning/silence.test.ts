import { it, expect } from "vitest";
import { ContentPlanner } from "../../../src/infrastructure/planning/content-planner";
import { presets } from "../../../src/domain/preset";
it("cuts only approved dead intervals and maps captions to the new timeline", async () => {
  const p = await new ContentPlanner().plan({
    jobId: "j",
    checksum: "a".repeat(64),
    file: "x",
    media: { durationMs: 6000, hasAudio: true },
    transcript: [
      {
        text: "Xin chào",
        startMs: 3000,
        endMs: 5000,
        timestampMs: 4000,
        confidence: null,
      },
    ],
    deadRanges: [
      { startMs: 1000, endMs: 2000 },
      { startMs: 3500, endMs: 4500 },
    ],
    preset: presets.expert,
    assets: [],
    brand: { name: "", cta: "", color: "#a78bfa", font: "Arial" },
  });
  expect(p.durationMs).toBe(5000);
  expect(p.captions[0].startMs).toBe(2000);
  expect(p.captions[0].endMs).toBe(4000);
  expect(p.segments).toHaveLength(2);
});
