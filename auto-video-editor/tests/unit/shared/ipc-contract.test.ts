import { it, expect } from "vitest";
import { ipcRequestSchema } from "../../../src/shared/ipc-contract";
it("rejects arbitrary IPC operations and limits notes", () => {
  expect(
    ipcRequestSchema.safeParse({ method: "exec", args: { cmd: "x" } }).success,
  ).toBe(false);
  expect(
    ipcRequestSchema.safeParse({
      method: "reviseJob",
      args: { id: "j", command: "custom-note", note: "a".repeat(501) },
    }).success,
  ).toBe(false);
  expect(
    ipcRequestSchema.safeParse({
      method: "openFolder",
      args: { folder: "../../" },
    }).success,
  ).toBe(false);
});
