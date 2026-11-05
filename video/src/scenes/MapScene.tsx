import React from "react";
import { AGENT, C, FONT, H, W } from "../theme";
import { MAP } from "../timing";
import { lerp, ramp, settle, travel, useT } from "../ease";
import { LIVE, MAPPED, bottomOf, centerOf, nodeById, type Diagram } from "../data/types";
import { Ambient, Cam, MapCanvas, P, project } from "../components/MapCanvas";
import { Agent, Glyphs, Mood } from "../components/Agent";
import { Caption } from "../components/Caption";
import { AppWindow, SaasBackground } from "../components/Saas";
import { HistoryCard, NeedsYou, ProjectChip } from "../components/Panels";
import { Cursor } from "../components/Cursor";

/** The camera starts here and each move below is a soft step: it begins at t, takes ~dur to settle. */
const CAM0 = { cx: 1036, cy: 700, scale: 0.62 };
const MOVES: { t: number; dur: number; cx: number; cy: number; scale: number }[] = [
  { t: 0, dur: 190, cx: 1036, cy: 700, scale: 0.82 }, // the map builds, slow push in
  { t: 185, dur: 120, cx: 1000, cy: 650, scale: 1.04 }, // agents arrive
  { t: 438, dur: 76, cx: 1110, cy: 700, scale: 1.4 }, // in on Payments
  { t: 652, dur: 70, cx: 1300, cy: 600, scale: 1.2 }, // over to the new code
  { t: 838, dur: 100, cx: 1036, cy: 700, scale: 0.84 }, // back out to the whole map
];

export const cameraAt = (t: number): Cam => {
  let cx = CAM0.cx;
  let cy = CAM0.cy;
  let ls = Math.log(CAM0.scale);
  let prev = { cx: CAM0.cx, cy: CAM0.cy, ls: Math.log(CAM0.scale) };
  for (const m of MOVES) {
    const k = settle(t, m.t, m.dur);
    const next = { cx: m.cx, cy: m.cy, ls: Math.log(m.scale) };
    cx += (next.cx - prev.cx) * k;
    cy += (next.cy - prev.cy) * k;
    ls += (next.ls - prev.ls) * k;
    prev = next;
  }
  // A slow breath, so the frame is never still.
  return { cx: cx + 9 * Math.sin(t / 58), cy: cy + 6 * Math.sin(t / 77 + 1), scale: Math.exp(ls) * (1 + 0.006 * Math.sin(t / 90)) };
};

const seg = (t: number, a: number, b: number, from: P, to: P): P => {
  const p = travel(Math.min(1, Math.max(0, (t - a) / (b - a))));
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) };
};

const D = LIVE;
const EMPTY: Diagram = { defs: "", width: LIVE.width, height: LIVE.height, nodes: [], edges: [] };
const web = bottomOf(nodeById(D, "web"));
const gateway = bottomOf(nodeById(D, "gateway"));
const auth = bottomOf(nodeById(D, "auth"));
const orders = bottomOf(nodeById(D, "orders"));
const payments = bottomOf(nodeById(D, "payments"));
const paymentsNode = nodeById(D, "payments");
const refunds = nodeById(MAPPED, "refunds");
const SITE = { x: 1290, y: 556, w: 170, h: 56 };
const siteFeet: P = { x: SITE.x + SITE.w / 2, y: SITE.y + SITE.h };
const refundsFeet = bottomOf(refunds);

export const MapScene: React.FC = () => {
  const t = useT();
  const cam = cameraAt(t);
  const scr = (p: P) => project(cam, p);

  // --- reveal of the map -----------------------------------------------------
  const nodeP = (n: { group: boolean }, i: number) =>
    n.group ? ramp(t, MAP.groupsIn + i * 3, MAP.groupsIn + i * 3 + 26) : ramp(t, MAP.nodesIn + (i - 4) * 4, MAP.nodesIn + (i - 4) * 4 + 22);
  const edgeP = (_: string, i: number) => ramp(t, MAP.edgesIn + i * 5, MAP.edgesIn + i * 5 + 26, travel);

  const mappedMix = ramp(t, MAP.mapped - 6, MAP.mapped + 10, travel);
  const refundIn = ramp(t, MAP.mapped, MAP.mapped + 22);
  const refundEdge = ramp(t, MAP.mapped + 14, MAP.mapped + 44, travel);

  // --- agents ------------------------------------------------------------------
  const appear = (i: number) => ramp(t, MAP.agentsIn + i * 9, MAP.agentsIn + i * 9 + 18);
  let gecko: P = web;
  gecko = t < 260 ? seg(t, 210, 260, web, gateway) : seg(t, 290, 340, gateway, auth);
  const geckoWalking = (t >= 210 && t < 260) || (t >= 290 && t < 340);

  const waiting = t >= MAP.fox.waits && t < MAP.fox.answered;
  const flag = waiting ? ramp(t, MAP.fox.waits, MAP.fox.waits + 16) : t >= MAP.fox.answered ? 1 - ramp(t, MAP.fox.answered, MAP.fox.answered + 14) : 0;
  let fox: P = payments;
  if (t >= MAP.sitePlot - 12 && t < MAP.mapped + 10) fox = seg(t, MAP.sitePlot - 12, MAP.sitePlot + 28, payments, siteFeet);
  if (t >= MAP.mapped + 10) fox = seg(t, MAP.mapped + 12, MAP.mapped + 62, siteFeet, refundsFeet);
  const foxWalking = (t >= MAP.sitePlot - 12 && t < MAP.sitePlot + 28) || (t >= MAP.mapped + 12 && t < MAP.mapped + 62);
  const foxMood: Mood = waiting ? "waiting" : t < MAP.fox.waits ? "running" : "editing";
  const foxState = waiting ? "needs permission" : foxMood === "running" ? "running commands…" : "writing code…";

  // --- the click and the history card ------------------------------------------
  const payScreen = scr(centerOf(paymentsNode));
  const cursorIn = ramp(t, MAP.cursorIn, MAP.cursorIn + 10);
  const toPay = travel(Math.min(1, Math.max(0, (t - MAP.cursorIn) / (MAP.click - MAP.cursorIn))));
  const awayAt: P = { x: 520, y: 850 };
  const toAway = travel(Math.min(1, Math.max(0, (t - 600) / 50)));
  const start: P = { x: W - 260, y: H - 200 };
  const aim: P = { x: payScreen.x + 70, y: payScreen.y + 18 };
  const cursor: P =
    t < 600 ? { x: lerp(start.x, aim.x, toPay), y: lerp(start.y, aim.y, toPay) - Math.sin(toPay * Math.PI) * 60 } : { x: lerp(aim.x, awayAt.x, toAway), y: lerp(aim.y, awayAt.y, toAway) - Math.sin(toAway * Math.PI) * 50 };
  const cursorOut = 1 - ramp(t, 668, 684);
  const press = t >= MAP.click && t < MAP.click + 8 ? 1 : t >= 656 && t < 664 ? 1 : 0;
  const rippleP = t >= MAP.click ? (t - MAP.click) / 26 : t >= 656 ? (t - 656) / 26 : 0;
  const cardP = ramp(t, MAP.cardIn, MAP.cardIn + 22) * (1 - ramp(t, MAP.cardOut, MAP.cardOut + 14));
  const queueP = ramp(t, MAP.fox.queueIn, MAP.fox.queueIn + 20) * (1 - ramp(t, MAP.fox.answered - 4, MAP.fox.answered + 14));

  const ring = waiting ? 0.55 + 0.45 * Math.sin(t / 5) ** 2 : 0;
  const plotP = ramp(t, MAP.sitePlot, MAP.sitePlot + 20) * (1 - ramp(t, MAP.mapped - 6, MAP.mapped + 6));
  const badgeP = ramp(t, MAP.mapped + 16, MAP.mapped + 30) * (1 - ramp(t, 930, 960));

  const fadeIn = ramp(t, MAP.bgIn[0], MAP.bgIn[1]);
  const fadeOut = 1 - ramp(t, 1010, 1040);
  const layerOpacity = fadeIn * fadeOut;

  // Feet stand a little below the node, so the star never covers its label.
  const FEET = 38;
  const down = (p: P): P => ({ x: p.x, y: p.y + FEET });
  const gecko_ = down(scr(gecko));
  const otter_ = down(scr(orders));
  const fox_ = down(scr(fox));
  const k = 1.6;
  const ordersEdge = scr(orders);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: layerOpacity }}>
      <SaasBackground t={t} />
      <AppWindow enter={ramp(t, 4, 56)}>
      <MapCanvas diagram={EMPTY} cam={cam} />
      <Ambient t={t} />
      {mappedMix < 1 ? (
      <div style={{ position: "absolute", inset: 0, opacity: 1 - mappedMix }}>
      <MapCanvas bare diagram={LIVE} cam={cam} nodeP={nodeP} edgeP={edgeP} opacity={1}>
        {ring > 0 ? (
          <rect x={paymentsNode.x - 8} y={paymentsNode.y - 8} width={paymentsNode.w + 16} height={paymentsNode.h + 16} rx={14} fill="none" stroke={C.attention} strokeWidth={3 / cam.scale} opacity={ring * ramp(t, MAP.fox.waits + 4, MAP.fox.waits + 20)} style={{ filter: `drop-shadow(0 0 ${10 / cam.scale}px ${C.attention})` }} />
        ) : null}
        {plotP > 0 ? (
          <g opacity={plotP}>
            <rect x={SITE.x} y={SITE.y} width={SITE.w} height={SITE.h} rx={10} fill="rgba(245,158,11,0.08)" stroke={C.site} strokeWidth={1.6} strokeDasharray="7 5" />
            <text x={SITE.x + SITE.w / 2} y={SITE.y + SITE.h * 0.32} textAnchor="middle" fill={C.site} fontFamily={FONT} fontSize={8.5} fontWeight={700} letterSpacing={0.6}>NEW CODE</text>
            <text x={SITE.x + SITE.w / 2} y={SITE.y + SITE.h * 0.68} textAnchor="middle" fill={C.atlasInk} fontFamily={FONT} fontSize={12.5} fontWeight={600}>workers/refunds/</text>
          </g>
        ) : null}
      </MapCanvas>
      </div>
      ) : null}
      {mappedMix > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: mappedMix }}>
          <MapCanvas
            bare
            diagram={MAPPED}
            cam={cam}
            nodeP={(n) => (n.id === "refunds" ? refundIn : 1)}
            edgeP={(id) => (id === "payments>refunds" ? refundEdge : 1)}
          >
            {badgeP > 0 ? (
              <g opacity={badgeP} transform={`translate(${refunds.x + refunds.w - 40} ${refunds.y - 14})`}>
                <rect width={56} height={24} rx={12} fill={C.site} />
                <text x={28} y={16.5} textAnchor="middle" fill="#1a1204" fontFamily={FONT} fontSize={12.5} fontWeight={700}>New</text>
              </g>
            ) : null}
          </MapCanvas>
        </div>
      ) : null}

      {/* Agents: screen space, as the Atlas layer draws them */}
      {appear(1) > 0.9 ? <Glyphs frame={t} from={{ x: otter_.x, y: otter_.y - 24 }} to={{ x: ordersEdge.x, y: ordersEdge.y - 6 }} color={AGENT.otter.color} kind="code" seed="otter" /> : null}
      {appear(2) > 0.9 ? <Glyphs frame={t} from={{ x: fox_.x + 78, y: fox_.y - 6 }} to={fox_} color={AGENT.fox.color} kind="run" seed="fox" /> : null}
      <Agent frame={t} appear={appear(0)} at={gecko_} color={AGENT.gecko.color} name="Gecko" state="reading files…" mood="reading" task="Trace the sign-in flow" walking={geckoWalking} k={k} />
      <Agent frame={t} appear={appear(1)} at={otter_} color={AGENT.otter.color} name="Otter" state="writing code…" mood="editing" task="Speed up checkout totals" k={k} />
      <Agent frame={t} appear={appear(2)} at={fox_} color={AGENT.fox.color} name="Fox" state={foxState} mood={foxMood} task={t > MAP.mapped + 66 ? undefined : waiting ? "Run the refund migration" : "Add refund endpoint"} flag={flag} walking={foxWalking} k={k} />

      <ProjectChip opacity={ramp(t, 40, 70)} />
      <NeedsYou slide={queueP} seconds={12 + Math.max(0, Math.floor((t - MAP.fox.queueIn) / 30))} place="Payments" color={AGENT.fox.color} name="Fox" />
      <HistoryCard
        slide={cardP}
        title="Payments"
        tokens="≈$0.84 · 1.2M tokens spent here"
        entries={[
          { name: "Fox", color: AGENT.fox.color, when: "just now", intent: "Add refund endpoint", edits: 4, files: "refunds.ts, charges.ts" },
          { name: "Otter", color: AGENT.otter.color, when: "1h ago", intent: "Retry failed card charges", edits: 11, files: "retry.ts, stripe.ts" },
          { name: "Gecko", color: AGENT.gecko.color, when: "yesterday", intent: "Read through the checkout flow", edits: 0, files: "—" },
        ]}
      />

      <Cursor at={cursor} opacity={cursorIn * cursorOut} press={press} ripple={rippleP} />
      </AppWindow>

      <Caption frame={t} from={22} to={140} text="ArchDraw is a live map of your codebase." accent="live map" size={68} top={50} />
      <Caption frame={t} from={190} to={262} text="See where every agent is." size={68} top={50} />
      <Caption frame={t} from={282} to={350} text="What it's doing, right now." size={68} top={50} />
      <Caption frame={t} from={384} to={470} text="Know who needs you. First." size={68} top={50} accent="First" />
      <Caption frame={t} from={566} to={650} text="And why." size={68} top={50} />
      <Caption frame={t} from={800} to={900} text="The map grows as the code does." size={68} accent="grows" top={50} />
    </div>
  );
};
