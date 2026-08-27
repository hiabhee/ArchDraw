import { Nanum_Pen_Script, Patrick_Hand, Caveat } from 'next/font/google';

/** Self-hosted sketch handwriting — applied on the canvas wrapper in sketch mode. */
export const sketchHandwritingFont = Nanum_Pen_Script({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nanum-pen-script',
  preload: false,
});

/** Patrick Hand — sketch titles & edge labels (marker style). */
export const sketchPatrickHandFont = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-patrick-hand',
  preload: false,
});

/** Caveat — sketch subtitles & annotations (casual cursive). */
export const sketchCaveatFont = Caveat({
  weight: ['500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
  preload: false,
});
