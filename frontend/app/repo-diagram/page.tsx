import Link from 'next/link';
import { ArrowRight, GitBranch, Workflow, Layers, ShieldCheck, ScanSearch, Network } from 'lucide-react';
export const metadata = {
  title: 'How to generate an architecture diagram from a GitHub repo with AI',
  description:
    'Paste a GitHub repo URL and ArchDraw analyzes the codebase to produce an architecture diagram — components, relationships, workflows, and dependency intelligence — in minutes.',
  openGraph: {
    type: 'article',
    url: 'https://archdraw.hiabhee.online/repo-diagram',
    title: 'How to generate an architecture diagram from a GitHub repo with AI',
    description:
      'Paste a GitHub repo URL and ArchDraw analyzes the codebase to produce an architecture diagram — components, relationships, workflows, and dependency intelligence.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'Generate an architecture diagram from a GitHub repo with AI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to generate an architecture diagram from a GitHub repo with AI',
    images: ['/api/og/home'],
  },
};

const PIPELINE = [
  {
    icon: ScanSearch,
    title: 'Ingest',
    desc: 'ArchDraw fetches your repository (via the GitHub tarball), unpacks it, and caches the result so re-diagramming is fast.',
  },
  {
    icon: Layers,
    title: 'Classify',
    desc: 'Agent models identify the stack and classify files into architectural components — services, databases, queues, clients, and external dependencies.',
  },
  {
    icon: Network,
    title: 'Extract relationships',
    desc: 'Import graphs, resolvers, and framework conventions are analyzed to find how components actually depend on each other.',
  },
  {
    icon: Workflow,
    title: 'Derive workflows',
    desc: 'The graph is condensed into request paths and critical dependencies that matter for design reviews.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify',
    desc: 'Generated components and edges are checked for accuracy and confidence before the diagram is materialized on your canvas.',
  },
];

const FAQS = [
  {
    q: 'Does generating a repo diagram cost a generation?',
    a: 'Yes — repo diagrams run through the same AI pipeline as prompt generation, so they count against your quota.',
  },
  {
    q: 'Which repositories are supported?',
    a: 'Any public GitHub repository. ArchDraw fetches the repo over the network, so the codebase needs to be reachable.',
  },
  {
    q: 'What do I get besides the diagram?',
    a: 'The diagram is imported into your canvas with components and edges, plus a summary with the detected stack, architecture pattern, workflows, critical dependencies, and a confidence rating.',
  },
  {
    q: 'Can I edit the result?',
    a: 'Yes. The generated graph is a normal ArchDraw canvas — you can rewire nodes, run auto-layout, apply templates, and export it like any other diagram.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://archdraw.hiabhee.online/repo-diagram#article',
      headline: 'How to generate an architecture diagram from a GitHub repo with AI',
      description: metadata.description,
      url: 'https://archdraw.hiabhee.online/repo-diagram',
      publisher: { '@id': 'https://archdraw.hiabhee.online/#organization' },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://archdraw.hiabhee.online/repo-diagram#faq',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ],
};

function Header() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl border-b border-[hsl(var(--border)/0.12)]"
      style={{ background: 'hsl(var(--background) / 0.8)' }}
    >
      <div className="max-w-[980px] mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[hsl(var(--foreground))]">
            <svg className="w-3.5 h-3.5 text-[hsl(var(--background))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-[hsl(var(--foreground))] tracking-tight">ArchDraw</span>
        </Link>
        <nav className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/docs" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            Documentation
          </Link>
          <Link href="/blogs" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            Engineering Blog
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RepoDiagramPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Header />

      <main className="flex-1 max-w-[980px] w-full mx-auto px-6 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
        />

        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: 'hsl(var(--muted)/0.5)', border: '1px solid hsl(var(--border)/0.12)', color: 'hsl(var(--muted-foreground))' }}
          >
            <GitBranch className="w-3 h-3" />
            Repo → Diagram
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-6">
            How to generate an architecture diagram from a GitHub repo with AI
          </h1>

          <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] leading-relaxed mb-4">
            Paste a GitHub repo URL into ArchDraw and it analyzes the codebase to produce an
            architecture diagram — components, relationships, workflows, and dependency intelligence —
            in minutes instead of days. The result is imported straight onto your canvas as an editable,
            auto-laid-out graph you can refine and share.
          </p>
          <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] leading-relaxed">
            Manually mapping a codebase into boxes and arrows is the slowest part of an architecture
            review. ArchDraw runs a multi-stage pipeline that reads the repository, classifies the
            components, extracts how they depend on each other, and verifies the result before it ever
            reaches your canvas.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-6">What happens under the hood</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PIPELINE.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border)/0.16)] px-1.5 py-0.5 rounded">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <step.icon className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                </div>
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-1.5">{step.title}</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{step.desc}</p>
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.3)] bg-[hsl(var(--muted)/0.2)] p-5 flex flex-col justify-center">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-1.5">What you get back</h3>
              <ul className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed space-y-1">
                <li>• Auto-laid-out component graph on your canvas</li>
                <li>• Detected stack and architecture pattern</li>
                <li>• Request workflows and critical dependencies</li>
                <li>• Confidence rating and review notes</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">How to use it</h2>
          <ol className="mt-4 space-y-3">
            {[
              'Open the editor and launch the Repo → Diagram generator.',
              'Paste the GitHub repository URL and start generation.',
              'Review the summary — stack, architecture pattern, workflows, confidence.',
              'Import the graph, then refine it like any ArchDraw canvas: rewire, auto-layout, template, export.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm">
                <span className="flex items-center justify-center w-5 h-5 shrink-0 mt-0.5 text-[10px] font-mono font-bold rounded-md border border-[hsl(var(--border)/0.16)] text-[hsl(var(--muted-foreground))]">
                  {i + 1}
                </span>
                <span className="text-[hsl(var(--muted-foreground))] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-6">FAQ</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-[hsl(var(--border)/0.16)] bg-[hsl(var(--card))] p-5">
                <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-2">{faq.q}</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-lg transition-all duration-200"
            style={{ background: 'hsl(var(--primary))' }}
          >
            Generate a diagram free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="w-full sm:w-auto inline-flex items-center justify-center text-sm font-semibold text-[hsl(var(--foreground))] px-6 py-3 rounded-lg border border-[hsl(var(--border)/0.16)] transition-colors duration-200"
          >
            Read the documentation
          </Link>
        </div>
      </main>
    </div>
  );
}
