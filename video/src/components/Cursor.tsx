import React from "react";
import { P } from "./MapCanvas";

/** The macOS-style arrow the stageshow kit draws, with a soft ripple on click. */
export const Cursor: React.FC<{ at: P; opacity?: number; press?: number; ripple?: number }> = ({ at, opacity = 1, press = 0, ripple = 0 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${at.x}px, ${at.y}px)`, opacity, pointerEvents: "none" }}>
    {ripple > 0 && ripple < 1 ? (
      <div
        style={{
          position: "absolute",
          left: -28 * (0.4 + ripple),
          top: -28 * (0.4 + ripple),
          width: 56 * (0.4 + ripple),
          height: 56 * (0.4 + ripple),
          borderRadius: "50%",
          border: "2px solid rgba(11,16,32,0.5)",
          opacity: 1 - ripple,
        }}
      />
    ) : null}
    <svg width="34" height="40" viewBox="0 0 17 20" style={{ transform: `scale(${1 - press * 0.1})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 4px 10px rgba(15,23,42,0.35))" }}>
      <path d="M2 1.5 L2 15 L5.6 11.8 L8.2 17.6 L10.6 16.5 L8 10.8 L13 10.6 Z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  </div>
);
