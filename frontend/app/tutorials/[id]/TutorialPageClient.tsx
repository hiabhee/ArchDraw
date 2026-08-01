'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, PenSquare, RotateCcw, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { getTutorialById, isLeveledTutorial } from '@/data/tutorials';
import { useAuthStore } from '@/store/authStore';
import { useTutorialStore, sanitizeNode, sanitizeEdge } from '@/store/tutorialStore';
import { GuidePanel } from '@/components/tutorial/GuidePanel';
import { IntroCardFlow } from '@/components/tutorial/IntroCardFlow';
import { CompletionCardFlow } from '@/components/tutorial/CompletionCardFlow';
import { NodeDetailsPanel, NodeDetailsPanelEmpty } from '@/components/tutorial/NodeDetailsPanel';
import type { NodeDetailsInfo } from '@/components/tutorial/TutorialCanvas';
import { analytics } from '@/lib/analytics';
import logger from '@/lib/logger';
import type { TutorialLevel, TutorialStep } from '@/lib/tutorial/schema';
import type { Node, Edge } from 'reactflow';

// Dynamic import to avoid SSR issues with ReactFlow
const TutorialCanvas = dynamic(
  () => import('@/components/tutorial/TutorialCanvas').then((m) => ({ default: m.TutorialCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center" style={{ background: '#F4F4F4' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-gray-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-600">Loading canvas…</span>
        </div>
      </div>
    ),
  }
);


// ── Level Complete Screen ────────────────────────────────────────────────────
function LevelCompleteScreen({
  level,
  nextLevel,
  levelNum,
  nextLevelNum,
  nodeCount,
  edgeCount,
  onContinue,
  onSave,
}: {
  level: TutorialLevel;
  nextLevel: TutorialLevel;
  levelNum: number;
  nextLevelNum: number;
  nodeCount: number;
  edgeCount: number;
  onContinue: () => void;
  onSave: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl p-6 flex flex-col gap-5" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.1)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(89,89,89,0.1)', color: '#595959', border: '1px solid rgba(99,102,241,0.2)' }}>
            Level {levelNum} Complete
          </span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A] leading-snug">
            You built the {level.title.toLowerCase()} of this architecture.
          </h2>
          <p className="text-sm text-slate-500 mt-1">{nodeCount} components · {edgeCount} connections</p>
        </div>
        <div style={{ height: 1, background: 'rgba(0,0,0,0.1)' }} />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Ready for Level {nextLevelNum}?</p>
          <p className="text-sm text-slate-600">{nextLevel.title}</p>
          <p className="text-xs text-slate-400 mt-2">You&apos;ll add {nextLevel.steps.length} more components on top of what you built.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
style={{ background: '#595959' }}
             onMouseEnter={e => (e.currentTarget.style.background = '#434343')}
             onMouseLeave={e => (e.currentTarget.style.background = '#595959')}
          >
            Continue to Level {nextLevelNum} →
          </button>
          <button
            onClick={onSave}
            className="w-full py-2.5 rounded-xl text-sm text-slate-600 hover:text-[#1A1A1A] transition-colors"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)' }}
          >
            Save &amp; come back later
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TutorialPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const tutorial = getTutorialById(id);
  const isLeveled = tutorial ? isLeveledTutorial(tutorial.id) : false;
  const { user } = useAuthStore();

  const {
    currentStep, totalSteps, nodes, edges,
    isComplete, isLevelComplete,
    currentLevel,
    startTutorialFresh, startTutorialByDef, getProgress, setValidationStatus,
    skipStep,
    advanceLevel, dismissLevelComplete,
    activeTutorialId,
    saveProgress,
    setSwitchingTutorial,
    loadFromDb, syncToDb,
    hasHydrated,
  } = useTutorialStore();

  const hasStarted = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { 
    mountedRef.current = true;
    return () => { mountedRef.current = false; }; 
  }, []);

  const [headerRestartConfirm, setHeaderRestartConfirm] = useState(false);
  const headerRestartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelRatio] = useState<'3:7' | '4:6'>('3:7');
  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>('light');
  const [showIntro, setShowIntro] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeDetailsInfo | null>(null);

  const handleNodeSelect = useCallback((info: NodeDetailsInfo | null) => {
    setSelectedNode(info);
  }, []);

  // If navigating to a different tutorial, save the current canvas and switch.
  // Uses refs to capture nodes/edges at the moment the effect fires —
  // prevents stale closures after startTutorial clears them.
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);

  useEffect(() => {
    if (!tutorial) return;
    if (!activeTutorialId || activeTutorialId === tutorial.id) {
      useTutorialStore.setState({ activeTutorialId: tutorial.id });
      return;
    }

    const fromId = activeTutorialId;
    const fromNodes = prevNodesRef.current;
    const fromEdges = prevEdgesRef.current;

    setSwitchingTutorial(true);
    const fromSession = useTutorialStore.getState().session;
    saveProgress(fromId, {
      currentLevel: fromSession ? fromSession.levelIndex + 1 : useTutorialStore.getState().currentLevel,
      currentStep: fromSession ? fromSession.stepIndex + 1 : useTutorialStore.getState().currentStep,
      currentPhase: fromSession?.phase,
      completedLevels: fromSession?.completedLevelIds.map(Number) ?? useTutorialStore.getState().completedLevels,
      completedStepIds: fromSession?.completedStepIds ?? [],
      canvasNodes: fromNodes.map(sanitizeNode),
      canvasEdges: fromEdges.map(sanitizeEdge),
    });
    useTutorialStore.setState({ activeTutorialId: tutorial.id });
    setTimeout(() => setSwitchingTutorial(false), 50);
  }, [tutorial, activeTutorialId, saveProgress, setSwitchingTutorial]);

  // Keep refs in sync with current canvas state at render time
  useEffect(() => {
    prevNodesRef.current = nodes;
    prevEdgesRef.current = edges;
  });

  const levels: TutorialLevel[] = useMemo(() => 
    isLeveled && tutorial && 'levels' in tutorial ? tutorial.levels ?? [] : [],
    [isLeveled, tutorial]
  );
  
  // All tutorials now use the leveled format (TutorialDefinition)
  const allSteps: TutorialStep[] = useMemo(() => {
    if (!tutorial) return [];
    return tutorial.levels?.flatMap((l) => l.steps) ?? [];
  }, [tutorial]);

  const currentLevelData = useMemo(() => 
    levels[currentLevel - 1] ?? null,
    [levels, currentLevel]
  );

  const currentLevelSteps = useMemo(() => 
    currentLevelData?.steps ?? allSteps,
    [currentLevelData, allSteps]
  );

  // FIX: Start tutorial — restore from saved progress if available, otherwise start fresh
  useEffect(() => {
    if (!tutorial || !hasHydrated || hasStarted.current) return;
    hasStarted.current = true;

    const start = async () => {
      // Check for saved progress — local store first (already rehydrated), then DB for cross-device
      let saved = getProgress(tutorial.id);
      const hasLocalSaved = saved && (
        (saved.canvasNodes && saved.canvasNodes.length > 0) ||
        (saved.currentLevel > 0) ||
        (saved.currentStep > 0)
      );

      // If no local progress, try loading from DB (cross-device)
      if (!hasLocalSaved) {
        const dbProgress = await loadFromDb(tutorial.id);
        if (dbProgress) {
          saved = dbProgress;
        }
      }

      const hasSavedProgress = saved && (
        (saved.canvasNodes && saved.canvasNodes.length > 0) ||
        (saved.currentLevel > 0) ||
        (saved.currentStep > 0)
      );

      if (hasSavedProgress) {
        // Restore from saved progress — preserves both session position AND canvas diagram
        startTutorialByDef(tutorial);
        setIntroSkipped(true);
        toast.success('Welcome back! Your progress has been restored.', {
          duration: 3000,
          position: 'bottom-center',
        });
      } else {
        // No saved progress — start fresh and show intro card
        const result = await startTutorialFresh(tutorial);
        if (!result.success) {
          logger.error('[tutorial] Failed to start fresh:', result.error);
          toast.error('Failed to load tutorial progress');
          return;
        }
        setShowIntro(true);
        setIntroSkipped(false);
      }

      analytics.track({
        event_type: 'tutorial_started',
        page_path: window.location.pathname,
        payload: { tutorial_id: tutorial.id, tutorial_title: tutorial.title, restored: !!hasSavedProgress },
      });
    };

    start();
  }, [tutorial, hasHydrated, startTutorialFresh, startTutorialByDef, getProgress, loadFromDb]);

  // Periodic autosave to DB
  useEffect(() => {
    if (!tutorial || !activeTutorialId) return;
    const interval = setInterval(() => {
      syncToDb(activeTutorialId).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [tutorial, activeTutorialId, syncToDb]);

  // Save on step/level change
  useEffect(() => {
    if (!tutorial || !activeTutorialId) return;
    syncToDb(activeTutorialId).catch(() => {});
  }, [currentStep, currentLevel, tutorial, activeTutorialId, syncToDb]);

  const handleSkip = useCallback(() => {
    setValidationStatus('idle');
    skipStep();
  }, [setValidationStatus, skipStep]);

  // FIX: Retry - use fresh start to ensure DB is source of truth
  const handleRetry = useCallback(async () => {
    if (!tutorial) return;
    const result = await startTutorialFresh(tutorial);
    if (!result.success) {
      toast.error('Failed to reset: ' + result.error);
      return;
    }
    hasStarted.current = false;
  }, [tutorial, startTutorialFresh]);

  // FIX: Restart - use fresh start to ensure atomic reset
  const handleRestart = useCallback(async () => {
    if (!tutorial) return;
    const result = await startTutorialFresh(tutorial);
    if (!result.success) {
      toast.error('Failed to restart: ' + result.error);
      return;
    }
    hasStarted.current = false;
    setHeaderRestartConfirm(false);
    if (headerRestartTimer.current) clearTimeout(headerRestartTimer.current);

    toast.success('Tutorial restarted');

    analytics.track({
      event_type: 'tutorial_restarted',
      page_path: window.location.pathname,
      payload: { tutorial_id: tutorial.id, tutorial_title: tutorial.title },
    });
  }, [tutorial, startTutorialFresh]);

  const showHeaderConfirm = useCallback(() => {
    setHeaderRestartConfirm(true);
    if (headerRestartTimer.current) clearTimeout(headerRestartTimer.current);
    headerRestartTimer.current = setTimeout(() => setHeaderRestartConfirm(false), 3000);
  }, []);

  const handleGoToCanvas = useCallback(() => { router.push('/editor'); }, [router]);

  const handleContinueToNextLevel = useCallback(() => {
    if (!tutorial || !levels.length) return;
    const nextLevelData = levels[currentLevel]; // currentLevel is 1-indexed, levels is 0-indexed
    if (!nextLevelData) return;

    analytics.track({
      event_type: 'tutorial_level_completed',
      page_path: window.location.pathname,
      payload: { tutorial_id: tutorial.id, level: currentLevel, next_level: currentLevel + 1, node_count: nodes.length, edge_count: edges.length },
    });

    advanceLevel(nextLevelData.steps.length);
  }, [levels, currentLevel, advanceLevel, tutorial, nodes.length, edges.length]);

  const handleSaveAndLeave = useCallback(() => {
    dismissLevelComplete();
    router.push('/tutorials');
  }, [dismissLevelComplete, router]);

  // Start building from the intro card. The session is already initialized by
  // the bootstrap effect; this only dismisses the overlay. If progress somehow
  // exists (e.g. restored from another tab), resume from that instead of wiping.
  const handleStartFromIntro = useCallback(async () => {
    if (!tutorial) return;

    const saved = getProgress(tutorial.id);
    const hasSavedProgress = saved && (
      (saved.canvasNodes && saved.canvasNodes.length > 0) ||
      (saved.currentLevel > 0) ||
      (saved.currentStep > 0)
    );

    if (hasSavedProgress) {
      startTutorialByDef(tutorial);
    }

    setShowIntro(false);
    setIntroSkipped(true);
  }, [tutorial, getProgress, startTutorialByDef]);

  const handleIntroSkip = useCallback(() => {
    setShowIntro(false);
    setIntroSkipped(true);
  }, []);

  // Track tutorial completion
  useEffect(() => {
    if (isComplete && tutorial) {
      analytics.track({
        event_type: 'tutorial_completed',
        page_path: window.location.pathname,
        payload: { tutorial_id: tutorial.id, tutorial_title: tutorial.title, total_steps: totalSteps },
      });
    }
  }, [isComplete, tutorial, totalSteps]);

  // Calculate component count for intro
  const componentCount = useMemo(() => 
    allSteps.filter((s) => {
      const nodeRules = s.validation.filter((r) => r.type === 'node_exists' || r.type === 'node_count');
      return nodeRules.length > 0;
    }).length,
    [allSteps]
  );

  if (!tutorial) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F4F4', color: '#1A1A1A' }}>
        <div className="text-center">
          <p className="text-slate-500 mb-4">Tutorial not found.</p>
          <Link href="/tutorials" className="text-gray-500 hover:text-gray-600 text-sm">← Back to tutorials</Link>
        </div>
      </div>
    );
  }

  if (!user || user.id === 'guest') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F4F4', color: '#1A1A1A' }}>
        <div className="text-center max-w-sm">
          <p className="text-slate-500 mb-2">Sign in to access tutorials</p>
          <p className="text-xs text-slate-400 mb-4">Tutorial progress tracking is only available for authenticated users.</p>
          <Link href="/login" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: '#595959' }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const step = currentLevelSteps[currentStep - 1];
  const nextLevelData = isLeveled ? (levels[currentLevel] ?? null) : null;

  // Level-local step count
  const stepsInLevel = currentLevelData?.steps.length ?? totalSteps;
  const stepInLevel = isLeveled
    ? currentStep - levels.slice(0, currentLevel - 1).reduce((acc, l) => acc + l.steps.length, 0)
    : currentStep;

  const stepLabel = step 
    ? (isLeveled && currentLevelData
      ? `Level ${currentLevel}/${levels.length} · Step ${stepInLevel}/${stepsInLevel}`
      : `Step ${currentStep} of ${totalSteps || '?'}`)
    : 'Loading...';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#F4F4F4' }}>
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 shrink-0 z-20" style={{ background: 'white', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Link href="/tutorials" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1A1A1A] transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Tutorials</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#1A1A1A] hidden md:block">{tutorial.title}</span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(89,89,89,0.1)', color: '#595959', border: '1px solid rgba(99,102,241,0.2)' }}>
            {stepLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-500">{totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0}%</span>
            {isLeveled ? (
              <div className="flex flex-col gap-0.5">
                {/* Level progress */}
                <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                  <div className="h-full bg-gray-300 rounded-full transition-all duration-500"
                    style={{ width: `${levels.length > 0 ? ((currentLevel - 1) / levels.length) * 100 : 0}%` }} />
                </div>
                {/* Step-in-level progress */}
                <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                  <div className="h-full bg-gray-500 rounded-full transition-all duration-500"
                    style={{ width: `${stepsInLevel > 0 ? (stepInLevel / stepsInLevel) * 100 : 0}%` }} />
                </div>
              </div>
            ) : (
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
                <div className="h-full bg-gray-500 rounded-full transition-all duration-500" style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }} />
              </div>
            )}
          </div>
          <button
            onClick={() => setCanvasTheme((t) => t === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-[#1A1A1A] transition-colors flex-shrink-0"
            style={{ border: '1px solid rgba(0,0,0,0.1)' }}
            title={canvasTheme === 'dark' ? 'Switch to light canvas' : 'Switch to dark canvas'}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}
          >
            {canvasTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          {headerRestartConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Are you sure?</span>
              <button onClick={handleRestart} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors" style={{ background: '#ef4444' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f87171')} onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}>Yes, restart</button>
              <button onClick={() => { setHeaderRestartConfirm(false); if (headerRestartTimer.current) clearTimeout(headerRestartTimer.current); }} className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-[#1A1A1A] transition-colors" style={{ background: 'rgba(0,0,0,0.04)' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={showHeaderConfirm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-[#1A1A1A] text-xs font-medium transition-colors flex-shrink-0" style={{ border: '1px solid rgba(0,0,0,0.1)' }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}>
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
          )}
          <a href="/editor" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors flex-shrink-0" style={{ background: '#595959' }} onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = '#434343')} onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = '#595959')}>
            <PenSquare className="w-3.5 h-3.5" />
            Create your own
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="shrink-0 overflow-hidden flex flex-col h-full transition-all duration-300" style={{ width: panelRatio === '3:7' ? '30%' : '40%' }}>
          <GuidePanel />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <TutorialCanvas
            theme={canvasTheme}
            tutorialId={tutorial.id}
            tutorialTitle={tutorial.title}
            currentStep={currentStep}
            totalSteps={totalSteps}
            currentLevel={isLeveled ? currentLevel : undefined}
            totalLevels={isLeveled ? levels.length : undefined}
            onRestart={showHeaderConfirm}
            onSkip={handleSkip}
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* Right sidebar — node deep-dive (always visible, but empty when no selection) */}
        {selectedNode ? (
          <NodeDetailsPanel
            info={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        ) : (
          <NodeDetailsPanelEmpty />
        )}

        {/* Level complete overlay */}
        {isLevelComplete && isLeveled && currentLevelData && nextLevelData && (
          <LevelCompleteScreen
            level={currentLevelData}
            nextLevel={nextLevelData}
            levelNum={currentLevel}
            nextLevelNum={currentLevel + 1}
            nodeCount={nodes.length}
            edgeCount={edges.length}
            onContinue={handleContinueToNextLevel}
            onSave={handleSaveAndLeave}
          />
        )}
      </div>

      {isComplete && (
        <CompletionCardFlow
          tutorialTitle={tutorial.title}
          tutorialColor={tutorial.color}
          learnedItems={getLearnedItems(tutorial.id)}
          nextTutorialTitle={getNextTutorial(tutorial.id)?.title}
          nextTutorialReason={getNextTutorial(tutorial.id)?.reason}
          onRetry={handleRetry}
          onNext={() => {
            const next = getNextTutorial(tutorial.id);
            if (next) router.push(`/tutorials/${next.id}`);
          }}
          onGoToCanvas={handleGoToCanvas}
        />
      )}

      {showIntro && !introSkipped && (
        <IntroCardFlow
          tutorialTitle={tutorial.title}
          tutorialDescription={tutorial.description}
          levelTitle={currentLevelData?.title}
          levelDescription={currentLevelData?.description || tutorial.description}
          stepCount={totalSteps}
          estimatedTime={String(tutorial.estimatedMinutes) + ' mins'}
          componentCount={componentCount}
          onStart={handleStartFromIntro}
          onSkip={handleIntroSkip}
          tutorialColor={tutorial.color}
        />
      )}
    </div>
  );
}

// Learning items data
const LEARNED_ITEMS: Record<string, string[]> = {
  'chatgpt-architecture': [
    'How LLMs connect to real-time data via RAG pipelines',
    'Why vector databases enable semantic search over private data',
    'How load balancers make AI systems production-ready',
  ],
  'instagram-architecture': [
    'How CDNs serve media at global scale with 95%+ cache hit rates',
    'Why Kafka decouples microservices for independent scaling',
    'How feed pre-computation enables instant timeline loads',
  ],
  'netflix-architecture': [
    'Why edge caching can reduce origin traffic to near zero',
    'How recommendation ML models rank content for personalized homescreens',
    'Why stateless services enable horizontal scaling without coordination',
  ],
  'uber-architecture': [
    'How geospatial indexes enable real-time driver-passenger matching',
    'Why microservice orchestration handles complex trip workflows',
    'How real-time pricing balances supply and demand instantly',
  ],
  'whatsapp-architecture': [
    'Why end-to-end encryption means servers never see plaintext messages',
    'How store-and-forward enables 30-day message delivery guarantees',
    'Why presence detection needs its own dedicated service at billion-user scale',
  ],
  'stripe-architecture': [
    'How idempotency keys prevent double charges in distributed systems',
    'Why double-entry bookkeeping creates an immutable, auditable ledger',
    'How webhook retry with exponential backoff guarantees reliable notifications',
  ],
  'discord-architecture': [
    'Why WebSocket gateways maintain persistent connections for real-time messaging',
    'How guild sharding distributes 19M servers across independent service instances',
    'Why voice traffic uses a separate service path from text to minimize latency',
  ],
  'zoom-architecture': [
    'Why WebRTC uses UDP not TCP for video — packet loss beats latency spikes',
    'How SFUs (Selective Forwarding Units) route video without transcoding',
    'Why meeting state management needs its own service separate from media routing',
  ],
  'twitter-architecture': [
    'How fan-out on write pre-computes timelines for fast feed reads',
    'Why celebrity accounts use fan-out on read to avoid write amplification',
    'How distributed counters handle millions of like increments per second',
  ],
  'youtube-architecture': [
    'How adaptive bitrate streaming chooses quality based on network conditions',
    'Why video transcoding is the most compute-intensive step in upload pipelines',
    'How CDN prefetching dramatically reduces first-frame latency',
  ],
  'spotify-architecture': [
    'How audio CDNs cache encrypted segments close to listeners globally',
    'Why collaborative playlists need operational transforms for conflict resolution',
    'How recommendation systems use implicit signals (skip, replay) over explicit ratings',
  ],
  'airbnb-architecture': [
    'Why two-sided marketplace search needs separate availability and pricing indexes',
    'How payment escrow protects both parties in a peer-to-peer transaction',
    'Why search ranking combines real-time signals with pre-computed host quality scores',
  ],
  'linkedin-architecture': [
    'How degree-of-connection graph traversal works at 950M member scale',
    'Why feed ranking uses a separate scoring service from content delivery',
    'How profile views trigger real-time notifications without polling',
  ],
  'notion-architecture': [
    'How block-based data models enable flexible nested document structures',
    'Why operational transforms (or CRDTs) are needed for real-time collaboration',
    'How permission inheritance works in hierarchical workspace/page structures',
  ],
  'figma-architecture': [
    'How CRDTs allow simultaneous edits without conflicts in real-time design tools',
    'Why vector graphics require specialized serialization different from documents',
    'How multiplayer cursors are broadcast using separate presence channels',
  ],
  'shopify-architecture': [
    'How multi-tenant SaaS isolates merchant data while sharing infrastructure',
    'Why inventory writes need distributed locking to prevent overselling',
    'How webhook fan-out notifies thousands of apps on each order event',
  ],
  'doordash-architecture': [
    'How three-sided marketplaces (customer, merchant, dasher) coordinate in real-time',
    'Why delivery ETA estimation combines historical data with live driver positions',
    'How order state machines handle the complex lifecycle from placement to delivery',
  ],
  'github-architecture': [
    'How Git object storage uses content-addressable hashing for deduplication',
    'Why pull request review workflows require distributed lock coordination',
    'How CI/CD pipelines integrate with repository events through webhook queues',
  ],
  'url-shortener-architecture': [
    'Why consistent hashing keeps redirect caches hot',
    'How write batching prevents database saturation',
    'Why semantic caching saves 30-60% of compute on common queries',
  ],
  'rag-application-architecture': [
    'Why chunking strategy determines 80% of RAG output quality',
    'How vector similarity enables semantic search across differently-worded queries',
    'Why a two-stage retrieval (ANN + reranker) consistently outperforms single-stage',
  ],
  'ai-agent-system-architecture': [
    'How the ReAct loop (Reason + Act) enables autonomous multi-step execution',
    'Why token budgets at the gateway prevent runaway agent cost overruns',
    'How Agent Memory enables context-aware, persistent behavior across sessions',
  ],
};

const NEXT_TUTORIALS_MAP: Record<string, { id: string; title: string; reason: string }> = {
  // Beginner path → Intermediate
  'url-shortener-architecture':   { id: 'rag-application-architecture',    title: 'RAG Application',       reason: 'See how caching principles apply to LLM cost optimization' },
  'rag-application-architecture': { id: 'ai-agent-system-architecture',    title: 'AI Agent System',       reason: 'Extend RAG with autonomous multi-step agents' },
  'ai-agent-system-architecture': { id: 'chatgpt-architecture',            title: 'ChatGPT Architecture',  reason: 'See how production AI systems scale beyond a single agent' },

  // Core platforms
  'chatgpt-architecture':         { id: 'instagram-architecture',          title: 'Instagram Architecture', reason: 'Explore media platforms handling 100M+ uploads daily' },
  'instagram-architecture':       { id: 'youtube-architecture',            title: 'YouTube Architecture',  reason: 'Scale media pipelines to billions of video streams' },
  'youtube-architecture':         { id: 'netflix-architecture',            title: 'Netflix Architecture',  reason: 'See CDN-first design that eliminates 94% of origin traffic' },
  'netflix-architecture':         { id: 'spotify-architecture',            title: 'Spotify Architecture',  reason: 'Explore audio streaming with real-time recommendation' },
  'spotify-architecture':         { id: 'uber-architecture',               title: 'Uber Architecture',     reason: 'Learn real-time geospatial matching at global scale' },

  // Marketplace and commerce
  'uber-architecture':            { id: 'airbnb-architecture',             title: 'Airbnb Architecture',   reason: 'Compare two-sided vs three-sided marketplace tradeoffs' },
  'airbnb-architecture':          { id: 'doordash-architecture',           title: 'DoorDash Architecture', reason: 'See real-time logistics coordination with three parties' },
  'doordash-architecture':        { id: 'shopify-architecture',            title: 'Shopify Architecture',  reason: 'Understand multi-tenant SaaS at commerce scale' },
  'shopify-architecture':         { id: 'stripe-architecture',             title: 'Stripe Architecture',   reason: 'Build ACID-safe financial systems with idempotency' },

  // Communication and collaboration
  'stripe-architecture':          { id: 'whatsapp-architecture',           title: 'WhatsApp Architecture', reason: 'Learn end-to-end encryption and billion-user messaging' },
  'whatsapp-architecture':        { id: 'discord-architecture',            title: 'Discord Architecture',  reason: 'Add real-time voice to your messaging architecture knowledge' },
  'discord-architecture':         { id: 'zoom-architecture',               title: 'Zoom Architecture',     reason: 'Understand WebRTC and SFU video routing at scale' },
  'zoom-architecture':            { id: 'twitter-architecture',            title: 'Twitter Architecture',  reason: 'See how fan-out handles celebrity timelines' },

  // Social and professional
  'twitter-architecture':         { id: 'linkedin-architecture',           title: 'LinkedIn Architecture', reason: 'Explore graph traversal at social network scale' },
  'linkedin-architecture':        { id: 'notion-architecture',             title: 'Notion Architecture',   reason: 'See collaborative document editing with CRDTs' },
  'notion-architecture':          { id: 'figma-architecture',              title: 'Figma Architecture',    reason: 'Understand real-time multiplayer design tools' },

  // Dev tools
  'figma-architecture':           { id: 'github-architecture',             title: 'GitHub Architecture',   reason: 'See how Git object storage and PR workflows scale globally' },
  'github-architecture':          { id: 'url-shortener-architecture',      title: 'URL Shortener',         reason: 'Practice classic interview questions with hashing and caching' },
};

function getLearnedItems(tutorialId: string): string[] {
  return LEARNED_ITEMS[tutorialId] ?? [
    'How this architecture solves its core scaling challenges',
    'Why each component exists and how they work together',
    'The real architectural decisions behind the system',
  ];
}

function getNextTutorial(tutorialId: string): { id: string; title: string; reason: string } | null {
  return NEXT_TUTORIALS_MAP[tutorialId] ?? null;
}
