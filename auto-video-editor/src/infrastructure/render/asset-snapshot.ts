import { copyFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fingerprintFile } from "../filesystem/file-fingerprint";
import { safeExisting } from "../filesystem/atomic-file";
import { editPlanSchema, type EditPlan } from "../../domain/edit-plan";
export async function freezePlanAssets(
  input: EditPlan,
  root: string,
  destination: string,
) {
  const plan = structuredClone(input);
  await mkdir(destination, { recursive: true });
  const hashes: Record<string, string> = {};
  async function snapshot(file: string, source = false) {
    file = await safeExisting(root, file);
    const fp = await fingerprintFile(file);
    if (source && fp.sha256 !== plan.sourceChecksum)
      throw new Error("SOURCE_CHANGED");
    const target = join(destination, fp.sha256 + extname(file).toLowerCase());
    await copyFile(file, target);
    if (
      (await fingerprintFile(target)).sha256 !== fp.sha256 ||
      (await fingerprintFile(file)).sha256 !== fp.sha256
    )
      throw new Error("ASSET_CHANGED");
    hashes[target] = fp.sha256;
    return target;
  }
  for (const s of plan.segments) s.file = await snapshot(s.file, true);
  for (const b of plan.broll) b.file = await snapshot(b.file);
  if (plan.music) plan.music.file = await snapshot(plan.music.file);
  if (plan.brand.logo) plan.brand.logo = await snapshot(plan.brand.logo);
  if (plan.brand.fontFile)
    plan.brand.fontFile = await snapshot(plan.brand.fontFile);
  return editPlanSchema.parse({ ...plan, assetChecksums: hashes });
}
