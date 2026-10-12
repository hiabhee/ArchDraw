'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UpgradeModal, UPGRADE_BENEFITS } from '@/components/editor/modals/UpgradeModal';
import { approveAgentPairing, makeCanvasProject, unlinkCanvasProject } from '@/lib/client/api-client';
import type { LiveAgentSession } from '@/lib/diagram/projects/liveActivity';
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

const STATUS_LABEL: Record<LiveAgentSession['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  ended: 'Ended',
};

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

  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot]);
  const liveCount = sessions.filter((s) => s.status !== 'ended').length;
  const linkedCheckouts = snapshot?.linkedCheckouts ?? 0;
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
  const now = snapshot?.serverTime ?? 0;

  const handleUnlink = async () => {
    try {
      await unlinkCanvasProject(canvasId);
      useDiagramStore.getState().setCanvasProjectLink(canvasId, null);
      toast.success('Live project stopped. Agent access was revoked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not stop the project');
    }
  };

  return (
    <div>
      <button
        onClick={onToggleCollapsed}
        className="w-full flex items-center gap-2 px-3.5 py-2.5"
        aria-expanded={!collapsed}
      >
        <span className="relative flex w-1.5 h-1.5">
          {liveCount > 0 && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60 motion-reduce:hidden" />}
          <span className={`relative w-1.5 h-1.5 rounded-full ${liveCount > 0 ? 'bg-emerald-500' : 'bg-text-muted/40'}`} />
        </span>
        <span className="text-[13px] font-medium tracking-tight">Live</span>
        <span className="text-[11px] tabular-nums text-text-muted">{liveCount}</span>
        <ChevronDown
          className={`ml-auto w-3.5 h-3.5 text-text-muted transition-transform ${collapsed ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          <div className="px-1.5 py-1.5 max-h-[50vh] overflow-y-auto">
            {error && <p className="px-2 py-1.5 text-[11px] text-destructive">Paused: {error}</p>}

            {sessions.length === 0 ? (
              <p className="px-2 py-2 text-[11.5px] leading-relaxed text-text-muted">
                {linkedCheckouts > 0
                  ? `No sessions in the last few hours. ${linkedCheckouts === 1 ? 'Your linked checkout needs' : `Your ${linkedCheckouts} linked checkouts need`} no new pairing: start Claude there and it shows up here.`
                  : 'No agents yet. Link a checkout once and every session started there shows up here.'}
                {!hasMappings && ' Ask one to map this codebase.'}
              </p>
            ) : (
              <ul>
                {sessions.map((s) => {
                  const focused = focusedSessionKey === s.sessionKey;
                  const where = s.currentComponentId ? labels.get(s.currentComponentId) ?? s.currentComponentId : null;
                  const detail = s.intent ?? (s.lastChange ? summarizeChange(s.lastChange) : null);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setFocusedSession(focused ? null : s.sessionKey)}
                        className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors ${
                          focused ? 'bg-text-primary/[0.06]' : 'hover:bg-text-primary/[0.035]'
                        } ${s.status === 'ended' ? 'opacity-45' : ''}`}
                        aria-pressed={focused}
                        title={`${s.label} · ${STATUS_LABEL[s.status]}${s.branch && s.branch !== s.label ? ` · ${s.branch}` : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'active' ? '' : 'opacity-50'}`}
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="flex-1 truncate text-xs font-medium">{s.label}</span>
                          <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">
                            {timeAgo(s.lastSeenAt, now)}
                          </span>
                        </span>
                        {(where || detail) && (
                          <span className="mt-0.5 block truncate pl-3.5 text-[11px] text-text-muted">
                            {where && <span className="text-text-secondary">{where}</span>}
                            {where && detail && ' — '}
                            {detail}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {unmapped.length > 0 && <UnmappedFiles paths={unmapped} />}
          </div>

          {showConnect ? (
            <ConnectAgent
              agenticProjectId={snapshot?.agenticProjectId ?? null}
              workspaceId={snapshot?.workspaceId ?? null}
              onDone={() => setShowConnect(false)}
            />
          ) : (
            <div className="flex items-center justify-between border-t border-border px-3.5 py-2">
              <button onClick={() => setShowConnect(true)} className={TEXT_BUTTON_CLASS}>
                {linkedCheckouts > 0 ? '+ Link another checkout' : '+ Link a checkout'}
              </button>
              <button
                onClick={() => setConfirmUnlink(true)}
                className="text-[11px] text-text-muted transition-colors hover:text-destructive"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title="Stop live project?"
        description="Connected agents lose access and session history is cleared. The diagram itself is kept."
        confirmText="Stop project"
        destructive
        onConfirm={handleUnlink}
      />
    </div>
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
    <div className="mt-1 px-2 pt-2 pb-1">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Unmapped</p>
      <ul className="space-y-0.5">
        {paths.map((path) => (
          <li key={path} className="group flex items-center gap-2">
            <code className="flex-1 truncate font-mono text-[10.5px] text-text-secondary" title={path}>{path}</code>
            <button
              onClick={() => assign(path)}
              disabled={!selectedNode}
              className="shrink-0 text-[10.5px] text-text-muted transition-colors hover:text-text-primary disabled:opacity-40 disabled:hover:text-text-muted"
              title={selectedLabel ? `Map to ${selectedLabel}` : 'Select a component to map this file'}
              aria-label={selectedLabel ? `Map ${path} to ${selectedLabel}` : `Select a component to map ${path}`}
            >
              map
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
