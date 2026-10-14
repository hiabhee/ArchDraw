'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { SVGEdgeMarkerDefs } from '@/lib/theme/edgeColorUtils';
import { assignEdgeColors } from '@/lib/theme/edgeColors';
import { NODE_TYPES, EDGE_TYPES } from '@/components/canvas/canvasTypes';
import { DiagramGeometryProvider } from '@/components/canvas/edges/DiagramGeometryProvider';
import { CANVAS_CONFIG, DEFAULT_EDGE_OPTIONS } from '@/lib/config';
import { useTheme } from '@/lib/theme/appTheme';
import { CanvasHostProvider, type CanvasHost } from '@/lib/diagram/canvas/CanvasHostContext';
import { buildNodeActivity, mapCoverage, type LiveAgentSession } from '@/lib/diagram/projects/liveActivity';
import { useProjectLiveStore } from '@/store/projectLiveStore';
import { AgentAtlasLayer } from '@/components/canvas/AgentAtlasLayer';
import { DetailMapEmpty, MapLevelToggle } from '@/components/canvas/MapLevelToggle';
import { NeedsYouQueue } from '@/components/canvas/NeedsYouQueue';
import { SignInButtons } from '@/components/auth/SignInButtons';
import { useAuthStore } from '@/store/authStore';
import '@/components/canvas/nodes/nodeStyles.css';

/**
 * Read-only live view of a project (`/live/<token>`): the diagram plus which
 * agent session is working where. No sign-in; nothing here writes to the
 * editor's diagram store.
 */

const POLL_MS = 2_000;
const NO_NODES: Node[] = [];
const NO_EDGES: Edge[] = [];
const MAX_BACKOFF_MS = 30_000;

interface WatchResponse {
  canvasName: string;
  /** Made with `npx archdraw-live` and not saved to an account yet. */
  claimable?: boolean;
  canvasUpdatedAt: number;
  serverTime: number;
  sessions: LiveAgentSession[];
  nodes?: Node[];
  edges?: Edge[];
  /** When the detailed map was last drawn; null until there is one. */
  detailUpdatedAt?: number | null;
  /** Sent with `?detail=` when newer than the copy the page has. */
  detail?: { nodes: Node[]; edges: Edge[]; updatedAt: number };
}

const STATUS_LABEL: Record<LiveAgentSession['status'], string> = { active: 'working', idle: 'idle', ended: 'ended' };

function normalizeNodes(raw: Node[]): Node[] {
  return raw.map((node) => ({
    ...node,
    selected: false,
    dragging: false,
    ...(node.type === 'groupNode' ? { zIndex: -1 } : {}),
  }));
}

function timeAgo(ms: number, now: number) {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

/** The claim secret the CLI put in the URL fragment, kept per canvas in this browser. */
const claimKey = (canvasId: string) => `archdraw-claim:${canvasId}`;
const CLAIM_PENDING_KEY = 'archdraw-claim-pending';

function readStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode: the claim only works in this tab
  }
}

/**
 * Saving a project made without an account. A signed-in visitor holding the
 * claim key saves it automatically; otherwise signing in comes back to this
 * page, which then claims the project and opens the editor.
 */
function useClaim(canvasId: string, claimable: boolean) {
  const user = useAuthStore((s) => s.user);
  const authReady = useAuthStore((s) => s.initialized);
  const signedIn = Boolean(user && user.id !== 'guest');
  const router = useRouter();
  const [secret] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.hash.slice(1)).get('claim') ?? readStorage(claimKey(canvasId));
  });
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  useEffect(() => {
    if (!new URLSearchParams(window.location.hash.slice(1)).has('claim')) return;
    if (secret) writeStorage(claimKey(canvasId), secret);
    // Keep the secret out of the address bar, so a copied watch link can't claim.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [canvasId, secret]);

  const claim = useCallback(async () => {
    if (!secret) return;
    setState({ busy: true, error: null });
    writeStorage(CLAIM_PENDING_KEY, null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(canvasId)}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: secret }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok && body.code !== 'ALREADY_CLAIMED') {
        setState({ busy: false, error: body.error ?? 'Could not save the project. Try again.' });
        return;
      }
      writeStorage(claimKey(canvasId), null);
      if (res.ok) router.push(`/editor?canvas=${encodeURIComponent(canvasId)}`);
      else setState({ busy: false, error: body.error ?? null });
    } catch {
      setState({ busy: false, error: 'Could not reach ArchDraw. Try again.' });
    }
  }, [canvasId, secret, router]);

  // Signed in (already, or back from the sign-in redirect) and holding this
  // project's claim key: save it to the account without asking. Only the
  // person who ran the command has the key. Tried once per visit; a failure
  // (e.g. the project limit) leaves the card with the error and a retry.
  const autoClaimed = useRef(false);
  useEffect(() => {
    if (!claimable || !signedIn || !secret || autoClaimed.current) return;
    const timer = setTimeout(() => {
      autoClaimed.current = true;
      void claim();
    }, 0);
    return () => clearTimeout(timer);
  }, [claimable, signedIn, secret, claim]);

  return {
    canClaim: claimable && Boolean(secret),
    signedIn,
    authReady,
    ...state,
    claim,
    markPending: () => writeStorage(CLAIM_PENDING_KEY, canvasId),
  };
}

function Viewer({ token }: { token: string }) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [sessions, setSessions] = useState<LiveAgentSession[]>([]);
  const [serverTime, setServerTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [claimable, setClaimable] = useState(false);
  const canvasId = useMemo(() => token.slice(0, Math.max(token.lastIndexOf('.'), 0)), [token]);
  const claim = useClaim(canvasId, claimable);
  const updatedAtRef = useRef<number | null>(null);
  // Overview first; the detailed map is fetched only while it is shown.
  const level = useProjectLiveStore((s) => s.level);
  const setLevel = useProjectLiveStore((s) => s.setLevel);
  const [detail, setDetail] = useState<{ nodes: Node[]; edges: Edge[]; updatedAt: number } | null>(null);
  const [detailUpdatedAt, setDetailUpdatedAt] = useState<number | null>(null);
  const detailAtRef = useRef<number | null>(null);
  const focusedSessionKey = useProjectLiveStore((s) => s.focusedSessionKey);
  const setFocusedSession = useProjectLiveStore((s) => s.setFocusedSession);

  const poll = useCallback(async (signal: AbortSignal) => {
    const query = new URLSearchParams();
    if (updatedAtRef.current !== null) query.set('since', String(updatedAtRef.current));
    if (level === 'detail') query.set('detail', String(detailAtRef.current ?? 0));
    const res = await fetch(`/api/live/${encodeURIComponent(token)}${query.size ? `?${query}` : ''}`, { signal, cache: 'no-store' });
    if (res.status === 404) {
      setGone(true);
      return false;
    }
    if (!res.ok) throw new Error(res.status === 429 ? 'Too many viewers from this network. Retrying…' : 'Live updates paused. Retrying…');
    const body = (await res.json()) as WatchResponse;
    setName(body.canvasName);
    setClaimable(Boolean(body.claimable));
    setSessions(body.sessions);
    setServerTime(body.serverTime);
    // Badges and figures read the shared live store; this page has no editor using it.
    useProjectLiveStore.setState({
      nodeActivity: buildNodeActivity(body.sessions, body.serverTime),
      snapshot: {
        canvasId: token,
        canvasName: body.canvasName,
        isProject: true,
        agenticProjectId: null,
        workspaceId: null,
        repositoryRemote: null,
        canvasUpdatedAt: body.canvasUpdatedAt,
        serverTime: body.serverTime,
        linkedCheckouts: 0,
        watchPath: null,
        detailUpdatedAt: body.detailUpdatedAt ?? null,
        sessions: body.sessions,
      },
    });
    if (body.nodes) {
      setGraph({ nodes: normalizeNodes(body.nodes), edges: body.edges ?? [] });
      updatedAtRef.current = body.canvasUpdatedAt;
    }
    setDetailUpdatedAt(body.detailUpdatedAt ?? null);
    if (body.detail) {
      setDetail({ nodes: normalizeNodes(body.detail.nodes), edges: body.detail.edges, updatedAt: body.detail.updatedAt });
      detailAtRef.current = body.detail.updatedAt;
    }
    setError(null);
    return true;
  }, [token, level]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const run = async () => {
      if (document.visibilityState !== 'visible') return; // resumed on visibilitychange
      try {
        if (!(await poll(controller.signal))) return; // link revoked: stop polling
        failures = 0;
      } catch (err) {
        if (controller.signal.aborted) return;
        failures = Math.min(failures + 1, 4);
        setError(err instanceof Error ? err.message : 'Live updates paused. Retrying…');
      }
      timer = setTimeout(run, Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') { clearTimeout(timer); void run(); }
    };
    void run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);
  // Every visit starts on the overview; the shared live store is cleared on leave.
  useEffect(() => {
    useProjectLiveStore.setState({ level: 'overview' });
    return () => {
      useProjectLiveStore.setState({ nodeActivity: {}, snapshot: null, focusedSessionKey: null, level: 'overview' });
    };
  }, []);

  const shown = level === 'detail' ? detail : graph;
  const edges = useMemo(() => assignEdgeColors(shown?.edges ?? NO_EDGES, isDark), [shown, isDark]);
  const nodes = shown?.nodes ?? NO_NODES;
  const labels = useMemo(() => new Map(nodes.map((n) => [n.id, String((n.data as { label?: unknown })?.label ?? n.id)])), [nodes]);
  const host = useMemo<CanvasHost>(() => ({
    readOnly: true,
    showLiveActivity: true,
    nodes,
    edges,
    isDark,
    planKey: `live:${token}:${level}`,
  }), [nodes, edges, isDark, token, level]);
  const working = sessions.filter((s) => s.status !== 'ended');
  const coverage = mapCoverage(sessions);

  if (gone) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-[hsl(var(--canvas-bg))] px-6 text-center text-foreground">
        <div className="max-w-sm space-y-2">
          <p className="text-base font-semibold">This live project link no longer works</p>
          <p className="text-sm text-muted-foreground">The owner stopped the project or the link is wrong. Ask them for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'dark' : ''} relative w-screen h-[100dvh] bg-[hsl(var(--canvas-bg))] text-foreground`}>
      <header className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-background/85 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            Live
          </span>
          <h1 className="truncate text-sm font-semibold">{name || 'Live project'}</h1>
          <span className="shrink-0 text-xs text-muted-foreground">· view only</span>
          <MapLevelToggle level={level} onChange={setLevel} hasDetail={detailUpdatedAt !== null} className="ml-1 shrink-0" />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Agent sessions">
          {sessions.length === 0 && <span className="text-xs text-muted-foreground">No agent sessions in the last few hours.</span>}
          {sessions.slice(0, 8).map((s) => {
            const focused = focusedSessionKey === s.sessionKey;
            const where = s.site ? 'new code' : s.currentComponentId ? labels.get(s.currentComponentId) : null;
            return (
              <button
                key={s.id}
                onClick={() => setFocusedSession(focused ? null : s.sessionKey)}
                aria-pressed={focused}
                title={[s.name, s.branch, STATUS_LABEL[s.status], where ? `on ${where}` : null, s.intent, timeAgo(s.lastSeenAt, serverTime)].filter(Boolean).join(' · ')}
                className={`inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${focused ? 'border-foreground/40 bg-foreground/[0.06]' : 'border-border/70 hover:bg-foreground/[0.04]'} ${s.status === 'ended' ? 'opacity-50' : ''}`}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="truncate font-medium">{s.name}</span>
                {where && <span className="truncate text-muted-foreground">· {where}</span>}
              </button>
            );
          })}
          {sessions.length > 8 && <span className="text-[11px] text-muted-foreground">+{sessions.length - 8} more</span>}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {working.length} active
          {coverage && (
            <span title={`${coverage.percent}% of the ${coverage.total} files agents edited are on a component of this map`}>
              {' '}· map covers {coverage.percent}%
            </span>
          )}
        </span>
      </header>

      {error && (
        <div role="status" className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-md border border-amber-500/40 bg-background/95 px-3 py-1.5 text-xs">
          {error}
        </div>
      )}

      {graph && (sessions.length === 0 || claim.canClaim) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4">
          {sessions.length === 0 && (
            <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border/70 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold">Waiting for your first agent</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Start Claude Code in this project&apos;s folder (run <code className="rounded bg-foreground/[0.07] px-1 py-0.5 font-mono">claude</code>).
                Each session shows up here as a star that moves to the part of the code it is working on.
              </p>
            </div>
          )}
          {claim.canClaim && (
            <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border/70 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <p className="font-semibold">{claim.signedIn && !claim.error ? 'Saving to your account…' : 'Keep this project'}</p>
              {!claim.signedIn && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  It isn&apos;t saved to an account yet. Sign in to keep it, edit the diagram and share it.
                  Unsaved projects are deleted after 30 days without activity.
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {claim.signedIn ? (
                  claim.error && <button
                    onClick={() => void claim.claim()}
                    disabled={claim.busy}
                    className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {claim.busy ? 'Saving…' : 'Try again'}
                  </button>
                ) : claim.authReady ? (
                  <div onClickCapture={claim.markPending}>
                    <SignInButtons compact callbackURL={typeof window === 'undefined' ? '/' : window.location.pathname} />
                  </div>
                ) : null}
                {claim.error && <span role="alert" className="text-xs text-red-500">{claim.error}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {level === 'detail' && !detail ? (
        <div className="flex h-full items-center justify-center pt-12">
          {detailUpdatedAt === null ? <DetailMapEmpty /> : <span className="text-sm text-muted-foreground">Loading the detailed map…</span>}
        </div>
      ) : !graph ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading live project…</div>
      ) : (
        <div key={level} className="h-full w-full pt-12">
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
                // Mounted once data has arrived, so the initial fit sees measured nodes.
                fitView
                fitViewOptions={{ padding: 0.15 }}
                panOnDrag
                panOnScroll
                zoomOnScroll={false}
                zoomOnPinch
                proOptions={{ hideAttribution: true }}
                connectionMode={CANVAS_CONFIG.connectionMode as ConnectionMode}
                connectionLineType={ConnectionLineType.SmoothStep}
                minZoom={CANVAS_CONFIG.minZoom}
                maxZoom={CANVAS_CONFIG.maxZoom}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={CANVAS_CONFIG.background.gap}
                  size={CANVAS_CONFIG.background.size}
                  color={isDark ? '#475569' : '#cbd5e1'}
                  style={{ opacity: 0.6 }}
                />
                <Controls showInteractive={false} className="!bg-card !border-border !text-foreground !shadow-sm" />
                <SVGEdgeMarkerDefs />
                <AgentAtlasLayer />
                <NeedsYouQueue className="!top-3" />
              </ReactFlow>
            </DiagramGeometryProvider>
          </CanvasHostProvider>
        </div>
      )}
    </div>
  );
}

export function LiveWatchViewer({ token }: { token: string }) {
  return (
    <ReactFlowProvider>
      <Viewer token={token} />
    </ReactFlowProvider>
  );
}
