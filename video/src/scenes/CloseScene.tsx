import React from "react";
import { C, FONT, MONO } from "../theme";
import { arrive, ramp, useT } from "../ease";
import { LIVE } from "../data/types";
import { SaasBackground } from "../components/Saas";
import { MapCanvas } from "../components/MapCanvas";

export const CloseScene: React.FC = () => {
  const f = useT();
  const drift = f * 0.12;
  const rise = (a: number) => ramp(f, a, a + 22, arrive);
  const tile = ramp(f, 6, 34, arrive);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      <SaasBackground t={f + 900} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.42 * ramp(f, 0, 40) }}>
        <MapCanvas diagram={LIVE} cam={{ cx: 1036 + drift, cy: 700, scale: 0.72 }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 42%, rgba(238,241,247,0.88), rgba(238,241,247,0.97) 72%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: tile, transform: `scale(${0.86 + 0.14 * tile})` }}>
          <div style={{ width: 150, height: 150, borderRadius: 34, background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 60px rgba(11,16,32,0.28)" }}>
            <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div style={{ fontSize: 138, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink }}>ArchDraw</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 60, fontWeight: 500, letterSpacing: "-0.02em", color: C.inkSoft, opacity: rise(40), transform: `translateY(${(1 - rise(40)) * 20}px)` }}>
          Open the map. <span style={{ color: C.ink, fontWeight: 650 }}>Then start the agents.</span>
        </div>
        <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 18, padding: "20px 34px", borderRadius: 18, background: C.ink, color: "#fff", fontFamily: MONO, boxShadow: "0 24px 50px rgba(11,16,32,0.28)", fontSize: 40, fontWeight: 600, opacity: rise(78), transform: `translateY(${(1 - rise(78)) * 20}px)` }}>
          <span style={{ opacity: 0.5 }}>$</span> npx -y archdraw-live
        </div>
        <div style={{ marginTop: 40, fontSize: 38, color: C.muted, letterSpacing: "0.01em", opacity: rise(112) }}>archdraw.hiabhee.online</div>
      </div>
    </div>
  );
};
