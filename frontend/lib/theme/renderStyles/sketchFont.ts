import { Nanum_Pen_Script } from 'next/font/google';

/** Self-hosted sketch handwriting — applied on the canvas wrapper in sketch mode. */
export const sketchHandwritingFont = Nanum_Pen_Script({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nanum-pen-script',
  preload: false,
});
