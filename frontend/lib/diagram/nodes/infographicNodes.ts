/**
 * Infographic pieces: plain shapes (`decorNode`: a panel, a circle, a line, an arrow) and big-number
 * cards (`statNode`: a value, a label, an optional caption and icon).
 *
 * One description of each is drawn by both the canvas (`DecorNode.tsx`, `StatNode.tsx`) and the SVG
 * export (`renderNodes.ts`), so the image matches the canvas. Shapes are decoration: they sit behind
 * cards and connections, and the edge router ignores them (`withoutDecorNodes`), so a panel under a
 * row of cards never pushes the connections between them around. `mcp-server/src/lib/canvas-ops.ts`
 * copies the stat sizing (`estimateStatSize`); change both.
 */

import { measureText, wrapText } from '@/lib/diagram/export/svg/textMeasure';
import { toCustomNodeIconName, type CustomNodeIconName } from '@/lib/icons/CustomNodeIcon';

export const DECOR_NODE_TYPE = 'decorNode';
export const STAT_NODE_TYPE = 'statNode';

export type DecorKind = 'rectangle' | 'circle' | 'line' | 'arrow';

export interface DecorNodeData {
  kind?: DecorKind;
  /** Fill of a rectangle or circle (#rrggbb). Omitted: a soft panel that follows the theme. */
  fill?: string;
  /** Outline of a rectangle or circle, or the ink of a line / arrow. */
  stroke?: string;
  strokeWidth?: number;
  /** Corner radius of a rectangle. */
  radius?: number;
  dashed?: boolean;
  /** 0..1, applied to the whole shape. */
  opacity?: number;
  /** Line / arrow ends inside the node box, as fractions (0..1) of its width and height. */
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

export interface StatNodeData {
  value?: string;
  label?: string;
  caption?: string;
  icon?: string;
  /** Accent: the value's colour and the icon's. */
  color?: string;
  /** Card background (#rrggbb). Omitted: the theme's card surface. */
  fill?: string;
}

export function isDecorNode(node: { type?: string | null }): boolean {
  return node.type === DECOR_NODE_TYPE;
}

/** The nodes edges are routed among: decoration is drawn under them and never in the way. */
export function withoutDecorNodes<T extends { type?: string | null }>(nodes: T[]): T[] {
  return nodes.some(isDecorNode) ? nodes.filter(node => !isDecorNode(node)) : nodes;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (value: unknown): string | undefined => (typeof value === 'string' && HEX.test(value) ? value : undefined);
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const r = (n: number) => Math.round(n * 100) / 100;

// ─── decorNode ───────────────────────────────────────────────────────────────

export interface DecorPrimitive {
  tag: 'rect' | 'ellipse' | 'line' | 'path';
  attrs: Record<string, string | number>;
}

/** The SVG elements of a shape, in the node's own box (0,0 to width,height). */
export function decorPrimitives(data: DecorNodeData, width: number, height: number, isDark: boolean): DecorPrimitive[] {
  const kind: DecorKind = data.kind === 'circle' || data.kind === 'line' || data.kind === 'arrow' ? data.kind : 'rectangle';
  const strokeWidth = clamp(data.strokeWidth, 0, 24, kind === 'line' || kind === 'arrow' ? 3 : 0);
  const dash: Record<string, string> = data.dashed ? { 'stroke-dasharray': `${Math.max(4, strokeWidth * 3)} ${Math.max(4, strokeWidth * 2.5)}` } : {};

  if (kind === 'line' || kind === 'arrow') {
    const ink = hex(data.stroke) ?? (isDark ? '#94a3b8' : '#64748b');
    const from = { x: clamp(data.from?.x, 0, 1, 0) * width, y: clamp(data.from?.y, 0, 1, 0.5) * height };
    const to = { x: clamp(data.to?.x, 0, 1, 1) * width, y: clamp(data.to?.y, 0, 1, 0.5) * height };
    const w = Math.max(1, strokeWidth);
    if (kind === 'line') {
      return [{ tag: 'line', attrs: { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: ink, 'stroke-width': w, 'stroke-linecap': 'round', ...dash } }];
    }
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.max(10, w * 4);
    // The shaft stops where the head starts, so a thick line does not poke through its tip.
    const end = { x: to.x - Math.cos(angle) * head * 0.8, y: to.y - Math.sin(angle) * head * 0.8 };
    const left = { x: to.x - Math.cos(angle - 0.45) * head, y: to.y - Math.sin(angle - 0.45) * head };
    const right = { x: to.x - Math.cos(angle + 0.45) * head, y: to.y - Math.sin(angle + 0.45) * head };
    return [
      { tag: 'line', attrs: { x1: from.x, y1: from.y, x2: end.x, y2: end.y, stroke: ink, 'stroke-width': w, 'stroke-linecap': 'round', ...dash } },
      { tag: 'path', attrs: { d: `M ${r(to.x)} ${r(to.y)} L ${r(left.x)} ${r(left.y)} L ${r(right.x)} ${r(right.y)} Z`, fill: ink, stroke: ink, 'stroke-width': 1, 'stroke-linejoin': 'round' } },
    ];
  }

  const fill = hex(data.fill) ?? (isDark ? '#1b2230' : '#eef2f7');
  const stroke = hex(data.stroke);
  const outline: Record<string, string | number> = stroke
    ? { stroke, 'stroke-width': strokeWidth > 0 ? strokeWidth : 1.5, ...dash }
    : { stroke: 'none' };
  const inset = typeof outline['stroke-width'] === 'number' ? outline['stroke-width'] / 2 : 0;
  if (kind === 'circle') {
    return [{ tag: 'ellipse', attrs: { cx: width / 2, cy: height / 2, rx: Math.max(0, width / 2 - inset), ry: Math.max(0, height / 2 - inset), fill, ...outline } }];
  }
  const radius = clamp(data.radius, 0, Math.min(width, height) / 2, 16);
  return [{ tag: 'rect', attrs: { x: inset, y: inset, width: Math.max(0, width - inset * 2), height: Math.max(0, height - inset * 2), rx: radius, ry: radius, fill, ...outline } }];
}

export function decorOpacity(data: DecorNodeData): number {
  return clamp(data.opacity, 0.05, 1, 1);
}

// ─── statNode ────────────────────────────────────────────────────────────────

export const STAT_PAD = 20;
export const STAT_ICON = 28;
export const STAT_VALUE_PX = 44;
export const STAT_LABEL_PX = 15;
export const STAT_CAPTION_PX = 13;
const STAT_ICON_GAP = 12;
const STAT_VALUE_LINE = 52;
const STAT_LABEL_LINE = 21;
const STAT_CAPTION_LINE = 18;
const STAT_GAP = 6;

/** The size a stat card is drawn at when none is given. Mirrored in mcp-server canvas-ops. */
export function estimateStatSize(value = '', label = '', caption = '', icon = false): { width: number; height: number } {
  const width = Math.min(420, Math.max(200, Math.round(Math.max(value.length * STAT_VALUE_PX * 0.6, label.length * STAT_LABEL_PX * 0.56, Math.min(caption.length, 44) * STAT_CAPTION_PX * 0.52) + STAT_PAD * 2)));
  const captionLines = caption ? Math.min(3, Math.ceil((caption.length * STAT_CAPTION_PX * 0.52) / (width - STAT_PAD * 2))) : 0;
  const height = Math.round(STAT_PAD * 2 + (icon ? STAT_ICON + STAT_ICON_GAP : 0) + STAT_VALUE_LINE + (label ? STAT_GAP + STAT_LABEL_LINE : 0) + (captionLines ? STAT_GAP + captionLines * STAT_CAPTION_LINE : 0));
  return { width, height };
}

export interface StatTextBlock { lines: string[]; y: number; px: number; line: number }

export interface StatLayout {
  surface: string;
  border: string;
  /** Outline while selected. */
  selectedBorder: string;
  valueColor: string;
  labelColor: string;
  captionColor: string;
  iconColor: string;
  icon?: { x: number; y: number; size: number };
  /** Text is left-aligned at `x`; each block's `y` is its first baseline. */
  x: number;
  value?: { text: string; y: number; px: number };
  label?: StatTextBlock;
  caption?: StatTextBlock;
}

export function statLayout(data: StatNodeData, width: number, height: number, isDark: boolean, hasIcon: boolean): StatLayout {
  const accent = hex(data.color);
  const inner = Math.max(40, width - STAT_PAD * 2);
  const ink = isDark ? '#f1f5f9' : '#0f172a';
  let y = STAT_PAD;
  const layout: StatLayout = {
    surface: hex(data.fill) ?? (isDark ? '#141a24' : '#ffffff'),
    border: isDark ? '#2a3342' : '#e2e8f0',
    selectedBorder: '#6366f1',
    valueColor: accent ?? ink,
    labelColor: isDark ? '#e2e8f0' : '#1e293b',
    captionColor: isDark ? '#94a3b8' : '#64748b',
    iconColor: accent ?? (isDark ? '#cbd5e1' : '#475569'),
    x: STAT_PAD,
  };
  if (hasIcon) {
    layout.icon = { x: STAT_PAD, y, size: STAT_ICON };
    y += STAT_ICON + STAT_ICON_GAP;
  }
  if (data.value) {
    // A value too wide for the card is drawn smaller rather than clipped.
    const natural = measureText(data.value, 600, STAT_VALUE_PX);
    const px = natural > inner ? Math.max(20, Math.floor(STAT_VALUE_PX * inner / natural)) : STAT_VALUE_PX;
    layout.value = { text: data.value, y: y + STAT_VALUE_LINE * 0.78, px };
    y += STAT_VALUE_LINE;
  }
  if (data.label) {
    const lines = wrapText(data.label, inner, { weight: 600, px: STAT_LABEL_PX }).slice(0, 2);
    y += STAT_GAP;
    layout.label = { lines, y: y + STAT_LABEL_LINE * 0.76, px: STAT_LABEL_PX, line: STAT_LABEL_LINE };
    y += lines.length * STAT_LABEL_LINE;
  }
  if (data.caption) {
    const room = Math.max(1, Math.floor((height - STAT_PAD - y - STAT_GAP) / STAT_CAPTION_LINE));
    const lines = wrapText(data.caption, inner, { weight: 400, px: STAT_CAPTION_PX }).slice(0, Math.max(1, Math.min(3, room)));
    y += STAT_GAP;
    layout.caption = { lines, y: y + STAT_CAPTION_LINE * 0.76, px: STAT_CAPTION_PX, line: STAT_CAPTION_LINE };
  }
  return layout;
}

/** Everyday words a stat uses for its icon, onto the closest icons the canvas has. */
const STAT_ICON_ALIASES: Record<string, string> = {
  globe: 'arch-web', world: 'arch-web', web: 'arch-web', region: 'arch-cdn', regions: 'arch-cdn', edge: 'arch-cdn',
  zap: 'arch-realtime', bolt: 'arch-realtime', fast: 'arch-realtime', speed: 'arch-realtime', latency: 'arch-realtime',
  clock: 'arch-scheduler', time: 'arch-scheduler', timer: 'arch-scheduler', calendar: 'arch-scheduler',
  money: 'arch-payment', dollar: 'arch-payment', cost: 'arch-payment', price: 'arch-payment', revenue: 'arch-payment', card: 'arch-payment',
  chart: 'arch-metrics', growth: 'arch-metrics', trend: 'arch-metrics', 'trending-up': 'arch-metrics', 'bar-chart': 'arch-metrics', activity: 'arch-metrics',
  shield: 'arch-auth', lock: 'arch-secrets', key: 'arch-secrets', security: 'arch-auth',
  user: 'arch-users', users: 'arch-users', people: 'arch-users', customers: 'arch-users', team: 'arch-users',
  heart: 'arch-health-check', check: 'arch-health-check', uptime: 'arch-health-check',
  mail: 'arch-email', email: 'arch-email', message: 'arch-chat', chat: 'arch-chat', bell: 'arch-notification',
  search: 'arch-search', file: 'arch-file', doc: 'arch-file', cloud: 'arch-external', server: 'arch-server', database: 'arch-database',
  ai: 'arch-ai', brain: 'arch-ai', sparkles: 'arch-ai', bot: 'arch-agent', code: 'arch-terminal', terminal: 'arch-terminal',
  deploy: 'arch-cicd', rocket: 'arch-cicd', storage: 'arch-storage', phone: 'arch-mobile', mobile: 'arch-mobile',
};

/**
 * The stat's icon: a canvas icon name (`database`, `arch-cache`…) or an everyday word from
 * STAT_ICON_ALIASES. A name that matches nothing shows no icon rather than a generic one.
 */
export function statIconName(data: StatNodeData, _isDark?: boolean): CustomNodeIconName | null {
  if (!data.icon) return null;
  const key = data.icon.trim().toLowerCase();
  return toCustomNodeIconName(STAT_ICON_ALIASES[key] ?? data.icon) ?? toCustomNodeIconName(key);
}

/** A node's drawn size: its style (set by the resizer), else its own size, else its data. */
export function infographicNodeSize(
  node: { style?: unknown; width?: number | null; height?: number | null; data?: unknown } | undefined,
  fallback: { width: number; height: number },
): { width: number; height: number } {
  const style = (node?.style ?? {}) as { width?: unknown; height?: unknown };
  const data = (node?.data ?? {}) as { nodeWidth?: unknown; nodeHeight?: unknown };
  const pick = (...values: unknown[]) => {
    for (const value of values) {
      const n = typeof value === 'string' ? Number.parseFloat(value) : value;
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) return n;
    }
    return undefined;
  };
  return {
    width: pick(style.width, node?.width, data.nodeWidth) ?? fallback.width,
    height: pick(style.height, node?.height, data.nodeHeight) ?? fallback.height,
  };
}
