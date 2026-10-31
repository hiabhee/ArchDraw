'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Eye, Loader2, Plus, Power, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/editor/modals/UpgradeModal';
import { approveAgentPairing, makeCanvasProject, unlinkCanvasProject } from '@/lib/client/api-client';
import { ACTIVITY_LABEL, collisions, mapCoverage, sessionActivity, type LiveAgentSession } from '@/lib/diagram/projects/liveActivity';
import { sessionCostUsd } from '@/lib/diagram/projects/sessionInsights';
import { addUsage, emptyUsage, formatTokens, formatUsd, totalTokens } from '@/lib/diagram/projects/sessionUsage';
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
  const [expanded, setExpanded] = useState(false);
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
      setExpanded(true);
    };
    window.addEventListener(OPEN_LIVE_PROJECT_EVENT, handler);
    return () => window.removeEventListener(OPEN_LIVE_PROJECT_EVENT, handler);
  }, [user]);

  // Project canvases always show the rail; its list opens beside it.
  const visible = open || isProject;

  return (
    <>
      {visible && activeCanvasId && (isProject ? (
        <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2" role="region" aria-label="Live project">
          <ProjectView canvasId={activeCanvasId} expanded={expanded} onExpandedChange={setExpanded} />
        </div>
      ) : (
        <div
          className="absolute left-3 bottom-28 z-30 w-[min(288px,calc(100vw-24px))] rounded-xl border border-border bg-surface-panel/95 text-text-primary shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur"
          role="region"
          aria-label="Live project"
        >
          <MakeProjectView canvasId={activeCanvasId} onClose={() => setOpen(false)} />
        </div>
      ))}
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

/** Most avatars the rail shows before "+n" (the rest are in the list). */
const RAIL_AVATARS = 5;

function ProjectView({
  canvasId,
  expanded,
  onExpandedChange,
}: {
  canvasId: string;
  /** The session list beside the rail. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
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
  // Rework risk and money: who shares a component right now, and what the sessions in view have used.
  const clashes = useMemo(() => [...collisions(sessions, now).entries()], [sessions, now]);
  const spend = useMemo(() => {
    let tokens = 0;
    let usd: number | null = null;
    let reporting = 0;
    for (const s of sessions) {
      if (!s.usage) continue;
      reporting += 1;
      tokens += totalTokens(addUsage(emptyUsage(), s.usage));
      const cost = sessionCostUsd(s);
      if (cost != null) usd = (usd ?? 0) + cost;
    }
    return reporting > 0 ? { tokens, usd, reporting } : null;
  }, [sessions]);
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
  // Working sessions first, then the idle ones that may come back; ended ones only in the list.
  const railSessions = [...current, ...earlier.filter((s) => s.status === 'idle')];

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExpandedChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onExpandedChange]);

  const handleUnlink = async () => {
    try {
      await unlinkCanvasProject(canvasId);
      useDiagramStore.getState().setCanvasProjectLink(canvasId, null);
      toast.success('Live project stopped. Agent access was revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not stop the project');
    }
  };

  const describe = (s: LiveAgentSession) => {
    const where = s.site ? `New: ${s.site.label}` : s.currentComponentId ? labels.get(s.currentComponentId) ?? s.currentComponentId : null;
    const activity = sessionActivity(s, now);
    return { where, activity, busy: activity === 'writing' || activity === 'running', task: s.status !== 'ended' ? s.intent : null };
  };

  const row = (s: LiveAgentSession) => {
    const focused = focusedSessionKey === s.sessionKey;
    const { where, activity, busy, task } = describe(s);
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
              <span className={`shrink-0 ${busy ? 'text-text-primary' : ''}`} style={busy ? { color: s.color } : undefined}>
                {ACTIVITY_LABEL[activity]}
              </span>
            </span>
            {task && <span className="mt-0.5 block truncate text-[11px] leading-tight text-text-secondary">{task}</span>}
          </span>
          <span className="shrink-0 self-start pt-0.5 text-right text-[10px] tabular-nums text-text-muted/80">
            {timeAgo(s.lastSeenAt, now)}
            {s.usage && (
              <span className="block" title={`${formatTokens(totalTokens(s.usage))} tokens, mostly cached context. The dollar figure is an estimate at list prices.`}>
                {sessionCostUsd(s) != null ? `≈${formatUsd(sessionCostUsd(s)!)}` : `${formatTokens(totalTokens(s.usage))} tok`}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  const statusText = current.length > 0 ? `${current.length} working` : 'quiet';

  return (
    <div className="relative">
      {/* The rail: who is here, at a glance; everything else is one click away. */}
      <div className="flex w-11 flex-col items-center gap-1 rounded-2xl border border-border bg-surface-panel/95 py-1.5 text-text-primary shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur">
        <button
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={`Live project: ${statusText}. ${expanded ? 'Hide' : 'Show'} sessions`}
          title={`Live · ${statusText}`}
          className={`flex h-8 w-8 flex-col items-center justify-center gap-[3px] rounded-xl transition-colors ${expanded ? 'bg-text-primary/[0.08]' : 'hover:bg-text-primary/[0.05]'}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {current.length > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />}
            <span className={`relative h-1.5 w-1.5 rounded-full ${current.length > 0 ? 'bg-emerald-500' : 'bg-text-muted/40'}`} />
          </span>
          <span className="text-[7.5px] font-bold uppercase tracking-[0.12em] text-text-muted">Live</span>
        </button>

        {railSessions.length > 0 && <span className="my-0.5 h-px w-5 bg-border" aria-hidden />}
        {railSessions.slice(0, RAIL_AVATARS).map((s) => {
          const focused = focusedSessionKey === s.sessionKey;
          const { where, activity, busy, task } = describe(s);
          return (
            <div key={s.id} className="group relative">
              <button
                onClick={() => setFocusedSession(focused ? null : s.sessionKey)}
                aria-pressed={focused}
                aria-label={[s.name, ACTIVITY_LABEL[activity], where ? `on ${where}` : null, task].filter(Boolean).join(', ')}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${focused ? 'bg-text-primary/[0.08]' : 'hover:bg-text-primary/[0.05]'}`}
              >
                <Avatar session={s} />
              </button>
              {/* Hover card beside the rail. */}
              <div className="pointer-events-none absolute left-full top-1/2 z-10 ml-2.5 hidden w-max max-w-[240px] -translate-y-1/2 rounded-xl border border-border bg-surface-panel px-3 py-2 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] group-hover:block group-focus-within:block">
                <p className="truncate text-[12px] font-medium leading-tight">{where ?? 'Not on the map yet'}</p>
                <p className="mt-0.5 text-[10.5px] leading-tight text-text-muted">
                  <span className="font-semibold text-text-primary/80">{s.name}</span>
                  {' · '}
                  <span style={busy ? { color: s.color } : undefined}>{ACTIVITY_LABEL[activity]}</span>
                </p>
                {task && <p className="mt-1 text-[11px] leading-snug text-text-secondary">{task}</p>}
              </div>
            </div>
          );
        })}
        {railSessions.length > RAIL_AVATARS && (
          <button
            onClick={() => onExpandedChange(true)}
            className="flex h-6 w-8 items-center justify-center rounded-lg text-[10px] font-semibold tabular-nums text-text-muted hover:bg-text-primary/[0.05] hover:text-text-primary"
            aria-label={`${railSessions.length - RAIL_AVATARS} more sessions`}
          >
            +{railSessions.length - RAIL_AVATARS}
          </button>
        )}

        {unmapped.length > 0 && (
          <button
            onClick={() => { onExpandedChange(true); setShowUnmapped(true); }}
            title={`${unmapped.length} edited file${unmapped.length === 1 ? '' : 's'} not on the map`}
            aria-label={`${unmapped.length} files not on the map`}
            className="flex h-7 w-8 items-center justify-center gap-1 rounded-lg text-[10px] tabular-nums text-text-muted hover:bg-text-primary/[0.05] hover:text-text-primary"
          >
            <span className="h-1.5 w-1.5 rotate-45 border border-current" aria-hidden />
            {unmapped.length}
          </button>
        )}

        <span className="my-0.5 h-px w-5 bg-border" aria-hidden />
        <IconAction label={linkedCheckouts > 0 ? 'Link another checkout' : 'Link a checkout'} onClick={() => { onExpandedChange(true); setShowConnect(true); }}>
          <Plus className="h-3.5 w-3.5" />
        </IconAction>
        {snapshot?.watchPath && <CopyWatchLink path={snapshot.watchPath} />}
        <IconAction label="Stop live project" onClick={() => setConfirmUnlink(true)} danger>
          <Power className="h-3.5 w-3.5" />
        </IconAction>
      </div>

      {expanded && (
        <div className="absolute left-full top-1/2 ml-2 w-[min(280px,calc(100vw-80px))] -translate-y-1/2 rounded-xl border border-border bg-surface-panel/95 text-text-primary shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur">
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Live</span>
            <span className="text-[11px] text-text-muted">{statusText}</span>
            <button onClick={() => onExpandedChange(false)} aria-label="Hide sessions" className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-text-primary/[0.06] hover:text-text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-1.5 pb-1.5">
            {error && <p className="px-2 pb-1.5 text-[11px] text-destructive">Paused: {error}</p>}

            {clashes.map(([nodeId, list]) => (
              <p key={nodeId} className="px-2 pb-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                {list.map((x) => x.name).join(' and ')} are both editing {labels.get(nodeId)?.split(/<br\s*\/?>/i)[0] ?? nodeId}. They may overwrite each other.
              </p>
            ))}

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
            <p className="border-t border-border/60 px-3 py-2 text-[10.5px] text-text-muted">
              {linkedCheckouts > 0 ? `${linkedCheckouts} checkout${linkedCheckouts === 1 ? '' : 's'} linked` : 'No checkout linked'}
              {spend && (
                <span title={`${formatTokens(spend.tokens)} tokens across ${spend.reporting} session${spend.reporting === 1 ? '' : 's'} in the last few hours, mostly cached context. Dollars are an estimate at list prices; your plan may bill differently.`}>
                  {' '}· {spend.usd != null ? `≈${formatUsd(spend.usd)}` : `${formatTokens(spend.tokens)} tokens`} used
                </span>
              )}
              {coverage && (
                <span title={`${coverage.percent}% of the ${coverage.total} files agents edited are on a component. Low? Ask Claude to re-map the project.`}>
                  {' '}· map covers {coverage.percent}%
                </span>
              )}
            </p>
          )}
        </div>
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
