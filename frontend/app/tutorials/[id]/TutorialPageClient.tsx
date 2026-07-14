'use client';

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, PenSquare, RotateCcw, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { getTutorialById, isLeveledTutorial } from '@/data/tutorials';
import { useTutorialStore, sanitizeNode, sanitizeEdge } from '@/store/tutorialStore';
import { validateStep } from '@/lib/tutorialValidation';
import { GuidePanel } from '@/components/tutorial/GuidePanel';
import { IntroCardFlow } from '@/components/tutorial/IntroCardFlow';
import { CompletionCardFlow } from '@/components/tutorial/CompletionCardFlow';
import { analytics } from '@/lib/analytics';
import logger from '@/lib/logger';
import type { TutorialData } from '@/data/tutorials';
import type { Tutorial, TutorialLevel, TutorialStep } from '@/lib/tutorial/types';
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
  nodeCount,
  edgeCount,
  onContinue,
  onSave,
}: {
  level: TutorialLevel;
  nextLevel: TutorialLevel;
  nodeCount: number;
  edgeCount: number;
  onContinue: () => void;
  onSave: () => void;
}) {
  const levelNum = level.level ?? level.order ?? 1;
  const nextLevelNum = nextLevel.level ?? nextLevel.order ?? (levelNum + 1);
  
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
          <p className="text-sm text-slate-600">{nextLevel.description}</p>
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

  const {
    currentStep, totalSteps, nodes, edges,
    isComplete, isLevelComplete,
    currentLevel,
    startTutorialFresh, setValidationStatus,
    addMessage, advanceStep, skipStep,
    completeTutorial, advanceLevel, dismissLevelComplete,
    activeTutorialId,
    saveProgress,
    setSwitchingTutorial,
  } = useTutorialStore();

  const hasStarted = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { 
    mountedRef.current = true;
    return () => { mountedRef.current = false; }; 
  }, []);

  const [headerRestartConfirm, setHeaderRestartConfirm] = useState(false);
  const headerRestartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelRatio, setPanelRatio] = useState<'3:7' | '4:6'>('3:7');
  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>('light');
  const [showIntro, setShowIntro] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);

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
    saveProgress(fromId, {
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
    isLeveled && tutorial && 'levels' in tutorial ? (tutorial as Tutorial).levels ?? [] : [],
    [isLeveled, tutorial]
  );
  
  // Handle both old flat format (tutorial.steps) and new factory format (tutorial.levels[].steps)
  // Also handle case where tutorial has levels but wasn't detected as leveled yet
  const hasLevelsArray = useMemo(() => 
    tutorial && 'levels' in tutorial && (tutorial as Tutorial).levels?.length > 0,
    [tutorial]
  );
  
  const allSteps: TutorialStep[] = useMemo(() => {
    if (!tutorial) return [];
    if (isLeveled || hasLevelsArray) {
      return (tutorial as Tutorial).levels?.flatMap((l) => l.steps) ?? [];
    }
    return (tutorial as TutorialData).steps ?? [];
  }, [tutorial, isLeveled, hasLevelsArray]);

  const currentLevelData = useMemo(() => 
    levels[currentLevel - 1] ?? null,
    [levels, currentLevel]
  );

  const currentLevelSteps = useMemo(() => 
    currentLevelData?.steps ?? allSteps,
    [currentLevelData, allSteps]
  );

  // FIX: Start tutorial - always from DB first to avoid stale cache
  useEffect(() => {
    if (!tutorial || hasStarted.current) return;
    hasStarted.current = true;

    const start = async () => {
      // Show intro immediately while we fetch
      setShowIntro(true);
      
      // Always start fresh from DB - this ensures no stale data
      const result = await startTutorialFresh(tutorial);
      
      if (!result.success) {
        logger.error('[tutorial] Failed to start fresh:', result.error);
        toast.error('Failed to load tutorial progress');
        return;
      }
      
      // Successfully started fresh - skip intro since we reset to step 1
      setIntroSkipped(true);

      analytics.track({
        event_type: 'tutorial_started',
        page_path: window.location.pathname,
        payload: { tutorial_id: tutorial.id, tutorial_title: tutorial.title },
      });
    };

    start();
  }, [tutorial, startTutorialFresh]);

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

  // FIX: Start building - always from DB fresh to ensure atomic reset
  const handleStartFromIntro = useCallback(async () => {
    if (!tutorial) return;
    
    setShowIntro(false);
    
    // Start fresh from DB - this does the atomic reset sequence
    const result = await startTutorialFresh(tutorial);
    
    if (!result.success) {
      toast.error('Failed to start tutorial: ' + result.error);
      return;
    }
    
    setIntroSkipped(true);
  }, [tutorial, startTutorialFresh]);

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
    allSteps.filter((s) => s.requiredNodes && s.requiredNodes.length > 0).length,
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

  const step = currentLevelSteps[currentStep - 1];
  const nextLevelData = isLeveled ? (levels[currentLevel] ?? null) : null;
  const stepLabel = step 
    ? (isLeveled && currentLevelData
      ? `Level ${currentLevel} · Step ${currentStep}/${totalSteps || '?'}`
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
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
              <div className="h-full bg-gray-500 rounded-full transition-all duration-500" style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }} />
            </div>
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
          />
        </div>

        {/* Level complete overlay */}
        {isLevelComplete && isLeveled && currentLevelData && nextLevelData && (
          <LevelCompleteScreen
            level={currentLevelData}
            nextLevel={nextLevelData}
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
          levelDescription={currentLevelData?.description}
          stepCount={totalSteps}
          estimatedTime={'estimatedMinutes' in tutorial ? String(tutorial.estimatedMinutes) + ' mins' : String((tutorial as TutorialData).estimatedTime)}
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
  'netflix-architecture': [
    'Why edge caching can reduce origin traffic to near zero',
    'How recommendation ML models rank content for personalized homescreens',
    'Why stateless services enable horizontal scaling without coordination',
  ],
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
  'url-shortener-architecture': [
    'Why consistent hashing keeps redirect caches hot',
    'How write batching prevents database saturation',
    'Why semantic caching saves 30-60% of compute on common queries',
  ],
  'rag-application-architecture': [
    'Why chunking strategy determines 80% of RAG quality',
    'How vector similarity enables semantic search across different wording',
    'Why semantic caching dramatically reduces LLM API costs',
  ],
  'ai-agent-system-architecture': [
    'How multi-agent orchestration decomposes complex goals into sub-tasks',
    'Why token budgets at the gateway prevent runaway agent loops',
    'How agent memory enables context-aware, persistent behavior',
  ],
};

const NEXT_TUTORIALS_MAP: Record<string, { id: string; title: string; reason: string }> = {
  'url-shortener-architecture': { id: 'chatgpt-architecture', title: 'ChatGPT Architecture', reason: 'Understand the LLM foundation that powers AI systems' },
  'chatgpt-architecture': { id: 'instagram-architecture', title: 'Instagram Architecture', reason: 'Explore how social platforms handle massive write volumes' },
  'instagram-architecture': { id: 'netflix-architecture', title: 'Netflix Architecture', reason: 'See how streaming platforms optimize for read-heavy workloads' },
  'netflix-architecture': { id: 'uber-architecture', title: 'Uber Architecture', reason: 'Learn how real-time and geospatial systems work at scale' },
  'uber-architecture': { id: 'whatsapp-architecture', title: 'WhatsApp Architecture', reason: 'Understand how messaging systems achieve billion-user scale' },
  'whatsapp-architecture': { id: 'stripe-architecture', title: 'Stripe Architecture', reason: 'Build financial systems with ACID guarantees and idempotency' },
  'stripe-architecture': { id: 'url-shortener-architecture', title: 'URL Shortener', reason: 'Practice the classic interview question with hashing and caching' },
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
