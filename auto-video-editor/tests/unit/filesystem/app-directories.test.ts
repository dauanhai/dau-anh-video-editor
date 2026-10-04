import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureAppDirectories } from "../../../src/infrastructure/filesystem/app-directories";
import { fingerprintFile } from "../../../src/infrastructure/filesystem/file-fingerprint";
import { assertCapacity } from "../../../src/infrastructure/filesystem/disk-space-guard";
it("creates directories idempotently and preserves source bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "editor-"));
  const dirs = await ensureAppDirectories(root);
  const a = join(dirs.inbox, "a.mp4"),
    b = join(dirs.inbox, "b.mp4");
  await writeFile(a, "source");
  await writeFile(b, "source");
  await ensureAppDirectories(root);
  expect(await readFile(a, "utf8")).toBe("source");
  expect((await fingerprintFile(a)).sha256).toBe(
    (await fingerprintFile(b)).sha256,
  );
  await writeFile(b, "changed");
  expect((await fingerprintFile(a)).sha256).not.toBe(
    (await fingerprintFile(b)).sha256,
  );
});
it("rejects low disk space", async () => {
  await expect(assertCapacity(".", 1, async () => 100)).rejects.toThrow(
    "INSUFFICIENT_DISK_SPACE",
  );
});
