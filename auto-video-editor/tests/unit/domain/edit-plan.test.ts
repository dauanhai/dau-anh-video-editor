import { describe, it, expect } from "vitest";
import { editPlanSchema } from "../../../src/domain/edit-plan";
import { valid } from "../../fixtures/plan";
describe("EditPlan contract", () => {
  it("accepts millisecond timeline", () =>
    expect(editPlanSchema.safeParse(valid).success).toBe(true));
  it.each([{ inMs: -1 }, { outMs: 0 }, { startMs: -1 }])(
    "rejects invalid segment %j",
    (patch) =>
      expect(
        editPlanSchema.safeParse({
          ...valid,
          segments: [{ ...valid.segments[0], ...patch }],
        }).success,
      ).toBe(false),
  );
  it("requires preset version", () =>
    expect(
      editPlanSchema.safeParse({ ...valid, preset: { id: "expert" } }).success,
    ).toBe(false));
  it("requires caption timing", () =>
    expect(
      editPlanSchema.safeParse({ ...valid, captions: [{ text: "Xin chào" }] })
        .success,
    ).toBe(false));
});
