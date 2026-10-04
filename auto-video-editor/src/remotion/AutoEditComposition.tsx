import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  CanvasImage,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import { Video, Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { EditPlan } from "../domain/edit-plan";
import { timelineFrames, msToFrames } from "./timeline";
export type AutoEditProps = { plan: EditPlan };
const CaptionLayer = ({ plan }: AutoEditProps) => {
  const frame = useCurrentFrame(),
    ms = (frame * 1000) / plan.fps,
    c = plan.captions.find((c) => c.startMs <= ms && c.endMs > ms);
  return c ? (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        bottom: 300,
        textAlign: "center",
        fontSize: 48,
        lineHeight: 1.3,
        fontWeight: 700,
        color: "white",
        background: "rgba(15,23,42,.85)",
        padding: "18px 24px",
        borderRadius: 20,
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
    >
      {c.text}
    </div>
  ) : null;
};
const BrandLayer = ({ plan }: AutoEditProps) => {
  const f = useCurrentFrame(),
    ms = (f * 1000) / plan.fps,
    text = plan.texts.find((t) => t.startMs <= ms && t.endMs > ms);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 72,
          top: 100,
          color: "white",
          fontSize: 28,
          fontWeight: 700,
          background: "rgba(15,23,42,.6)",
          padding: 12,
          borderRadius: 12,
        }}
      >
        {plan.brand.name}
      </div>
      {plan.brand.logo ? (
        <CanvasImage
          src={plan.brand.logo}
          style={{
            position: "absolute",
            top: 100,
            right: 72,
            width: 140,
            height: 100,
            objectFit: "contain",
          }}
        />
      ) : null}
      {text ? (
        <div
          style={{
            position: "absolute",
            top: text.kind === "cta" ? 1350 : 250,
            left: 72,
            right: 72,
            color: "white",
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.18,
            padding: 32,
            borderRadius: 24,
            background: "rgba(15,23,42,.85)",
            borderLeft: `10px solid ${plan.brand.color}`,
            opacity: interpolate(ms - text.startMs, [0, 180], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {text.text}
        </div>
      ) : null}
    </>
  );
};
export const AutoEditComposition = ({ plan }: AutoEditProps) => {
  const frame = useCurrentFrame(),
    t = timelineFrames(plan.segments, plan.fps);
  const [fontHandle] = React.useState(() => delayRender("Local font"));
  React.useEffect(() => {
    if (!plan.brand.fontFile) {
      continueRender(fontHandle);
      return;
    }
    const font = new FontFace(plan.brand.font, `url("${plan.brand.fontFile}")`);
    font
      .load()
      .then((f) => {
        document.fonts.add(f);
        continueRender(fontHandle);
      })
      .catch(cancelRender);
  }, [fontHandle, plan.brand.font, plan.brand.fontFile]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#101827",
        fontFamily: `"${plan.brand.font}",Arial,sans-serif`,
      }}
    >
      <TransitionSeries>
        {plan.segments.flatMap((s, i) => [
          ...(i && t.overlaps[i] > 0
            ? [
                <TransitionSeries.Transition
                  key={"transition-" + i}
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: t.overlaps[i] })}
                />,
              ]
            : []),
          <TransitionSeries.Sequence
            key={"segment-" + i}
            durationInFrames={t.durations[i]}
          >
            <Video
              src={s.file}
              objectFit="contain"
              trimBefore={msToFrames(s.inMs, plan.fps)}
              style={{
                width: "100%",
                height: "100%",

                scale: interpolate(frame, [0, t.durationInFrames], [1, 1.025], {
                  extrapolateRight: "clamp",
                }),
              }}
            />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      {plan.broll.map((b, i) => (
        <Sequence
          key={"broll-" + i}
          from={msToFrames(b.startMs, plan.fps)}
          durationInFrames={msToFrames(b.durationMs, plan.fps)}
        >
          <Video
            src={b.file}
            objectFit="contain"
            muted
            style={{ width: "100%", height: "100%" }}
          />
        </Sequence>
      ))}
      <CaptionLayer plan={plan} />
      <BrandLayer plan={plan} />
      {plan.music ? (
        <Audio
          src={plan.music.file}
          loop
          volume={(f) => {
            const ms = (f * 1000) / plan.fps,
              speech = plan.captions.some(
                (c) => c.startMs <= ms && ms < c.endMs,
              );
            return (
              plan.music!.volume *
              (speech ? 0.55 : 1) *
              Math.min(1, f / 15, (t.durationInFrames - f) / 30)
            );
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
