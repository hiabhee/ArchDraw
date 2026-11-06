/**
 * Measures and wraps text for the SVG export so a card's title and subtitle break across lines
 * exactly where the canvas breaks them.
 *
 * In a browser the text is measured with the font stack the canvas itself uses, so wrapping matches
 * whichever face the browser really draws (Inter when it is installed, else the system font). On the
 * server there is no DOM, so widths come from the bundled Inter faces: `INTER_WIDTHS` holds each
 * glyph's advance in 1/1000 em, generated from the TTFs in `frontend/assets/fonts`.
 */

type Weight = 400 | 500 | 600;

interface WidthTable {
  /** U+0020..U+007E. */
  ascii: number[];
  /** A few common symbols outside ASCII. */
  extra: Record<string, number>;
  /** Used for any other character (the width of "n"). */
  fallback: number;
}

// Advance widths in 1/1000 em. Inter Regular (400), Medium (500), SemiBold (600).
const INTER_WIDTHS: Record<Weight, WidthTable> = {
  400: {
    ascii: [281,288,466,633,642,982,644,300,365,365,501,662,288,460,288,360,631,407,610,618,646,593,620,566,619,620,288,302,662,662,662,511,966,690,654,730,722,601,590,746,743,269,571,672,565,903,753,765,639,765,644,642,646,744,690,985,682,679,629,365,360,365,471,456,323,562,612,571,612,583,370,613,591,242,242,549,242,876,591,600,612,612,376,528,327,591,562,818,546,562,552,426,333,426,662],
    extra: { '—': 1000,'–': 500,'→': 954,'←': 954,'·': 288,'•': 563,'…': 864,'’': 261,'‘': 261,'“': 440,'”': 440,'é': 583,'è': 583,'ü': 591,'ö': 600,'ñ': 591,'×': 662,'≥': 662,'≤': 662,'↔': 1341,'↓': 834,'↑': 834,'©': 914,'®': 666,'°': 456,'™': 611,'€': 667,'£': 611,'¥': 550,'§': 568,'¶': 603 },
    fallback: 591,
  },
  500: {
    ascii: [267,304,494,639,646,993,653,313,369,369,521,667,303,462,303,370,646,415,616,627,656,603,630,571,629,630,303,315,667,667,667,527,982,709,657,733,722,603,589,748,745,272,575,688,565,913,756,767,642,769,648,646,653,740,709,1003,701,696,641,369,370,369,477,463,337,568,618,577,618,587,379,620,602,252,252,559,252,888,602,604,618,618,387,539,340,602,575,829,557,575,559,440,346,440,667],
    extra: { '—': 1000,'–': 500,'→': 954,'←': 954,'·': 303,'•': 533,'…': 910,'’': 277,'‘': 277,'“': 474,'”': 471,'é': 587,'è': 587,'ü': 602,'ö': 604,'ñ': 602,'×': 667,'≥': 667,'≤': 667,'↔': 1341,'↓': 858,'↑': 858,'©': 914,'®': 665,'°': 457,'™': 621,'€': 672,'£': 620,'¥': 557,'§': 568,'¶': 601 },
    fallback: 602,
  },
  600: {
    ascii: [252,321,523,644,650,1004,663,326,373,373,540,673,319,465,319,379,660,423,623,636,666,612,640,576,640,640,319,329,673,673,673,543,999,728,659,737,722,605,588,749,746,277,580,703,565,922,759,769,645,773,652,650,660,736,728,1020,720,713,652,373,379,373,481,469,351,574,624,583,624,591,389,625,612,262,262,569,262,900,612,609,624,624,397,549,353,612,587,839,569,588,566,455,359,455,673],
    extra: { '—': 1000,'–': 500,'→': 954,'←': 954,'·': 319,'•': 503,'…': 956,'’': 294,'‘': 294,'“': 507,'”': 501,'é': 591,'è': 591,'ü': 612,'ö': 609,'ñ': 612,'×': 673,'≥': 673,'≤': 673,'↔': 1341,'↓': 881,'↑': 881,'©': 914,'®': 664,'°': 458,'™': 630,'€': 679,'£': 629,'¥': 563,'§': 568,'¶': 600 },
    fallback: 612,
  },
};

const STACK = 'Inter, "IBM Plex Sans", system-ui, -apple-system, sans-serif';

function nearestWeight(weight: number): Weight {
  if (weight >= 600) return 600;
  if (weight >= 500) return 500;
  return 400;
}

function serverWidth(text: string, weight: number, px: number): number {
  const table = INTER_WIDTHS[nearestWeight(weight)];
  let total = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    total += code >= 32 && code <= 126 ? table.ascii[code - 32] : table.extra[ch] ?? table.fallback;
  }
  return (total / 1000) * px;
}

let context: CanvasRenderingContext2D | null | undefined;
function browserContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  try {
    context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    context = null;
  }
  return context;
}

/** Width in px of `text` set at `px`, with `letterSpacing` px added after every character. */
export function measureText(text: string, weight: number, px: number, letterSpacing = 0): number {
  const ctx = browserContext();
  let width: number;
  if (ctx) {
    ctx.font = `${weight} ${px}px ${STACK}`;
    width = ctx.measureText(text).width;
  } else {
    width = serverWidth(text, weight, px);
  }
  return width + letterSpacing * [...text].length;
}

export interface WrapOptions {
  weight: number;
  px: number;
  letterSpacing?: number;
}

/**
 * Breaks `text` into lines no wider than `maxWidth`: at spaces first, and inside a word only when
 * the word alone is too wide (`overflow-wrap: break-word`, as the canvas does). Explicit newlines are kept.
 */
export function wrapText(text: string, maxWidth: number, { weight, px, letterSpacing = 0 }: WrapOptions): string[] {
  const width = (value: string) => measureText(value, weight, px, letterSpacing);
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split(/\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (width(word) <= maxWidth) { line = word; continue; }
      // A single word wider than the line: break it by characters.
      let piece = '';
      for (const ch of word) {
        if (piece && width(piece + ch) > maxWidth) { lines.push(piece); piece = ch; } else piece += ch;
      }
      line = piece;
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}
