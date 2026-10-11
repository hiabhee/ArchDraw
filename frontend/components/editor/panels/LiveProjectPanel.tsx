'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, FileQuestion, GitCommitVertical, Link2, Loader2, Plus, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

const STATUS_LABEL: Record<LiveAgentSession['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  ended: 'Ended',
};

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
          className="absolute left-3 bottom-28 z-30 w-[min(320px,calc(100vw-24px))] rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
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
  const [remote, setRemote] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      // The project row links to the saved canvas, so persist it first.
      await flushCanvasSaveToDB(canvasId, useDiagramStore.getState);
      const { project } = await makeCanvasProject(canvasId, { repositoryRemote: remote.trim() || null });
      useDiagramStore.getState().setCanvasProjectLink(canvasId, project.agenticProjectId);
      toast.success('This canvas is now a live project');
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
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Make this a live project</h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Link this canvas to a codebase. Your coding agents keep the diagram up to date, and you can see which
        session is working on which component while they work.
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">Repository remote (optional)</span>
        <Input
          value={remote}
          onChange={(e) => setRemote(e.target.value)}
          placeholder="git@github.com:you/repo.git"
          className="h-8 text-xs"
        />
      </label>
      <Button size="sm" className="w-full" onClick={handleCreate} disabled={busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
        Make live project
      </Button>
    </div>
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
        className="w-full flex items-center justify-between gap-2 px-4 py-3"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={`w-2 h-2 rounded-full ${liveCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          Live project
          <span className="text-xs font-normal text-muted-foreground">
            {liveCount} {liveCount === 1 ? 'agent' : 'agents'}
          </span>
        </span>
        {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {error && <p className="text-xs text-destructive">Live updates paused: {error}</p>}

          {!hasMappings && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              No component has code paths yet. Ask your agent to map the codebase into this project, or add
              paths to a component in its properties.
            </p>
          )}

          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No agent sessions yet. Connect an agent to get started.</p>
          ) : (
            <ul className="space-y-1.5">
              {sessions.map((s) => {
                const focused = focusedSessionKey === s.sessionKey;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setFocusedSession(focused ? null : s.sessionKey)}
                      className={`w-full text-left rounded-xl px-2.5 py-2 border transition-colors ${
                        focused ? 'border-accent bg-accent/5' : 'border-transparent hover:bg-muted/60'
                      } ${s.status === 'ended' ? 'opacity-50' : ''}`}
                      aria-pressed={focused}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-xs font-medium truncate flex-1">{s.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {STATUS_LABEL[s.status]} · {timeAgo(s.lastSeenAt, now)}
                        </span>
                      </span>
                      {s.intent && <span className="block mt-1 pl-[18px] text-[11px] text-foreground/80 line-clamp-2">{s.intent}</span>}
                      {s.lastChange && (
                        <span className="flex items-start gap-1 mt-1 pl-[18px] text-[11px] text-foreground/80">
                          <GitCommitVertical className="w-3 h-3 shrink-0 mt-px" aria-hidden />
                          <span className="line-clamp-2">
                            {summarizeChange(s.lastChange)} · {timeAgo(s.lastChange.at, now)}
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 mt-1 pl-[18px] text-[11px] text-muted-foreground">
                        <Activity className="w-3 h-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {s.currentComponentId ? labels.get(s.currentComponentId) ?? s.currentComponentId : 'No mapped edits yet'}
                          {s.branch && s.branch !== s.label ? ` · ${s.branch}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {unmapped.length > 0 && <UnmappedFiles paths={unmapped} />}

          {showConnect ? (
            <ConnectAgent
              agenticProjectId={snapshot?.agenticProjectId ?? null}
              workspaceId={snapshot?.workspaceId ?? null}
              onDone={() => setShowConnect(false)}
            />
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowConnect(true)}>
                <Link2 className="w-3.5 h-3.5" /> Connect an agent
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:!text-destructive"
                onClick={() => setConfirmUnlink(true)}
              >
                Stop
              </Button>
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
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <FileQuestion className="w-3 h-3" aria-hidden /> Edited files not on the diagram
      </p>
      <ul className="space-y-0.5">
        {paths.map((path) => (
          <li key={path} className="flex items-center gap-1.5 text-[11px]">
            <code className="truncate flex-1 text-foreground/80" title={path}>{path}</code>
            <button
              onClick={() => assign(path)}
              disabled={!selectedNode}
              className="shrink-0 inline-flex items-center gap-0.5 text-accent disabled:text-muted-foreground/50"
              title={selectedLabel ? `Map to ${selectedLabel}` : 'Select a component to map this file'}
              aria-label={selectedLabel ? `Map ${path} to ${selectedLabel}` : `Select a component to map ${path}`}
            >
              <Plus className="w-3 h-3" /> map
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
  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const command = `npx -y @hiabhee/archdraw-mcp-server link --api ${apiBase}`;

  const approve = async () => {
    if (!agenticProjectId || !workspaceId) return;
    setBusy(true);
    try {
      await approveAgentPairing({ userCode: code, projectId: agenticProjectId, workspaceId });
      toast.success('Agent connected. It will appear here once it starts working.');
      setCode('');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect the agent');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        1. In your repository, run:
      </p>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(command);
          toast.success('Command copied');
        }}
        className="w-full text-left rounded-lg bg-muted px-2 py-1.5 font-mono text-[10.5px] break-all"
        title="Copy command"
      >
        {command}
      </button>
      <p className="text-[11px] text-muted-foreground">2. Enter the code it prints:</p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD-EFGH-JKLM"
          className="h-8 text-xs font-mono uppercase"
          aria-label="Pairing code"
        />
        <Button size="sm" className="h-8 text-xs" onClick={approve} disabled={busy || code.trim().length < 12 || !workspaceId}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
        </Button>
      </div>
      <button onClick={onDone} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
    </div>
  );
}
