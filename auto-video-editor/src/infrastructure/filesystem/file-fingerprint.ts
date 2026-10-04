import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
export async function fingerprintFile(path: string) {
  const before = await stat(path);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const after = await stat(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
    throw new Error("SOURCE_CHANGED");
  return {
    sha256: hash.digest("hex"),
    sizeBytes: after.size,
    modifiedAtMs: after.mtimeMs,
  };
}
