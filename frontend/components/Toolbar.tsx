'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Trash2, Upload,
  Undo2, Redo2, Share2, Loader2, Check,
  GraduationCap, MoreHorizontal, HelpCircle,
  PanelLeftClose, LayoutTemplate, FolderOpen,
  LayoutDashboard,
  Github,
  PenTool,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { ShareModal } from '@/components/ShareModal';
import { useModelStore, AVAILABLE_MODELS } from '@/lib/ai/utils/modelStore';
import { TemplateModal } from '@/components/TemplateModal';
import { EmailCaptureModal, type EmailCaptureReason } from '@/components/EmailCaptureModal';
import logger from '@/lib/logger';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/UpgradeModal';
import { getUserTier, canAccessFeature } from '@/lib/userQuotas';
import { useOnboardingStore } from '@/store/onboardingStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NodeIconModeToggle } from '@/components/NodeIconModeToggle';
import { DiagramPagination } from '@/components/editor/DiagramPagination';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ExportControls } from '@/components/toolbar/ExportControls';
import { LayoutToggleButton } from '@/components/toolbar/LayoutControls';
import { RenderStyleToggle } from '@/components/toolbar/ThemeToggles';



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
    body { 
      background: #0f172a; 
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: #1e293b;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      padding: 20px;
      max-width: 100%;
      overflow: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .title {
      color: #f1f5f9;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
    }
    .badge {
      background: linear-gradient(135deg, #595959, #8A8A8A);
      color: white;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 500;
    }
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
      <!-- Grid pattern -->
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="0.5" opacity="0.5"/>
      </pattern>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      <!-- Edges -->
      ${edgesSVG}
      <!-- Nodes -->
      ${nodesSVG}
    </svg>
  </div>
</body>
</html>`;
}

export function Toolbar() {
  const router = useRouter();
  const {
    clearDiagram, nodes, edges, importDiagram,
    undo, redo, past, future,
    canvases, activeCanvasId, removeCanvas,
    getVisibleCanvases,
    savingState, userProfile, setSidebarOpen, sidebarOpen,
    activeLayoutPresetId, sequenceDiagrams,
    isPenModeActive, setPenModeActive,
  } = useDiagramStore();

  const selectedModel = useModelStore((s) => s.selectedModel);
  const { user } = useAuthStore();
  const tier = getUserTier(user?.id);
  const isGuest = tier === 'guest';
  const isSequenceDiagram = activeCanvasId ? !!sequenceDiagrams[activeCanvasId] : false;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareSessionId, setShareSessionId] = useState('');
  const [shareAccessType, setShareAccessType] = useState<'restricted' | 'anyone'>('anyone');
  const [shareLinkPermission, setShareLinkPermission] = useState<'viewer' | 'editor'>('viewer');
  const [sharePeople, setSharePeople] = useState<Array<{email: string; name: string; role: string}>>([]);
  const [emailCapture, setEmailCapture] = useState<EmailCaptureReason | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ feature: string; message: string; benefits: string[] } | null>(null);

  const openGuide = useOnboardingStore((s) => s.open);

  useCallback(getVisibleCanvases, [getVisibleCanvases])();

  // Count nodes/edges in current canvas for delete confirmation
  const currentCanvasForDelete = canvases.find(c => c.id === activeCanvasId);
  const deleteNodeCount = currentCanvasForDelete?.nodes.length ?? 0;
  const deleteEdgeCount = currentCanvasForDelete?.edges.length ?? 0;

  const handleDeleteCanvas = () => {
    setConfirmDeleteId(activeCanvasId);
  };





  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);

  const sanitizeFilename = (name: string): string => {
    return name
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim()
      .substring(0, 50) || 'diagram'; // Limit length and fallback
  };

  const getExportFilename = (extension: string): string => {
    const canvasName = activeCanvas?.name;
    if (!canvasName) return `archdraw-export.${extension}`;
    return `${sanitizeFilename(canvasName)}.${extension}`;
  };

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
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert to blob'));
          }
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
      const iframeCode = `<iframe 
  src="data:text/html,${encodeURIComponent(htmlContent)}" 
  width="100%" 
  height="600" 
  style="border:none;border-radius:12px;"
  title="ArchDraw Diagram"
></iframe>`;
      await navigator.clipboard.writeText(iframeCode);
      toast.success('Embed code (iframe) copied to clipboard');
      return;
    }
    
    const isSvg = format.startsWith('svg-');
    const bgType = format.includes('dark') ? 'dark' : format.includes('light') ? 'light' : 'transparent';
    
    const { fitView } = useDiagramStore.getState();
    
    // We strictly use the user's current canvas node style (darkMode).
    // Exporting with a different background should NOT change the nodes' styling
    // to prevent the "Nodes losing plates" issue.

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
        toast.success(
          isTransparent ? 'Exported as vector SVG (no background)' : 'Exported as vector SVG',
        );
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
      const cropRect =
        isTransparent && reactFlowRef.instance
          ? computeDiagramCropRect(exportNodes, reactFlowRef.instance.getViewport(), 0.1)
          : null;

      const { toPng } = await import('html-to-image');
      
      const pixelRatio = isTransparent ? 2 : 5;

      let dataUrl = await toPng(element, {
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
          payload: { format: format, pixel_ratio: pixelRatio, success: true },
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          importDiagram(data.nodes, data.edges);
          toast.success('Diagram imported');
        }
      } catch {
        toast.error('Invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const doShare = async () => {
    const currentUser = useAuthStore.getState().user;
    const userEmail = currentUser?.email || 'owner@local';
    const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Owner';
    
    setIsSharing(true);
    try {
      const response = await fetch('/api/diagram/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
          label: activeCanvas?.name ?? 'Shared Diagram',
          source: 'manual',
          accessType: 'anyone',
          linkPermission: 'viewer',
          users: [{
            email: userEmail,
            name: userName,
            role: 'owner',
            addedAt: Date.now(),
          }],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 || data?.code === 'AUTH_REQUIRED') {
        setUpgradeModal({
          feature: 'sharing',
          message: data?.error || 'Sign in to share diagrams.',
          benefits: UPGRADE_BENEFITS.share,
        });
        return;
      }
      
      if (response.ok && data.sessionId) {
        // Prefer the current origin so local/staging links stay on the same host.
        const baseUrl = window.location.origin;
        const currentStyle = useDiagramStore.getState().diagramRenderStyle;
        const shareUrl = `${baseUrl}/share/${data.sessionId}${currentStyle === 'sketch' ? '?style=sketch' : ''}`;
        setShareUrl(shareUrl);
        setShareSessionId(data.sessionId);
        setShareAccessType('anyone');
        setShareLinkPermission('viewer');
        setSharePeople([{ email: userEmail, name: userName, role: 'owner' }]);
        setShareModalOpen(true);

        analytics.track({
          event_type: 'share',
          event_name: 'share_link_created',
          page_path: window.location.pathname,
          payload: { node_count: nodes.length, edge_count: edges.length },
        });
      } else {
        toast.error(data?.error || 'Could not generate share link');
      }
    } catch (err) {
      logger.error('Share error:', err);
      toast.error('Could not generate share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShare = () => {
    if (!canAccessFeature(tier, 'share')) {
      setUpgradeModal({
        feature: 'sharing',
        message: 'Sharing requires a free account.',
        benefits: UPGRADE_BENEFITS.share,
      });
      return;
    }
    doShare();
  };

  useEffect(() => {
    const handleTriggerShare = () => {
      handleShare();
    };
    const handleTriggerDownload = () => {
      const currentIsDark = useDiagramStore.getState().darkMode;
      doExport(currentIsDark ? 'png-dark' : 'png-light');
    };

    window.addEventListener('trigger-share', handleTriggerShare);
    window.addEventListener('trigger-download', handleTriggerDownload);
    return () => {
      window.removeEventListener('trigger-share', handleTriggerShare);
      window.removeEventListener('trigger-download', handleTriggerDownload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  const handleClear = () => {
    if (nodes.length === 0) return;
    if (window.confirm('Clear all nodes and edges from the canvas?')) {
      clearDiagram();
      toast.success('Canvas cleared');
    }
  };

  return (
    <>
      <header
        className="floating-toolbar flex items-center justify-between px-2 sm:px-4 z-50 max-w-[calc(100vw-16px)] sm:max-w-none overflow-visible"
        style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          scrollbarWidth: 'none',
        }}
      >
        {/* LEFT: Sidebar toggle + Canvas tabs */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newState = !sidebarOpen;
              setSidebarOpen(newState);
              if (newState) {
                window.dispatchEvent(new CustomEvent('close-canvas-sidebar'));
              }
            }}
            className="!hidden sm:!flex !w-8 sm:!w-9 !h-8 sm:!h-9"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <PanelLeftClose className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-canvas-sidebar'))}
            className="!hidden sm:!flex !w-8 sm:!w-9 !h-8 sm:!h-9"
            title="Toggle canvases"
          >
            <FolderOpen className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="gap-1.5"
            title="Go to Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>

          <DiagramPagination />
        </div>

        {/* CENTER: Context info */}
        <div className="!hidden sm:flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span>{nodes.length}</span>
            <span className="hidden sm:inline">nodes</span>
          </span>
          <span className="w-px h-3 bg-border/50" />
          <span className="flex items-center gap-1">
            <span>{edges.length}</span>
            <span className="hidden sm:inline">edges</span>
          </span>


          {userProfile && savingState !== 'idle' && (
            <>
              <span className="w-px h-3 bg-border/50" />
              <span className="flex items-center gap-1">
                {savingState === 'saving' ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /><span className="hidden sm:inline">&nbsp;Saving</span></>
                ) : (
                  <><Check className="w-3 h-3 text-emerald-500" /><span className="hidden sm:inline">&nbsp;Saved</span></>
                )}
              </span>
            </>
          )}
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="!hidden sm:!flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={!past.length}
              className="!w-8 sm:!w-9 !h-8 sm:!h-9 disabled:opacity-30"
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={!future.length}
              className="!w-8 sm:!w-9 !h-8 sm:!h-9 disabled:opacity-30"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="max-w-[130px] truncate px-1.5 py-1 text-[11px] rounded-md bg-transparent text-muted-foreground hover:text-foreground hover:bg-brand/40 transition-all border-0 cursor-pointer focus:outline-none"
                  title="Select AI model"
                >
                  {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name || 'Select model'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {(['groq', 'openrouter'] as const).map((provider, idx) => {
                  const models = AVAILABLE_MODELS.filter((m) => m.provider === provider);
                  if (models.length === 0) return null;
                  return (
                    <div key={provider}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                        {provider === 'groq' ? 'Groq (Fast)' : 'OpenRouter'}
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={selectedModel}
                        onValueChange={(value) => useModelStore.getState().setSelectedModel(value)}
                      >
                        {models.map((m) => (
                          <DropdownMenuRadioItem key={m.id} value={m.id} className="text-xs">
                            {m.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="w-px h-4 bg-border/50 mx-0.5 sm:mx-1" />
          </span>

          <ThemeToggle />

          <span className="!hidden sm:!flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPenModeActive(!isPenModeActive)}
              className={`!w-8 sm:!w-9 !h-8 sm:!h-9 ${
                isPenModeActive
                  ? 'text-primary bg-primary/15 dark:bg-primary/25 ring-1 ring-primary/40'
                  : ''
              }`}
              title={isPenModeActive ? "Deactivate Comet Trail Pen" : "Activate Comet Trail Pen"}
            >
              <PenTool className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>

            <LayoutToggleButton />

            <RenderStyleToggle />

            <NodeIconModeToggle />

            <span className="w-px h-4 bg-border/50 mx-0.5 sm:mx-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteCanvas}
              className="!w-8 sm:!w-9 !h-8 sm:!h-9 hover:!text-destructive hover:!bg-destructive/10"
              title="Delete canvas"
            >
              <Trash2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              disabled={isSharing || nodes.length === 0}
              className="!w-8 sm:!w-9 !h-8 sm:!h-9 disabled:opacity-40"
            >
              {isSharing ? <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" /> : <Share2 className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
            </Button>
          </span>

          <ExportControls getExportFilename={getExportFilename} />

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMoreOpen(!moreOpen)}
              className="!w-9 !h-9"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            {moreOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-3 w-56 rounded-2xl overflow-hidden z-30 bg-popover border border-border text-popover-foreground"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}
                >
                  {/* Edit Section (mobile-friendly access to hidden toolbar actions) */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Edit</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { undo(); setMoreOpen(false); }}
                    disabled={!past.length}
                    className="w-full justify-start gap-2 rounded-none disabled:opacity-30"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { redo(); setMoreOpen(false); }}
                    disabled={!future.length}
                    className="w-full justify-start gap-2 rounded-none disabled:opacity-30"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    Redo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setPenModeActive(!isPenModeActive); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {isPenModeActive ? 'Disable' : 'Enable'} Pen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { handleDeleteCanvas(); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none !text-destructive hover:!bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete canvas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { handleShare(); setMoreOpen(false); }}
                    disabled={isSharing || nodes.length === 0}
                    className="w-full justify-start gap-2 rounded-none disabled:opacity-30"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </Button>

                  {/* Resources Section */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Resources</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { router.push('/tutorials'); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    Learn
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { openGuide(); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Guide
                  </Button>

                  {/* Workspace Section */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Workspace</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setTemplatesOpen(true); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" />
                    Templates
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { fileInputRef.current?.click(); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import JSON
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { window.dispatchEvent(new CustomEvent('open-repo-ingest')); setMoreOpen(false); }}
                    className="w-full justify-start gap-2 rounded-none"
                  >
                    <Github className="w-3.5 h-3.5" />
                    Ingest GitHub Repo
                  </Button>

                  {/* Danger Zone */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Danger</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { handleClear(); setMoreOpen(false); }}
                    disabled={nodes.length === 0}
                    className="w-full justify-start gap-2 rounded-none !text-destructive hover:!bg-destructive/10 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Canvas
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {shareModalOpen && shareUrl && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          shareUrl={shareUrl}
          sessionId={shareSessionId}
          accessType={shareAccessType}
          linkPermission={shareLinkPermission}
          initialPeople={sharePeople.map(p => ({
            id: p.email,
            name: p.name,
            email: p.email,
            role: p.role === 'owner' ? 'owner' : p.role === 'editor' ? 'can edit' : 'can view',
          }))}
          onAccessChange={(accessType, linkPermission) => {
            setShareAccessType(accessType);
            setShareLinkPermission(linkPermission);
            
            // Persist to backend
            fetch('/api/diagram/load', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: shareSessionId,
                accessType,
                linkPermission,
              }),
            }).catch((err) => logger.error('Access change error:', err));
          }}
          onInvite={(email, role) => {
            const userName = email.split('@')[0];
            setSharePeople(prev => [...prev, { email, name: userName, role }]);
            
            fetch('/api/diagram/load', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: shareSessionId,
                email,
                name: userName,
                role: role === 'can edit' ? 'editor' : 'viewer',
              }),
            }).catch((err) => logger.error('Invite error:', err));
          }}
          onRemove={(userId) => {
            setSharePeople(prev => prev.filter(p => p.email !== userId));
            
            fetch('/api/diagram/load', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: shareSessionId,
                email: userId,
              }),
            }).catch((err) => logger.error('Remove user error:', err));
          }}
          onRoleChange={(userId, newRole) => {
            setSharePeople(prev => prev.map(p => 
              p.email === userId ? { ...p, role: newRole === 'can edit' ? 'editor' : 'viewer' } : p
            ));
            
            fetch('/api/diagram/load', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: shareSessionId,
                email: userId,
                name: sharePeople.find(p => p.email === userId)?.name || userId,
                role: newRole === 'can edit' ? 'editor' : 'viewer',
              }),
            }).catch((err) => logger.error('Role change error:', err));
          }}
        />
      )}
      {emailCapture && (
        <EmailCaptureModal
          reason={emailCapture}
          onClose={() => setEmailCapture(null)}
        />
      )}
      {upgradeModal && (
        <UpgradeModal
          isOpen={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          feature={upgradeModal.feature}
          message={upgradeModal.message}
          benefits={upgradeModal.benefits}
        />
      )}
      {templatesOpen && <TemplateModal onClose={() => setTemplatesOpen(false)} />}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete canvas?"
        description={
          <>
            This will delete <strong>&ldquo;{currentCanvasForDelete?.name || 'this canvas'}&rdquo;</strong> and remove {deleteNodeCount} node{deleteNodeCount !== 1 ? 's' : ''} and {deleteEdgeCount} edge{deleteEdgeCount !== 1 ? 's' : ''}.
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) {
            removeCanvas(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
      />
    </>
  );
}

