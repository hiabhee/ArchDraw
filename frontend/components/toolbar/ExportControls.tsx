'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuthStore } from '@/store/authStore';
import { analytics } from '@/lib/analytics';
import logger from '@/lib/logger';
import { getUserTier, isExportFormatAllowed, shouldWatermark } from '@/lib/userQuotas';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/UpgradeModal';
import { Button } from '@/components/ui/button';
import {
  prepareReactFlowForImageExport,
  reactFlowExportFilter,
  resolveExportBackgroundColor,
  restoreReactFlowAfterImageExport,
  waitForReactFlowFrame,
} from '@/lib/utils/prepareReactFlowForImageExport';
import { computeDiagramCropRect, cropRasterDataUrl } from '@/lib/utils/exportCrop';
import { reactFlowRef } from '@/lib/reactFlowRef';

export type ExportFormat =
  | 'png-dark'
  | 'png-light'
  | 'png-transparent'
  | 'svg-dark'
  | 'svg-light'
  | 'svg-transparent'
  | 'json'
  | 'pdf'
  | 'html-embed';

interface EmbedNode {
  id: string;
  width?: number | null;
  height?: number | null;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
}

interface EmbedEdge {
  source: string;
  target: string;
  data?: Record<string, unknown>;
  style?: React.CSSProperties;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function addWatermark(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0);
      const fontSize = Math.max(16, Math.floor(img.width / 50));
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText('Made with ArchDraw — Sign in to remove', img.width - fontSize, img.height - fontSize);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function generateEmbedHTML(nodes: EmbedNode[], edges: EmbedEdge[]): string {
  const svgWidth = 1200;
  const svgHeight = 800;

  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  const renderedNodes = nodes.map(node => {
    const width = node.width || 140;
    const height = node.height || 72;
    nodeMap.set(node.id, { x: node.position.x, y: node.position.y, width, height });
    return {
      ...node,
      width,
      height,
      color: (node.data?.color as string) || '#6B7280',
      label: (node.data?.label as string) || node.id,
    };
  });

  const renderedEdges = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    label: (edge.data?.label as string) || '',
    color: edge.style?.stroke || '#64748b',
  }));

  const nodesSVG = renderedNodes.map(node => {
    const { position: { x, y }, width, height, color, label } = node;
    return `
    <g transform="translate(${x}, ${y})" class="node">
      <rect width="${width}" height="${height}" rx="8" fill="#1e293b" stroke="${color}" stroke-width="2"/>
      <rect width="${width}" height="4" rx="2" fill="${color}"/>
      <text x="${width/2}" y="${height/2 + 5}" text-anchor="middle" fill="#f1f5f9" font-family="system-ui,sans-serif" font-size="12" font-weight="500">${escapeXml(label)}</text>
    </g>`;
  }).join('');

  const edgesSVG = renderedEdges.map(edge => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) return '';

    const sx = source.x + source.width;
    const sy = source.y + source.height / 2;
    const tx = target.x;
    const ty = target.y + target.height / 2;
    const mx = (sx + tx) / 2;

    const path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
    const labelX = (sx + tx) / 2;
    const labelY = (sy + ty) / 2 - 8;

    return `
    <g class="edge">
      <path d="${path}" fill="none" stroke="${edge.color}" stroke-width="2" marker-end="url(#arrowhead)"/>
      ${edge.label ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="10">${escapeXml(edge.label)}</text>` : ''}
    </g>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArchDraw Diagram</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: #1e293b; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); padding: 20px; max-width: 100%; overflow: auto; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .title { color: #f1f5f9; font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600; }
    .badge { background: linear-gradient(135deg, #595959, #8A8A8A); color: white; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 500; }
    svg { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="title">Architecture Diagram</span>
      <span class="badge">Created with ArchDraw</span>
    </div>
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/>
        </marker>
      </defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="0.5" opacity="0.5"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      ${edgesSVG}
      ${nodesSVG}
    </svg>
  </div>
</body>
</html>`;
}

interface ExportControlsProps {
  /** Sanitized filename base (no extension) for the active canvas */
  getExportFilename: (ext: string) => string;
}

export interface ExportControlsHandle {
  handleExport: (format: ExportFormat) => void;
}

export const ExportControls = forwardRef<ExportControlsHandle, ExportControlsProps>(function ExportControls({ getExportFilename }, ref) {
  const { nodes, edges } = useDiagramStore();
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);

  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; message: string; benefits: string[] } | null>(null);

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataUrlToBlob = (dataUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Failed to get canvas context')); return; }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert to blob'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const doExport = async (format: ExportFormat) => {
    setExportOpen(false);

    if (format === 'json') {
      const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
      downloadFile(blob, getExportFilename('json'));
      toast.success('Exported as JSON');
      return;
    }

    if (format === 'html-embed') {
      const htmlContent = generateEmbedHTML(nodes as EmbedNode[], edges as EmbedEdge[]);
      const iframeCode = `<iframe \n  src="data:text/html,${encodeURIComponent(htmlContent)}" \n  width="100%" \n  height="600" \n  style="border:none;border-radius:12px;"\n  title="ArchDraw Diagram"\n></iframe>`;
      await navigator.clipboard.writeText(iframeCode);
      toast.success('Embed code (iframe) copied to clipboard');
      return;
    }

    const isSvg = format.startsWith('svg-');
    const bgType = format.includes('dark') ? 'dark' : format.includes('light') ? 'light' : 'transparent';

    const { fitView } = useDiagramStore.getState();
    setIsExporting(true);

    let edgeSnapshots: ReturnType<typeof prepareReactFlowForImageExport> = [];

    try {
      const element = document.querySelector('.react-flow') as HTMLElement | null;
      const isTransparent = bgType === 'transparent';

      if (isSvg) {
        const state = useDiagramStore.getState();
        const layoutDirection = state.activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR';
        const exportNodes = reactFlowRef.instance?.getNodes() ?? state.nodes;

        let svgBg = 'none';
        if (!isTransparent) {
          if (bgType === 'dark') {
            svgBg = '#000000';
          } else if (element) {
            svgBg = resolveExportBackgroundColor('light', element) ?? '#ffffff';
          } else {
            svgBg = '#ffffff';
          }
        }

        const { generatePureSVG } = await import('@/lib/svgExport');
        const svgContent = generatePureSVG(
          exportNodes,
          state.edges,
          state.darkMode,
          svgBg,
          layoutDirection,
          state.diagramRenderStyle,
        );
        downloadFile(new Blob([svgContent], { type: 'image/svg+xml' }), getExportFilename('svg'));
        toast.success(isTransparent ? 'Exported as vector SVG (no background)' : 'Exported as vector SVG');
        analytics.track({
          event_type: 'export',
          event_name: 'svg',
          page_path: window.location.pathname,
          payload: { format, vector: true, success: true },
        });
        return;
      }

      if (!element) {
        toast.error('Canvas not ready. Please try again.');
        return;
      }

      const bgColor = resolveExportBackgroundColor(bgType, element);

      fitView({ padding: 0.1, duration: 300 });
      await waitForReactFlowFrame(400);

      edgeSnapshots = prepareReactFlowForImageExport(element);

      const exportFilter = (node: unknown) => reactFlowExportFilter(node as HTMLElement);
      const exportNodes = reactFlowRef.instance?.getNodes() ?? nodes;
      const shouldCrop = !!reactFlowRef.instance && exportNodes.length > 0;
      const cropRect = shouldCrop
          ? computeDiagramCropRect(exportNodes, reactFlowRef.instance!.getViewport(), 0.12)
          : null;

      const { safeToPng } = await import('@/lib/utils/safeHtmlToImage');
      const baseRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      // High-DPI export that beats native screenshot (retina 2x → 4-5x, capped to avoid OOM)
      const pixelRatio = Math.min(4, Math.max(3, Math.ceil(baseRatio * 2.5)));

      let dataUrl = await safeToPng(element, {
        backgroundColor: bgColor,
        pixelRatio,
        cacheBust: true,
        filter: exportFilter,
      });

      if (cropRect) {
        const cropped = await cropRasterDataUrl(dataUrl, cropRect, pixelRatio, 'image/png');
        dataUrl = cropped.dataUrl;
      }

      let finalDataUrl = dataUrl;
      if (shouldWatermark(tier, 'png')) {
        finalDataUrl = await addWatermark(dataUrl);
      }

      if (format.includes('pdf')) {
        const { jsPDF } = await import('jspdf');
        const img = new window.Image();
        img.src = finalDataUrl;
        await new Promise<void>((r) => { img.onload = () => r(); });
        const pdf = new jsPDF({
          orientation: img.width > img.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [img.width, img.height],
        });
        pdf.addImage(finalDataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(getExportFilename('pdf'));
        toast.success('Exported as PDF');
        analytics.track({
          event_type: 'export',
          event_name: 'pdf',
          page_path: window.location.pathname,
          payload: { format: 'pdf', success: true },
        });
      } else {
        downloadFile(await dataUrlToBlob(finalDataUrl), getExportFilename('png'));
        toast.success(isTransparent ? 'Exported as PNG (no background)' : 'Exported as PNG');
        analytics.track({
          event_type: 'export',
          event_name: 'png',
          page_path: window.location.pathname,
          payload: { format, pixel_ratio: pixelRatio, success: true },
        });
      }
    } catch (err) {
      toast.error('Export failed. Please try again.');
      logger.error(err);
      analytics.track({
        event_type: 'export',
        page_path: window.location.pathname,
        payload: { format: 'unknown', success: false, error: String(err) },
      });
    } finally {
      if (edgeSnapshots.length > 0) {
        restoreReactFlowAfterImageExport(edgeSnapshots);
      }
      setIsExporting(false);
    }
  };

  const handleExport = (format: ExportFormat) => {
    if (!isExportFormatAllowed(tier, format)) {
      setUpgradeModal({
        feature: 'export',
        message: `${format.toUpperCase().replace(/-\d+x$/, '')} export is available for signed-in users.`,
        benefits: UPGRADE_BENEFITS.export,
      });
      return;
    }
    doExport(format);
  };

  useImperativeHandle(ref, () => ({ handleExport }), [handleExport]);

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExportOpen(!exportOpen)}
          disabled={isExporting}
          className="!w-8 sm:!w-9 !h-8 sm:!h-9"
        >
          {isExporting ? <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" /> : <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
        </Button>

        {exportOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
            <div
              className="absolute right-0 top-full mt-3 w-56 rounded-2xl overflow-hidden z-30 bg-popover border border-border text-popover-foreground"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
            >
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Image</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { const isDark = useDiagramStore.getState().darkMode; handleExport(isDark ? 'png-dark' : 'png-light'); }} className="w-full justify-start rounded-none">
                PNG
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleExport('png-transparent')} className="w-full justify-start rounded-none">
                PNG (No Background)
              </Button>
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SVG (Vector)</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleExport('svg-transparent')} className="w-full justify-start rounded-none">
                SVG (No Background)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { const isDark = useDiagramStore.getState().darkMode; handleExport(isDark ? 'svg-dark' : 'svg-light'); }} className="w-full justify-start rounded-none">
                SVG (With Background)
              </Button>
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Other</p>
              </div>
              {([
                { label: 'JSON', format: 'json' },
                { label: 'PDF', format: 'pdf' },
                { label: 'HTML Embed', format: 'html-embed' },
              ] as { label: string; format: ExportFormat }[]).map(({ label, format }) => (
                <Button key={format} variant="ghost" size="sm" onClick={() => handleExport(format)} className="w-full justify-start rounded-none">
                  {label}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>

      {upgradeModal && (
        <UpgradeModal
          isOpen={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          feature={upgradeModal.feature}
          message={upgradeModal.message}
          benefits={upgradeModal.benefits}
        />
      )}
    </>
  );
})
