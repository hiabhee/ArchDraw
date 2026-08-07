/** Per-node `showIcon` overrides the global canvas preference when set. */
export function resolveNodeIconVisibility(
  showNodeIcons: boolean,
  nodeShowIcon?: boolean,
): boolean {
  return nodeShowIcon ?? showNodeIcons;
}
