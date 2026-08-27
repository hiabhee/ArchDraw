import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#090b0d' },
  ],
};
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://archdraw.app'),
  title: {
    default: 'ArchDraw — System Architecture Diagram & Design Tool',
    template: '%s | ArchDraw',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  description: 'Design and map production system architecture with drag-and-drop diagrams. Share, export, and embed instantly.',
  alternates: {
    canonical: 'https://archdraw.app',
    languages: {
      en: 'https://archdraw.app',
      'x-default': 'https://archdraw.app',
    },
  },
  keywords: [
    'system design tool', 'architecture diagram', 'system architecture',
    'software architecture diagram', 'system design diagram maker',
    'backend architecture tool', 'microservices diagram', 'cloud architecture diagram',
    'system design interview', 'network diagram tool',
  ],
  authors: [{ name: 'ArchDraw' }],
  creator: 'ArchDraw',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://archdraw.app',
    title: 'ArchDraw — System Architecture Diagram & Design Tool',
    description: 'Design production-ready system architecture diagrams visually.',
    siteName: 'ArchDraw',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw System Architecture Design Tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArchDraw — System Architecture Diagram & Design Tool',
    description: 'Design production-ready system architecture diagrams visually.',
    images: ['/api/og/home'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://archdraw.app/#organization',
                  name: 'ArchDraw',
                  url: 'https://archdraw.app',
                  logo: 'https://archdraw.app/api/og/home',
                  description:
                    'AI-assisted system architecture diagramming tool that turns plain English, Mermaid, or a GitHub repo URL into styled, auto-laid-out architecture diagrams.',
                  sameAs: ['https://github.com/hiabhee/ArchDraw'],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://archdraw.app/#website',
                  url: 'https://archdraw.app',
                  name: 'ArchDraw',
                  publisher: { '@id': 'https://archdraw.app/#organization' },
                  inLanguage: 'en-US',
                },
                {
                  '@type': 'SoftwareApplication',
                  '@id': 'https://archdraw.app/#software',
                  name: 'ArchDraw',
                  url: 'https://archdraw.app',
                  description: 'AI-assisted system architecture diagramming tool that turns plain English, Mermaid, or a GitHub repo URL into styled, auto-laid-out architecture diagrams.',
                  applicationCategory: 'DeveloperApplication',
                  operatingSystem: 'Web',
                  inLanguage: 'en-US',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                    description: 'Free during beta',
                  },
                  publisher: { '@id': 'https://archdraw.app/#organization' },
                },
              ],
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('archdraw-theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else if (!theme || theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
              
              // Global handler for Web Locks API AbortErrors (LevelDB/localStorage conflicts)
              window.addEventListener('unhandledrejection', function(event) {
                var reason = event.reason;
                if (reason && reason.name === 'AbortError' && reason.message && (
                  reason.message.includes('steal') || 
                  reason.message.includes('Lock') ||
                  reason.message.includes('lock')
                )) {
                  event.preventDefault();
                  console.warn('[ArchDraw] Storage lock conflict suppressed:', reason.message);
                }
              });
              
              // Also catch sync errors from storage operations
              window.addEventListener('error', function(event) {
                var msg = event.message;
                if (msg && msg.includes && msg.includes('AbortError') && msg.includes('Lock')) {
                  event.preventDefault();
                  console.warn('[ArchDraw] Storage lock error suppressed');
                }
              });
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="archdraw-theme" themes={['dark', 'light']}>
          <AuthProvider>
            <AnalyticsProvider>
              {children}
            </AnalyticsProvider>
            <Toaster position="bottom-right" theme="light" richColors />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
