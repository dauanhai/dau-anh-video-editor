import { it, expect } from "vitest";
import { RenderService } from "../../../src/infrastructure/render/render-service";
import { valid } from "../../fixtures/plan";
it("rejects exports before approval and after revision changes", async () => {
  const service = new RenderService({} as any, async () => {});
  const j = {
    id: "test",
    status: "awaiting_review",
    approvedRevision: null,
    checkpoint: { previewRevision: 1 },
  };
  await expect(service.renderApproved(j as any, valid as any)).rejects.toThrow(
    "APPROVAL",
  );
  await expect(
    service.renderApproved(
      { ...j, approvedRevision: 1 } as any,
      { ...valid, revision: 2 } as any,
    ),
  ).rejects.toThrow("APPROVAL");
});
