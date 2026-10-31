import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';

/**
 * The landing's three type roles, loaded once and shared by every landing surface
 * (live landing, status/404 pages): display serif for headlines, Geist for body,
 * Geist Mono for commands and labels. Surfaces apply `.variable` on their root and
 * their CSS reads `--font-display`, `--font-body`, `--font-mono`.
 */
export const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
export const body = Geist({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
export const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
