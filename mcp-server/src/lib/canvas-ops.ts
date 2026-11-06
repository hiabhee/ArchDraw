import { COMM_COLORS, DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, TIER_COLORS } from './constants.js';
import type { DrawOp } from './schema.js';
import type { TierType } from '../types/index.js';

/**
 * The drawing engine behind `draw_on_canvas`: applies an ordered list of operations
 * (place text, add a card or shape, group, connect, restyle, move, align, remove) to a
 * canvas of nodes and edges. Pure: no network, no session, so every operation can be tested
 * on its own. The operations apply all together or not at all (a `DrawError` names the
 * operation that failed and nothing is returned).
 *
 * Coordinates in the operations are canvas coordinates. A node inside a group stores its
 * position relative to the group (as React Flow does); this module converts both ways.
 */

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  zIndex?: number;
  parentNode?: string;
  extent?: 'parent';
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface DrawStep {
  index: number;
  op: string;
  /** Ids created or changed by the operation. */
  ids: string[];
}

export interface DrawResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  steps: DrawStep[];
  /** A `clear` ran: the drawing started over, so it is no longer the published one. */
  cleared: boolean;
}

export class DrawError extends Error {
  constructor(public readonly index: number, public readonly op: string, message: string) {
    super(`Operation ${index + 1} (${op}): ${message}`);
    this.name = 'DrawError';
  }
}

export const MAX_NODES = 500;
export const MAX_EDGES = 1500;

// Mirrors frontend/lib/diagram/nodes/textSizing.ts: the box the editor reserves for text.
const TEXT_FONT: Record<string, number> = { small: 24, medium: 32, large: 48, heading: 72 };
const ANNOTATION_TITLE_FONT = 32;
const ANNOTATION_BODY_FONT = 24;
const AVG_CHAR = 0.6;

function lines(text: string | undefined): string[] {
  return String(text ?? '').split(/\n/).filter(Boolean);
}

export function estimateText(text: string, size = 'medium'): { width: number; height: number } {
  const font = TEXT_FONT[size] ?? 32;
  const rows = lines(text || 'Text');
  const longest = Math.max(1, ...rows.map(row => row.length));
  return {
    width: Math.min(560, Math.max(60, Math.round(longest * font * AVG_CHAR + 16))),
    height: Math.max(100, Math.round(Math.max(1, rows.length) * font * 1.3 + 12)),
  };
}

export function estimateNote(title?: string, body?: string): { width: number; height: number } {
  const titleRows = lines(title || 'Note');
  const bodyRows = lines(body);
  const longest = Math.max(1, ...titleRows.map(row => row.length), ...bodyRows.map(row => row.length));
  return {
    width: Math.min(360, Math.max(180, Math.round(longest * ANNOTATION_BODY_FONT * AVG_CHAR + 24))),
    height: Math.max(100, Math.round(titleRows.length * ANNOTATION_TITLE_FONT * 1.4 + bodyRows.length * ANNOTATION_BODY_FONT * 1.4 + 20)),
  };
}

const SHAPE_SIZE: Record<string, { width: number; height: number }> = {
  'rounded-rectangle': { width: 200, height: 90 },
  rectangle: { width: 200, height: 90 },
  diamond: { width: 180, height: 130 },
  circle: { width: 130, height: 130 },
  cylinder: { width: 160, height: 120 },
  hexagon: { width: 200, height: 100 },
  cloud: { width: 220, height: 120 },
  parallelogram: { width: 220, height: 90 },
  shield: { width: 180, height: 110 },
  actor: { width: 110, height: 130 },
  monitor: { width: 220, height: 130 },
  mobile: { width: 130, height: 210 },
  'dashed-rectangle': { width: 200, height: 90 },
};

const GROUP_PAD = { left: 28, right: 28, top: 48, bottom: 28 };

interface Box { x: number; y: number; w: number; h: number }

const HAS_SIZE_FIELDS = new Set(['width', 'height']);

/** What `update` may set on each kind of node (anything else is an error, not a silent no-op). */
const UPDATABLE: Record<string, ReadonlySet<string>> = {
  textLabelNode: new Set(['text', 'size', 'bold', 'color', 'x', 'y', 'parent', 'width', 'height']),
  shapeNode: new Set(['title', 'subtitle', 'color', 'fill', 'shape', 'x', 'y', 'width', 'height', 'parent']),
  annotationNode: new Set(['title', 'body', 'x', 'y', 'width', 'height', 'parent']),
  systemNode: new Set(['label', 'title', 'subtitle', 'color', 'x', 'y', 'width', 'height', 'parent']),
  groupNode: new Set(['label', 'color', 'x', 'y', 'width', 'height', 'parent']),
  edge: new Set(['label', 'color', 'style']),
};

export function applyDrawOps(inputNodes: CanvasNode[], inputEdges: CanvasEdge[], ops: DrawOp[]): DrawResult {
  let nodes: CanvasNode[] = inputNodes.map(node => ({ ...node, position: { ...node.position }, data: { ...node.data } }));
  let edges: CanvasEdge[] = inputEdges.map(edge => ({ ...edge, data: edge.data ? { ...(edge.data as object) } : edge.data }));
  const steps: DrawStep[] = [];
  let cleared = false;

  const find = (id: string) => nodes.find(node => node.id === id);
  const nodeMap = () => new Map(nodes.map(node => [node.id, node]));
  const isGroup = (node: CanvasNode) => node.type === 'groupNode' || node.type === 'group' || node.data?.isGroup === true;

  const abs = (node: CanvasNode, map = nodeMap()): { x: number; y: number } => {
    let x = node.position.x, y = node.position.y;
    const seen = new Set([node.id]);
    for (let parent = node.parentNode ? map.get(node.parentNode) : undefined; parent && !seen.has(parent.id); parent = parent.parentNode ? map.get(parent.parentNode) : undefined) {
      seen.add(parent.id);
      x += parent.position.x;
      y += parent.position.y;
    }
    return { x, y };
  };
  const sizeOf = (node: CanvasNode) => ({ w: node.width ?? DEFAULT_NODE_WIDTH, h: node.height ?? DEFAULT_NODE_HEIGHT });
  const boxOf = (node: CanvasNode, map = nodeMap()): Box => ({ ...abs(node, map), ...sizeOf(node) });

  /** Put a node at a canvas position, whatever its parent. */
  const setAbs = (node: CanvasNode, x: number, y: number) => {
    const map = nodeMap();
    const parent = node.parentNode ? map.get(node.parentNode) : undefined;
    const origin = parent ? abs(parent, map) : { x: 0, y: 0 };
    node.position = { x: x - origin.x, y: y - origin.y };
  };
  const reparent = (node: CanvasNode, parentId: string | undefined) => {
    const here = abs(node);
    if (parentId) { node.parentNode = parentId; node.extent = 'parent'; }
    else { delete node.parentNode; delete node.extent; }
    setAbs(node, here.x, here.y);
  };

  const counters = new Map<string, number>();
  const taken = () => new Set([...nodes.map(node => node.id), ...edges.map(edge => edge.id)]);
  const freshId = (prefix: string) => {
    const used = taken();
    let n = counters.get(prefix) ?? 0;
    do { n++; } while (used.has(`${prefix}_${n}`));
    counters.set(prefix, n);
    return `${prefix}_${n}`;
  };

  const resolveId = (index: number, op: string, requested: string | undefined, prefix: string) => {
    if (requested === undefined) return freshId(prefix);
    if (taken().has(requested)) throw new DrawError(index, op, `the id "${requested}" is already used.`);
    return requested;
  };
  const need = (index: number, op: string, id: string): CanvasNode => {
    const node = find(id);
    if (!node) throw new DrawError(index, op, `there is no node "${id}".`);
    return node;
  };
  const checkParent = (index: number, op: string, parent: string | undefined) => {
    if (parent === undefined) return;
    const group = find(parent);
    if (!group) throw new DrawError(index, op, `there is no group "${parent}".`);
    if (!isGroup(group)) throw new DrawError(index, op, `"${parent}" is not a group.`);
  };
  const place = (node: CanvasNode, x: number, y: number, parent: string | undefined) => {
    if (parent) { node.parentNode = parent; node.extent = 'parent'; }
    setAbs(node, x, y);
  };
  const add = (node: CanvasNode) => {
    if (nodes.length >= MAX_NODES) throw new Error(`A canvas holds at most ${MAX_NODES} nodes.`);
    nodes.push(node);
  };

  ops.forEach((op, index) => {
    const ids: string[] = [];
    switch (op.op) {
      case 'text': {
        checkParent(index, op.op, op.parent);
        const id = resolveId(index, op.op, op.id, 'text');
        const size = op.size ?? 'medium';
        const dims = estimateText(op.text, size);
        const node: CanvasNode = {
          id, type: 'textLabelNode', position: { x: 0, y: 0 }, width: dims.width, height: dims.height, zIndex: 2,
          data: { text: op.text, fontSize: size, ...(op.bold !== undefined ? { bold: op.bold } : {}), ...(op.color ? { color: op.color } : {}) },
        };
        place(node, op.x, op.y, op.parent);
        add(node);
        ids.push(id);
        break;
      }
      case 'card': {
        checkParent(index, op.op, op.parent);
        const id = resolveId(index, op.op, op.id, 'card');
        const shape = op.shape ?? 'rounded-rectangle';
        const base = SHAPE_SIZE[shape] ?? SHAPE_SIZE['rounded-rectangle'];
        const titleLength = (op.title ?? '').length;
        const width = op.width ?? Math.min(360, Math.max(base.width, Math.round(titleLength * 11 + 48)));
        const height = op.height ?? base.height;
        const node: CanvasNode = {
          id, type: 'shapeNode', position: { x: 0, y: 0 }, width, height, zIndex: 1,
          data: {
            label: op.title ?? '',
            ...(op.subtitle ? { subtitle: op.subtitle, sublabel: op.subtitle } : {}),
            shape: shape === 'rectangle' ? 'rounded-rectangle' : shape,
            category: 'Compute',
            nodeWidth: width,
            nodeHeight: height,
            ...(op.color ? { color: op.color, strokeColor: op.color, accentColor: op.color } : {}),
            ...(op.fill ? { fillColor: op.fill } : {}),
          },
        };
        place(node, op.x, op.y, op.parent);
        add(node);
        ids.push(id);
        break;
      }
      case 'note': {
        checkParent(index, op.op, op.parent);
        const id = resolveId(index, op.op, op.id, 'note');
        const dims = estimateNote(op.title, op.body);
        const node: CanvasNode = {
          id, type: 'annotationNode', position: { x: 0, y: 0 }, width: op.width ?? dims.width, height: op.height ?? dims.height, zIndex: 2,
          data: { title: op.title ?? '', body: op.body ?? '', titleSize: op.titleSize ?? 'heading', bodySize: op.bodySize ?? 'medium' },
        };
        place(node, op.x, op.y, op.parent);
        add(node);
        ids.push(id);
        break;
      }
      case 'component': {
        checkParent(index, op.op, op.parent);
        const id = resolveId(index, op.op, op.id, 'component');
        const tier = (op.tier ?? 'compute') as TierType;
        const node: CanvasNode = {
          id, type: 'systemNode', position: { x: 0, y: 0 }, width: op.width ?? DEFAULT_NODE_WIDTH, height: op.height ?? DEFAULT_NODE_HEIGHT, zIndex: 1,
          data: {
            label: op.label,
            ...(op.subtitle ? { subtitle: op.subtitle } : {}),
            icon: op.icon ?? 'box',
            layer: tier,
            tier,
            tierColor: TIER_COLORS[tier],
            ...(op.status ? { status: op.status } : {}),
          },
        };
        place(node, op.x, op.y, op.parent);
        add(node);
        ids.push(id);
        break;
      }
      case 'group': {
        const id = resolveId(index, op.op, op.id, 'group');
        const children = (op.children ?? []).map(child => need(index, op.op, child));
        if (children.length === 0 && (op.x === undefined || op.y === undefined || op.width === undefined || op.height === undefined)) {
          throw new DrawError(index, op.op, 'give the group children to wrap, or an x, y, width and height.');
        }
        if (new Set(op.children ?? []).has(id)) throw new DrawError(index, op.op, 'a group cannot contain itself.');
        const map = nodeMap();
        const boxes = children.map(child => boxOf(child, map));
        const minX = boxes.length ? Math.min(...boxes.map(b => b.x)) : 0;
        const minY = boxes.length ? Math.min(...boxes.map(b => b.y)) : 0;
        const maxX = boxes.length ? Math.max(...boxes.map(b => b.x + b.w)) : 0;
        const maxY = boxes.length ? Math.max(...boxes.map(b => b.y + b.h)) : 0;
        const x = op.x ?? minX - GROUP_PAD.left;
        const y = op.y ?? minY - GROUP_PAD.top;
        const width = op.width ?? maxX - minX + GROUP_PAD.left + GROUP_PAD.right;
        const height = op.height ?? maxY - minY + GROUP_PAD.top + GROUP_PAD.bottom;
        const group: CanvasNode = {
          id, type: 'groupNode', position: { x, y }, width, height, zIndex: -1, style: { width, height },
          data: {
            label: op.label ?? '', groupLabel: op.label ?? '', isGroup: true, icon: 'layers', layer: 'compute',
            ...(op.color ? { groupColor: op.color } : {}),
          },
        };
        // The parent goes before its children, or React Flow cannot resolve the parent.
        const first = children.length ? Math.min(...children.map(child => nodes.indexOf(child))) : nodes.length;
        if (nodes.length >= MAX_NODES) throw new Error(`A canvas holds at most ${MAX_NODES} nodes.`);
        nodes.splice(first, 0, group);
        for (const child of children) {
          const here = abs(child, nodeMap());
          child.parentNode = id;
          child.extent = 'parent';
          child.position = { x: here.x - x, y: here.y - y };
        }
        ids.push(id, ...children.map(child => child.id));
        break;
      }
      case 'connect': {
        const source = need(index, op.op, op.from);
        const target = need(index, op.op, op.to);
        if (source.id === target.id) throw new DrawError(index, op.op, 'a connection cannot join a node to itself.');
        if (isGroup(source) || isGroup(target)) throw new DrawError(index, op.op, 'connect nodes inside the groups; a connection cannot end on a group.');
        if (edges.length >= MAX_EDGES) throw new Error(`A canvas holds at most ${MAX_EDGES} connections.`);
        const id = resolveId(index, op.op, op.id, 'edge');
        const dashed = op.style === 'dashed';
        const color = op.color ?? (dashed ? COMM_COLORS.async.color : COMM_COLORS.sync.color);
        const variant = op.arrow === 'both' ? 'bidirectional' : (op.style ?? 'solid');
        const label = op.label ?? '';
        edges.push({
          id, source: op.from, target: op.to,
          type: 'simpleFloating',
          animated: dashed,
          label,
          labelShowBg: true,
          labelBgPadding: [8, 4],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.9 },
          labelStyle: { fontSize: 10, fontWeight: 600, fill: '#e2e8f0' },
          style: { stroke: color, strokeWidth: op.style === 'thick' ? 4 : 2, strokeDasharray: dashed ? '6 4' : '' },
          markerEnd: { type: 'arrowclosed', color },
          data: {
            communicationType: dashed ? 'async' : 'sync',
            pathType: ({ smooth: 'Smoothstep', step: 'step', straight: 'straight', bezier: 'bezier' } as const)[op.path ?? 'smooth'],
            label,
            edgeVariant: variant,
            ...(op.fromSide ? { laneSourceSide: op.fromSide } : {}),
            ...(op.toSide ? { laneTargetSide: op.toSide } : {}),
          },
        });
        ids.push(id);
        break;
      }
      case 'update': {
        const edge = edges.find(candidate => candidate.id === op.id);
        const node = edge ? undefined : need(index, op.op, op.id);
        const kind = edge ? 'edge' : (node!.type in UPDATABLE ? node!.type : 'systemNode');
        const given = Object.keys(op).filter(key => key !== 'op' && key !== 'id' && (op as Record<string, unknown>)[key] !== undefined);
        const bad = given.filter(key => !UPDATABLE[kind].has(key));
        if (bad.length) throw new DrawError(index, op.op, `${bad.join(', ')} cannot be set on ${edge ? 'a connection' : `a ${kind}`} (it accepts: ${[...UPDATABLE[kind]].join(', ')}).`);
        if (given.length === 0) throw new DrawError(index, op.op, 'nothing to change.');
        if (edge) {
          const data = { ...((edge.data as Record<string, unknown>) ?? {}) };
          if (op.label !== undefined) { edge.label = op.label; data.label = op.label; }
          if (op.color) {
            edge.style = { ...((edge.style as object) ?? {}), stroke: op.color };
            edge.markerEnd = { type: 'arrowclosed', color: op.color };
          }
          if (op.style) {
            const dashed = op.style === 'dashed';
            edge.animated = dashed;
            edge.style = { ...((edge.style as object) ?? {}), strokeWidth: op.style === 'thick' ? 4 : 2, strokeDasharray: dashed ? '6 4' : '' };
            data.edgeVariant = op.style;
            data.communicationType = dashed ? 'async' : 'sync';
          }
          edge.data = data;
        } else {
          const n = node!;
          const data = n.data;
          if (n.type === 'textLabelNode') {
            if (op.text !== undefined) data.text = op.text;
            if (op.size !== undefined) data.fontSize = op.size;
            if (op.bold !== undefined) data.bold = op.bold;
            if (op.color) data.color = op.color;
            if (op.text !== undefined || op.size !== undefined) {
              const dims = estimateText(String(data.text ?? ''), String(data.fontSize ?? 'medium'));
              if (op.width === undefined) n.width = dims.width;
              if (op.height === undefined) n.height = dims.height;
            }
          } else if (n.type === 'shapeNode') {
            if (op.title !== undefined) data.label = op.title;
            if (op.subtitle !== undefined) { data.subtitle = op.subtitle; data.sublabel = op.subtitle; }
            if (op.color) { data.color = op.color; data.strokeColor = op.color; data.accentColor = op.color; }
            if (op.fill) data.fillColor = op.fill;
            if (op.shape) data.shape = op.shape === 'rectangle' ? 'rounded-rectangle' : op.shape;
          } else if (n.type === 'annotationNode') {
            if (op.title !== undefined) data.title = op.title;
            if (op.body !== undefined) data.body = op.body;
          } else if (n.type === 'groupNode') {
            if (op.label !== undefined) { data.label = op.label; data.groupLabel = op.label; }
            if (op.color) data.groupColor = op.color;
          } else {
            const label = op.label ?? op.title;
            if (label !== undefined) data.label = label;
            if (op.subtitle !== undefined) data.subtitle = op.subtitle;
            if (op.color) { data.tierColor = op.color; data.accentColor = op.color; }
          }
          for (const key of HAS_SIZE_FIELDS) {
            const value = (op as Record<string, unknown>)[key] as number | undefined;
            if (value === undefined) continue;
            n[key] = value;
            if (n.type === 'shapeNode') data[key === 'width' ? 'nodeWidth' : 'nodeHeight'] = value;
            if (n.type === 'groupNode') n.style = { ...((n.style as object) ?? {}), [key]: value };
          }
          if (op.parent !== undefined) {
            if (op.parent === null) reparent(n, undefined);
            else {
              checkParent(index, op.op, op.parent);
              const map = nodeMap();
              for (let p: CanvasNode | undefined = map.get(op.parent), guard = 0; p && guard < 64; p = p.parentNode ? map.get(p.parentNode) : undefined, guard++) {
                if (p.id === n.id) throw new DrawError(index, op.op, 'a node cannot be put inside itself or something inside it.');
              }
              reparent(n, op.parent);
            }
          }
          if (op.x !== undefined || op.y !== undefined) {
            const here = abs(n);
            setAbs(n, op.x ?? here.x, op.y ?? here.y);
          }
        }
        ids.push(op.id);
        break;
      }
      case 'move': {
        const selected = op.ids.map(id => need(index, op.op, id));
        const hasDelta = op.dx !== undefined || op.dy !== undefined;
        const hasTarget = op.x !== undefined || op.y !== undefined;
        if (hasDelta === hasTarget) throw new DrawError(index, op.op, 'give either dx / dy (shift by) or x / y (move to), not both and not neither.');
        const map = nodeMap();
        const selectedIds = new Set(selected.map(node => node.id));
        const hasSelectedAncestor = (node: CanvasNode) => {
          for (let p = node.parentNode ? map.get(node.parentNode) : undefined, guard = 0; p && guard < 64; p = p.parentNode ? map.get(p.parentNode) : undefined, guard++) {
            if (selectedIds.has(p.id)) return true;
          }
          return false;
        };
        const movers = selected.filter(node => !hasSelectedAncestor(node));
        const boxes = movers.map(node => boxOf(node, map));
        const dx = hasDelta ? (op.dx ?? 0) : op.x !== undefined ? op.x - Math.min(...boxes.map(b => b.x)) : 0;
        const dy = hasDelta ? (op.dy ?? 0) : op.y !== undefined ? op.y - Math.min(...boxes.map(b => b.y)) : 0;
        movers.forEach((node, i) => setAbs(node, boxes[i].x + dx, boxes[i].y + dy));
        ids.push(...selected.map(node => node.id));
        break;
      }
      case 'align': {
        const selected = op.ids.map(id => need(index, op.op, id));
        const map = nodeMap();
        const boxes = selected.map(node => boxOf(node, map));
        const left = Math.min(...boxes.map(b => b.x)), right = Math.max(...boxes.map(b => b.x + b.w));
        const top = Math.min(...boxes.map(b => b.y)), bottom = Math.max(...boxes.map(b => b.y + b.h));
        selected.forEach((node, i) => {
          const b = boxes[i];
          const x = op.mode === 'left' ? left : op.mode === 'right' ? right - b.w : op.mode === 'center' ? (left + right) / 2 - b.w / 2 : b.x;
          const y = op.mode === 'top' ? top : op.mode === 'bottom' ? bottom - b.h : op.mode === 'middle' ? (top + bottom) / 2 - b.h / 2 : b.y;
          setAbs(node, x, y);
        });
        ids.push(...selected.map(node => node.id));
        break;
      }
      case 'distribute': {
        const selected = op.ids.map(id => need(index, op.op, id));
        const map = nodeMap();
        const horizontal = op.axis === 'horizontal';
        const items = selected.map(node => ({ node, box: boxOf(node, map) })).sort((a, b) => (horizontal ? a.box.x - b.box.x : a.box.y - b.box.y));
        const len = (box: Box) => (horizontal ? box.w : box.h);
        const start = (box: Box) => (horizontal ? box.x : box.y);
        const first = items[0].box, last = items[items.length - 1].box;
        const gap = op.gap ?? (start(last) + len(last) - start(first) - items.reduce((sum, item) => sum + len(item.box), 0)) / (items.length - 1);
        let cursor = start(first);
        for (const item of items) {
          setAbs(item.node, horizontal ? cursor : item.box.x, horizontal ? item.box.y : cursor);
          cursor += len(item.box) + gap;
        }
        ids.push(...selected.map(node => node.id));
        break;
      }
      case 'remove': {
        for (const id of op.ids) {
          if (!find(id) && !edges.some(edge => edge.id === id)) throw new DrawError(index, op.op, `there is nothing called "${id}".`);
        }
        for (const id of op.ids) {
          const node = find(id);
          if (node) {
            // A removed group frees its children, where they are on the canvas.
            for (const child of nodes.filter(candidate => candidate.parentNode === id)) reparent(child, node.parentNode);
            nodes = nodes.filter(candidate => candidate.id !== id);
            edges = edges.filter(edge => edge.source !== id && edge.target !== id);
          } else {
            edges = edges.filter(edge => edge.id !== id);
          }
          ids.push(id);
        }
        break;
      }
      case 'clear': {
        nodes = [];
        edges = [];
        cleared = true;
        break;
      }
    }
    steps.push({ index, op: op.op, ids });
  });

  return { nodes: parentsFirst(nodes), edges, steps, cleared };
}

/** React Flow needs a node's parent to come before it. Stable otherwise. */
function parentsFirst(nodes: CanvasNode[]): CanvasNode[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const done = new Set<string>();
  const out: CanvasNode[] = [];
  const visit = (node: CanvasNode, depth = 0) => {
    if (done.has(node.id) || depth > 64) return;
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined;
    if (parent) visit(parent, depth + 1);
    done.add(node.id);
    out.push(node);
  };
  for (const node of nodes) visit(node);
  return out;
}
