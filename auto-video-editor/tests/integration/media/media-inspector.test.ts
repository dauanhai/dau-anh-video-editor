import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MediaInspector } from "../../../src/infrastructure/media/media-inspector";
it("inspects real files with and without audio", async () => {
  const dir = await mkdtemp(join(tmpdir(), "media-"));
  for (const audio of [false, true]) {
    const f = join(dir, `${audio}.mp4`);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=purple:s=160x240:r=30",
      ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440"] : []),
      "-t",
      "1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      f,
    ]);
    const m = await new MediaInspector().inspect(f);
    expect(m.width).toBe(160);
    expect(m.hasAudio).toBe(audio);
    expect(m.durationMs).toBeGreaterThan(900);
  }
});
