'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/analytics';
import { usePageTracking } from '@/hooks/usePageTracking';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    analytics.init();
  }, []);

  usePageTracking();

  return <>{children}</>;
}
