'use client';

import { useState, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDiagramStore } from '@/store/diagramStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/store/authStore';
import { analytics } from '@/lib/client/analytics';
import logger from '@/lib/logger';
import { getUserTier, isExportFormatAllowed, shouldWatermark } from '@/lib/quotas/userQuotas';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/editor/modals/UpgradeModal';
import { Button } from '@/components/ui/button';
import { pngDataUrlToBlob } from '@/lib/diagram/export/prepareReactFlowForImageExport';
import { reactFlowRef } from '@/lib/client/reactFlowRef';
import type { CanvasBackgroundConfig } from '@/store/diagram/types';
import type { SvgCanvasBackground } from '@/lib/diagram/export/svgExport';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';

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

function resolveSvgCanvasBackground(
  background: CanvasBackgroundConfig,
  showGrid: boolean,
  isDark: boolean,
  reactFlowElement: HTMLElement | null,
): SvgCanvasBackground {
  const computedStyle = reactFlowElement ? window.getComputedStyle(reactFlowElement) : null;
  const themeGridToken = computedStyle?.getPropertyValue('--arch-canvas-grid').trim() ?? '';
  const gridToken = computedStyle?.getPropertyValue('--grid-color').trim() ?? '';
  const defaultColor = background.variant === 'dots'
    ? themeGridToken || (isDark ? '#94a3b8' : '#e2e8f0')
    : themeGridToken || (isDark ? (gridToken ? `hsl(${gridToken})` : '#475569') : '#e5e7eb');
  const configuredColor = background.patternColor
    ?.replace('var(--grid-color)', themeGridToken || (gridToken ? `hsl(${gridToken})` : '')) ?? null;

  return {
    ...background,
    patternColor: configuredColor || defaultColor,
    showGrid,
  };
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

type ExportBg = 'dark' | 'light' | 'transparent';

function exportSnapshot(bgType: ExportBg, element: HTMLElement | null) {
  const state = useDiagramStore.getState();
  const flow = reactFlowRef.instance;
  const transparent = bgType === 'transparent';
  const isDark = transparent ? state.darkMode : bgType === 'dark';
  // Read the graph from React Flow so High-level and Detailed view export the visible projection.
  return {
    nodes: (flow?.getNodes() ?? state.nodes).map((node) => ({ ...node, selected: false, dragging: false })),
    edges: (flow?.getEdges() ?? state.edges).map((edge) => ({ ...edge, selected: false })),
    view: {
      readOnly: true,
      renderStyleId: state.diagramRenderStyle,
      colorThemeId: state.diagramStyleTheme,
      direction: state.activeLayoutPresetId === 'layered-tb' ? 'TD' as const : 'LR' as const,
      iconMode: state.iconMode,
      isDark,
      labelZoom: flow?.getZoom(),
      planKey: state.activeCanvasId ?? 'active-canvas',
    },
    background: state.canvasBackground,
    svgBackground: resolveSvgCanvasBackground(state.canvasBackground, state.showGrid, isDark, element),
    showGrid: state.showGrid,
    transparent,
    showGroupPlates: !!element?.querySelector('[data-group-plates]'),
  };
}

async function buildExportSvg(snapshot: ReturnType<typeof exportSnapshot>): Promise<string> {
  const { nodes, edges, view, transparent, background, svgBackground } = snapshot;
  const [{ generatePureSVG }, { embedExportAssets }] = await Promise.all([
    import('@/lib/diagram/export/svgExport'),
    import('@/lib/diagram/export/svg/embedAssets'),
  ]);
  await document.fonts.ready;
  const fill = transparent ? 'none' : background.bgColor ?? resolveCanvasTokens(view).cssVars['--arch-canvas-bg'];
  const svg = generatePureSVG(nodes, edges, view.isDark, fill, view.direction, view.renderStyleId,
    view.colorThemeId, view.iconMode, svgBackground, view.labelZoom);
  return embedExportAssets(svg);
}

function generateEmbedHTML(svg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ArchDraw Diagram</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #0f172a; }
    body { display: flex; align-items: center; justify-content: center; padding: 12px; }
    svg { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; }
  </style>
</head>
<body>
${svg}
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
  const { nodes, edges } = useDiagramStore(useShallow((s) => ({ nodes: s.nodes, edges: s.edges })));
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);

  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportInProgress = useRef(false);
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; message: string; benefits: string[] } | null>(null);

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Firefox/Safari require the anchor to be in the DOM and revoke must be delayed
    // until after the browser has started the download.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Use timeout so Safari doesn't abort the download when revoking immediately.
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  };

  const doExport = async (format: ExportFormat) => {
    if (exportInProgress.current) return;
    setExportOpen(false);

    if (format === 'json') {
      const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
      downloadFile(blob, getExportFilename('json'));
      toast.success('Exported as JSON');
      return;
    }

    if (format === 'html-embed') {
      try {
        const svg = await buildExportSvg(exportSnapshot('dark', document.querySelector<HTMLElement>('.react-flow')));
        const htmlContent = generateEmbedHTML(svg);
        const iframeCode = `<iframe \n  srcdoc="${htmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" \n  width="100%" \n  height="600" \n  style="border:none;border-radius:12px;"\n  title="ArchDraw Diagram"\n></iframe>`;
        await navigator.clipboard.writeText(iframeCode);
        toast.success('Embed code (iframe) copied to clipboard');
      } catch (err) {
        logger.error('HTML embed export failed', err);
        toast.error('Could not copy embed code. Please try again.');
      }
      return;
    }

    const isSvg = format.startsWith('svg-');
    const bgType: ExportBg = format === 'pdf'
      ? (useDiagramStore.getState().darkMode ? 'dark' : 'light')
      : format.includes('dark') ? 'dark' : format.includes('light') ? 'light' : 'transparent';

    exportInProgress.current = true;
    setIsExporting(true);

    try {
      const element = document.querySelector<HTMLElement>('.react-flow');
      const snapshot = exportSnapshot(bgType, element);
      const isTransparent = snapshot.transparent;

      if (isSvg) {
        const svgContent = await buildExportSvg(snapshot);
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

      let raster: { dataUrl: string; pixelRatio: number };
      try {
        const { captureDiagram } = await import('@/lib/diagram/export/captureDiagram');
        raster = await captureDiagram(snapshot);
      } catch (error) {
        logger.warn('Canvas capture failed. Rendering the diagram from SVG.', error);
        const { rasterizeExportSvg } = await import('@/lib/diagram/export/rasterizeSvg');
        const svg = await buildExportSvg(snapshot);
        raster = await rasterizeExportSvg(svg, Math.min(4, Math.max(3, Math.ceil(window.devicePixelRatio * 2))));
      }
      const { dataUrl, pixelRatio } = raster;

      let finalDataUrl = dataUrl;
      if (shouldWatermark(tier, 'png')) {
        finalDataUrl = await addWatermark(dataUrl);
      }

      if (format.includes('pdf')) {
        const { jsPDF } = await import('jspdf');
        const img = new window.Image();
        img.src = finalDataUrl;
        await img.decode();
        const width = img.naturalWidth * 72 / 96;
        const height = img.naturalHeight * 72 / 96;
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [width, height],
          compress: true,
        });
        pdf.addImage(finalDataUrl, 'PNG', 0, 0, width, height);
        pdf.save(getExportFilename('pdf'));
        toast.success('Exported as PDF');
        analytics.track({
          event_type: 'export',
          event_name: 'pdf',
          page_path: window.location.pathname,
          payload: { format: 'pdf', success: true },
        });
      } else {
        try {
          const blob = pngDataUrlToBlob(finalDataUrl);
          downloadFile(blob, getExportFilename('png'));
        } catch (blobErr) {
          // Fallback: download the data URL directly (avoids canvas re-render).
          logger.error('PNG blob conversion failed. Downloading the data URL.', blobErr);
          const a = document.createElement('a');
          a.href = finalDataUrl;
          a.download = getExportFilename('png');
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 1000);
        }
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
      exportInProgress.current = false;
      setIsExporting(false);
    }
  };

  const doExportRef = useRef(doExport);
  doExportRef.current = doExport;

  const handleExport = useCallback((format: ExportFormat) => {
    if (!isExportFormatAllowed(tier, format)) {
      setUpgradeModal({
        feature: 'export',
        message: `${format.toUpperCase().replace(/-\d+x$/, '')} export is available for signed-in users.`,
        benefits: UPGRADE_BENEFITS.export,
      });
      return;
    }
    void doExportRef.current(format);
  }, [tier]);

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
              className="absolute right-0 top-full mt-3 w-44 rounded-2xl overflow-hidden z-30 bg-popover border border-border text-popover-foreground"
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
