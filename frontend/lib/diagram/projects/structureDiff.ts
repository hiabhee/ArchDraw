/**
 * What changed structurally between two versions of a project diagram:
 * components added, removed or renamed (by stable node id). Text/annotation
 * nodes are ignored. Pure: used by the publish route and the editor.
 */

import { isTextNode } from '@/lib/diagram/pipeline-shared/textNodes';

export interface StructureNode {
  id: string;
  type?: string;
  data?: { label?: unknown } | null;
}

export interface StructureChange {
  added: Array<{ id: string; label: string }>;
  removed: Array<{ id: string; label: string }>;
  renamed: Array<{ id: string; from: string; to: string }>;
  /** Epoch ms of the publish. */
  at: number;
}

function labelOf(node: StructureNode) {
  return typeof node.data?.label === 'string' && node.data.label.trim() ? node.data.label : node.id;
}

function components(nodes: readonly StructureNode[]) {
  return new Map(nodes.filter((n) => !isTextNode(n)).map((n) => [n.id, n]));
}

export function diffStructure(before: readonly StructureNode[], after: readonly StructureNode[], at: number): StructureChange {
  const prev = components(before);
  const next = components(after);
  const change: StructureChange = { added: [], removed: [], renamed: [], at };
  for (const [id, node] of next) {
    const old = prev.get(id);
    if (!old) change.added.push({ id, label: labelOf(node) });
    else if (labelOf(old) !== labelOf(node)) change.renamed.push({ id, from: labelOf(old), to: labelOf(node) });
  }
  for (const [id, node] of prev) {
    if (!next.has(id)) change.removed.push({ id, label: labelOf(node) });
  }
  return change;
}

export function isEmptyChange(change: StructureChange) {
  return change.added.length === 0 && change.removed.length === 0 && change.renamed.length === 0;
}

export function parseStructureChange(value: unknown): StructureChange | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<StructureChange>;
  if (!Array.isArray(v.added) || !Array.isArray(v.removed) || !Array.isArray(v.renamed) || typeof v.at !== 'number') return null;
  return { added: v.added, removed: v.removed, renamed: v.renamed, at: v.at };
}

/** "Added Queue, Cache · removed Worker · renamed API → Gateway" */
export function summarizeChange(change: StructureChange, max = 3): string {
  const list = (items: string[]) =>
    items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max}` : items.join(', ');
  const parts: string[] = [];
  if (change.added.length) parts.push(`added ${list(change.added.map((a) => a.label))}`);
  if (change.removed.length) parts.push(`removed ${list(change.removed.map((r) => r.label))}`);
  if (change.renamed.length) parts.push(`renamed ${list(change.renamed.map((r) => `${r.from} → ${r.to}`))}`);
  const text = parts.join(' · ');
  return text ? text[0].toUpperCase() + text.slice(1) : 'No structural changes';
}
