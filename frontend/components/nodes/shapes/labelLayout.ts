import { resolveNodeIcon } from '@/lib/nodeIconResolver';
import { resolveAutoCloudIcon } from '@/lib/cloudIcons/autoResolution';
import { getTechnologyBrandSlug } from '@/lib/brandIcons';
import type { NodeIconMode } from '@/lib/utils/nodeIconVisibility';
import { type ShapeType } from '@/lib/shapeRegistry';
import type { ShapeNodeData } from './types';

export type ShapeLabelLayout = 'default' | 'icon-brand' | 'pipe-text';

export function resolveShapeLabelLayout(
  shape: ShapeType | undefined,
  data: ShapeNodeData,
  iconMode: NodeIconMode,
): ShapeLabelLayout {
  if (iconMode === 'off' || !shape) return 'default';
  // Queue shape uses pipe-text layout (horizontal label)
  if (shape === 'queue') return 'pipe-text';
  // Cylinder (vertical drum) and other large shapes use icon-brand layout
  if (shape === 'cylinder' || shape === 'rounded-rectangle' || shape === 'circle') return 'icon-brand';
  // Semantic silhouettes prefer prominent icons too (LB logos, auth shields, web clients).
  if (shape !== 'diamond' && nodeHasProminentBrand(data)) return 'icon-brand';
  return 'default';
}

function nodeHasProminentBrand(data: ShapeNodeData): boolean {
  const resolved = resolveNodeIcon({
    label: data.label,
    typeId: data.typeId,
    componentType: data.componentType,
    serviceType: data.serviceType,
    technology: data.technology,
    category: data.category,
    icon: data.icon,
    color: data.color,
  });
  if (resolved.technology && getTechnologyBrandSlug(resolved.technology)) return true;
  return Boolean(
    resolveAutoCloudIcon({
      label: data.label,
      typeId: data.typeId ?? data.componentType,
      componentId: (data as ShapeNodeData & { componentId?: string }).componentId,
      technology: data.technology,
      serviceType: data.serviceType,
      icon: data.icon,
    }),
  );
}
