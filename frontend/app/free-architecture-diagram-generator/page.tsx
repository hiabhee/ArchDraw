import Link from 'next/link';
import { ArrowRight, Bot, Code2, GitBranch, MessageSquareText } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { GeneratorPromptBox } from '@/components/landing/GeneratorPromptBox';
import { TEMPLATES } from '@/data/templates/index';
import { templateHeading, templateSlug } from '@/lib/site/templateCatalog';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/site/seo';

const PATH = '/free-architecture-diagram-generator';

export const metadata = pageMetadata({
  title: 'Free AI Architecture Diagram Generator',
  description: 'Free AI architecture diagram generator: describe a system or paste a GitHub repo and get an editable, auto-laid-out software architecture diagram.',
  path: PATH,
  keywords: ['free architecture diagram generator', 'ai architecture diagram generator', 'ai diagram generator', 'system architecture diagram generator', 'architecture diagram maker', 'github repo to diagram', 'text to architecture diagram'],
});

const EXAMPLES = [
  'A food delivery app with ordering, restaurant menus, courier dispatch, payments and push notifications',
  'A RAG chatbot over company documents with embeddings, a vector database and streaming answers',
  'An e-commerce checkout with cart, inventory reservation, payments and order events on Kafka',
  'A multi-tenant SaaS backend with an API gateway, auth, Postgres per tenant and background jobs',
  'A real-time multiplayer game backend with matchmaking, game servers, leaderboards and Redis',
  'An IoT platform ingesting device telemetry through MQTT into a stream processor and time-series database',
];

const WAYS = [
  { icon: MessageSquareText, title: 'Describe it', body: 'Write what the system does in plain English. Add details (the databases you use, the queues, the clients) for a closer match.' },
  { icon: GitBranch, title: 'Paste a GitHub repo', body: 'ArchDraw reads the repository\'s architecture files and code, checks its findings against the README, and draws the system.', href: '/repo-diagram' },
  { icon: Code2, title: 'Paste Mermaid', body: 'Open the code panel and paste a Mermaid graph; ArchDraw lays it out and styles it, and keeps the code and canvas in sync.' },
  { icon: Bot, title: 'Ask your AI agent', body: 'Connect Claude or another MCP client and ask it to draw or update a diagram; it returns a link to the editable result.', href: '/mcp' },
];

const FAQ = [
  { question: 'How does the AI architecture diagram generator work?', answer: 'An AI model plans the architecture from your description and writes it as a Mermaid graph. ArchDraw then builds the components, groups and connections and lays them out with a deterministic layout engine, so you get a tidy, editable diagram rather than an image.' },
  { question: 'Is it free?', answer: 'Yes. ArchDraw is free during its public beta. You can generate diagrams without an account; sign in with Google or GitHub to save them, share links and export SVG.' },
  { question: 'Can I edit the generated diagram?', answer: 'Yes. Everything is editable on the canvas: move, rename, restyle, add components and connections, or edit the diagram as Mermaid. You can also ask the AI to change it.' },
  { question: 'Can it diagram my existing codebase?', answer: 'Yes, for public GitHub repositories. Paste the repository URL and ArchDraw builds the diagram from the repo\'s files, verified against the code and the README.' },
  { question: 'What can I export?', answer: 'PNG and JSON without an account, SVG when signed in, and the diagram as Mermaid from the code panel. Signed-in users can also share a read-only link or embed it.' },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'ArchDraw Free AI Architecture Diagram Generator',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      url: absoluteUrl(PATH),
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${absoluteUrl('/')}#organization` },
    },
    { '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) },
    breadcrumbJsonLd([['Free architecture diagram generator', PATH]]),
  ],
};

const h2 = 'text-2xl font-semibold tracking-[-.03em] text-text-primary';

export default function GeneratorPage() {
  const featured = ['chatgpt', 'microservices', 'netflix', 'event_driven', 'whatsapp', 'serverless'].flatMap((id) => TEMPLATES.find((t) => t.id === id) ?? []);
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-28 sm:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Free AI tool</p>
          <h1 className="text-[clamp(2.4rem,5.5vw,4.2rem)] font-semibold leading-[1] tracking-[-.045em]">Free AI architecture diagram generator</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
            Describe a system or paste a GitHub repository, and get a clean, editable software architecture diagram in seconds, laid out for you.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-3xl">
          <GeneratorPromptBox placeholder="e.g. A ride-sharing backend with rider and driver apps, matching, live driver locations, trips and payments" />
        </div>

        <section aria-labelledby="examples-title" className="mx-auto mt-10 max-w-3xl">
          <h2 id="examples-title" className="text-sm font-semibold text-text-secondary">Try an example</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <a href={`/editor?generate=${encodeURIComponent(example)}`} rel="nofollow" className="block h-full rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm leading-6 text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary">
                  {example}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ways-title" className="pt-20">
          <h2 id="ways-title" className={h2}>Four ways to create an architecture diagram</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {WAYS.map(({ icon: Icon, title, body, href }) => (
              <div key={title} className="rounded-xl border border-border-default bg-surface-card p-5">
                <Icon size={20} aria-hidden="true" className="text-brand-text" />
                <h3 className="mt-3 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
                {href && <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">Learn more <ArrowRight size={14} aria-hidden="true" /></Link>}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-title" className="mx-auto max-w-3xl pt-20">
          <h2 id="how-title" className={h2}>How it works</h2>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-7 text-text-secondary marker:text-text-muted">
            <li className="pl-1"><strong className="font-semibold text-text-primary">Plan.</strong> An AI model reads your description and plans the components, how they connect and how they group into areas.</li>
            <li className="pl-1"><strong className="font-semibold text-text-primary">Write it as Mermaid.</strong> The plan becomes a Mermaid graph, a text format you can read and edit.</li>
            <li className="pl-1"><strong className="font-semibold text-text-primary">Lay it out.</strong> A deterministic layout engine places every component and routes the connections, so related parts line up and the diagram stays readable.</li>
            <li className="pl-1"><strong className="font-semibold text-text-primary">Edit and share.</strong> The result is a real diagram, not a picture: change anything on the canvas or in the code, then export or share it.</li>
          </ol>
        </section>

        <section aria-labelledby="templates-title" className="pt-20">
          <h2 id="templates-title" className={h2}>Or start from a template</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <li key={t.id}>
                <Link href={`/templates/${templateSlug(t)}`} className="group flex items-center justify-between rounded-lg border border-border-default bg-surface-card px-4 py-3 text-sm font-medium transition-colors hover:border-border-strong">
                  {templateHeading(t)}
                  <ArrowRight size={14} aria-hidden="true" className="text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-text-secondary">
            Already have diagram code? Try the <Link href="/free-diagram-generator" className="font-medium text-brand-text hover:underline">free diagram generator</Link>, which draws Mermaid instantly. Browse all <Link href="/templates" className="font-medium text-brand-text hover:underline">architecture diagram templates</Link>, or compare ArchDraw with{' '}
            <Link href="/alternatives" className="font-medium text-brand-text hover:underline">other diagram tools</Link>.
          </p>
        </section>

        <section aria-labelledby="faq-title" className="mx-auto max-w-3xl pt-20">
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
      </main>
      <Footer />
    </div>
  );
}
