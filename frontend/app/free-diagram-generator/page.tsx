import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { DiagramFromTextTool } from '@/components/landing/tools/DiagramFromTextTool';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

const PATH = '/free-diagram-generator';

export const metadata = pageMetadata({
  title: 'Free Diagram Generator: Text to Diagram Online',
  description: 'Free online diagram generator: write a flowchart or system diagram as text (Mermaid) and get a clean, laid-out diagram to download as PNG or SVG. No sign-up.',
  path: PATH,
  keywords: ['free diagram generator', 'text to diagram', 'mermaid to png', 'mermaid diagram generator', 'flowchart generator', 'online diagram maker'],
});

const SYNTAX: Array<{ code: string; meaning: string }> = [
  { code: 'graph LR', meaning: 'Start a diagram that flows left to right (use graph TD for top to bottom).' },
  { code: 'A[Web App]', meaning: 'A box with id A and the label "Web App".' },
  { code: 'DB[(Postgres)]', meaning: 'A database (cylinder) shape.' },
  { code: 'LB{{Load Balancer}}', meaning: 'A hexagon, used for gateways and load balancers.' },
  { code: 'A --> B', meaning: 'An arrow from A to B.' },
  { code: 'A -->|HTTPS| B', meaning: 'An arrow with a label.' },
  { code: 'A -.-> B', meaning: 'A dashed arrow, for asynchronous calls.' },
  { code: 'subgraph Backend ... end', meaning: 'A group around the components inside it.' },
];

const FAQ = [
  { question: 'Is this diagram generator really free?', answer: 'Yes. Draw as many diagrams as you like and download them as PNG or SVG without an account. A fair-use limit of a few hundred diagrams an hour applies.' },
  { question: 'What kinds of diagrams can it draw?', answer: 'Flowcharts and box-and-arrow diagrams written in Mermaid graph syntax: system architecture, data flows, processes and pipelines, with groups, labelled arrows and shapes for databases, queues and gateways.' },
  { question: 'Do I need to know Mermaid?', answer: 'No. Start from the example and change the names, or use the free AI architecture diagram generator, which writes the diagram from a plain-English description.' },
  { question: 'Is my diagram stored?', answer: 'No. Drawing and downloading does not save anything. Only "Edit in ArchDraw" saves a copy, so it can open in the editor.' },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Free Diagram Generator',
      url: absoluteUrl(PATH),
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${absoluteUrl('/')}#organization` },
    },
    { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
    breadcrumbJsonLd([['Free diagram generator', PATH]]),
  ],
};

const h2 = 'text-2xl font-semibold tracking-[-.03em] text-text-primary';

export default function FreeDiagramGeneratorPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-28 sm:px-8">
        <header className="max-w-3xl">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Free tool · No sign-up</p>
          <h1 className="text-[clamp(2.3rem,5vw,3.8rem)] font-semibold leading-[1] tracking-[-.045em]">Free diagram generator</h1>
          <p className="mt-5 text-lg leading-8 text-text-secondary">
            Write a diagram as text and get a clean, automatically laid-out diagram. Download it as PNG or SVG, or open it in the editor to keep working.
          </p>
        </header>

        <div className="mt-10"><DiagramFromTextTool /></div>

        <div className="mx-auto max-w-3xl">
          <section aria-labelledby="syntax-title" className="pt-20">
            <h2 id="syntax-title" className={h2}>How to write a diagram</h2>
            <p className="mt-3 leading-7 text-text-secondary">The generator reads Mermaid graph syntax, a simple text format for boxes and arrows. These lines cover almost everything:</p>
            <div className="mt-5 overflow-x-auto rounded-xl border border-border-default">
              <table className="w-full min-w-[480px] text-left text-sm">
                <tbody className="divide-y divide-border-default bg-surface-card">
                  {SYNTAX.map((row) => (
                    <tr key={row.code}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-text-primary">{row.code}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="why-title" className="pt-16">
            <h2 id="why-title" className={h2}>Why draw diagrams as text</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-text-secondary marker:text-text-muted">
              <li className="pl-1">Layout is automatic: add a component and the diagram rearranges itself, so it never turns into a tangle.</li>
              <li className="pl-1">Text fits in a README, a pull request or a design doc, and changes show up in diffs.</li>
              <li className="pl-1">AI assistants write Mermaid well, so you can ask one for a first draft and paste it here.</li>
            </ul>
          </section>

          <section aria-labelledby="more-title" className="pt-16">
            <h2 id="more-title" className={h2}>More free tools</h2>
            <ul className="mt-4 space-y-2 leading-7 text-text-secondary">
              <li><Link href="/free-architecture-diagram-generator" className="font-medium text-brand-text hover:underline">Free AI architecture diagram generator</Link>: describe a system in plain English or paste a GitHub repo.</li>
              <li><Link href="/system-design-calculator" className="font-medium text-brand-text hover:underline">System design calculator</Link>: estimate requests per second, storage and bandwidth.</li>
              <li><Link href="/templates" className="font-medium text-brand-text hover:underline">Architecture diagram templates</Link>: start from ChatGPT, Netflix, WhatsApp and more.</li>
            </ul>
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
