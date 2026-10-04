export const msToFrames = (ms: number, fps: number) =>
  Math.round((ms * fps) / 1000);
export function timelineFrames(
  segments: { durationMs: number; transitionMs?: number }[],
  fps: number,
) {
  let total = 0;
  const starts: number[] = [],
    durations: number[] = [],
    overlaps: number[] = [];
  segments.forEach((s, i) => {
    const d = msToFrames(s.durationMs, fps),
      overlap = i ? msToFrames(s.transitionMs ?? 0, fps) : 0;
    if (d < 1 || overlap >= d || (i && overlap >= durations[i - 1]))
      throw new Error("INVALID_TRANSITION_DURATION");
    starts.push(total - overlap);
    durations.push(d);
    overlaps.push(overlap);
    total += d - overlap;
  });
  return { starts, durations, overlaps, durationInFrames: total };
}
