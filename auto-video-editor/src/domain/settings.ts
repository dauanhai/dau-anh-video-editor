import { z } from "zod";
import { brandSchema } from "./edit-plan";
export const appSettingsSchema = z
  .object({
    brand: brandSchema,
    preset: z.enum(["expert", "viral-education", "student-story"]),
    autostart: z.boolean(),
    notifications: z.boolean(),
    watch: z.boolean(),
    maxDurationMs: z.number().int().min(1000).max(3600000),
    stabilityMs: z.number().int().min(1000),
    minFreeBytes: z.number().nonnegative(),
  })
  .strict();
export type AppSettings = z.infer<typeof appSettingsSchema>;
export const defaultSettings: AppSettings = {
  brand: { name: "", cta: "", color: "#a78bfa", font: "Arial" },
  preset: "expert",
  autostart: false,
  notifications: true,
  watch: true,
  maxDurationMs: 600000,
  stabilityMs: 10000,
  minFreeBytes: 10 * 1024 ** 3,
};
