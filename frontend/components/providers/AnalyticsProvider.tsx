'use client';

import { useEffect } from 'react';
import { analytics } from '@/lib/client/analytics';
import { usePageTracking } from '@/hooks/usePageTracking';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    analytics.init();
  }, []);

  usePageTracking();

  return <>{children}</>;
}
