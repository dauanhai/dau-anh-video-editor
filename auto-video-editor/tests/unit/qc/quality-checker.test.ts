import { it, expect } from "vitest";
import { valid } from "../../fixtures/plan";
import { checkPlan } from "../../../src/infrastructure/qc/quality-checker";
import { detectPrivacy } from "../../../src/infrastructure/qc/privacy-detector";
it("rejects gaps and out-of-bounds captions", () => {
  expect(() =>
    checkPlan({
      ...valid,
      segments: [{ ...valid.segments[0], startMs: 100 }],
    } as any),
  ).toThrow("TIMELINE");
  expect(() =>
    checkPlan({
      ...valid,
      captions: [
        {
          text: "x",
          startMs: 0,
          endMs: 3000,
          timestampMs: null,
          confidence: null,
        },
      ],
    } as any),
  ).toThrow("CAPTION");
});
it("warns for sensitive transcript patterns without storing matches", () => {
  const warnings = detectPrivacy(
    "Hộ chiếu B1234567. Sinh ngày 01/02/2000. Gọi 0912345678.",
  );
  expect(warnings).toContain("PERSONAL_DATA_PASSPORT");
  expect(warnings.join(" ")).not.toContain("B1234567");
});
