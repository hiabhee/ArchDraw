import Link from 'next/link';

/** The site footer: night palette (the landing's), built only from the shared tokens. */
export function Footer() {
  return (
    <footer className="border-t border-text-primary/10 bg-surface-page px-6 py-7 text-text-secondary">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-sm font-semibold text-text-primary">ArchDraw</Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <a href="/docs" className="py-1 transition-colors hover:text-text-primary">Docs</a>
          <a href="https://github.com/hiabhee/ArchDraw" className="py-1 transition-colors hover:text-text-primary">GitHub</a>
          <a href="/privacy" className="py-1 transition-colors hover:text-text-primary">Privacy</a>
          <a href="/terms" className="py-1 transition-colors hover:text-text-primary">Terms</a>
        </nav>
        <span className="text-xs">© 2026 ArchDraw</span>
      </div>
    </footer>
  );
}
