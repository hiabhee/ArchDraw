import React from "react";
import { C, FONT } from "../theme";
import { W, H } from "../theme";

/** The page behind every scene: a cool grey ground with two slow, soft lights. */
export const SaasBackground: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #f4f6fb 0%, ${C.page} 100%)` }}>
    <div style={{ position: "absolute", width: 1300, height: 1300, left: -300 + Math.sin(t / 160) * 90, top: -620 + Math.cos(t / 200) * 70, background: "radial-gradient(circle, rgba(30,144,255,0.20), rgba(30,144,255,0) 60%)" }} />
    <div style={{ position: "absolute", width: 1100, height: 1100, left: 1100 + Math.cos(t / 180) * 80, top: 520 + Math.sin(t / 150) * 80, background: "radial-gradient(circle, rgba(251,191,36,0.16), rgba(251,191,36,0) 60%)" }} />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.7), rgba(255,255,255,0) 55%)" }} />
  </div>
);

export const WINDOW = { scale: 0.8, left: 192, top: 150, bar: 56 };

/**
 * An app window floating on the page: the product, framed. The children are a
 * W x H screen drawn at 1:1 and scaled into the frame, so the camera and agents
 * keep their own coordinates.
 */
export const AppWindow: React.FC<{ children: React.ReactNode; enter: number; title?: string; live?: boolean }> = ({ children, enter, title = "archdraw.hiabhee.online/live/acme-shop", live = true }) => {
  const w = W * WINDOW.scale;
  const h = H * WINDOW.scale + WINDOW.bar;
  return (
    <div
      style={{
        position: "absolute",
        left: WINDOW.left,
        top: WINDOW.top + (1 - enter) * 70,
        width: w,
        height: h,
        opacity: enter,
        transform: `scale(${0.965 + 0.035 * enter})`,
        transformOrigin: "50% 100%",
        filter: enter < 1 ? `blur(${(1 - enter) * 8}px)` : undefined,
        borderRadius: 26,
        overflow: "hidden",
        background: "#fff",
        border: `1px solid ${C.lineStrong}`,
        boxShadow: "0 50px 120px rgba(15,23,42,0.20), 0 12px 32px rgba(15,23,42,0.10)",
        fontFamily: FONT,
      }}
    >
      <div style={{ height: WINDOW.bar, display: "flex", alignItems: "center", padding: "0 22px", background: "#fbfcfe", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", gap: 9 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ padding: "7px 22px", borderRadius: 999, background: C.card, border: `1px solid ${C.line}`, fontSize: 18, color: C.muted, letterSpacing: "0.005em" }}>{title}</div>
        </div>
        <div style={{ width: 150, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600, color: C.inkSoft, visibility: live ? "visible" : "hidden" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }} /> 3 live
        </div>
      </div>
      <div style={{ position: "relative", width: w, height: H * WINDOW.scale, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${WINDOW.scale})`, transformOrigin: "0 0" }}>{children}</div>
      </div>
    </div>
  );
};
