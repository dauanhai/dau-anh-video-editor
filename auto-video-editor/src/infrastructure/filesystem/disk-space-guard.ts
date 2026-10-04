import { statfs } from "node:fs/promises";
export async function assertCapacity(
  root: string,
  estimatedOutputBytes: number,
  provider = async (p: string) => {
    const s = await statfs(p);
    return s.bavail * s.bsize;
  },
  minimum = 10 * 1024 ** 3,
) {
  if ((await provider(root)) < Math.max(minimum, estimatedOutputBytes * 3))
    throw new Error("INSUFFICIENT_DISK_SPACE");
}

export function estimateCapacity(input: {
  sourceBytes: number;
  durationMs: number;
}) {
  return input.sourceBytes * 1.1 + input.durationMs * 2500 + 256 * 1024 ** 2;
}
