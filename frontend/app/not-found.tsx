import Link from 'next/link';
import { StatusPage, statusStyles } from '@/components/landing/StatusPage';

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      kicker="404 · Off the map"
      title={<>This page isn’t <em>on the map.</em></>}
      lead="The link may be old, or the page moved. Head back to the map, or find what you were after in the docs."
      actions={
        <>
          <Link href="/" className={statusStyles.primary}>Back to ArchDraw →</Link>
          <Link href="/docs" className={statusStyles.secondary}>Read the docs</Link>
        </>
      }
    />
  );
}
