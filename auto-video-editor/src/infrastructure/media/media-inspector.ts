import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export type MediaMetadata = {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
};
export class MediaInspector {
  constructor(private ffprobe = "ffprobe") {}
  async inspect(path: string): Promise<MediaMetadata> {
    const { stdout } = await run(
      this.ffprobe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { timeout: 60000, maxBuffer: 5 * 1024 ** 2 },
    );
    const data = JSON.parse(stdout),
      v = data.streams.find((s: any) => s.codec_type === "video");
    if (!v) throw new Error("NO_VIDEO_STREAM");
    const [n, d] = v.avg_frame_rate.split("/").map(Number),
      durationMs = Math.round(Number(data.format.duration) * 1000);
    if (!Number.isFinite(durationMs) || durationMs <= 0)
      throw new Error("INVALID_DURATION");
    return {
      durationMs,
      width: v.width,
      height: v.height,
      fps: d ? n / d : 30,
      hasAudio: data.streams.some((s: any) => s.codec_type === "audio"),
    };
  }
}
