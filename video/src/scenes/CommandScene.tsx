import React from "react";
import { C, FONT, MONO, T } from "../theme";
import { arrive, ramp, useT } from "../ease";
import { Caption } from "../components/Caption";
import { SaasBackground } from "../components/Saas";

const CMD = "npx -y archdraw-live";
const LINES: { at: number; text: string; kind?: "ok" | "dim" | "bold" }[] = [
  { at: 92, text: "Setting up a live map for acme-shop…" },
  { at: 112, text: "✓ Project created", kind: "ok" },
  { at: 132, text: "✓ Claude Code connected", kind: "ok" },
  { at: 156, text: "Claude is reading your code (read-only) to draw the map.", kind: "dim" },
  { at: 206, text: "✓ Claude mapped 14 components", kind: "ok" },
  { at: 228, text: "✓ Detailed map: 46 parts", kind: "ok" },
  { at: 252, text: "Next: start Claude Code in this folder (run claude).", kind: "bold" },
];

export const CommandScene: React.FC = () => {
  const f = useT();
  const typed = Math.max(0, Math.min(CMD.length, Math.floor((f - 24) * 0.9)));
  const win = ramp(f, 0, 26, arrive);
  const out = ramp(f, 306, 330);
  const caret = Math.floor(f / 14) % 2 === 0;
  const col = (k?: string) => (k === "ok" ? "#34d399" : k === "dim" ? T.muted : k === "bold" ? T.ink : T.inkSoft);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, opacity: 1 - out }}>
      <SaasBackground t={f + 400} />
      <Caption frame={f} from={4} to={300} text="One command." size={116} bottom={780} accent="One" sub="No account. No setup." />
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 360,
          width: 1160,
          height: 520,
          borderRadius: 20,
          background: T.panel,
          border: `1.5px solid ${T.lineStrong}`,
          boxShadow: "0 50px 120px rgba(15,23,42,0.34), 0 10px 30px rgba(15,23,42,0.16)",
          opacity: win,
          transform: `translateY(${(1 - win) * 40}px)`,
          overflow: "hidden",
        }}
      >
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: T.card, borderBottom: `1px solid ${T.line}` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
          ))}
          <span style={{ marginLeft: 150, fontSize: 19, color: T.muted }}>acme-shop — zsh</span>
        </div>
        <div style={{ padding: "26px 30px", fontFamily: MONO, fontSize: 25, lineHeight: "40px" }}>
          <div>
            <span style={{ color: T.muted }}>~/code/acme-shop</span> <span style={{ color: C.blue }}>$</span>{" "}
            <span style={{ color: T.ink, fontWeight: 600 }}>{CMD.slice(0, typed)}</span>
            {f < 92 ? <span style={{ color: T.ink, opacity: caret ? 1 : 0 }}>▍</span> : null}
          </div>
          {LINES.map((l) => {
            const p = ramp(f, l.at, l.at + 10);
            return p > 0 ? (
              <div key={l.text} style={{ color: col(l.kind), opacity: p, transform: `translateY(${(1 - p) * 8}px)`, fontWeight: l.kind === "bold" ? 600 : 400 }}>
                {l.text}
              </div>
            ) : null;
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center", opacity: ramp(f, 262, 282), transform: `translateY(${(1 - ramp(f, 262, 282)) * 14}px)` }}>
        <div style={{ padding: "12px 26px", borderRadius: 999, border: `1px solid ${C.lineStrong}`, color: C.inkSoft, fontSize: 30, background: "rgba(255,255,255,0.85)" }}>
          Paths only. <span style={{ color: C.ink, fontWeight: 600 }}>Never your code.</span>
        </div>
      </div>
    </div>
  );
};
