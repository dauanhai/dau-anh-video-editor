import { Composition } from "remotion";
import { AutoEditComposition } from "./AutoEditComposition";
import { timelineFrames } from "./timeline";
export const RemotionRoot = () => (
  <Composition
    id="AutoEdit"
    component={AutoEditComposition}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={60}
    defaultProps={{
      plan: {
        version: 1,
        jobId: "sample",
        sourceChecksum: "a".repeat(64),
        revision: 1,
        preset: { id: "expert", version: 1 },
        width: 1080,
        height: 1920,
        fps: 30,
        durationMs: 2000,
        segments: [
          {
            file: "",
            inMs: 0,
            outMs: 2000,
            startMs: 0,
            durationMs: 2000,
            transitionMs: 0,
          },
        ],
        captions: [],
        broll: [],
        texts: [],
        music: null,
        brand: { name: "", cta: "", color: "#a78bfa", font: "Arial" },
        warnings: [],
        assetChecksums: {},
      },
    }}
    calculateMetadata={({ props }) => ({
      durationInFrames: timelineFrames(props.plan.segments, props.plan.fps)
        .durationInFrames,
      width: props.plan.width,
      height: props.plan.height,
      fps: props.plan.fps,
    })}
  />
);
