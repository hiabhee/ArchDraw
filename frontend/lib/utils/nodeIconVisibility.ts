/** Global icon display mode for diagram nodes. */
export type NodeIconMode = 'all' | 'normal' | 'off';

/**
 * Per-node `showIcon` overrides the global canvas preference when set.
 * `manualIcon` marks icons explicitly chosen from the Properties panel; in
 * "normal" mode those are hidden while auto-assigned icons still render.
 */
export function resolveNodeIconVisibility(
  mode: NodeIconMode,
  nodeShowIcon?: boolean,
  manualIcon?: boolean,
): boolean {
  if (nodeShowIcon !== undefined) return nodeShowIcon;
  if (mode === 'all') return true;
  if (mode === 'off') return false;
  return !manualIcon;
}
