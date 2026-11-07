import { BRAND_COLORS } from './brand';

/**
 * The ArchDraw mark for generated social cards (`app/api/og/*`), which render with
 * `next/og` and cannot use CSS tokens or `components/ui/BrandMark.tsx`. Same three
 * layers; the cards are dark, so it takes the dark theme's colours (light tile, dark glyph).
 */
export function OgBrandMark({ size = 48 }: { size?: number }) {
  const glyph = Math.round(size / 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
        background: BRAND_COLORS.nightInk,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke={BRAND_COLORS.nightPage} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );
}
