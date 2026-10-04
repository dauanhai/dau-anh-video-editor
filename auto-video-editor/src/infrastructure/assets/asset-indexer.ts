import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { MediaInspector } from "../media/media-inspector";
import type { Asset } from "./asset-matcher";
import { safeExisting } from "../filesystem/atomic-file";
export async function indexAssets(
  root: string,
  inspector = new MediaInspector(),
) {
  const assets: Asset[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      ![".mp4", ".mov"].includes(extname(entry.name).toLowerCase())
    )
      continue;
    const file = await safeExisting(root, join(root, entry.name));
    try {
      const info = JSON.parse(await readFile(file + ".json", "utf8"));
      if (
        Array.isArray(info.tags) &&
        info.tags.every((s: unknown) => typeof s === "string")
      )
        assets.push({
          file,
          tags: info.tags,
          durationMs: (await inspector.inspect(file)).durationMs,
        });
    } catch {}
  }
  return assets;
}
