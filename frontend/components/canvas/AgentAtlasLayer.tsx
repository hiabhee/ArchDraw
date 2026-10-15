'use client';

import { useEffect, useRef } from 'react';
import { useStoreApi, type Edge, type Node } from 'reactflow';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';
import { useCanvasTheme } from '@/lib/theme/appTheme';
import { RECENT_EDIT_MS, sessionsForLevel, type LiveAgentSession, type LiveSite } from '@/lib/diagram/projects/liveActivity';
import { useProjectLiveStore } from '@/store/projectLiveStore';
import { useDiagramGeometryPlan } from '@/components/canvas/edges/DiagramGeometryProvider';
import type { DiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';

/**
 * Agent Atlas: every live coding-agent session is a star on the architecture
 * map. It stands at the component it works on, walks along real
 * edges when it moves, sends code into a node while editing and pulls it out
 * while reading, raises a flag when it needs the user, and waits at Arrivals
 * until it touches the map. One canvas, redrawn per frame from refs — no React
 * renders per frame. View-only (pointer-events: none), never exported.
 * New code no component owns yet is a dashed construction site beside the
 * component with the nearest code; the star works there until the agent
 * puts it on the diagram.
 */

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

interface Walker {
  key: string;
  /** Current anchor in flow coordinates (follows `path`). */
  pos: Point;
  path: Point[];
  /** What the walker is heading to: a node id, `aim:<id>` or `dock`. */
  targetKey: string | null;
  fromNodeId: string | null;
  /** Screen-space slot offset (spreads stars at one place), eased. */
  slot: Point;
  particles: Particle[];
  nextParticleAt: number;
  seenAt: number;
  enteredAt: number;
}

interface Particle {
  from: Point; // flow
  to: Point; // flow
  born: number;
  life: number;
  glyph: string;
}

const GLYPHS = ['{ }', '=>', 'fn', '</>', '( )', ';', '[ ]', '++', '&&', '::'];
const WALK_SPEED_PX = 320; // screen px per second
const MAX_WALK_MS = 2400;
const READ_RECENT_MS = 20_000;
const DONE_FLAG_MS = 10 * 60_000;
const ARRIVAL_MS = 9_000;
/** Below this zoom only stars show; tags stay for agents that need the user. */
const TAG_MIN_ZOOM = 0.45;
const SITE_W = 150;
const SITE_H = 52;
const SITE_GAP = 56;
const SITE_COLOR = '#f59e0b';

function overlaps(a: Rect, b: Rect, margin = 16): boolean {
  return a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;
}

/** Whether an axis-aligned or diagonal segment passes within `margin` of a rect. */
function segmentHitsRect(p: Point, q: Point, r: Rect, margin = 10): boolean {
  const x0 = r.x - margin, y0 = r.y - margin, x1 = r.x + r.w + margin, y1 = r.y + r.h + margin;
  if (Math.max(p.x, q.x) < x0 || Math.min(p.x, q.x) > x1 || Math.max(p.y, q.y) < y0 || Math.min(p.y, q.y) > y1) return false;
  // Routes are orthogonal; for the rare diagonal, sample along it.
  if (Math.abs(p.x - q.x) < 0.5 || Math.abs(p.y - q.y) < 0.5) return true;
  for (let t = 0; t <= 1; t += 0.05) {
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  }
  return false;
}

function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function bottomAnchor(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h };
}

function nodeRect(node: Node | undefined): Rect | null {
  if (!node) return null;
  const pos = (node as Node & { positionAbsolute?: Point }).positionAbsolute ?? node.position;
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  if (!pos || !w || !h) return null;
  return { x: pos.x, y: pos.y, w, h };
}

/** Shortest node sequence between two nodes over (undirected) diagram edges. */
function shortestPath(from: string, to: string, edges: readonly Edge[], limit = 60): string[] | null {
  if (from === to) return [from];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target);
    (adj.get(e.target) ?? adj.set(e.target, []).get(e.target)!).push(e.source);
  }
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length && prev.size < limit * 20) {
    const id = queue.shift()!;
    for (const next of adj.get(id) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, id);
      if (next === to) {
        const out = [to];
        let cur = to;
        while (cur !== from) { cur = prev.get(cur)!; out.unshift(cur); }
        return out.length <= limit ? out : null;
      }
      queue.push(next);
    }
  }
  return null;
}

function shortName(s: LiveAgentSession): string {
  return s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name;
}

type Mood = 'arriving' | 'editing' | 'working' | 'reading' | 'waiting' | 'done' | 'idle' | 'aiming';

function moodOf(s: LiveAgentSession, now: number, located: boolean, aiming: boolean): Mood {
  const age = s.lastActionAt != null ? now - s.lastActionAt : Infinity;
  if (s.lastAction === 'waiting' && s.status !== 'ended') return 'waiting';
  if (s.lastAction === 'done' && age < DONE_FLAG_MS) return 'done';
  if (s.status === 'idle') return 'idle';
  if (s.lastAction === 'edit' && age < RECENT_EDIT_MS) return 'editing';
  if (s.lastAction === 'read' && age < READ_RECENT_MS) return 'reading';
  if (!located && aiming) return 'aiming';
  if (s.lastAction === 'start' && age < ARRIVAL_MS) return 'arriving';
  return 'working';
}

const MOOD_LABEL: Record<Mood, string> = {
  arriving: 'arriving',
  editing: 'editing',
  working: 'working',
  reading: 'reading',
  waiting: 'needs you',
  done: 'your turn',
  idle: 'idle',
  aiming: 'heading',
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function AgentAtlasLayer() {
  const { showLiveActivity } = useCanvasView();
  const { isDark } = useCanvasTheme();
  const rfStore = useStoreApi();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Planned edge routes: construction sites are placed clear of them.
  const plan = useDiagramGeometryPlan();
  const planRef = useRef<DiagramGeometryPlan | null>(plan);
  useEffect(() => { planRef.current = plan; }, [plan]);
  const darkRef = useRef(isDark);
  useEffect(() => { darkRef.current = isDark; }, [isDark]);

  useEffect(() => {
    if (!showLiveActivity) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const walkers = new Map<string, Walker>();
    let snapshotRef: unknown = null;
    let clockOffset = 0; // server time − client time
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(t - last, 64);
      last = t;
      const live = useProjectLiveStore.getState();
      const snapshot = live.snapshot;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!snapshot || snapshot.sessions.length === 0) {
        // Nothing to draw: sleep until the next snapshot instead of redrawing an empty canvas every frame.
        walkers.clear();
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (snapshot !== snapshotRef) {
        snapshotRef = snapshot;
        clockOffset = snapshot.serverTime - Date.now();
      }
      const now = Date.now() + clockOffset;
      const rf = rfStore.getState();
      const [tx, ty, zoom] = rf.transform;
      const toScreen = (p: Point): Point => ({ x: p.x * zoom + tx, y: p.y * zoom + ty });
      const nodes = rf.nodeInternals;
      const edges = rf.edges;

      // Bounds for the Arrivals area (left of the diagram).
      let minX = Infinity, minY = Infinity, maxY = -Infinity;
      const solidRects: Rect[] = [];
      for (const n of nodes.values()) {
        const r = nodeRect(n);
        if (!r) continue;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, r.y + r.h);
        if (n.type !== 'groupNode') solidRects.push(r);
      }
      if (!Number.isFinite(minX)) return;
      // Arrivals: a column left of the diagram, starting a little below its top.
      const dockAnchor = { x: minX - 90 / Math.max(zoom, 0.05) - 60, y: minY + 70 / Math.max(zoom, 0.05) };

      const sessions = sessionsForLevel(snapshot.sessions, live.level).filter((s) => s.status !== 'ended');
      // Figures are objects on the map: they scale with the diagram (about 60%
      // of a node's height), with a floor so they never vanish when zoomed out.
      const scale = Math.min(Math.max(zoom * 1.4, 0.42), 1.5);
      const dark = darkRef.current;
      const ink = dark ? '#e7eaee' : '#1d2026';
      const muted = dark ? 'rgba(231,234,238,0.6)' : 'rgba(29,32,38,0.55)';
      const tagBg = dark ? 'rgba(20,24,30,0.92)' : 'rgba(255,255,255,0.94)';

      // Construction sites: beside their anchor component, clear of nodes and each other.
      const siteRects = new Map<string, Rect>();
      const routes = planRef.current?.routes;
      const hitsEdge = (rect: Rect) => {
        if (!routes) return false;
        for (const route of routes.values()) {
          const w = route.waypoints;
          for (let i = 1; i < w.length; i++) if (segmentHitsRect(w[i - 1], w[i], rect)) return true;
        }
        return false;
      };
      const siteRectFor = (site: LiveSite): Rect => {
        const cached = siteRects.get(site.key);
        if (cached) return cached;
        const anchor = site.anchorId ? nodeRect(nodes.get(site.anchorId)) : null;
        // Beside the anchor first, then below (clear of the figure's name tag), left, above.
        const starts: Rect[] = anchor
          ? [
              { x: anchor.x + anchor.w + SITE_GAP, y: anchor.y + (anchor.h - SITE_H) / 2, w: SITE_W, h: SITE_H },
              { x: anchor.x + (anchor.w - SITE_W) / 2, y: anchor.y + anchor.h + SITE_GAP + 24, w: SITE_W, h: SITE_H },
              { x: anchor.x - SITE_GAP - SITE_W, y: anchor.y + (anchor.h - SITE_H) / 2, w: SITE_W, h: SITE_H },
              { x: anchor.x + (anchor.w - SITE_W) / 2, y: anchor.y - SITE_GAP - SITE_H, w: SITE_W, h: SITE_H },
            ]
          : [{ x: minX, y: maxY + SITE_GAP + 30, w: SITE_W, h: SITE_H }];
        const blockedByShapes = (rect: Rect) =>
          solidRects.some((r) => overlaps(rect, r)) || [...siteRects.values()].some((r) => overlaps(rect, r));
        let fallback: Rect | null = null;
        let chosen: Rect | null = null;
        search: for (const start of starts) {
          for (let i = 0; i < 6; i++) {
            const rect = { ...start, y: start.y + i * (SITE_H + 28) };
            if (blockedByShapes(rect)) continue;
            fallback ??= rect;
            if (!hitsEdge(rect)) { chosen = rect; break search; }
          }
        }
        // No spot clear of edges: keep it clear of components (the plot is opaque).
        const rect = chosen ?? fallback ?? starts[0];
        siteRects.set(site.key, rect);
        return rect;
      };

      // Resolve each session's place.
      type Placed = { s: LiveAgentSession; w: Walker; anchor: Point; rect: Rect | null; key: string; mood: Mood; aimRect: Rect | null; index: number; total: number };
      const placed: Placed[] = [];
      const counts = new Map<string, number>();
      const totals = new Map<string, number>();
      const draft = sessions.map((s) => {
        const siteRect = s.site ? siteRectFor(s.site) : null;
        const currentRect = siteRect ?? (s.currentComponentId ? nodeRect(nodes.get(s.currentComponentId)) : null);
        const aimRect = !currentRect && s.aimComponentId ? nodeRect(nodes.get(s.aimComponentId)) : null;
        const key = siteRect ? `site:${s.site!.key}` : currentRect ? s.currentComponentId! : aimRect ? `aim:${s.aimComponentId}` : 'dock';
        totals.set(key, (totals.get(key) ?? 0) + 1);
        return { s, currentRect, aimRect, key, atSite: !!siteRect };
      });
      for (const { s, currentRect, aimRect, key, atSite } of draft) {
        const rect = currentRect ?? aimRect;
        const anchor = rect ? bottomAnchor(rect) : dockAnchor;
        const index = counts.get(key) ?? 0;
        counts.set(key, index + 1);
        const total = totals.get(key) ?? 1;
        const slot = key === 'dock'
          ? { x: 0, y: index * (zoom >= TAG_MIN_ZOOM ? 62 : 34 * scale + 8) }
          : { x: (index - (total - 1) / 2) * 30 * scale, y: 24 * scale };

        let w = walkers.get(s.sessionKey);
        if (!w) {
          const start = key === 'dock' ? { x: anchor.x - 220 / Math.max(zoom, 0.05), y: anchor.y } : anchor;
          w = { key: s.sessionKey, pos: start, path: [anchor], targetKey: key, fromNodeId: atSite ? s.site!.anchorId : currentRect ? s.currentComponentId : null, slot, particles: [], nextParticleAt: 0, seenAt: now, enteredAt: now };
          walkers.set(s.sessionKey, w);
        }
        if (w.targetKey !== key) {
          // Walk there: along diagram edges when moving between two components.
          // A site is reached through its anchor component.
          const toId = atSite ? s.site!.anchorId : currentRect ? s.currentComponentId : aimRect ? s.aimComponentId : null;
          const route = w.fromNodeId && toId ? shortestPath(w.fromNodeId, toId, edges) : null;
          const via = route
            ? route.slice(1, atSite ? undefined : -1).map((id) => nodeRect(nodes.get(id))).filter((r): r is Rect => !!r).map(center)
            : [];
          w.path = [...via, anchor];
          w.targetKey = key;
          if (atSite) w.fromNodeId = s.site!.anchorId;
          else if (currentRect) w.fromNodeId = s.currentComponentId;
        } else {
          w.path[w.path.length - 1] = anchor; // follow the node if it is dragged
        }
        w.slot = { x: w.slot.x + (slot.x - w.slot.x) * 0.15, y: w.slot.y + (slot.y - w.slot.y) * 0.15 };
        w.seenAt = now;
        placed.push({ s, w, anchor, rect: currentRect, key, mood: moodOf(s, now, !!currentRect, !!aimRect), aimRect, index, total });
      }
      for (const key of [...walkers.keys()]) if (!sessions.some((s) => s.sessionKey === key)) walkers.delete(key);

      // Move along paths at a steady on-screen speed (sped up on long trips).
      for (const { w } of placed) {
        if (reduceMotion) { w.pos = w.path[w.path.length - 1]; w.path = [w.pos]; continue; }
        let remaining = w.path.reduce((acc, p, i) => acc + Math.hypot(p.x - (i ? w.path[i - 1].x : w.pos.x), p.y - (i ? w.path[i - 1].y : w.pos.y)), 0) * zoom;
        const speed = Math.max(WALK_SPEED_PX, remaining / (MAX_WALK_MS / 1000));
        let budget = (speed * dt) / 1000 / zoom;
        while (budget > 0 && w.path.length) {
          const next = w.path[0];
          const d = Math.hypot(next.x - w.pos.x, next.y - w.pos.y);
          if (d <= budget) {
            w.pos = { ...next };
            budget -= d;
            if (w.path.length > 1) w.path.shift(); else break;
          } else {
            w.pos = { x: w.pos.x + ((next.x - w.pos.x) / d) * budget, y: w.pos.y + ((next.y - w.pos.y) / d) * budget };
            budget = 0;
          }
        }
        remaining = Math.hypot(w.path[w.path.length - 1].x - w.pos.x, w.path[w.path.length - 1].y - w.pos.y);
        (w as Walker & { walking?: boolean }).walking = w.path.length > 1 || remaining > 1;
      }

      // Construction sites: a dashed, hatched plot tied to its anchor component.
      const drawnSites = new Set<string>();
      for (const p of placed) {
        const site = p.s.site;
        if (!site || drawnSites.has(site.key)) continue;
        drawnSites.add(site.key);
        const r = siteRectFor(site);
        const a = toScreen({ x: r.x, y: r.y });
        const sw = r.w * zoom;
        const sh = r.h * zoom;
        const anchorRect = site.anchorId ? nodeRect(nodes.get(site.anchorId)) : null;
        ctx.save();
        if (anchorRect) {
          // A faint tether from the nearest side of the anchor.
          const ac = center(anchorRect);
          const sc = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
          const horizontal = Math.abs(sc.x - ac.x) > Math.abs(sc.y - ac.y);
          const fromFlow = horizontal
            ? { x: sc.x > ac.x ? anchorRect.x + anchorRect.w : anchorRect.x, y: ac.y }
            : { x: ac.x, y: sc.y > ac.y ? anchorRect.y + anchorRect.h : anchorRect.y };
          const toFlow = horizontal
            ? { x: sc.x > ac.x ? r.x : r.x + r.w, y: sc.y }
            : { x: sc.x, y: sc.y > ac.y ? r.y : r.y + r.h };
          const from = toScreen(fromFlow);
          const to = toScreen(toFlow);
          ctx.setLineDash([2, 4]);
          ctx.strokeStyle = SITE_COLOR;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
        // Opaque card so edges never show through, with a light amber tint.
        ctx.globalAlpha = 1;
        roundRect(ctx, a.x, a.y, sw, sh, 10 * zoom);
        ctx.fillStyle = dark ? '#16191f' : '#ffffff';
        ctx.fill();
        ctx.fillStyle = dark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.07)';
        ctx.fill();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = SITE_COLOR;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        if (zoom >= 0.35) {
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxW = sw - 16 * zoom;
          ctx.fillStyle = SITE_COLOR;
          ctx.font = `700 ${8.5 * zoom}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillText('NEW CODE', a.x + sw / 2, a.y + sh * 0.32, maxW);
          ctx.fillStyle = ink;
          ctx.font = `600 ${12 * zoom}px ui-sans-serif, system-ui, sans-serif`;
          let label = site.label;
          while (label.length > 4 && ctx.measureText(label).width > maxW) label = `${label.slice(0, -2)}…`;
          ctx.fillText(label, a.x + sw / 2, a.y + sh * 0.66);
        }
        ctx.restore();
      }

      // Aim lines (dashed "probably heading here").
      for (const p of placed) {
        if (p.mood !== 'aiming' || !p.aimRect) continue;
        const a = toScreen(p.w.pos);
        const b = toScreen(center(p.aimRect));
        ctx.save();
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = p.s.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x + p.w.slot.x, a.y + p.w.slot.y - 14 * scale);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }

      // Arrivals area label.
      if (placed.some((p) => p.key === 'dock')) {
        const d = toScreen(dockAnchor);
        ctx.save();
        ctx.font = `600 ${Math.max(9 * scale, 8)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = muted;
        ctx.textAlign = 'center';
        ctx.fillText('ARRIVALS', d.x, d.y - 52 * scale - 6);
        ctx.restore();
      }

      // Code particles: into the node while editing, out of it while reading.
      for (const p of placed) {
        const w = p.w;
        const walking = (w as Walker & { walking?: boolean }).walking;
        if (!reduceMotion && p.rect && !walking && (p.mood === 'editing' || p.mood === 'reading') && now >= w.nextParticleAt) {
          const inside = { x: p.rect.x + p.rect.w * (0.2 + Math.random() * 0.6), y: p.rect.y + p.rect.h * (0.25 + Math.random() * 0.5) };
          const hand = { x: w.pos.x + w.slot.x / zoom, y: w.pos.y + (w.slot.y - 22 * scale) / zoom };
          const editing = p.mood === 'editing';
          w.particles.push({
            from: editing ? hand : inside,
            to: editing ? inside : hand,
            born: now,
            life: editing ? 900 : 1300,
            glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          });
          w.nextParticleAt = now + (editing ? 240 : 520) + Math.random() * 120;
        }
        w.particles = w.particles.filter((q) => now - q.born < q.life);
        for (const q of w.particles) {
          const k = (now - q.born) / q.life;
          const e = 1 - Math.pow(1 - k, 3);
          const fx = q.from.x + (q.to.x - q.from.x) * e;
          const fy = q.from.y + (q.to.y - q.from.y) * e - Math.sin(k * Math.PI) * 24 / zoom;
          const s = toScreen({ x: fx, y: fy });
          ctx.save();
          ctx.globalAlpha = Math.sin(k * Math.PI) * (p.mood === 'reading' ? 0.7 : 0.95);
          ctx.fillStyle = p.s.color;
          ctx.font = `600 ${Math.max((p.mood === 'reading' ? 9.5 : 11) * scale, 6)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(q.glyph, s.x, s.y);
          ctx.restore();
        }
      }

      // Figures, tags and flags.
      const focused = live.focusedSessionKey;
      for (const p of placed) {
        const w = p.w;
        const base = toScreen(w.pos);
        const x = base.x + w.slot.x;
        const y = base.y + w.slot.y;
        const walking = (w as Walker & { walking?: boolean }).walking;
        const tSec = performance.now() / 1000;
        const bob = reduceMotion ? 0 : walking ? Math.abs(Math.sin(tSec * 9 + w.enteredAt)) * -3 * scale : p.mood === 'editing' ? Math.sin(tSec * 14) * 1.2 * scale : 0;
        const faded = p.mood === 'idle';
        const hollow = p.mood === 'aiming';
        ctx.save();
        ctx.globalAlpha = faded ? 0.5 : focused && focused !== p.s.sessionKey ? 0.35 : 1;

        // The session: a five-point star in its colour. It glows, turns slowly
        // while editing, and is drawn hollow while only its task points here.
        const cx = x;
        const cy = y - 11 * scale + bob;
        const outer = 9.5 * scale;
        const inner = outer * 0.45;
        const spin = reduceMotion || p.mood !== 'editing' ? 0 : tSec * 1.6;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 === 0 ? outer : inner;
          const a = -Math.PI / 2 + spin + (k * Math.PI) / 5;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = p.s.color;
        ctx.strokeStyle = p.s.color;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.6 * scale;
        if (hollow) {
          ctx.stroke();
        } else {
          ctx.save();
          ctx.shadowColor = p.s.color;
          ctx.shadowBlur = faded ? 0 : 10 * scale;
          ctx.fill();
          ctx.restore();
        }

        // focus ring
        if (focused === p.s.sessionKey) {
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, outer + 5 * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // flag when the session needs the user
        if (p.mood === 'waiting' || p.mood === 'done') {
          const lift = reduceMotion ? 0 : Math.sin(tSec * 4) * 1.5 * scale;
          const fx = x + 8 * scale;
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.4 * scale;
          ctx.beginPath();
          ctx.moveTo(fx, y - 8 * scale);
          ctx.lineTo(fx, y - 38 * scale + lift);
          ctx.stroke();
          ctx.fillStyle = p.mood === 'waiting' ? '#f59e0b' : p.s.color;
          ctx.beginPath();
          ctx.moveTo(fx, y - 38 * scale + lift);
          ctx.lineTo(fx + 15 * scale, y - 33 * scale + lift);
          ctx.lineTo(fx, y - 28 * scale + lift);
          ctx.closePath();
          ctx.fill();
        }
        if (p.mood === 'idle' && !reduceMotion) {
          ctx.fillStyle = muted;
          ctx.font = `600 ${9 * scale}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillText('z', x + 7 * scale, y - 26 * scale - (tSec % 2) * 3 * scale);
        }

        // Name tag below the star: "<branch> · <mood>". Zoomed far out the
        // map shows only stars; agents that need the user keep a compact tag.
        const needsUser = p.mood === 'waiting' || p.mood === 'done';
        const showTag = zoom >= TAG_MIN_ZOOM || needsUser || focused === p.s.sessionKey;
        if (showTag) {
          const compact = zoom < TAG_MIN_ZOOM;
          const ts = compact ? 0.85 : Math.min(Math.max(zoom, 0.85), 1.1);
          const label = compact ? '' : shortName(p.s);
          const state = p.mood === 'aiming' && p.aimRect
            ? `→ ${String((nodes.get(p.s.aimComponentId!)?.data as { label?: unknown })?.label ?? '').slice(0, 24)}?`
            : MOOD_LABEL[p.mood];
          const stateText = label ? ` · ${state}` : state;
          ctx.font = `600 ${10.5 * ts}px ui-sans-serif, system-ui, sans-serif`;
          const lw = label ? ctx.measureText(label).width : 0;
          ctx.font = `500 ${10.5 * ts}px ui-sans-serif, system-ui, sans-serif`;
          const sw = ctx.measureText(stateText).width;
          const crowded = !compact && p.key !== 'dock' && p.total > 1;
          const dot = crowded ? 10 * ts : 0;
          const tw = lw + sw + 16 * ts + dot;
          const th = 18 * ts;
          // Several agents at one component: stack their tags in a column under
          // the group (a colour dot links each tag to its star) so none overlap.
          const tagX = crowded ? base.x - tw / 2 : x - tw / 2;
          const tagY = crowded ? base.y + 8 * ts + scale * 10 + p.index * (th + 3 * ts) : y + 5 * ts;
          ctx.fillStyle = tagBg;
          roundRect(ctx, tagX, tagY, tw, th, 9 * ts);
          ctx.fill();
          ctx.strokeStyle = p.s.color;
          ctx.globalAlpha *= 0.55;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = faded ? 0.5 : focused && focused !== p.s.sessionKey ? 0.35 : 1;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          if (crowded) {
            ctx.fillStyle = p.s.color;
            ctx.beginPath();
            ctx.arc(tagX + 10 * ts, tagY + th / 2, 3 * ts, 0, Math.PI * 2);
            ctx.fill();
          }
          if (label) {
            ctx.fillStyle = ink;
            ctx.font = `600 ${10.5 * ts}px ui-sans-serif, system-ui, sans-serif`;
            ctx.fillText(label, tagX + 8 * ts + dot, tagY + th / 2 + 0.5);
          }
          const urgent = needsUser || p.mood === 'editing';
          ctx.fillStyle = urgent ? (p.mood === 'waiting' ? '#d97706' : p.s.color) : muted;
          ctx.font = `500 ${10.5 * ts}px ui-sans-serif, system-ui, sans-serif`;
          ctx.fillText(stateText, tagX + 8 * ts + dot + lw, tagY + th / 2 + 0.5);
        }
        ctx.restore();
      }
    };
    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const unsubscribe = useProjectLiveStore.subscribe((state, prev) => {
      if (state.snapshot !== prev.snapshot) wake();
    });
    wake();
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
      observer.disconnect();
    };
  }, [showLiveActivity, rfStore]);

  if (!showLiveActivity) return null;
  return (
    <>
      <canvas
        ref={canvasRef}
        className="live-activity-overlay"
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}
      />
      <AgentAtlasSummary />
    </>
  );
}

function sessionStateText(s: LiveAgentSession): string {
  if (s.lastAction === 'waiting') return 'needs your permission';
  if (s.lastAction === 'done') return 'finished, your turn';
  return s.status;
}

/** Screen-reader text for what the canvas figures show. */
function AgentAtlasSummary() {
  const sessions = useProjectLiveStore((s) => s.snapshot?.sessions);
  const rfStore = useStoreApi();
  const current = (sessions ?? []).filter((s) => s.status !== 'ended');
  if (current.length === 0) return null;
  const labelOf = (id: string | null | undefined) => {
    if (!id) return null;
    const label = rfStore.getState().nodeInternals.get(id)?.data?.label;
    return typeof label === 'string' ? label.replace(/<br\s*\/?>/gi, ' ') : null;
  };
  return (
    <ul className="sr-only" aria-label="Agent sessions on the map">
      {current.map((s) => {
        const place = labelOf(s.currentComponentId);
        return <li key={s.sessionKey}>{`${s.name}: ${sessionStateText(s)}${place ? `, at ${place}` : ''}`}</li>;
      })}
    </ul>
  );
}
