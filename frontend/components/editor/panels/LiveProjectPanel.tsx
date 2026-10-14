'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Eye, Loader2, Plus, Power, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/editor/modals/UpgradeModal';
import { approveAgentPairing, makeCanvasProject, unlinkCanvasProject } from '@/lib/client/api-client';
import { RECENT_EDIT_MS, mapCoverage, type LiveAgentSession } from '@/lib/diagram/projects/liveActivity';
import { getCodePaths } from '@/lib/diagram/projects/pathMatcher';
import { summarizeChange } from '@/lib/diagram/projects/structureDiff';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { flushCanvasSaveToDB } from '@/store/diagram/persistence/dbSave';
import { useProjectLiveStore } from '@/store/projectLiveStore';

/** Opens the live-project panel (toolbar button / command palette). */
export const OPEN_LIVE_PROJECT_EVENT = 'open-live-project';

function timeAgo(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

/** Pairing codes are 12 letters/digits, often typed as XXXX-XXXX-XXXX or with spaces. */
function looksLikePairingCode(value: string) {
  return /^[A-Z0-9]{12}$/i.test(value.replace(/[\s-]/g, ''));
}

const INPUT_CLASS =
  'w-full h-8 rounded-lg border border-border bg-transparent px-2.5 text-xs text-text-primary placeholder:text-text-muted/70 outline-none transition-colors focus:border-border-strong aria-[invalid=true]:border-destructive/60';
const PRIMARY_BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-text-primary px-3 text-xs font-medium text-surface-panel transition-opacity hover:opacity-90 disabled:opacity-40';
const TEXT_BUTTON_CLASS = 'text-[11px] text-text-muted transition-colors hover:text-text-primary';

/**
 * Live project companion: turns the active canvas into a project, pairs coding
 * agents, and lists their sessions with what each one is working on.
 */
export function LiveProjectPanel() {
  const user = useAuthStore((s) => s.user);
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  const activeCanvas = useDiagramStore((s) => s.canvases.find((c) => c.id === s.activeCanvasId));
  const isProject = Boolean(activeCanvas?.agenticProjectId);

  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Poll live activity only while the active canvas is a project.
  useEffect(() => {
    const live = useProjectLiveStore.getState();
    if (isProject && activeCanvasId) live.start(activeCanvasId);
    else live.stop();
  }, [isProject, activeCanvasId]);
  useEffect(() => () => useProjectLiveStore.getState().stop(), []);

  useEffect(() => {
    const handler = () => {
      if (!user || user.id === 'guest') {
        setUpgradeOpen(true);
        return;
      }
      setOpen(true);
      setCollapsed(false);
    };
    window.addEventListener(OPEN_LIVE_PROJECT_EVENT, handler);
    return () => window.removeEventListener(OPEN_LIVE_PROJECT_EVENT, handler);
  }, [user]);

  // Project canvases always show the (collapsible) panel.
  const visible = open || isProject;

  return (
    <>
      {visible && activeCanvasId && (
        <div
          className={`absolute left-3 bottom-28 z-30 rounded-xl border border-border bg-surface-panel/95 text-text-primary shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur ${
            isProject && collapsed ? 'w-auto' : 'w-[min(288px,calc(100vw-24px))]'
          }`}
          role="region"
          aria-label="Live project"
        >
          {isProject ? (
            <ProjectView
              canvasId={activeCanvasId}
              collapsed={collapsed}
              onToggleCollapsed={() => setCollapsed((c) => !c)}
            />
          ) : (
            <MakeProjectView canvasId={activeCanvasId} onClose={() => setOpen(false)} />
          )}
        </div>
      )}
      {upgradeOpen && (
        <UpgradeModal
          isOpen
          onClose={() => setUpgradeOpen(false)}
          feature="live projects"
          message="Sign in to turn a canvas into a live project for your coding agents."
          benefits={UPGRADE_BENEFITS.projects}
        />
      )}
    </>
  );
}

function MakeProjectView({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [remote, setRemote] = useState('');
  const [showRemote, setShowRemote] = useState(false);
  const [busy, setBusy] = useState(false);
  const codeInvalid = code.trim() !== '' && !looksLikePairingCode(code);

  // A pairing code pasted into the remote field belongs in the code field.
  const handleRemoteChange = (value: string) => {
    if (looksLikePairingCode(value)) {
      setCode(value.trim());
      setRemote('');
    } else {
      setRemote(value);
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      // The project row links to the saved canvas, so persist it first.
      await flushCanvasSaveToDB(canvasId, useDiagramStore.getState);
      const { project } = await makeCanvasProject(canvasId, { repositoryRemote: remote.trim() || null });
      useDiagramStore.getState().setCanvasProjectLink(canvasId, project.agenticProjectId);
      if (!code.trim() || !project.agenticProjectId || !project.workspaceId) {
        toast.success('This canvas is now a live project');
        return;
      }
      try {
        await approveAgentPairing({ userCode: code, projectId: project.agenticProjectId, workspaceId: project.workspaceId });
        toast.success('Live project created and agent connected');
      } catch (err) {
        toast.error(
          `Project created, but the pairing code did not work${err instanceof Error ? `: ${err.message}` : ''}. ` +
            'Run the link command again and use "Connect agent".',
        );
      }
    } catch (err) {
      const e = err as Error & { code?: string };
      toast.error(
        e.code === 'CANVAS_NOT_FOUND'
          ? 'Save this canvas first (sign in and make an edit), then try again.'
          : e.message || 'Could not create the project',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium tracking-tight">Live project</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-text-muted">
        Link this canvas to a codebase. Agents keep it current and you see what each one is touching.
      </p>
      <LinkCommand />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Pairing code (optional)"
        className={`${INPUT_CLASS} font-mono uppercase placeholder:normal-case placeholder:font-sans`}
        aria-label="Pairing code"
        aria-invalid={codeInvalid}
        title={codeInvalid ? 'A pairing code has 12 letters and digits.' : undefined}
      />
      {showRemote ? (
        <input
          value={remote}
          onChange={(e) => handleRemoteChange(e.target.value)}
          placeholder="git@github.com:you/repo.git"
          className={INPUT_CLASS}
          aria-label="Git remote URL"
          autoFocus
        />
      ) : (
        <button onClick={() => setShowRemote(true)} className={TEXT_BUTTON_CLASS}>
          + Git remote
        </button>
      )}
      <button className={`${PRIMARY_BUTTON_CLASS} w-full`} onClick={handleCreate} disabled={busy || codeInvalid}>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {code.trim() ? 'Create and connect' : 'Create live project'}
      </button>
    </div>
  );
}

/** Copyable `link` command that prints a pairing code. */
function LinkCommand() {
  const [copied, setCopied] = useState(false);
  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const command = `npx -y @hiabhee/archdraw-mcp-server link --api ${apiBase}`;
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group flex w-full items-start gap-2 rounded-lg bg-text-primary/[0.04] px-2.5 py-2 text-left transition-colors hover:bg-text-primary/[0.07]"
      title="Copy command"
    >
      <code className="flex-1 break-all font-mono text-[10.5px] leading-relaxed text-text-secondary">
        <span className="select-none text-text-muted">$ </span>
        {command}
      </code>
      {copied ? (
        <Check className="mt-0.5 w-3 h-3 shrink-0 text-emerald-500" aria-label="Copied" />
      ) : (
        <Copy className="mt-0.5 w-3 h-3 shrink-0 text-text-muted opacity-60 group-hover:opacity-100" aria-hidden />
      )}
    </button>
  );
}


/** What the session is doing, as one lowercase word. */
function sessionVerb(s: LiveAgentSession, now: number) {
  if (s.status === 'ended') return 'ended';
  if (s.status === 'idle') return 'idle';
  const lastEdit = s.currentComponentId ? s.touched[s.currentComponentId]?.lastAt : undefined;
  return lastEdit !== undefined && now - lastEdit < RECENT_EDIT_MS ? 'editing' : 'working';
}

function Avatar({ session, size = 'md' }: { session: LiveAgentSession; size?: 'sm' | 'md' }) {
  const handle = session.name;
  const dims = size === 'sm' ? 'h-5 w-5 text-[8.5px]' : 'h-7 w-7 text-[9.5px]';
  const live = session.status === 'active';
  return (
    <span
      className={`live-presence-avatar relative inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold uppercase ${dims} ${live ? 'live-presence-avatar--live text-white' : 'bg-transparent'}`}
      style={{
        ['--presence' as string]: session.color,
        backgroundColor: live ? session.color : undefined,
        color: live ? undefined : session.color,
        boxShadow: live ? undefined : `inset 0 0 0 1.5px ${session.color}`,
        opacity: session.status === 'ended' ? 0.45 : 1,
      }}
      aria-hidden
    >
      {handle.slice(0, 2)}
    </span>
  );
}

function ProjectView({
  canvasId,
  collapsed,
  onToggleCollapsed,
}: {
  canvasId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const snapshot = useProjectLiveStore((s) => s.snapshot);
  const error = useProjectLiveStore((s) => s.error);
  const focusedSessionKey = useProjectLiveStore((s) => s.focusedSessionKey);
  const setFocusedSession = useProjectLiveStore((s) => s.setFocusedSession);
  const nodes = useDiagramStore((s) => s.nodes);
  const [showConnect, setShowConnect] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [showUnmapped, setShowUnmapped] = useState(false);

  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot]);
  const now = snapshot?.serverTime ?? 0;
  const current = sessions.filter((s) => s.status === 'active');
  const earlier = sessions.filter((s) => s.status !== 'active');
  const linkedCheckouts = snapshot?.linkedCheckouts ?? 0;
  const coverage = useMemo(() => mapCoverage(sessions), [sessions]);
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) map.set(n.id, String((n.data as { label?: unknown })?.label ?? n.id));
    return map;
  }, [nodes]);
  const hasMappings = useMemo(() => nodes.some((n) => getCodePaths(n).length > 0), [nodes]);
  const unmapped = useMemo(
    () => Array.from(new Set(sessions.filter((s) => s.status !== 'ended').flatMap((s) => s.unmappedPaths))).slice(0, 8),
    [sessions],
  );

  const handleUnlink = async () => {
    try {
      await unlinkCanvasProject(canvasId);
      useDiagramStore.getState().setCanvasProjectLink(canvasId, null);
      toast.success('Live project stopped. Agent access was revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not stop the project');
    }
  };

  const row = (s: LiveAgentSession) => {
    const focused = focusedSessionKey === s.sessionKey;
    const where = s.site ? `New: ${s.site.label}` : s.currentComponentId ? labels.get(s.currentComponentId) ?? s.currentComponentId : null;
    const verb = sessionVerb(s, now);
    const note = s.intent ?? (s.lastChange ? summarizeChange(s.lastChange) : null);
    return (
      <li key={s.id}>
        <button
          onClick={() => setFocusedSession(focused ? null : s.sessionKey)}
          aria-pressed={focused}
          title={[`${s.name} — the terminal title shows this name`, s.label, note].filter(Boolean).join('\n')}
          className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${
            focused ? 'bg-text-primary/[0.07]' : 'hover:bg-text-primary/[0.04]'
          }`}
        >
          <Avatar session={s} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[12.5px] font-medium leading-tight ${where ? 'text-text-primary' : 'text-text-muted'}`}>
              {where ?? 'Not on the map yet'}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] leading-tight text-text-muted">
              <span className="shrink-0 font-semibold text-text-primary/80">{s.name}</span>
              {s.branch && <span className="truncate font-mono">{s.branch}</span>}
              <span aria-hidden>·</span>
              <span className={verb === 'editing' ? 'text-text-primary' : ''} style={verb === 'editing' ? { color: s.color } : undefined}>
                {verb}
              </span>
            </span>
          </span>
          <span className="shrink-0 self-start pt-0.5 text-[10px] tabular-nums text-text-muted/80">{timeAgo(s.lastSeenAt, now)}</span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <button
        onClick={onToggleCollapsed}
        className="flex w-full items-center gap-2.5 px-3 py-2.5"
        aria-expanded={!collapsed}
        aria-label={`Live project: ${current.length} session${current.length === 1 ? '' : 's'} working`}
      >
        <span className="relative flex h-1.5 w-1.5">
          {current.length > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
          <span className={`relative h-1.5 w-1.5 rounded-full ${current.length > 0 ? 'bg-emerald-500' : 'bg-text-muted/40'}`} />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-primary">Live</span>
        <span className="flex items-center -space-x-1.5">
          {current.slice(0, 4).map((s) => (
            <span key={s.id} className="rounded-full ring-2 ring-surface-panel">
              <Avatar session={s} size="sm" />
            </span>
          ))}
          {current.length > 4 && (
            <span className="relative inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-text-primary/10 px-1 text-[9px] font-semibold tabular-nums ring-2 ring-surface-panel">
              +{current.length - 4}
            </span>
          )}
        </span>
        {!collapsed && current.length === 0 && <span className="text-[11px] text-text-muted">quiet</span>}
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-text-muted transition-transform ${collapsed ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {!collapsed && (
        <>
          <div className="max-h-[50vh] overflow-y-auto px-1.5 pb-1.5">
            {error && <p className="px-2 pb-1.5 text-[11px] text-destructive">Paused: {error}</p>}

            {sessions.length === 0 ? (
              <p className="px-2 pb-2 text-[11.5px] leading-relaxed text-text-muted">
                {linkedCheckouts > 0
                  ? 'Start Claude in your linked checkout and it appears here, on the component it touches.'
                  : 'Link a checkout once; every Claude session started there appears here.'}
                {!hasMappings && ' Ask it to map this codebase first.'}
              </p>
            ) : (
              <>
                {current.length > 0 ? (
                  <ul className="space-y-0.5">{current.map(row)}</ul>
                ) : (
                  <p className="px-2 pb-1 text-[11.5px] text-text-muted">Nobody is working right now.</p>
                )}
                {earlier.length > 0 && (
                  <div className="mt-1">
                    <button
                      onClick={() => setShowEarlier((v) => !v)}
                      className="flex w-full items-center gap-2 px-2 py-1 text-[10.5px] text-text-muted transition-colors hover:text-text-primary"
                      aria-expanded={showEarlier}
                    >
                      <span className="flex -space-x-1">
                        {earlier.slice(0, 3).map((s) => (
                          <span key={s.id} className="h-2 w-2 rounded-full ring-1 ring-surface-panel" style={{ backgroundColor: s.color, opacity: 0.5 }} />
                        ))}
                      </span>
                      {earlier.length} earlier
                      <ChevronDown className={`h-3 w-3 transition-transform ${showEarlier ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {showEarlier && <ul className="space-y-0.5 opacity-80">{earlier.map(row)}</ul>}
                  </div>
                )}
              </>
            )}

            {unmapped.length > 0 && (
              <div className="mt-1 border-t border-border/60 pt-1">
                <button
                  onClick={() => setShowUnmapped((v) => !v)}
                  className="flex w-full items-center gap-2 px-2 py-1 text-[10.5px] text-text-muted transition-colors hover:text-text-primary"
                  aria-expanded={showUnmapped}
                >
                  <span className="h-1.5 w-1.5 rotate-45 border border-current" aria-hidden />
                  {unmapped.length} file{unmapped.length === 1 ? '' : 's'} not on the map
                  <ChevronDown className={`h-3 w-3 transition-transform ${showUnmapped ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {showUnmapped && <UnmappedFiles paths={unmapped} />}
              </div>
            )}
          </div>

          {showConnect ? (
            <ConnectAgent
              agenticProjectId={snapshot?.agenticProjectId ?? null}
              workspaceId={snapshot?.workspaceId ?? null}
              onDone={() => setShowConnect(false)}
            />
          ) : (
            <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
              <span className="flex-1 px-1 text-[10.5px] text-text-muted">
                {linkedCheckouts > 0 ? `${linkedCheckouts} checkout${linkedCheckouts === 1 ? '' : 's'} linked` : 'No checkout linked'}
                {coverage && (
                  <span title={`${coverage.percent}% of the ${coverage.total} files agents edited are on a component. Low? Ask Claude to re-map the project.`}>
                    {' '}· map covers {coverage.percent}%
                  </span>
                )}
              </span>
              <IconAction label={linkedCheckouts > 0 ? 'Link another checkout' : 'Link a checkout'} onClick={() => setShowConnect(true)}>
                <Plus className="h-3.5 w-3.5" />
              </IconAction>
              {snapshot?.watchPath && <CopyWatchLink path={snapshot.watchPath} />}
              <IconAction label="Stop live project" onClick={() => setConfirmUnlink(true)} danger>
                <Power className="h-3.5 w-3.5" />
              </IconAction>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Stop live project?"
        description="Connected agents lose access, watch links stop working and session history is cleared. The diagram itself is kept."
        confirmText="Stop project"
        destructive
        onConfirm={handleUnlink}
      />
    </div>
  );
}

function IconAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-text-primary/[0.06] ${danger ? 'hover:text-destructive' : 'hover:text-text-primary'}`}
    >
      {children}
    </button>
  );
}

/** Copy the read-only link others can open to watch this project without signing in. */
function CopyWatchLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Watch link copied. Anyone with it can view this project live, without signing in.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.message('Copy this watch link', { description: url, duration: 15_000 });
    }
  };
  return (
    <IconAction label="Copy watch link (view only, no sign-in)" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </IconAction>
  );
}

function UnmappedFiles({ paths }: { paths: string[] }) {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId);
  const selectedNode = useDiagramStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const selectedLabel = selectedNode ? String((selectedNode.data as { label?: unknown })?.label ?? selectedNode.id) : null;

  const assign = (path: string) => {
    if (!selectedNode || !selectedNodeId) return;
    const existing = getCodePaths(selectedNode);
    if (existing.includes(path)) return;
    const store = useDiagramStore.getState();
    store.pushHistory();
    store.updateNodeData(selectedNodeId, { codePaths: [...existing, path] });
    toast.success(`Mapped ${path} to ${selectedLabel}`);
  };

  return (
    <div className="px-2 pb-1">
      <ul className="space-y-0.5">
        {paths.map((path) => (
          <li key={path} className="flex items-center gap-2">
            <code className="flex-1 truncate font-mono text-[10.5px] text-text-secondary" title={path}>{path}</code>
            <button
              onClick={() => assign(path)}
              disabled={!selectedNode}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-text-primary/[0.06] hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent"
              title={selectedLabel ? `Map to ${selectedLabel}` : 'Select a component on the canvas, then map this file to it'}
              aria-label={selectedLabel ? `Map ${path} to ${selectedLabel}` : `Select a component to map ${path}`}
            >
              {selectedLabel ? `→ ${selectedLabel}` : 'map'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectAgent({
  agenticProjectId,
  workspaceId,
  onDone,
}: {
  agenticProjectId: string | null;
  workspaceId: string | null;
  onDone: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    if (!agenticProjectId || !workspaceId) return;
    setBusy(true);
    try {
      await approveAgentPairing({ userCode: code, projectId: agenticProjectId, workspaceId });
      toast.success('Checkout linked. Every Claude session started there now shows up here.');
      setCode('');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect the agent');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-border p-3.5">
      <p className="text-[11px] leading-relaxed text-text-muted">
        Only for a new machine or clone. Run this once in that checkout; its sessions and worktrees then connect on their own.
      </p>
      <LinkCommand />
      <div className="flex gap-1.5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Pairing code"
          className={`${INPUT_CLASS} font-mono uppercase placeholder:normal-case placeholder:font-sans`}
          aria-label="Pairing code"
          autoFocus
        />
        <button className={PRIMARY_BUTTON_CLASS} onClick={approve} disabled={busy || code.trim().length < 12 || !workspaceId}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
        </button>
      </div>
      <button onClick={onDone} className={TEXT_BUTTON_CLASS}>Cancel</button>
    </div>
  );
}
