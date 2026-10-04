import { it, expect } from "vitest";
import { timelineFrames } from "../../../src/remotion/timeline";
it("subtracts overlap and calculates cumulative starts without gaps", () => {
  const t = timelineFrames(
    [
      { durationMs: 2000, transitionMs: 0 },
      { durationMs: 2000, transitionMs: 200 },
    ],
    30,
  );
  expect(t.durationInFrames).toBe(114);
  expect(t.starts).toEqual([0, 54]);
});
it("rejects transition longer than neighboring clips", () =>
  expect(() =>
    timelineFrames(
      [
        { durationMs: 100, transitionMs: 0 },
        { durationMs: 100, transitionMs: 200 },
      ],
      30,
    ),
  ).toThrow());
