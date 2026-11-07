import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { CapacityCalculator } from '@/components/landing/tools/CapacityCalculator';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

const PATH = '/system-design-calculator';

export const metadata = pageMetadata({
  title: 'System Design Calculator (Back-of-the-Envelope)',
  description: 'Free back-of-the-envelope calculator for system design interviews: estimate QPS, peak traffic, storage and bandwidth from users and usage.',
  path: PATH,
  keywords: ['system design calculator', 'back of the envelope estimation', 'capacity estimation', 'qps calculator', 'system design interview estimation'],
});

/** Widely quoted orders of magnitude (popularised by Jeff Dean and Peter Norvig); real hardware varies. */
const LATENCY: Array<[string, string]> = [
  ['L1 cache reference', '~1 ns'],
  ['Main memory reference', '~100 ns'],
  ['Read 1 MB sequentially from memory', '~10 µs'],
  ['Round trip within a data center', '~0.5 ms'],
  ['Read 1 MB sequentially from SSD', '~1 ms'],
  ['Disk seek (spinning disk)', '~10 ms'],
  ['Round trip between continents', '~150 ms'],
];

const POWERS: Array<[string, string, string]> = [
  ['2¹⁰', 'Thousand', '1 KB'],
  ['2²⁰', 'Million', '1 MB'],
  ['2³⁰', 'Billion', '1 GB'],
  ['2⁴⁰', 'Trillion', '1 TB'],
  ['2⁵⁰', 'Quadrillion', '1 PB'],
];

const FAQ = [
  { question: 'What is back-of-the-envelope estimation in system design?', answer: 'Quick, rough arithmetic to size a system before designing it: how many requests per second it must handle, how much data it stores and how much bandwidth it needs. It shows which parts need caching, sharding or a CDN.' },
  { question: 'How do you calculate QPS from daily active users?', answer: 'Multiply daily active users by requests per user per day, then divide by 86,400 seconds in a day. Multiply by a peak factor (often 2 to 5) to size for the busiest hour.' },
  { question: 'How accurate are these estimates?', answer: 'They are orders of magnitude, not forecasts. They are meant to tell 100 requests per second apart from 100,000, which is what drives design decisions.' },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebApplication', name: 'System Design Calculator', url: absoluteUrl(PATH), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@id': `${absoluteUrl('/')}#organization` } },
    { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
    breadcrumbJsonLd([['System design calculator', PATH]]),
  ],
};

const h2 = 'text-2xl font-semibold tracking-[-.03em] text-text-primary';

export default function SystemDesignCalculatorPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-28 sm:px-8">
        <header className="max-w-3xl">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Free tool</p>
          <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-.045em]">System design calculator</h1>
          <p className="mt-5 text-lg leading-8 text-text-secondary">
            Back-of-the-envelope estimates for system design interviews and real projects: enter users and usage, get requests per second, storage and bandwidth.
          </p>
        </header>

        <div className="mt-10"><CapacityCalculator /></div>

        <div className="mx-auto grid max-w-5xl gap-12 pt-20 lg:grid-cols-2">
          <section aria-labelledby="latency-title">
            <h2 id="latency-title" className={h2}>Latency numbers to know</h2>
            <p className="mt-2 text-sm text-text-secondary">Orders of magnitude, popularised by Jeff Dean and Peter Norvig. Real hardware varies.</p>
            <table className="mt-4 w-full text-left text-sm">
              <tbody className="divide-y divide-border-default">
                {LATENCY.map(([what, time]) => (
                  <tr key={what}><td className="py-2.5 pr-4 text-text-secondary">{what}</td><td className="py-2.5 text-right font-mono text-text-primary">{time}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby="powers-title">
            <h2 id="powers-title" className={h2}>Powers of two</h2>
            <p className="mt-2 text-sm text-text-secondary">The shortcuts used in every estimate.</p>
            <table className="mt-4 w-full text-left text-sm">
              <tbody className="divide-y divide-border-default">
                {POWERS.map(([power, name, size]) => (
                  <tr key={power}><td className="py-2.5 font-mono text-text-primary">{power}</td><td className="py-2.5 text-text-secondary">{name}</td><td className="py-2.5 text-right font-mono text-text-primary">{size}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="mx-auto max-w-3xl">
          <section aria-labelledby="use-title" className="pt-16">
            <h2 id="use-title" className={h2}>From numbers to a design</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-text-secondary marker:text-text-muted">
              <li className="pl-1">Thousands of reads per second on the same data: add a <Link href="/system-design/cache" className="font-medium text-brand-text hover:underline">cache</Link>.</li>
              <li className="pl-1">Large media and global users: serve files from a <Link href="/system-design/cdn" className="font-medium text-brand-text hover:underline">CDN</Link> in front of <Link href="/system-design/object-storage" className="font-medium text-brand-text hover:underline">object storage</Link>.</li>
              <li className="pl-1">Writes beyond one database server: partition the data, often in a <Link href="/system-design/nosql-database" className="font-medium text-brand-text hover:underline">NoSQL database</Link>.</li>
              <li className="pl-1">Bursty work that can wait: put it on a <Link href="/system-design/message-queue" className="font-medium text-brand-text hover:underline">message queue</Link>.</li>
            </ul>
            <p className="mt-4 text-sm text-text-secondary">
              Then draw it: try the <Link href="/free-architecture-diagram-generator" className="font-medium text-brand-text hover:underline">free AI architecture diagram generator</Link>, or practise with the <Link href="/tutorials" className="font-medium text-brand-text hover:underline">system design tutorials</Link>.
            </p>
          </section>

          <section aria-labelledby="faq-title" className="pt-16">
            <h2 id="faq-title" className={h2}>Frequently asked questions</h2>
            <div className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
              {FAQ.map((f) => (
                <div key={f.question} className="px-5 py-4">
                  <h3 className="text-sm font-semibold">{f.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
