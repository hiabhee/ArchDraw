import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SCALE } from "../timing";
import { arrive, ramp, travel, useT } from "../ease";

/**
 * Compound scene boundaries: the picture arrives out of a soft blur and a slight
 * scale, and leaves the same way, so a cut carries motion instead of just dimming.
 * Lengths are on the 30 fps authoring timeline. Opacity is optional because the
 * scenes that overlap already cross-fade themselves.
 */
export const Shell: React.FC<{ children: React.ReactNode; inT?: number; outT?: number; fadeIn?: boolean; fadeOut?: boolean }> = ({ children, inT = 0, outT = 0, fadeIn, fadeOut }) => {
  const t = useT();
  const { durationInFrames } = useVideoConfig();
  const end = durationInFrames / SCALE;
  const a = inT ? ramp(t, 0, inT, arrive) : 1;
  const b = outT ? ramp(t, end - outT, end, travel) : 0;
  const blur = (1 - a) * 10 + b * 8;
  const scale = (0.97 + 0.03 * a) * (1 + b * 0.035);
  const opacity = (fadeIn ? a : 1) * (fadeOut ? 1 - b : 1);
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined, transformOrigin: "50% 50%" }}>{children}</AbsoluteFill>
  );
};
