import React from "react";
import { C, FONT } from "../theme";
import { arrive, ramp } from "../ease";

/** A headline that rises in word by word and leaves the same way. Frames are scene-local. */
export const Caption: React.FC<{ text: string; sub?: string; frame: number; from: number; to: number; size?: number; accent?: string; align?: "center" | "left"; bottom?: number; top?: number }> = ({
  text,
  sub,
  frame,
  from,
  to,
  size = 92,
  accent,
  align = "center",
  bottom = 96,
  top,
}) => {
  if (frame < from - 2 || frame > to + 14) return null;
  const words = text.split(" ");
  const out = ramp(frame, to, to + 12, arrive);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, ...(top !== undefined ? { top } : { bottom }), display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", paddingLeft: align === "left" ? 120 : 0, fontFamily: FONT, opacity: 1 - out, transform: `translateY(${out * -14}px)` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.28}px`, textShadow: "none" }}>
        {words.map((w, i) => {
          const p = ramp(frame, from + i * 3, from + i * 3 + 16, arrive);
          const emph = accent && accent.split(" ").includes(w.replace(/[.,]/g, ""));
          return (
            <span key={i} style={{ display: "inline-block", fontSize: size, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1.08, color: emph ? C.blue : C.ink, opacity: p, transform: `translateY(${(1 - p) * 28}px) scale(${0.96 + 0.04 * p})`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined }}>
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div style={{ marginTop: 18, fontSize: 40, fontWeight: 450, color: C.inkSoft, opacity: ramp(frame, from + words.length * 3 + 6, from + words.length * 3 + 22), textShadow: "none" }}>{sub}</div>
      ) : null}
    </div>
  );
};

/** A dark gradient under the lower third so captions stay legible over the map. */
export const Scrim: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 420, opacity, background: "linear-gradient(to top, rgba(7,8,10,0.92), rgba(7,8,10,0))", pointerEvents: "none" }} />
);
