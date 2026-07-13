'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

export function usePageTracking() {
  const pathname = usePathname();
  const startRef = useRef<number>(0);
  const prevPathRef = useRef<string>('');
  const visibleRef = useRef<boolean>(true);

  useEffect(() => {
    // Track navigation away from previous page
    if (prevPathRef.current !== pathname) {
      const duration_ms = Date.now() - startRef.current;
      // Debounce: don't record sub-second navigations
      if (duration_ms > 1000) {
        analytics.track({
          event_type: 'page_time',
          page_path: prevPathRef.current,
          payload: { duration_ms },
        });
      }
      analytics.track({
        event_type: 'page_view',
        page_path: pathname,
      });
      startRef.current = Date.now();
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    // Initial page view on mount
    analytics.track({
      event_type: 'page_view',
      page_path: pathname,
    });
    startRef.current = Date.now();
    prevPathRef.current = pathname;

    // Pause timer when tab is hidden
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        visibleRef.current = false;
      } else {
        visibleRef.current = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      // Track time on page on unmount
      const duration_ms = Date.now() - startRef.current;
      if (duration_ms > 1000) {
        analytics.track({
          event_type: 'page_time',
          page_path: pathname,
          payload: { duration_ms },
        });
      }
    };
  }, [pathname]);
}
