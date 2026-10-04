import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export type DeadRange = { startMs: number; endMs: number };
export function intersection(a: DeadRange[], b: DeadRange[]) {
  return a.flatMap((x) =>
    b.flatMap((y) => {
      const startMs = Math.max(x.startMs, y.startMs),
        endMs = Math.min(x.endMs, y.endMs);
      return endMs - startMs >= 300 ? [{ startMs, endMs }] : [];
    }),
  );
}
export class SilenceDetector {
  constructor(private ffmpeg = process.env.DAU_ANH_FFMPEG || "ffmpeg") {}
  async detect(file: string, durationMs: number) {
    const { stderr } = await run(
      this.ffmpeg,
      [
        "-hide_banner",
        "-i",
        file,
        "-vf",
        "freezedetect=n=-30dB:d=0.6",
        "-af",
        "silencedetect=noise=-35dB:d=0.3",
        "-f",
        "null",
        "-",
      ],
      { timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 ** 2, windowsHide: true },
    );
    const parse = (prefix: string) => {
      const ranges: DeadRange[] = [];
      let start: number | null = null;
      for (const match of stderr.matchAll(
        new RegExp(prefix + "_(start|end): ([0-9.]+)", "g"),
      )) {
        if (match[1] === "start") start = Number(match[2]) * 1000;
        else if (start !== null) {
          ranges.push({ startMs: start, endMs: Number(match[2]) * 1000 });
          start = null;
        }
      }
      if (start !== null) ranges.push({ startMs: start, endMs: durationMs });
      return ranges;
    };
    return intersection(parse("freeze"), parse("silence"));
  }
}
