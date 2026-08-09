'use client';

import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useDiagramStore } from '@/store/diagramStore';
import { STORAGE_KEYS } from '@/lib/config';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
  cardPosition: 'center' | 'right' | 'below' | 'below-left';
  handAnimation: 'tap' | 'drag' | 'none';
  isInteractive: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ArchDraw',
    description:
      'Describe your architecture in plain English, refine it on the canvas, and export or share with your team. This quick guide covers the essentials in ~1 minute.',
    targetSelector: null,
    cardPosition: 'center',
    handAnimation: 'none',
    isInteractive: false,
  },
  {
    id: 'search',
    title: 'Search 150+ Components',
    description:
      'Type any component name — API Gateway, Redis, Kafka — to filter the library. Components are grouped by category: Network, Compute, Database, Messaging, Storage, AI/ML, and Services.',
    targetSelector: 'aside input[placeholder="Search..."]',
    cardPosition: 'right',
    handAnimation: 'tap',
    isInteractive: false,
  },
  {
    id: 'templates',
    title: 'Start from a Template',
    description:
      "Don't start from scratch. Load a pre-built architecture: ArchFlow's own system design, a ChatGPT-like LLM stack, or an Instagram-like social platform. Auto-layout is applied instantly.",
    targetSelector: '[data-onboarding="templates-btn"]',
    cardPosition: 'below',
    handAnimation: 'tap',
    isInteractive: false,
  },
  {
    id: 'drag',
    title: 'Drag a Component onto the Canvas',
    description:
      'Click and drag any component from the sidebar onto the canvas. Or just click it to add it at the center. Go ahead — drag one now to continue.',
    targetSelector: '[data-onboarding="component-item"]',
    cardPosition: 'right',
    handAnimation: 'drag',
    isInteractive: true,
  },
  {
    id: 'export',
    title: 'Export & Share',
    description:
      'Download your diagram as a PNG (dark, light, or transparent background at 3× resolution). Use the Share button to publish a read-only link — anyone can view it without an account.',
    targetSelector: '[data-onboarding="export-btn"]',
    cardPosition: 'below-left',
    handAnimation: 'tap',
    isInteractive: false,
  },
];

/** Thin hook — just re-exports the store + wires up Step 4 drag detection. */
export function useOnboarding() {
  const store = useOnboardingStore();
  const initialNodeCount = useRef(0);
  const { open: storeOpen, setStepCompleted } = store;

  // Auto-open on first visit
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEYS.guideDismissed);
    if (!dismissed) {
      storeOpen();
    }
  }, [storeOpen]);

  // Step 4 drag detection via Zustand subscribe (v5 subscribe takes one fn)
  useEffect(() => {
    if (store.currentStep !== 3 || !store.isOpen) return;

    // Snapshot node count when we enter this step
    initialNodeCount.current = useDiagramStore.getState().nodes.length;

    const unsub = useDiagramStore.subscribe((state) => {
      if (state.nodes.length > initialNodeCount.current) {
        setStepCompleted(true);
      }
    });
    return unsub;
  }, [store.currentStep, store.isOpen, setStepCompleted]);

  return store;
}
