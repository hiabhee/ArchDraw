import React from "react";
import { C, FONT, MONO } from "../theme";

const K = 1.6; // the app's 11.5-14px chrome, enlarged to read in a video

/** NeedsYouQueue: the pill at the top of the map. */
export const NeedsYou: React.FC<{ seconds: number; place: string; reason?: string; color: string; name: string; slide: number }> = ({ seconds, place, reason = "needs permission", color, name, slide }) => {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 44, display: "flex", justifyContent: "center", transform: `translateY(${(1 - slide) * -90}px)`, opacity: slide, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 * K, padding: `${6 * K}px ${8 * K}px`, borderRadius: 16 * K, border: `1px solid ${C.lineStrong}`, background: "rgba(255,255,255,0.96)", fontSize: 11.5 * K, color: C.ink, boxShadow: "0 18px 44px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.06)" }}>
        <span style={{ padding: `0 ${6 * K}px`, fontWeight: 600, color: "#b45309" }}>Needs you</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 * K, padding: `${4 * K}px ${10 * K}px`, borderRadius: 999, border: `1px solid ${C.lineStrong}`, whiteSpace: "nowrap" }}>
          <span style={{ width: 8 * K, height: 8 * K, borderRadius: "50%", background: color }} />
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span style={{ color: "#b45309" }}>{reason}</span>
          <span style={{ color: C.muted }}>· {place}</span>
          <span style={{ marginLeft: 8 * K, fontVariantNumeric: "tabular-nums", color: C.muted }}>{`${m}:${s}`}</span>
        </span>
        <span style={{ width: 24 * K, height: 24 * K, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
          <svg width={14 * K} height={14 * K} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
      </div>
    </div>
  );
};

type Entry = { name: string; color: string; when: string; intent: string; edits: number; files: string };

/** ComponentHistoryCard: who touched this component and why. */
export const HistoryCard: React.FC<{ title: string; entries: Entry[]; slide: number; tokens: string }> = ({ title, entries, slide, tokens }) => (
  <div style={{ position: "absolute", right: 56, top: 140, width: 320 * K, opacity: slide, transform: `translateX(${(1 - slide) * 60}px)`, fontFamily: FONT }}>
    <div style={{ borderRadius: 16 * K, border: `1px solid ${C.lineStrong}`, background: "rgba(255,255,255,0.98)", fontSize: 12 * K, color: C.ink, boxShadow: "0 30px 70px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.06)", overflow: "hidden" }}>
      <div style={{ padding: `${12 * K}px ${14 * K}px ${10 * K}px`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 10.5 * K, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>Component history · {entries.length} sessions</div>
        <div style={{ fontSize: 14 * K, fontWeight: 600, marginTop: 2 }}>{title}</div>
        <div style={{ fontSize: 11 * K, color: C.muted, marginTop: 3 }}>{tokens}</div>
      </div>
      <div style={{ position: "relative", padding: `${12 * K}px ${14 * K}px` }}>
        <div style={{ position: "absolute", left: 14 * K + 4 * K, top: 16 * K, bottom: 16 * K, width: 1, background: C.line }} />
        {entries.map((e, i) => (
          <div key={e.name} style={{ position: "relative", paddingLeft: 20 * K, marginBottom: i === entries.length - 1 ? 0 : 14 * K }}>
            <span style={{ position: "absolute", left: 0, top: 5 * K, width: 9 * K, height: 9 * K, borderRadius: "50%", background: e.color, border: `2px solid #fff` }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 * K }}>
              <span style={{ fontWeight: 600 }}>{e.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 11 * K, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{e.when}</span>
            </div>
            <div style={{ marginTop: 2 * K, lineHeight: 1.35, color: "rgba(11,16,32,0.88)" }}>{e.intent}</div>
            <div style={{ marginTop: 2 * K, color: C.muted }}>
              {e.edits} edits<span style={{ fontFamily: MONO, fontSize: 11 * K }}> · {e.files}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** The live panel's "map covers" chip and project title bar, for the top-left of the map. */
export const ProjectChip: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div style={{ position: "absolute", left: 56, top: 52, opacity, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT, color: C.ink }}>
    <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 12px rgba(16,185,129,0.6)" }} />
    <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>acme-shop</span>
    <span style={{ fontSize: 22, color: C.muted }}>live</span>
  </div>
);
