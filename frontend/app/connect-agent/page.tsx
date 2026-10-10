'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Loader2, Shield, ShieldOff } from 'lucide-react';
import { SignInButtons } from '@/components/auth/SignInButtons';
import { useAuthStore } from '@/store/authStore';

interface AgenticWorkspace {
  id: string;
  branchName: string | null;
  currentRevision: number;
}

interface AgenticProject {
  id: string;
  name: string;
  repositoryRemote: string | null;
  workspaces: AgenticWorkspace[];
}

interface AgenticCredential {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error || `Request failed (${response.status})`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ConnectAgentPage() {
  const { user, initialized } = useAuthStore();
  const signedIn = Boolean(user && user.id !== 'guest');
  const [projects, setProjects] = useState<AgenticProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [credentials, setCredentials] = useState<AgenticCredential[]>([]);
  const [userCode, setUserCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [repositoryRemote, setRepositoryRemote] = useState('');
  const [branchName, setBranchName] = useState('main');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (!signedIn) {
      // Clear project data when authentication is removed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setCredentials([]);
      return;
    }

    let active = true;
    setLoadingProjects(true);
    fetch('/api/agentic/projects', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const nextProjects = (data.projects ?? []) as AgenticProject[];
        setProjects(nextProjects);
        setSelectedProjectId((current) =>
          nextProjects.some((project) => project.id === current) ? current : nextProjects[0]?.id ?? '',
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load projects');
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });

    return () => { active = false; };
  }, [signedIn]);

  useEffect(() => {
    if (!selectedProject) {
      // Clear project-scoped data when the selection is removed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedWorkspaceId('');
      setCredentials([]);
      return;
    }

    setSelectedWorkspaceId((current) =>
      selectedProject.workspaces.some((workspace) => workspace.id === current)
        ? current
        : selectedProject.workspaces[0]?.id ?? '',
    );

    let active = true;
    fetch(`/api/agentic/projects/${selectedProject.id}/credentials`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json();
      })
      .then((data) => {
        if (active) setCredentials((data.credentials ?? []) as AgenticCredential[]);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load credentials');
      });

    return () => { active = false; };
  }, [selectedProject]);

  async function approvePairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !selectedWorkspaceId) return;
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/agentic/pairing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode, projectId: selectedProject.id, workspaceId: selectedWorkspaceId }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setUserCode('');
      setMessage(`Approved for ${selectedProject.name}. Return to your coding agent to finish connection.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not approve this pairing');
    } finally {
      setSubmitting(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingProject(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/agentic/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          repositoryRemote: repositoryRemote || undefined,
          defaultBranch: branchName || undefined,
          branchName: branchName || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      const project = data.project as AgenticProject;
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setSelectedProjectId(project.id);
      setSelectedWorkspaceId(project.workspaces[0]?.id ?? '');
      setProjectName('');
      setRepositoryRemote('');
      setMessage(`Created ${project.name}. Select it above to approve pairing.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create project');
    } finally {
      setCreatingProject(false);
    }
  }

  async function revokeCredential(credentialId: string) {
    if (!selectedProject) return;
    setError('');
    try {
      const response = await fetch(`/api/agentic/projects/${selectedProject.id}/credentials/${credentialId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await readError(response));
      setCredentials((current) => current.map((credential) =>
        credential.id === credentialId ? { ...credential, revokedAt: new Date().toISOString() } : credential,
      ));
      setMessage('Agent credential revoked. It can no longer read this project.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke credential');
    }
  }

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-text-primary sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to ArchDraw
        </Link>

        <section className="rounded-2xl border border-border-default bg-surface-panel p-5 shadow-sm sm:p-8">
          <div className="mb-7 flex items-start gap-3">
            <div className="rounded-xl bg-accent-bg p-2.5 text-accent"><Shield className="h-5 w-5" /></div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Agent connection</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Connect your coding agent</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                Approve a short-lived code, choose the private project it can access, then return to your agent to finish setup.
              </p>
            </div>
          </div>

          {!initialized ? (
            <div className="flex items-center gap-2 py-6 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Checking your account…</div>
          ) : !signedIn ? (
            <div className="rounded-xl border border-border-default bg-surface-page p-5">
              <h2 className="font-semibold">Sign in to continue</h2>
              <p className="mt-1 mb-4 text-sm text-text-secondary">Your agent connection stays private to your account.</p>
              {process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true' ? (
                <SignInButtons callbackURL="/connect-agent" />
              ) : (
                <p className="text-sm text-text-secondary">Account sign-in is not enabled in this environment.</p>
              )}
            </div>
          ) : (
            <div className="space-y-7">
              <form onSubmit={approvePairing} className="space-y-4">
                <div>
                  <label htmlFor="pairing-code" className="mb-2 block text-sm font-medium">One-time code</label>
                  <input
                    id="pairing-code"
                    value={userCode}
                    onChange={(event) => setUserCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, ''))}
                    autoComplete="one-time-code"
                    spellCheck={false}
                    maxLength={12}
                    placeholder="12-character code"
                    className="w-full rounded-xl border border-border-default bg-surface-page px-4 py-3 font-mono text-lg tracking-[0.2em] text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    required
                  />
                  <p className="mt-1.5 text-xs text-text-secondary">The code expires after 10 minutes and can be used once.</p>
                </div>

                {loadingProjects ? (
                  <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Loading your projects…</div>
                ) : projects.length > 0 ? (
                  <>
                    <div>
                      <label htmlFor="agent-project" className="mb-2 block text-sm font-medium">Project</label>
                      <select
                        id="agent-project"
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                        className="w-full rounded-xl border border-border-default bg-surface-page px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                      >
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                    </div>
                    {selectedProject && selectedProject.workspaces.length > 0 && (
                      <div>
                        <label htmlFor="agent-workspace" className="mb-2 block text-sm font-medium">Branch or worktree</label>
                        <select
                          id="agent-workspace"
                          value={selectedWorkspaceId}
                          onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                          className="w-full rounded-xl border border-border-default bg-surface-page px-4 py-3 text-sm text-text-primary outline-none focus:border-accent"
                        >
                          {selectedProject.workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.branchName || 'Unassigned branch'} · revision {workspace.currentRevision}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={submitting || userCode.length !== 12 || !selectedProject || !selectedWorkspaceId}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {submitting ? 'Approving…' : 'Approve project access'}
                    </button>
                  </>
                ) : (
                  <p className="rounded-xl border border-border-default bg-surface-page p-4 text-sm text-text-secondary">
                    Create a project below first. A Git remote is optional, so local-only repositories are supported.
                  </p>
                )}
              </form>

              {!loadingProjects && (
                <details open={projects.length === 0} className="rounded-xl border border-border-default bg-surface-page p-4 sm:p-5">
                  <summary className="cursor-pointer font-semibold">Create a project</summary>
                  <form onSubmit={createProject} className="mt-4 space-y-3">
                    <label className="block text-sm font-medium" htmlFor="new-project-name">Project name</label>
                    <input id="new-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} required className="w-full rounded-lg border border-border-default bg-surface-panel px-3 py-2.5 text-sm outline-none focus:border-accent" placeholder="Payments API" />
                    <label className="block text-sm font-medium" htmlFor="new-project-remote">Git remote <span className="font-normal text-text-secondary">(optional)</span></label>
                    <input id="new-project-remote" value={repositoryRemote} onChange={(event) => setRepositoryRemote(event.target.value)} maxLength={2048} className="w-full rounded-lg border border-border-default bg-surface-panel px-3 py-2.5 text-sm outline-none focus:border-accent" placeholder="https://github.com/org/repo" />
                    <label className="block text-sm font-medium" htmlFor="new-project-branch">Current branch</label>
                    <input id="new-project-branch" value={branchName} onChange={(event) => setBranchName(event.target.value)} maxLength={255} className="w-full rounded-lg border border-border-default bg-surface-panel px-3 py-2.5 text-sm outline-none focus:border-accent" placeholder="main" />
                    <button type="submit" disabled={creatingProject || !projectName.trim()} className="inline-flex items-center gap-2 rounded-lg border border-border-default px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-panel disabled:opacity-50">
                      {creatingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                      Create project
                    </button>
                  </form>
                </details>
              )}

              {selectedProject && credentials.length > 0 && (
                <div className="border-t border-border-default pt-6">
                  <h2 className="mb-1 font-semibold">Agent credentials</h2>
                  <p className="mb-3 text-sm text-text-secondary">Revoke access for this project at any time.</p>
                  <ul className="space-y-2">
                    {credentials.map((credential) => (
                      <li key={credential.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{credential.name} {credential.revokedAt && <span className="font-normal text-text-secondary">· revoked</span>}</p>
                          <p className="text-xs text-text-secondary">Expires {formatDate(credential.expiresAt)}{credential.lastUsedAt ? ` · Last used ${formatDate(credential.lastUsedAt)}` : ''}</p>
                        </div>
                        {!credential.revokedAt && (
                          <button type="button" onClick={() => revokeCredential(credential.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-red-400 hover:text-red-600">
                            <ShieldOff className="h-3.5 w-3.5" /> Revoke
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {message && <p role="status" className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-text-primary">{message}</p>}
          {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text-primary">{error}</p>}

          <p className="mt-7 border-t border-border-default pt-5 text-xs leading-5 text-text-secondary">
            The access token stays with the process that started pairing, is project-scoped, expires after 90 days, and is stored as a hash by ArchDraw. This page never displays it.
          </p>
        </section>
      </div>
    </main>
  );
}
