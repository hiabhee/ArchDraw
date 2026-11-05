/**
 * One definition of the Studio card's geometry and type, scaled from the original
 * 64px-high card. Everything that draws or measures a Studio card (the layout's
 * sizing, both node components, the CSS, the SVG export, the readability measure)
 * reads it from here, so they cannot drift apart. No imports: layout code and the
 * export use it, and neither may pull in the other's dependencies.
 *
 * Cards are larger than they once were because a fitted diagram is mostly read at
 * a low zoom, and the gaps between cards (edge labels, handle clearance) do not
 * scale with them: a bigger card takes a bigger share of the screen.
 */

/** How much larger a card is than the original 192×64 design. */
export const STUDIO_SCALE = 1.25;

/** Card widths: plain, and with the icon beside the title. */
export const STUDIO_CARD_WIDTH = Math.round(192 * STUDIO_SCALE);
export const STUDIO_CARD_WIDTH_WITH_ICON = Math.round(240 * STUDIO_SCALE);
/** The shortest a card gets; wrapped text makes it taller. */
export const STUDIO_CARD_HEIGHT = Math.round(64 * STUDIO_SCALE);

export const STUDIO_ICON_WELL = Math.round(48 * STUDIO_SCALE);
export const STUDIO_ICON_GLYPH = Math.round(36 * STUDIO_SCALE);
export const STUDIO_CARD_RADIUS = Math.round(18 * STUDIO_SCALE);

/** Type sizes in canvas px (the original design used 18.5 and 12.5). */
export const STUDIO_TITLE_PX = 23;
export const STUDIO_SUBTITLE_PX = 15.5;

/** Average glyph widths and line heights the sizing uses to predict wrapping, from the type sizes above. */
export const STUDIO_TITLE_CHAR_PX = 9.25 * (STUDIO_TITLE_PX / 18.5);
export const STUDIO_SUBTITLE_CHAR_PX = 6.6 * (STUDIO_SUBTITLE_PX / 12.5);
export const STUDIO_TITLE_LINE_PX = Math.round(23 * STUDIO_SCALE);
export const STUDIO_SUBTITLE_LINE_PX = Math.round(15 * STUDIO_SCALE);
/** Padding around the text: left + right, and top + bottom. */
export const STUDIO_TEXT_PAD_X = Math.round(28 * STUDIO_SCALE);
export const STUDIO_TEXT_PAD_Y = Math.round(24 * STUDIO_SCALE);
/** Gap between the icon well and the text beside it. */
export const STUDIO_ICON_GAP = Math.round(10 * STUDIO_SCALE);
