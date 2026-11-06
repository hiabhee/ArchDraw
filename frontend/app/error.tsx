'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { StatusPage, statusStyles } from '@/components/landing/StatusPage';
import logger from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error);
  }, [error]);

  return (
    <StatusPage
      code="!"
      kicker="Error · Something broke"
      title={<>This part of the map <em>didn’t load.</em></>}
      lead="Something went wrong on our side. Try again; if it keeps happening, tell us and we’ll fix it."
      actions={
        <>
          <button type="button" onClick={reset} className={statusStyles.primary}>Try again</button>
          <Link href="/contact" className={statusStyles.secondary}>Report it</Link>
        </>
      }
      footnote={error.digest ? <p className={statusStyles.ref}>ref {error.digest}</p> : undefined}
    />
  );
}
