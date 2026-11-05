import React from "react";
import { random } from "remotion";
import { AGENT, FONT, H, MONO, T, W } from "../theme";
import { arrive, lerp, ramp, travel, useT } from "../ease";
import { Caption } from "../components/Caption";
import { SaasBackground } from "../components/Saas";
import { Cursor } from "../components/Cursor";

const TABS = [
  { name: "api", color: AGENT.otter.color },
  { name: "web", color: AGENT.gecko.color },
  { name: "worker", color: AGENT.fox.color },
  { name: "auth", color: "#a855f7" },
  { name: "db", color: "#06b6d4" },
  { name: "infra", color: "#facc15" },
];
const STUCK = 3;
const POOL = [
  "● Read(src/orders/cart.ts)",
  "● Edit(src/orders/totals.ts)",
  '● Grep("retryCharge")',
  "  ⎿  Updated 14 lines",
  "● Bash(npm test -- orders)",
  "  ⎿  PASS  orders/cart.test.ts",
  "● Read(src/payments/stripe.ts)",
  "● Write(src/api/refunds.ts)",
  "  ⎿  Wrote 62 lines",
  '● Glob("**/*.sql")',
  "● Edit(src/auth/session.ts)",
  "  ⎿  Updated 6 lines",
  "✻ Thinking…",
  "● Bash(git diff --stat)",
];

const CW = 540;
const CH = 300;
const GAP = 36;
const GX = (W - (3 * CW + 2 * GAP)) / 2;
const GY = 120;
const pos = (i: number) => ({ x: GX + (i % 3) * (CW + GAP), y: GY + Math.floor(i / 3) * (CH + GAP) });
const center = (i: number) => ({ x: pos(i).x + CW / 2, y: pos(i).y + CH / 2 });

// The cursor hops tab to tab: each stop and the frame it arrives.
const STOPS: [number, number][] = [
  [0, 24],
  [1, 48],
  [2, 72],
  [4, 96],
  [5, 120],
  [3, 150],
];

export const ProblemScene: React.FC = () => {
  const f = useT();
  const exit = ramp(f, 172, 206, travel);

  let from = { x: W - 200, y: H - 160 };
  let to = center(STOPS[0][0]);
  let a = 4;
  let b = STOPS[0][1];
  for (let i = 0; i < STOPS.length; i++) {
    if (f >= STOPS[i][1]) {
      from = center(STOPS[i][0]);
      a = STOPS[i][1] + 6;
      const nx = STOPS[i + 1];
      to = nx ? center(nx[0]) : center(STOPS[i][0]);
      b = nx ? nx[1] : a + 1;
    }
  }
  const p = travel(Math.min(1, Math.max(0, (f - a) / Math.max(1, b - a - 4))));
  const cur = { x: lerp(from.x, to.x, p) + 40, y: lerp(from.y, to.y, p) + 30 - Math.sin(p * Math.PI) * 50 };
  let active = -1;
  for (const [i, at] of STOPS) if (f >= at + 2 && f < at + 22) active = i;
  if (f >= 150) active = STUCK;

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      <SaasBackground t={f} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 - exit * 0.06})`, opacity: 1 - exit, transformOrigin: "50% 45%" }}>
        {TABS.map((t, i) => {
          const pIn = ramp(f, i * 4, i * 4 + 20, arrive);
          const stuck = i === STUCK && f >= 100;
          const scroll = stuck ? 100 * 0.13 : f * 0.13;
          const base = Math.floor(scroll);
          const frac = scroll - base;
          return (
            <div
              key={t.name}
              style={{
                position: "absolute",
                left: pos(i).x,
                top: pos(i).y + (1 - pIn) * 40,
                width: CW,
                height: CH,
                opacity: pIn,
                borderRadius: 16,
                background: T.panel,
                border: `1.5px solid ${active === i ? (i === STUCK ? T.attention : T.inkSoft) : T.line}`,
                overflow: "hidden",
                boxShadow: active === i ? `0 0 0 4px ${i === STUCK ? "rgba(217,119,6,0.28)" : "rgba(11,16,32,0.12)"}, 0 30px 70px rgba(15,23,42,0.30)` : "0 30px 70px rgba(15,23,42,0.22), 0 6px 18px rgba(15,23,42,0.10)",
              }}
            >
              <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: `1px solid ${T.line}`, background: T.card }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: t.color }} />
                <span style={{ fontSize: 17, color: T.inkSoft, fontWeight: 500 }}>claude — {t.name}</span>
              </div>
              <div style={{ position: "relative", height: CH - 40, overflow: "hidden", padding: "12px 18px", fontFamily: MONO, fontSize: 16 }}>
                <div style={{ transform: `translateY(${-frac * 26}px)` }}>
                  {Array.from({ length: 10 }).map((_, r) => {
                    const idx = base + r;
                    const line = POOL[Math.floor(random(`${t.name}-${idx}`) * POOL.length)];
                    const dim = line.startsWith("  ");
                    return (
                      <div key={idx} style={{ height: 26, color: dim ? T.muted : T.inkSoft, whiteSpace: "nowrap" }}>
                        {line}
                      </div>
                    );
                  })}
                </div>
                {stuck ? (
                  <div style={{ position: "absolute", left: 14, right: 14, bottom: 14, padding: "10px 14px", borderRadius: 10, background: "#1d1709", border: `1px solid ${T.attention}`, color: "#fbbf24", fontSize: 16 }}>
                    Allow Bash(npm run migrate)? <span style={{ opacity: Math.floor(f / 15) % 2 ? 1 : 0.2 }}>▍</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <Cursor at={cur} opacity={ramp(f, 14, 24) * (1 - exit)} />
      </div>
      <Caption frame={f} from={8} to={74} text="Six agents. Six tabs." size={92} bottom={70} />
      <Caption frame={f} from={92} to={176} text="Which one is stuck?" size={92} bottom={70} accent="stuck" />
    </div>
  );
};
