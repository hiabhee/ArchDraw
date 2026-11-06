import raw from "./diagrams.json";

export type DNode = { id: string; group: boolean; x: number; y: number; w: number; h: number; label: string; inner: string };
export type DEdge = { id: string; d: string; stroke: string; width: number; dash: string | null; glow: string | null; markerD?: string; markerFill?: string; labelSvg?: string };
export type Diagram = { defs: string; width: number; height: number; nodes: DNode[]; edges: DEdge[] };

export const DIAGRAMS = raw as unknown as { tokens: { bg: string; grid: string }; live: Diagram; liveMapped: Diagram };
export const LIVE = DIAGRAMS.live;
export const MAPPED = DIAGRAMS.liveMapped;

export const nodeById = (d: Diagram, id: string) => {
  const n = d.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};
export const centerOf = (n: DNode) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
export const bottomOf = (n: DNode) => ({ x: n.x + n.w / 2, y: n.y + n.h });
