import { cn } from '@/lib/utils';

/**
 * The ArchDraw mark: three stacked layers on an ink tile. The one logo for the
 * landing nav, dashboard, viewers and docs, so it never drifts between screens.
 * `size` is the tile's side in px; the glyph is half of it.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  const glyph = Math.round(size / 2);
  return (
    <span
      aria-hidden="true"
      className={cn('flex flex-shrink-0 items-center justify-center rounded-lg bg-text-primary', className)}
      style={{ width: size, height: size }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="var(--surface-page)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </span>
  );
}
