'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTutorialStore, useTutorialHelpers } from '@/store/tutorialStore';
import { useAuthStore } from '@/store/authStore';
import type { PhaseName, PhaseContent } from '@/lib/tutorial/schema';
import {
  canRequestExplain,
  explainOverrideKey,
  isExplainPhase,
  nextExplainVariantIndex,
} from '@/lib/tutorial/explainQuota';
import { validateStep, getStepRequirements, isNodeTypeMet, isEdgeMet, type StepRequirements } from '@/lib/tutorialValidation';
import { layoutDiagramViaMermaid } from '@/lib/mermaid/relayout';
import { analytics } from '@/lib/analytics';

const PHASE_BUTTONS: Record<PhaseName, { label: string; action: PhaseName | 'next_step' }> = {
  context: { label: 'Got it', action: 'intro' },
  intro: { label: 'Tell me more', action: 'teaching' },
  teaching: { label: "Let's do it", action: 'action' },
  action: { label: 'Continue', action: 'next_step' },
  connecting: { label: 'Continue', action: 'next_step' },
  celebration: { label: 'Next Step', action: 'next_step' },
};

// ── Requirement Checklist ────────────────────────────────────────────────────
function RequirementChecklist({
  requirements,
  nodes,
  edges,
}: {
  requirements: StepRequirements;
  nodes: Node[];
  edges: Edge[];
}) {
  if (requirements.requiredNodeTypes.length === 0 && requirements.requiredEdges.length === 0) {
    return null;
  }

  const items: Array<{ label: string; met: boolean }> = [];

  // Deduplicate node requirements by nodeType
  const seenNodeTypes = new Set<string>();
  for (let i = 0; i < requirements.requiredNodeTypes.length; i++) {
    const nt = requirements.requiredNodeTypes[i];
    if (seenNodeTypes.has(nt)) continue;
    seenNodeTypes.add(nt);
    items.push({
      label: requirements.requiredNodeLabels[i] ?? nt.replace(/_/g, ' '),
      met: isNodeTypeMet(nt, nodes),
    });
  }

  // Deduplicate edge requirements
  const seenEdges = new Set<string>();
  for (const er of requirements.requiredEdges) {
    const key = `${er.source}->${er.target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    items.push({
      label: `${er.sourceLabel} → ${er.targetLabel}`,
      met: isEdgeMet(er.source, er.target, nodes, edges),
    });
  }

  if (items.length === 0) return null;

  const allMet = items.every(i => i.met);

  return (
    <div className={`p-3 rounded-lg border text-sm ${allMet
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${allMet
        ? 'text-green-600 dark:text-green-400'
        : 'text-blue-600 dark:text-blue-400'
      }`}>
        {allMet ? 'Ready to continue!' : 'Requirements'}
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              item.met
                ? 'bg-green-500 text-white'
                : 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-400'
            }`}>
              {item.met ? '✓' : ''}
            </span>
            <span className={item.met ? 'text-green-700 dark:text-green-300 line-through opacity-60' : 'text-foreground'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Phase Renderer ───────────────────────────────────────────────────────────
function PhaseRenderer({
  phase,
  content,
  onContinue,
  continueAfterMs = 45000,
  validationError,
  allRequirementsMet,
  isActionPhase,
  requirements,
  nodes,
  edges,
  tutorialId,
  stepId,
  explainContent,
  onExplainDifferent,
  explainLoading,
  explainDisabled,
  explainDisabledReason,
}: {
  phase: PhaseName;
  content: PhaseContent;
  onContinue: () => void;
  continueAfterMs?: number;
  validationError?: string | null;
  allRequirementsMet?: boolean;
  isActionPhase?: boolean;
  requirements?: StepRequirements;
  nodes?: Node[];
  edges?: Edge[];
  tutorialId?: string;
  stepId?: string;
  componentLabel?: string;
  explainContent?: PhaseContent;
  onExplainDifferent?: () => void;
  explainLoading?: boolean;
  explainDisabled?: boolean;
  explainDisabledReason?: string;
}) {
  const [showContinueAnyway, setShowContinueAnyway] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebrationReady, setCelebrationReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== 'celebration') {
      return undefined;
    }
    const t = setTimeout(() => setCelebrationReady(true), 1500);
    return () => {
      clearTimeout(t);
      setCelebrationReady(false);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'action' || phase === 'connecting') {
      timerRef.current = setTimeout(() => {
        setShowContinueAnyway(true);
      }, continueAfterMs);

      hintTimerRef.current = setTimeout(() => {
        setShowHint(true);
      }, 15000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [phase, continueAfterMs]);

  const buttonConfig = PHASE_BUTTONS[phase];
  const showChecklist = isActionPhase && requirements && nodes && edges;
  const displayContent = explainContent ?? content;
  const showExplainButton = isExplainPhase(phase) && onExplainDifferent;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{displayContent.heading}</h3>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{displayContent.body}</div>
      </div>

      {showExplainButton && (
        <button
          type="button"
          onClick={onExplainDifferent}
          disabled={explainLoading || explainDisabled}
          title={explainDisabled ? explainDisabledReason : undefined}
          className="self-start inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {explainLoading ? 'Rewriting…' : 'Explain differently'}
        </button>
      )}

      {phase === 'teaching' && displayContent.whyItMatters && (
        <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-sm">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
            Without this
          </p>
          <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
            {displayContent.whyItMatters}
          </p>
        </div>
      )}

      {phase === 'teaching' && displayContent.tradeoff && (
        <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            Tradeoff
          </p>
          <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
            {displayContent.tradeoff}
          </p>
        </div>
      )}

      {showChecklist && requirements && nodes && edges && (
        <RequirementChecklist
          requirements={requirements}
          nodes={nodes}
          edges={edges}
        />
      )}

      {showHint && !allRequirementsMet && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-400">Hint: </span>
          <span className="text-amber-600 dark:text-amber-300">
            {phase === 'connecting'
              ? 'Click and drag from the source node (grey ring) to the target node (green ring) to draw an edge.'
              : 'Press ⌘K to open component search, type the name, and press Enter to add.'}
          </span>
        </div>
      )}

      {validationError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
          <span className="font-medium text-red-700 dark:text-red-400">Not ready:</span>{' '}
          <span className="text-red-600 dark:text-red-300">{validationError}</span>
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={phase === 'celebration' && !celebrationReady}
        className={`self-end px-4 py-2 rounded-lg font-medium transition-colors ${
          phase === 'celebration' && !celebrationReady
            ? 'opacity-60 cursor-not-allowed bg-primary text-primary-foreground'
            : allRequirementsMet && isActionPhase
              ? 'bg-green-600 text-white hover:bg-green-700 animate-pulse'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {phase === 'celebration' && !celebrationReady ? '✓ Nice work!' : (allRequirementsMet && isActionPhase ? '✓ Continue' : buttonConfig.label)}
      </button>

      {showContinueAnyway && showHint && (
        <button
          onClick={() => {
            if (tutorialId && stepId) {
              analytics.track({
                event_type: 'tutorial_step_skipped',
                page_path: typeof window !== 'undefined' ? window.location.pathname : '/tutorials',
                payload: { tutorial_id: tutorialId, step_id: stepId },
              });
            }
            onContinue();
          }}
          className="self-end text-sm text-muted-foreground hover:text-foreground underline"
        >
          Continue anyway
        </button>
      )}
    </div>
  );
}

// ── Guide Panel ──────────────────────────────────────────────────────────────
export function GuidePanel() {
  const { session, advancePhase, advanceManually, isLoading, activeTutorial, exitTutorial, nodes, edges, setHighlight, setNodes, setEdges, tutorialLayoutEnabled, getProgress, recordExplainUsage } = useTutorialStore();
  const { user } = useAuthStore();
  const { currentStep, currentPhase, progress, isComplete } = useTutorialHelpers();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const prevStepIdRef = useRef<string | null>(null);
  const tutorialLayoutRequestRef = useRef(0);

  // Extract requirements for the current step
  const requirements = useMemo(() => {
    if (!currentStep) return null;
    return getStepRequirements(currentStep);
  }, [currentStep]);

  // Is this an action/connecting phase where canvas interaction is needed?
  const isActionPhase = session?.phase === 'action' || session?.phase === 'connecting';

  // Real-time validation: check on every canvas change during action/connecting phases
  const realtimeValidation = useMemo(() => {
    if (!isActionPhase || !currentStep) return { valid: true, message: '' };
    return validateStep(currentStep, nodes, edges);
  }, [isActionPhase, currentStep, nodes, edges]);

  // Are all requirements met?
  const allRequirementsMet = isActionPhase && realtimeValidation.valid;

  // ── Node Highlighting ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActionPhase || !requirements) {
      setHighlight(null, null);
      return;
    }

    // Find the first unmet node requirement to highlight
    const unmetNodeTypes = requirements.requiredNodeTypes.filter(
      (nt) => !isNodeTypeMet(nt, nodes)
    );

    // Find the first unmet edge requirement's source/target
    const unmetEdges = requirements.requiredEdges.filter(
      er => !isEdgeMet(er.source, er.target, nodes, edges)
    );

    if (unmetNodeTypes.length > 0) {
      // Highlight nodes that should connect TO the unmet node
      const parentLabels: string[] = [];
      for (const er of unmetEdges) {
        if (!isNodeTypeMet(er.target, nodes) && isNodeTypeMet(er.source, nodes)) {
          parentLabels.push(er.sourceLabel);
        }
      }
      setHighlight(
        parentLabels[0] ?? null,
        unmetNodeTypes[0]?.replace(/_/g, ' ') ?? null
      );
    } else if (unmetEdges.length > 0) {
      // All nodes exist but edges are missing
      setHighlight(unmetEdges[0].sourceLabel, unmetEdges[0].targetLabel);
    } else {
      setHighlight(null, null);
    }

    return () => {
      setHighlight(null, null);
    };
  }, [isActionPhase, requirements, nodes, edges, setHighlight]);

  // Clear validation error when step changes (render-time check, not effect)
  if (currentStep?.id !== prevStepIdRef.current) {
    prevStepIdRef.current = currentStep?.id ?? null;
    if (validationError !== null) {
      setValidationError(null);
    }
  }

  const tutorialProgress = activeTutorial ? getProgress(activeTutorial.id) : null;
  const isAuthenticated = Boolean(user && user.id !== 'guest');

  const componentLabel = useMemo(() => {
    if (!currentStep) return 'this component';
    return currentStep.title.replace(/^Add (the )?/i, '') || 'this component';
  }, [currentStep]);

  const explainQuota = useMemo(() => {
    if (!activeTutorial || !currentStep) {
      return { allowed: false, reason: undefined };
    }
    return canRequestExplain({
      isAuthenticated,
      stepExplainCounts: tutorialProgress?.stepExplainCounts,
      stepId: currentStep.id,
    });
  }, [activeTutorial, currentStep, isAuthenticated, tutorialProgress]);

  const explainContent = useMemo(() => {
    if (!currentPhase || !currentStep || !session || !isExplainPhase(session.phase)) {
      return currentPhase ?? undefined;
    }
    const override = tutorialProgress?.explainOverrides?.[
      explainOverrideKey(currentStep.id, session.phase)
    ];
    if (!override) return currentPhase;
    return { ...currentPhase, heading: override.heading, body: override.body };
  }, [currentPhase, currentStep, session, tutorialProgress]);

  const handleExplainDifferent = useCallback(async () => {
    if (!activeTutorial || !currentStep || !session || !currentPhase || !isExplainPhase(session.phase)) {
      return;
    }
    if (!explainQuota.allowed) {
      toast.error(explainQuota.reason ?? 'Explain limit reached');
      return;
    }

    setExplainLoading(true);
    try {
      const variantIndex = nextExplainVariantIndex(tutorialProgress?.stepExplainCounts, currentStep.id);
      const res = await fetch('/api/tutorials/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorialId: activeTutorial.id,
          stepId: currentStep.id,
          phase: session.phase,
          component: componentLabel,
          heading: currentPhase.heading,
          body: currentPhase.body,
          variantIndex,
          stepExplainCount: tutorialProgress?.stepExplainCounts?.[currentStep.id] ?? 0,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Could not rewrite explanation');
        return;
      }

      recordExplainUsage(activeTutorial.id, currentStep.id, session.phase, {
        heading: data.heading ?? currentPhase.heading,
        body: data.body ?? currentPhase.body,
      });

      analytics.track({
        event_type: 'tutorial_explain_requested',
        page_path: typeof window !== 'undefined' ? window.location.pathname : '/tutorials',
        payload: {
          tutorial_id: activeTutorial.id,
          step_id: currentStep.id,
          phase: session.phase,
          cached: Boolean(data.cached),
        },
      });
    } catch {
      toast.error('Could not reach the explain service');
    } finally {
      setExplainLoading(false);
    }
  }, [
    activeTutorial,
    currentStep,
    session,
    currentPhase,
    explainQuota,
    tutorialProgress,
    componentLabel,
    recordExplainUsage,
  ]);

  const handleContinue = useCallback(() => {
    setValidationError(null);

    if (session?.phase === 'action' || session?.phase === 'connecting') {
      if (currentStep) {
        const result = validateStep(currentStep, nodes, edges);
        if (!result.valid) {
          setValidationError(result.message);
          return;
        }
      }
      // Auto-layout once the step is satisfied, then advance. Fire-and-forget:
      // manual drags are preserved until this point, and the Mermaid round-trip
      // keeps the growing diagram readable across steps. A latest-request guard
      // stops a slow stale relayout from clobbering newer canvas edits.
      if (tutorialLayoutEnabled && nodes.length > 1) {
        const requestId = ++tutorialLayoutRequestRef.current;
        layoutDiagramViaMermaid(nodes, edges, 'LR')
          .then((res) => {
            if (res.success && requestId === tutorialLayoutRequestRef.current) {
              setNodes(res.nodes);
              setEdges(res.edges);
              window.setTimeout(() => {
                (window as Window & { __tutorialFitView?: () => void }).__tutorialFitView?.();
              }, 50);
            }
          })
          .catch(() => {});
      }
      advanceManually();
    } else {
      advancePhase();
    }
  }, [session, advancePhase, advanceManually, currentStep, nodes, edges, setNodes, setEdges, tutorialLayoutEnabled]);

  if (isLoading || !activeTutorial || !session) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading tutorial...</div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Tutorial Complete!</h2>
        <p className="text-muted-foreground mb-4">
          You&apos;ve completed {activeTutorial.title}
        </p>
        <button
          onClick={exitTutorial}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Finish
        </button>
      </div>
    );
  }

  if (!currentStep || !currentPhase) {
    return (
      <div className="p-4">
        <div className="text-muted-foreground">No active step</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold">{activeTutorial.title}</h2>
        <div className="text-sm text-muted-foreground mt-1">
          {progress.levelLabel} · Step {session.stepIndex + 1}
        </div>
        <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {session.phase}
          </span>
        </div>

        <PhaseRenderer
          key={`${session.stepIndex}-${session.phase}`}
          phase={session.phase}
          content={currentPhase}
          explainContent={explainContent}
          onExplainDifferent={isAuthenticated ? handleExplainDifferent : undefined}
          explainLoading={explainLoading}
          explainDisabled={!explainQuota.allowed}
          explainDisabledReason={explainQuota.reason}
          onContinue={handleContinue}
          continueAfterMs={currentStep.continueAfterMs ?? 45000}
          validationError={validationError}
          allRequirementsMet={allRequirementsMet}
          isActionPhase={isActionPhase}
          requirements={requirements ?? undefined}
          nodes={nodes}
          edges={edges}
          tutorialId={activeTutorial.id}
          stepId={currentStep.id}
          componentLabel={componentLabel}
        />

        {currentStep.hints.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Hints</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {currentStep.hints.map((hint, i) => (
                <li key={i}>· {hint}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
