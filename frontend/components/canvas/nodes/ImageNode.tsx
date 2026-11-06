'use client';

import { memo } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { ExternalLink } from 'lucide-react';
import { NodeHandles } from '@/components/canvas/nodes/NodeHandles';
import { useCanvasView } from '@/lib/diagram/canvas/CanvasHostContext';

export interface ImageNodeData {
  /** https image URL or a small data: URL. */
  src?: string;
  /** Preview page the image links to. */
  href?: string;
  caption?: string;
}

/** A picture on the canvas: a pasted image, or an ArchDraw preview with its link. */
export const ImageNode = memo(function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const { readOnly } = useCanvasView();
  const src = typeof data.src === 'string' && /^(https?:|data:image\/)/i.test(data.src) ? data.src : undefined;
  const href = typeof data.href === 'string' && /^https?:/i.test(data.href) ? data.href : undefined;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface-panel shadow-sm">
      {!readOnly && <NodeResizer isVisible={selected} minWidth={120} minHeight={80} keepAspectRatio />}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={data.caption || 'Pasted image'} draggable={false} className="min-h-0 flex-1 object-contain" />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-text-secondary">Image unavailable</div>
      )}
      {(href || data.caption) && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1 text-xs text-text-secondary">
          <span className="truncate">{data.caption}</span>
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="nodrag inline-flex items-center gap-1 text-brand-text hover:underline">
              Open <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      )}
      <NodeHandles />
    </div>
  );
});
