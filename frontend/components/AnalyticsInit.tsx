'use client';

import { useEffect, useRef } from 'react';
import { analytics } from '@/lib/analytics';
import { usePageTracking } from '@/hooks/usePageTracking';

export function AnalyticsInit() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    analytics.init();
  }, []);

  usePageTracking();

  return null;
}
