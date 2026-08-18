/** Global icon display mode for diagram nodes. */
export type NodeIconMode = 'all' | 'normal' | 'off';

/**
 * Per-node `showIcon` overrides the global canvas preference when set.
 * 
 * Icon visibility behavior:
 * - 'all': Show all icons (manual and auto-detected)
 * - 'normal': Show all icons (same as 'all' - manual icons are intentional and should display)
 * - 'off': Hide all icons
 * 
 * Note: The `manualIcon` parameter is preserved for potential future use but currently
 * doesn't affect visibility. Manual icons are user-selected and should be respected.
 */
export function resolveNodeIconVisibility(
  mode: NodeIconMode,
  nodeShowIcon?: boolean,
  manualIcon?: boolean,
): boolean {
  if (nodeShowIcon !== undefined) return nodeShowIcon;
  if (mode === 'off') return false;
  // Both 'all' and 'normal' show icons - manual icons are intentional user choices
  return true;
}
