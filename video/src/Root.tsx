import React from "react";
import { AbsoluteFill, Composition, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { FPS, HEIGHT, SCALE, SCENES, TOTAL, WIDTH } from "./timing";
import { Shell } from "./components/Shell";
import { C } from "./theme";
import { ProblemScene } from "./scenes/ProblemScene";
import { MapScene } from "./scenes/MapScene";
import { CommandScene } from "./scenes/CommandScene";
import { CloseScene } from "./scenes/CloseScene";

/** Authoring frames (30 fps timeline) -> render frames (60 fps). */
const f = (n: number) => Math.round(n * SCALE);

export const Launch: React.FC = () => {
  const frame = useCurrentFrame();
  return (
  <AbsoluteFill style={{ background: C.page }}>
    <Audio
      src={staticFile("music.mp3")}
      volume={interpolate(frame, [242, 2320, 2400, 2940, 3020], [0.33, 0.45, 0.32, 0.32, 0.45], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })}
      toneFrequency={1.49}
    />
    <Sequence name="Problem" from={f(SCENES.problem.from)} durationInFrames={f(SCENES.problem.dur)} premountFor={60}>
      <Shell outT={26}>
        <ProblemScene />
      </Shell>
    </Sequence>
    <Sequence name="Map" from={f(SCENES.map.from)} durationInFrames={f(SCENES.map.dur)} premountFor={60}>
      <Shell inT={36} outT={34}>
        <MapScene />
      </Shell>
    </Sequence>
    <Sequence name="Command" from={f(SCENES.command.from)} durationInFrames={f(SCENES.command.dur)} premountFor={60}>
      <Shell inT={30} outT={26} fadeIn>
        <CommandScene />
      </Shell>
    </Sequence>
    <Sequence name="Close" from={f(SCENES.close.from)} durationInFrames={f(SCENES.close.dur)} premountFor={60}>
      <Shell inT={30} fadeIn>
        <CloseScene />
      </Shell>
    </Sequence>
  </AbsoluteFill>
  );
};

const common = { fps: FPS, width: WIDTH, height: HEIGHT } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={f(TOTAL)} {...common} />
    <Composition id="Problem" component={ProblemScene} durationInFrames={f(SCENES.problem.dur)} {...common} />
    <Composition id="MapStory" component={MapScene} durationInFrames={f(SCENES.map.dur)} {...common} />
    <Composition id="Command" component={CommandScene} durationInFrames={f(SCENES.command.dur)} {...common} />
    <Composition id="Close" component={CloseScene} durationInFrames={f(SCENES.close.dur)} {...common} />
  </>
);
