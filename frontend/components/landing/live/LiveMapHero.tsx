'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import ReactFlow, { Background, BackgroundVariant, ReactFlowProvider, getRectOfNodes, useReactFlow, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { NODE_TYPES, EDGE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider } from '@/components/canvas/edges/DiagramGeometryProvider';
import { AgentAtlasLayer } from '@/components/canvas/AgentAtlasLayer';
import { NeedsYouQueue } from '@/components/canvas/NeedsYouQueue';
import { MapLevelToggle } from '@/components/canvas/MapLevelToggle';
import { CANVAS_CONFIG, DEFAULT_EDGE_OPTIONS } from '@/lib/config';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { buildNodeActivity, mapCoverage, type LiveAgentSession } from '@/lib/diagram/projects/liveActivity';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { assignEdgeColors } from '@/lib/theme/edgeColors';
import { resolveCanvasTokens } from '@/lib/theme/renderStyles';
import { useProjectLiveStore } from '@/store/projectLiveStore';
import '@/components/canvas/nodes/nodeStyles.css';
import type { HeroGraphs } from './heroGraph';
import { MAPPED_AT, loopTime, scriptSignature, sessionsAt } from './heroScript';
import styles from './LiveMapHero.module.css';

/**
 * The hero is a real live map: the product's canvas (Studio Metallic, dark),
 * edges, Agent Atlas and "Needs you" queue, fed by scripted sessions instead
 * of the live API. The header mirrors the watch page's.
 */

const RENDER_STYLE = 'studio-metallic' as const;
const APPEARANCE = resolveCanvasTokens({ renderStyleId: RENDER_STYLE, colorThemeId: 'studio-minimal', isDark: true });

function normalize(nodes: Node[]): Node[] {
  return nodes.map((n) => ({ ...n, selected: false, dragging: false, ...(n.type === 'groupNode' ? { zIndex: -1 } : {}) }));
}

/** Plays the script into the shared live store while the hero is on screen. */
function useScriptedSessions(graphs: HeroGraphs, root: React.RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState<{ sessions: LiveAgentSession[]; mapped: boolean }>({ sessions: [], mapped: false });
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion: hold one telling moment (Otter waiting, Fox done, Lynx building).
    const start = Date.now() - (reduce ? 13 : 0) * 1000;
    let signature = '';
    let visible = true;
    const tick = () => {
      if (!visible || document.hidden) return;
      const now = Date.now();
      const t = reduce ? 13 : loopTime(now, start);
      const next = scriptSignature(t);
      if (next === signature) return;
      signature = next;
      const sessions = sessionsAt(t, now, graphs.change);
      useProjectLiveStore.setState({
        level: 'overview',
        nodeActivity: buildNodeActivity(sessions, now),
        snapshot: {
          canvasId: 'landing-hero',
          canvasName: 'acme-shop',
          isProject: true,
          agenticProjectId: null,
          workspaceId: null,
          repositoryRemote: null,
          canvasUpdatedAt: 0,
          serverTime: now,
          linkedCheckouts: 0,
          watchPath: null,
          detailUpdatedAt: null,
          sessions,
        },
      });
      setState({ sessions, mapped: t >= MAPPED_AT });
    };
    tick();
    const timer = setInterval(tick, 250);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { signature = ''; tick(); } });
    if (root.current) io.observe(root.current);
    return () => {
      clearInterval(timer);
      io.disconnect();
      useProjectLiveStore.setState({ nodeActivity: {}, snapshot: null, focusedSessionKey: null, level: 'overview' });
    };
  }, [graphs, root]);
  return state;
}

function FitOnce({ graphs }: { graphs: HeroGraphs }) {
  const flow = useReactFlow();
  useEffect(() => {
    // Frame the map as it is once the new component exists, so nothing moves later.
    const bounds = getRectOfNodes(graphs.mapped.nodes.filter((n) => !n.parentNode));
    // Extra room below for the name tags under the bottom row.
    const framed = { ...bounds, height: bounds.height + 60 };
    const fit = () => {
      flow.fitBounds(framed, { padding: 0.06, duration: 0 });
      // On phones the canvas is wider than the screen: start on the middle of the map.
      const scroller = document.querySelector('[data-hero-canvas]')?.parentElement;
      if (scroller && scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    };
    fit();
    const ro = new ResizeObserver(fit);
    const el = document.querySelector('[data-hero-canvas]');
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [flow, graphs]);
  return null;
}

function HeroCanvas({ graphs }: { graphs: HeroGraphs }) {
  const root = useRef<HTMLDivElement>(null);
  const { sessions, mapped } = useScriptedSessions(graphs, root);
  const graph = mapped ? graphs.mapped : graphs.base;
  const nodes = useMemo(() => normalize(graph.nodes), [graph]);
  const edges = useMemo(() => assignEdgeColors(graph.edges, true), [graph]);
  const host = useMemo<CanvasHost>(() => ({
    readOnly: true,
    showLiveActivity: true,
    nodes,
    edges,
    isDark: true,
    renderStyleId: RENDER_STYLE,
    colorThemeId: 'studio-minimal',
    planKey: `landing:${mapped ? 'mapped' : 'base'}`,
  }), [nodes, edges, mapped]);
  const labels = useMemo(() => new Map(nodes.map((n) => [n.id, String((n.data as { label?: unknown })?.label ?? n.id)])), [nodes]);
  const coverage = mapCoverage(sessions);
  const active = sessions.filter((s) => s.status !== 'ended');

  return (
    <div ref={root} className={styles.window}>
      {/* Mirrors the watch page header (LiveWatchViewer). */}
      <header className={styles.header}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            Live
          </span>
          <span className="truncate text-sm font-semibold text-foreground">acme-shop</span>
          <span className="shrink-0 text-xs text-muted-foreground">· view only</span>
          <span className="pointer-events-none ml-1 shrink-0" aria-hidden="true">
            <MapLevelToggle level="overview" onChange={() => {}} hasDetail />
          </span>
        </div>
        <div className={styles.chips} aria-label="Agent sessions">
          {sessions.map((s) => {
            const where = s.site ? 'new code' : s.currentComponentId ? labels.get(s.currentComponentId) : null;
            return (
              <span key={s.id} className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="truncate font-medium">{s.name}</span>
                {where && <span className="truncate text-muted-foreground">· {where}</span>}
              </span>
            );
          })}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {active.length} active{coverage && <> · map covers {coverage.percent}%</>}
        </span>
      </header>
      <div className={styles.scroll}>
      <div className={styles.canvas} data-hero-canvas>
        <CanvasHostProvider value={host}>
          <DiagramGeometryProvider nodes={nodes} edges={edges}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag={false}
              panOnScroll={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
              minZoom={0.2}
              maxZoom={CANVAS_CONFIG.maxZoom}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            >
              <FitOnce graphs={graphs} />
              <Background variant={BackgroundVariant.Dots} gap={CANVAS_CONFIG.background.gap} size={CANVAS_CONFIG.background.size} color="#475569" style={{ opacity: 0.6 }} />
              <SVGEdgeMarkerDefs />
              <AgentAtlasLayer />
              <NeedsYouQueue className="!top-3" />
            </ReactFlow>
          </DiagramGeometryProvider>
        </CanvasHostProvider>
      </div>
      </div>
    </div>
  );
}

/** The diagram store rehydrates from localStorage, so the canvas mounts after hydration. */
export function LiveMapHero({ graphs }: { graphs: HeroGraphs }) {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  return (
    <div
      className={`dark ${styles.frame}`}
      data-render-style={RENDER_STYLE}
      data-color-theme="studio-minimal"
      role="img"
      aria-label="A live ArchDraw map of an online shop with five Claude Code sessions on it. Otter is waiting for permission at Payments, Fox has finished at Orders, Lynx is building a new Refund worker."
      style={{ ...APPEARANCE.cssVars, ['--arch-canvas-bg' as string]: APPEARANCE.cssVars['--arch-canvas-bg'] } as CSSProperties}
    >
      {hydrated ? (
        <ReactFlowProvider><HeroCanvas graphs={graphs} /></ReactFlowProvider>
      ) : (
        <div className={styles.window}><div className={styles.header} /><div className={styles.canvas} /></div>
      )}
    </div>
  );
}
