import { it, expect } from "vitest";
import { ContentPlanner } from "../../../src/infrastructure/planning/content-planner";
import { matchAssets } from "../../../src/infrastructure/assets/asset-matcher";
import { presets } from "../../../src/domain/preset";
it("matches Taiwan dormitory above generic campus and rejects irrelevant assets", () => {
  const assets = [
    { file: "a", tags: ["campus"], durationMs: 5000 },
    { file: "b", tags: ["dormitory", "taiwan"], durationMs: 5000 },
  ];
  expect(matchAssets("ký túc xá Đài Loan", assets)[0].file).toBe("b");
  expect(matchAssets("chăm sóc trẻ em", assets)).toEqual([]);
});
it("plans sourced overlays and revises without inventing claims", async () => {
  const p = new ContentPlanner();
  const plan = await p.plan({
    jobId: "j",
    checksum: "a".repeat(64),
    file: "a.mp4",
    media: { durationMs: 4000, hasAudio: true },
    transcript: [
      {
        text: "Ký túc xá Đài Loan",
        startMs: 0,
        endMs: 2000,
        timestampMs: 1000,
        confidence: null,
      },
    ],
    preset: presets.expert,
    assets: [],
    brand: { name: "", cta: "", color: "#a78bfa", font: "Arial" },
  });
  expect(plan.texts[0].text).toBe("Ký túc xá Đài Loan");
  expect(JSON.stringify(plan)).not.toContain("100% đỗ visa");
  const revised = p.revise(plan, "reduce-effects");
  expect(revised.revision).toBe(2);
  expect(revised.sourceChecksum).toBe(plan.sourceChecksum);
  expect(revised.captions).toEqual(plan.captions);
});
