import { fingerprintFile } from "../filesystem/file-fingerprint";
import { access } from "node:fs/promises";
import { editPlanSchema, type EditPlan } from "../../domain/edit-plan";
import { timelineFrames } from "../../remotion/timeline";
import { MediaInspector } from "../media/media-inspector";
export function checkPlan(plan: EditPlan) {
  editPlanSchema.parse(plan);
  const t = timelineFrames(plan.segments, plan.fps);
  plan.segments.forEach((s, i) => {
    if (Math.abs(s.startMs - (t.starts[i] * 1000) / plan.fps) > 34)
      throw new Error("TIMELINE_GAP");
  });
  if (Math.abs(plan.durationMs - (t.durationInFrames * 1000) / plan.fps) > 34)
    throw new Error("TIMELINE_DURATION_MISMATCH");
  for (const c of plan.captions)
    if (c.endMs > plan.durationMs || c.startMs < 0)
      throw new Error("CAPTION_OUT_OF_BOUNDS");
  for (const b of plan.broll)
    if (b.startMs + b.durationMs > plan.durationMs)
      throw new Error("BROLL_OUT_OF_BOUNDS");
  for (const text of plan.texts)
    if (text.endMs > plan.durationMs) throw new Error("TEXT_OUT_OF_BOUNDS");
  return t;
}
export async function checkAssets(plan: EditPlan) {
  for (const file of [
    ...plan.segments.map((s) => s.file),
    ...plan.broll.map((s) => s.file),
    ...(plan.music ? [plan.music.file] : []),
    ...(plan.brand.logo ? [plan.brand.logo] : []),
    ...(plan.brand.fontFile ? [plan.brand.fontFile] : []),
  ]) {
    await access(file);
    const expected = plan.assetChecksums?.[file];
    if (expected && (await fingerprintFile(file)).sha256 !== expected)
      throw new Error("ASSET_CHANGED");
  }
}
export async function checkOutput(
  path: string,
  plan: EditPlan,
  inspector = new MediaInspector(),
  scale = 1,
) {
  const m = await inspector.inspect(path);
  if (
    m.width !== Math.round(plan.width * scale) ||
    m.height !== Math.round(plan.height * scale) ||
    Math.abs(m.durationMs - plan.durationMs) > 150
  )
    throw new Error("OUTPUT_METADATA_MISMATCH");
  return m;
}
