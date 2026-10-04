import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { MediaServer } from "../../../src/infrastructure/render/media-server";
import { RemotionRenderer } from "../../../src/infrastructure/render/remotion-bundle";
import { ContentPlanner } from "../../../src/infrastructure/planning/content-planner";
import { presets } from "../../../src/domain/preset";
import { MediaInspector } from "../../../src/infrastructure/media/media-inspector";
import chromium from "@sparticuz/chromium";
it("renders a real silent MP4 at preview and full resolution from the same plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "render-")),
    file = join(root, "source.mp4");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=purple:s=160x240:r=30",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    file,
  ]);
  const plan = await new ContentPlanner().plan({
    jobId: "test",
    checksum: "a".repeat(64),
    file,
    media: { durationMs: 1000, hasAudio: false },
    transcript: [],
    preset: presets.expert,
    assets: [],
    brand: { name: "Đậu Ánh AI", cta: "", font: "Arial", color: "#a78bfa" },
  });
  const server = new MediaServer(root);
  await server.start();
  try {
    const renderer = new RemotionRenderer(
      resolve("src/remotion/index.ts"),
      server,
      process.env.DAU_ANH_BROWSER || (await chromium.executablePath()),
    );
    await renderer.render(plan, join(root, "preview.mp4"), true);
    await renderer.render(plan, join(root, "final.mp4"));
    const m = await new MediaInspector().inspect(join(root, "final.mp4"));
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1920);
    expect((await stat(join(root, "final.mp4"))).size).toBeGreaterThan(1000);
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      join(root, "final.mp4"),
      "-f",
      "null",
      "-",
    ]);
  } finally {
    await server.stop();
  }
});
