import React from "react";
import { random } from "remotion";
import { C, FONT } from "../theme";
import { P } from "./MapCanvas";

export type Mood = "editing" | "reading" | "running" | "waiting" | "thinking";

type Props = {
  /** The figure's feet, in screen px. */
  at: P;
  color: string;
  name: string;
  state: string;
  mood: Mood;
  task?: string;
  frame: number;
  /** 0..1 pop-in of the whole figure. */
  appear?: number;
  /** 0..1 flag height; 0 = none. */
  flag?: number;
  walking?: boolean;
  /** Scale of the figure and tag relative to the app's, so it reads in a video. */
  k?: number;
};

/** The five-point star, flag and name tag exactly as AgentAtlasLayer draws them. */
export const Agent: React.FC<Props> = ({ at, color, name, state, mood, task, frame, appear = 1, flag = 0, walking, k = 1.9 }) => {
  const t = frame / 30;
  const bob = walking ? Math.abs(Math.sin(t * 9)) * -3 * k : mood === "editing" ? Math.sin(t * 14) * 1.2 * k : 0;
  const spin = mood === "editing" ? t * 1.6 : 0;
  const outer = 9.5 * k;
  const inner = outer * 0.45;
  const cx = 0;
  const cy = -11 * k + bob;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + spin + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  const pulse = (Math.sin(t * 3) * 5 + 15) * k * 0.5;
  const urgent = mood === "waiting";
  const ts = k * 0.62;
  const fs = 12 * k * 0.95;
  const tagH = 20 * k * 0.95;
  const pop = 0.6 + 0.4 * appear;
  return (
    <div style={{ position: "absolute", left: at.x, top: at.y, opacity: appear, transform: `scale(${pop})`, transformOrigin: "0 0", fontFamily: FONT, pointerEvents: "none" }}>
      <svg width="1" height="1" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <polygon points={pts.join(" ")} fill={color} stroke={color} strokeWidth={1.6 * k} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${pulse}px ${color})` }} />
        {flag > 0 ? (
          <g>
            <line x1={8 * k} y1={-8 * k} x2={8 * k} y2={(-8 - 30 * flag) * k} stroke={C.atlasInk} strokeWidth={1.4 * k} />
            <polygon
              points={`${8 * k},${(-8 - 30 * flag) * k} ${23 * k},${(-8 - 30 * flag + 5) * k} ${8 * k},${(-8 - 30 * flag + 10) * k}`}
              fill={C.site}
              opacity={Math.min(1, flag * 2)}
            />
          </g>
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 5 * ts,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3 * ts,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            height: tagH,
            display: "flex",
            alignItems: "center",
            padding: `0 ${8 * ts * 1.4}px`,
            borderRadius: 9 * ts * 1.4,
            background: C.tagBg,
            border: `1px solid ${color}99`, boxShadow: "0 4px 14px rgba(15,23,42,0.10)",
            fontSize: fs,
            fontWeight: 600,
            color: C.atlasInk,
          }}
        >
          {name}
          <span style={{ fontWeight: 500, color: urgent ? "#d97706" : mood === "reading" || mood === "thinking" ? C.atlasMuted : color }}>{` · ${state}`}</span>
        </div>
        {task ? (
          <div style={{ padding: `0 ${7 * ts * 1.4}px`, height: 18 * ts * 1.5, display: "flex", alignItems: "center", borderRadius: 6 * ts * 1.4, background: "rgba(255,255,255,0.94)", border: "1px solid rgba(15,23,42,0.08)", fontSize: 11.5 * k * 0.95, color: C.atlasInk, fontWeight: 450 }}>
            {task}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Glyphs rising from a star into (editing) a component, or `>_` rising off it (running). */
export const Glyphs: React.FC<{ from: P; to: P; frame: number; color: string; kind: "code" | "run"; seed: string; k?: number }> = ({ from, to, frame, color, kind, seed, k = 1.9 }) => {
  const CODE = ["{ }", "=>", "fn", "</>", "( )", ";", "[ ]", "++", "&&", "::"];
  const RUN = [">_", "$", ">_", "…"];
  const list = kind === "code" ? CODE : RUN;
  const N = 6;
  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const period = 42;
        const phase = ((frame + i * (period / N)) % period) / period;
        const idx = Math.floor((frame + i * (period / N)) / period);
        const jx = (random(`${seed}-${i}-${idx}`) - 0.5) * 36 * k;
        const x = kind === "code" ? from.x + (to.x - from.x) * phase + jx * (1 - phase) : from.x + jx * 0.6;
        const y = kind === "code" ? from.y + (to.y - from.y) * phase : from.y - phase * 46 * k;
        const o = Math.sin(phase * Math.PI) * (kind === "code" ? 0.95 : 0.8);
        const g = list[Math.floor(random(`${seed}-g-${i}-${idx}`) * list.length)];
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", opacity: o, color, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 * k, fontWeight: 600 }}>
            {g}
          </div>
        );
      })}
    </>
  );
};
