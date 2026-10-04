import { fingerprintFile } from "../../../src/infrastructure/filesystem/file-fingerprint";
import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freezePlanAssets } from "../../../src/infrastructure/render/asset-snapshot";
import { checkAssets } from "../../../src/infrastructure/qc/quality-checker";
import { valid } from "../../fixtures/plan";
it("freezes external assets and rejects tampering with an approved source snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "freeze-")),
    source = join(root, "s.mp4"),
    logo = join(root, "logo.png");
  await writeFile(source, "source");
  await writeFile(logo, "old-logo");
  const p = await freezePlanAssets(
    {
      ...valid,
      sourceChecksum: (await fingerprintFile(source)).sha256,
      segments: [{ ...valid.segments[0], file: source }],
      brand: { ...valid.brand, logo },
    } as any,
    root,
    join(root, "frozen"),
  );
  await writeFile(logo, "new-logo");
  expect(await readFile(p.brand.logo!, "utf8")).toBe("old-logo");
  await checkAssets(p);
  await writeFile(p.segments[0].file, "tampered");
  await expect(checkAssets(p)).rejects.toThrow("ASSET_CHANGED");
});
