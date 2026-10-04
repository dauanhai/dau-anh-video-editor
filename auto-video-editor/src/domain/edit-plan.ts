import { z } from "zod";
export const captionSchema = z
  .object({
    text: z.string(),
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    timestampMs: z.number().nullable(),
    confidence: z.number().nullable(),
  })
  .refine((c) => c.endMs > c.startMs);
export const segmentSchema = z
  .object({
    file: z.string().min(1),
    inMs: z.number().nonnegative(),
    outMs: z.number().positive(),
    startMs: z.number().nonnegative(),
    durationMs: z.number().positive(),
    transitionMs: z.number().nonnegative().default(0),
  })
  .refine(
    (s) => s.outMs > s.inMs && Math.abs(s.durationMs - (s.outMs - s.inMs)) < 1,
  );
export const brandSchema = z.object({
  name: z.string().max(100),
  cta: z.string().max(140),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.string().min(1),
  logo: z.string().optional(),
  fontFile: z.string().optional(),
});
export const editPlanSchema = z.object({
  version: z.literal(1),
  jobId: z.string(),
  sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().positive(),
  preset: z.object({ id: z.string(), version: z.number().int().positive() }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationMs: z.number().positive(),
  segments: z.array(segmentSchema).min(1),
  captions: z.array(captionSchema),
  broll: z.array(
    z.object({
      file: z.string(),
      startMs: z.number().nonnegative(),
      durationMs: z.number().positive(),
    }),
  ),
  texts: z.array(
    z.object({
      text: z.string(),
      startMs: z.number().nonnegative(),
      endMs: z.number().positive(),
      source: z.enum(["transcript", "brand", "user"]),
      kind: z.enum(["hook", "keyword", "cta"]),
    }),
  ),
  music: z
    .object({ file: z.string(), volume: z.number().min(0).max(0.3) })
    .nullable(),
  brand: brandSchema,
  warnings: z.array(z.string()),
  assetChecksums: z
    .record(z.string(), z.string().regex(/^[a-f0-9]{64}$/))
    .default({}),
});
export type EditPlan = z.infer<typeof editPlanSchema>;
export type EditSegment = EditPlan["segments"][number];
export type Caption = z.infer<typeof captionSchema>;
export type Brand = z.infer<typeof brandSchema>;
