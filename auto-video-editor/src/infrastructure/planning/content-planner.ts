import {
  editPlanSchema,
  type EditPlan,
  type Caption,
  type Brand,
} from "../../domain/edit-plan";
import type { Preset } from "../../domain/preset";
import { matchAssets, type Asset } from "../assets/asset-matcher";
import type { DeadRange } from "../media/silence-detector";
export class ContentPlanner {
  readonly version = "source-bound-v2";
  async plan(input: {
    jobId: string;
    checksum: string;
    file: string;
    media: { durationMs: number; hasAudio: boolean };
    transcript: Caption[];
    preset: Preset;
    assets: Asset[];
    brand: Brand;
    music?: string;
    deadRanges?: DeadRange[];
  }) {
    const safe = (input.deadRanges ?? [])
      .filter(
        (r) =>
          r.endMs - r.startMs >= 300 &&
          !input.transcript.some(
            (c) => c.startMs < r.endMs && c.endMs > r.startMs,
          ),
      )
      .sort((a, b) => a.startMs - b.startMs);
    const ranges: { inMs: number; outMs: number }[] = [];
    let sourceStart = 0;
    for (const r of safe) {
      const start = Math.max(
          sourceStart,
          Math.min(input.media.durationMs, r.startMs),
        ),
        end = Math.min(input.media.durationMs, r.endMs);
      if (start > sourceStart) ranges.push({ inMs: sourceStart, outMs: start });
      sourceStart = Math.max(sourceStart, end);
    }
    if (sourceStart < input.media.durationMs)
      ranges.push({ inMs: sourceStart, outMs: input.media.durationMs });
    if (!ranges.length) ranges.push({ inMs: 0, outMs: input.media.durationMs });
    let cursor = 0;
    const segments = ranges.map((r) => {
      const s = {
        file: input.file,
        ...r,
        startMs: cursor,
        durationMs: r.outMs - r.inMs,
        transitionMs: 0,
      };
      cursor += s.durationMs;
      return s;
    });
    const durationMs = cursor,
      captions = input.transcript.flatMap((c) => {
        const s = segments.find(
          (s) => c.startMs >= s.inMs && c.endMs <= s.outMs,
        );
        return s
          ? [
              {
                ...c,
                startMs: c.startMs - s.inMs + s.startMs,
                endMs: c.endMs - s.inMs + s.startMs,
                timestampMs:
                  c.timestampMs === null
                    ? null
                    : c.timestampMs - s.inMs + s.startMs,
              },
            ]
          : [];
      });
    const hook = captions[0];
    const broll = captions.flatMap((c) => {
      const a = matchAssets(c.text, input.assets)[0];
      const startMs = Math.max(3000, c.startMs),
        length = Math.min(3000, c.endMs - startMs, a?.durationMs ?? 0);
      return a && length >= 1000
        ? [{ file: a.file, startMs, durationMs: length }]
        : [];
    });
    return editPlanSchema.parse({
      version: 1,
      jobId: input.jobId,
      sourceChecksum: input.checksum,
      revision: 1,
      preset: { id: input.preset.id, version: input.preset.version },
      width: input.preset.width,
      height: input.preset.height,
      fps: input.preset.fps,
      durationMs,
      segments,
      captions,
      broll,
      texts: [
        ...(hook
          ? [
              {
                text: hook.text,
                startMs: 0,
                endMs: Math.min(3000, durationMs),
                source: "transcript",
                kind: "hook",
              },
            ]
          : []),
        ...(input.brand.cta
          ? [
              {
                text: input.brand.cta,
                startMs: Math.max(0, durationMs - 3000),
                endMs: durationMs,
                source: "brand",
                kind: "cta",
              },
            ]
          : []),
      ],
      music: input.music
        ? { file: input.music, volume: input.preset.musicVolume }
        : null,
      brand: input.brand,
      warnings: input.media.hasAudio ? [] : ["NO_AUDIO_TRACK"],
    });
  }
  revise(plan: EditPlan, command: string) {
    const p = structuredClone(plan);
    p.revision++;
    if (command === "reduce-effects") {
      p.broll = [];
      p.segments.forEach((s) => (s.transitionMs = 0));
    } else if (command === "change-music") {
      p.music = null;
    } else if (command !== "custom-note")
      throw new Error("UNSUPPORTED_REVISION");
    return editPlanSchema.parse(p);
  }
}
