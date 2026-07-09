'use client';

import { useState } from 'react';
import { X, GitBranch, Loader2, Check, AlertTriangle, BarChart3, Workflow as WorkflowIcon, Package } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { toast } from 'sonner';
import { parseAndValidateRepoDiagram } from '@/lib/utils/importRepoDiagram';
import type { RepoDiagramApiResponse } from '@/lib/types/repo-diagram';
import type { DependencyIntelligence, Workflow as RepoWorkflow } from '@/lib/types/repo-diagram';

interface GeneratedSummary {
  nodeCount: number;
  edgeCount: number;
  workflowCount: number;
  repoType: string;
  stack: string;
  architecturePattern: string;
  profileReasoning: string;
  reviewNotes: string;
  confidence: string;
  ndjson: string;
  workflows: RepoWorkflow[];
  criticalDependencies: DependencyIntelligence[];
}

interface Props {
  onClose: () => void;
}

export function RepoDiagramGenerator({ onClose }: Props) {
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<GeneratedSummary | null>(null);

  const { importDiagram, activeCanvasId, renameCanvas, fitView } = useDiagramStore();

  const extractRepoName = (url: string): string => {
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      const parts = cleanUrl.split('/');
      return parts[parts.length - 1] || 'Repository';
    } catch {
      return 'Repository';
    }
  };

  const loadDiagram = (ndjson: string) => {
    const parsed = parseAndValidateRepoDiagram(ndjson);
    if (!parsed) {
      toast.error('No architectural components could be detected in this repository.');
      return;
    }

    importDiagram(parsed.nodes, parsed.edges);
    const repoName = extractRepoName(repoUrl);
    renameCanvas(activeCanvasId, `${repoName} Architecture`);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    toast.success(`Loaded: ${parsed.nodeCount} nodes, ${parsed.edgeCount} edges`);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetch('/api/repo-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate diagram');
      }

      const result = data as RepoDiagramApiResponse;
      const profile = result.repoProfile;
      const stack = profile.primaryStack
        ? [profile.primaryStack.language, profile.primaryStack.framework, profile.primaryStack.runtime]
            .filter(Boolean)
            .join(' · ')
        : '';

      const criticalDependencies = (result.dependencyMap ?? [])
        .filter((d) => d.isOnCriticalPath)
        .slice(0, 6);

      setSummary({
        nodeCount: result.nodeCount || 0,
        edgeCount: result.edgeCount || 0,
        workflowCount: result.workflowCount || 0,
        repoType: profile.repoType || 'unknown',
        stack: stack || 'Unknown',
        architecturePattern: profile.architecturePattern || '',
        profileReasoning: profile.reasoning || '',
        reviewNotes: result.reviewNotes || '',
        confidence: result.confidence || 'medium',
        ndjson: result.ndjson || '',
        workflows: result.workflows ?? [],
        criticalDependencies,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate diagram';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (summary) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" onClick={onClose} />
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          onClick={onClose}
        >
          <div
            className="pointer-events-auto w-full max-w-lg max-h-[90vh] bg-white dark:bg-[hsl(var(--card))] rounded-2xl flex flex-col overflow-hidden border border-border/60"
            style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Repository Analyzed</p>
                <p className="text-[11px] text-muted-foreground truncate">{extractRepoName(repoUrl)}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground/80">Type:</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                  {summary.repoType.replace(/_/g, ' ')}
                </span>
                {summary.architecturePattern && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {summary.architecturePattern.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
              </div>

              {summary.stack && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground/80">Stack:</span>
                  <span className="text-xs text-muted-foreground">{summary.stack}</span>
                </div>
              )}

              {summary.profileReasoning && (
                <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
                  {summary.profileReasoning}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-accent/30 border border-border/40 text-center">
                  <p className="text-lg font-bold text-foreground">{summary.nodeCount}</p>
                  <p className="text-[10px] text-muted-foreground">Nodes</p>
                </div>
                <div className="p-3 rounded-xl bg-accent/30 border border-border/40 text-center">
                  <p className="text-lg font-bold text-foreground">{summary.edgeCount}</p>
                  <p className="text-[10px] text-muted-foreground">Edges</p>
                </div>
                <div className="p-3 rounded-xl bg-accent/30 border border-border/40 text-center">
                  <p className="text-lg font-bold text-foreground">{summary.workflowCount}</p>
                  <p className="text-[10px] text-muted-foreground">Workflows</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground/80">Confidence:</span>
                <span
                  className={`text-xs font-medium capitalize ${
                    summary.confidence === 'high'
                      ? 'text-emerald-500'
                      : summary.confidence === 'medium'
                        ? 'text-amber-500'
                        : 'text-red-500'
                  }`}
                >
                  {summary.confidence}
                </span>
              </div>

              {summary.workflows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <WorkflowIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground/80">Detected workflows</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {summary.workflows.slice(0, 4).map((wf) => (
                      <li
                        key={wf.name}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-accent/40 border border-border/40 text-muted-foreground"
                      >
                        <span className="font-medium text-foreground/90">{wf.name}</span>
                        {wf.steps.length > 0 && (
                          <span className="text-muted-foreground/80"> — {wf.steps.length} steps</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.criticalDependencies.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground/80">Critical dependencies</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {summary.criticalDependencies.map((dep) => (
                      <li
                        key={dep.name}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-accent/40 border border-border/40"
                      >
                        <span className="font-medium text-foreground/90">{dep.name}</span>
                        <span className="text-muted-foreground"> — {dep.architecturalRole}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.reviewNotes && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{summary.reviewNotes}</p>
                </div>
              )}

              <div className="flex items-center gap-3 justify-end mt-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => loadDiagram(summary.ndjson)}
                  className="px-5 py-2.5 text-xs font-medium text-white bg-primary rounded-xl hover:bg-primary/95 transition-all shadow-md flex items-center gap-2"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  View Diagram
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        onClick={onClose}
      >
        <div
          className="pointer-events-auto w-full max-w-md bg-white dark:bg-[hsl(var(--card))] rounded-2xl flex flex-col overflow-hidden border border-border/60"
          style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.15)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">GitHub Repo Ingest</p>
              <p className="text-[11px] text-muted-foreground">
                Analyze a public repository and draw its architecture
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repo-url" className="text-xs font-semibold text-foreground/80">
                GitHub Repository URL
              </label>
              <input
                id="repo-url"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                disabled={isLoading}
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm bg-accent/40 rounded-xl outline-none border border-border/40 focus:border-primary/50 text-foreground placeholder:text-muted-foreground/60 transition-all shadow-inner"
              />
              <span className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed">
                * Public repositories only. Works with any language or framework.
              </span>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive leading-relaxed">
                {error}
                {(error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('403') || error.toLowerCase().includes('429')) && (
                  <p className="mt-1.5 text-destructive/80">
                    Add a <code className="bg-destructive/10 px-1 rounded">GITHUB_TOKEN</code> to{' '}
                    <code className="bg-destructive/10 px-1 rounded">.env.local</code> to raise the limit to 5,000 requests/hr.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !repoUrl.trim()}
                className="px-5 py-2.5 text-xs font-medium text-white bg-primary rounded-xl hover:bg-primary/95 transition-all shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing repository... this may take 20-30 seconds.</span>
                  </>
                ) : (
                  <span>Generate Architecture Diagram</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
