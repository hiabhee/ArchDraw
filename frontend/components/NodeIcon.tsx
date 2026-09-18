'use client';

import { iconRegistry } from '@/lib/iconRegistry';
import { CustomNodeIcon, toCustomNodeIconName } from './icons/CustomNodeIcon';
import { filterIconForMode, type RenderStyleId } from '@/lib/iconModeFilter';
import { normalizeColor } from '@/lib/semanticColors';

const GENERIC_ICON_COLOR = '#475569';

interface NodeIconProps {
  technology?: string;
  fallbackIcon?: string;
  fallbackColor?: string;
  size?: number;
  renderStyle?: RenderStyleId;
}

export function NodeIcon({
  technology,
  fallbackIcon,
  fallbackColor,
  size = 18,
  renderStyle = 'precision',
}: NodeIconProps) {
  const entry = technology ? iconRegistry[technology] : undefined;
  const filtered = filterIconForMode(entry?.icon ?? fallbackIcon ?? 'arch-server', technology, renderStyle);
  const customName = toCustomNodeIconName(filtered) ?? 'arch-server';
  const color = normalizeColor(entry?.color ?? fallbackColor ?? GENERIC_ICON_COLOR, customName);

  if (!toCustomNodeIconName(filtered) && filtered && /[^\w\s-]/.test(filtered)) {
    return (
      <span style={{ color, fontSize: size, lineHeight: 1 }} aria-hidden="true">
        {filtered}
      </span>
    );
  }

  return <CustomNodeIcon name={customName} color={color} size={size} />;
}

export function resolveNodeColor(technology?: string, fallbackColor?: string, iconName?: string): string {
  if (technology && iconRegistry[technology]) return iconRegistry[technology].color;
  return normalizeColor(fallbackColor, iconName) ?? GENERIC_ICON_COLOR;
}
