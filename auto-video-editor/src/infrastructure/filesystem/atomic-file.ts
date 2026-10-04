import { writeFile, rename, open, mkdir, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
export async function atomicJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(value, null, 2));
  const h = await open(temp, "r+");
  try {
    await h.sync();
  } finally {
    await h.close();
  }
  await rename(temp, path);
}
export function within(root: string, path: string) {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
export async function safeExisting(root: string, path: string) {
  const r = await realpath(root),
    p = await realpath(path);
  if (!within(r, p)) throw new Error("PATH_OUTSIDE_ROOT");
  return p;
}
