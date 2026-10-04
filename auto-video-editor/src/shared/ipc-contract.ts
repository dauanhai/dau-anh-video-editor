import { z } from "zod";
import { appSettingsSchema } from "../domain/settings";
const id = z.string().min(1).max(100);
export const ipcRequestSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("listJobs"), args: z.object({}).strict() }),
  z.object({ method: z.literal("getJob"), args: z.object({ id }).strict() }),
  z.object({
    method: z.literal("approveJob"),
    args: z.object({ id, revision: z.number().int().positive() }).strict(),
  }),
  z.object({
    method: z.literal("reviseJob"),
    args: z
      .object({
        id,
        command: z.enum(["reduce-effects", "change-music", "custom-note"]),
        note: z.string().max(500).optional(),
      })
      .strict(),
  }),
  z.object({ method: z.literal("cancelJob"), args: z.object({ id }).strict() }),
  z.object({ method: z.literal("retryJob"), args: z.object({ id }).strict() }),
  z.object({ method: z.literal("getSettings"), args: z.object({}).strict() }),
  z.object({ method: z.literal("saveSettings"), args: appSettingsSchema }),
  z.object({
    method: z.literal("openFolder"),
    args: z
      .object({
        folder: z.enum(["inbox", "review", "done", "error", "assets"]),
      })
      .strict(),
  }),
]);
export type IpcRequest = z.infer<typeof ipcRequestSchema>;
