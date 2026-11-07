import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { GeneratorPromptBox } from '@/components/landing/GeneratorPromptBox';
import { ALTERNATIVES, getAlternative } from '@/data/alternatives';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return ALTERNATIVES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) return { title: 'Comparison not found', robots: { index: false } };
  return pageMetadata({
    title: `${alt.name} Alternative: ArchDraw vs ${alt.name}`,
    description: alt.summary,
    path: `/alternatives/${alt.slug}`,
    type: 'article',
    keywords: [`${alt.name.toLowerCase()} alternative`, `archdraw vs ${alt.name.toLowerCase()}`, `${alt.name.toLowerCase()} vs`, 'architecture diagram tool'],
  });
}

const h2 = 'text-xl font-semibold tracking-[-.03em] text-text-primary';
const li = 'flex gap-2.5 leading-7 text-text-secondary';

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((s) => (
        <li key={s.slice(0, 40)} className={li}><Check size={16} aria-hidden="true" className="mt-1.5 flex-shrink-0 text-text-muted" />{s}</li>
      ))}
    </ul>
  );
}

export default async function AlternativePage({ params }: Props) {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) notFound();
  const path = `/alternatives/${alt.slug}`;
  const checked = new Date(`${alt.checkedOn}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', mainEntity: alt.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
      breadcrumbJsonLd([['Alternatives', '/alternatives'], [`ArchDraw vs ${alt.name}`, path]]),
    ],
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="transition-colors hover:text-text-primary">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/alternatives" className="transition-colors hover:text-text-primary">Alternatives</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">ArchDraw vs {alt.name}</li>
          </ol>
        </nav>

        <header>
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Comparison</p>
          <h1 className="text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-.04em]">ArchDraw vs {alt.name}</h1>
          <div className="mt-5 space-y-4">{alt.about.map((p) => <p key={p.slice(0, 40)} className="text-lg leading-8 text-text-secondary">{p}</p>)}</div>
        </header>

        <section aria-labelledby="table-title" className="mt-12">
          <h2 id="table-title" className={h2}>At a glance</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-surface-panel text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th scope="col" className="px-4 py-3 font-semibold">ArchDraw</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{alt.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default bg-surface-card">
                {alt.rows.map((r) => (
                  <tr key={r.feature}>
                    <th scope="row" className="px-4 py-3 font-medium text-text-primary">{r.feature}</th>
                    <td className="px-4 py-3 text-text-secondary">{r.archdraw}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Checked {checked} from public information. Features and plans change; see <a href={alt.pricingUrl} rel="noopener nofollow" className="underline hover:text-text-secondary">{alt.name}&apos;s site</a> for current details.
          </p>
        </section>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <section aria-labelledby="strengths-title">
            <h2 id="strengths-title" className={h2}>What {alt.name} does well</h2>
            <Ticks items={alt.theirStrengths} />
          </section>
          <section aria-labelledby="diff-title">
            <h2 id="diff-title" className={h2}>What ArchDraw does differently</h2>
            <Ticks items={alt.archdrawDifferences} />
          </section>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <section aria-labelledby="them-title">
            <h2 id="them-title" className={h2}>Choose {alt.name} if</h2>
            <Ticks items={alt.chooseThem} />
          </section>
          <section aria-labelledby="us-title">
            <h2 id="us-title" className={h2}>Choose ArchDraw if</h2>
            <Ticks items={alt.chooseArchDraw} />
          </section>
        </div>

        <section aria-labelledby="try-title" className="mt-14">
          <h2 id="try-title" className={h2}>Try ArchDraw on your own system</h2>
          <p className="mt-2 text-sm text-text-secondary">Free during the beta. Describe a system or paste a GitHub repository.</p>
          <div className="mt-4"><GeneratorPromptBox placeholder="e.g. A chat app with WebSockets, message history in Cassandra and push notifications" /></div>
        </section>

        <section aria-labelledby="faq-title" className="mt-14">
          <h2 id="faq-title" className={h2}>Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-border-default rounded-xl border border-border-default bg-surface-card">
            {alt.faq.map((f) => (
              <div key={f.question} className="px-5 py-4">
                <h3 className="text-sm font-semibold">{f.question}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{f.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-text-secondary">
            Other comparisons:{' '}
            {ALTERNATIVES.filter((a) => a.slug !== alt.slug).map((a, i) => (
              <span key={a.slug}>{i > 0 && ', '}<Link href={`/alternatives/${a.slug}`} className="font-medium text-brand-text hover:underline">ArchDraw vs {a.name}</Link></span>
            ))}
            .
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
