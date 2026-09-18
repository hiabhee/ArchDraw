import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Blocks, GitBranch, PencilRuler } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'About ArchDraw | AI Architecture Diagram Tool',
  description: 'Learn how ArchDraw turns a repository, Mermaid, or system description into an editable architecture diagram.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/about' },
  openGraph: {
    type: 'website', url: 'https://archdraw.hiabhee.online/about', title: 'About ArchDraw',
    description: 'A visual system design tool for turning software architecture into a shared, editable canvas.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'About ArchDraw' }],
  },
};

const JSON_LD = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'AboutPage', name: 'About ArchDraw', url: 'https://archdraw.hiabhee.online/about', description: 'ArchDraw turns repositories, prompts, and Mermaid into editable architecture diagrams.' },
  { '@type': 'Organization', name: 'ArchDraw', url: 'https://archdraw.hiabhee.online', description: 'An AI-assisted system architecture diagramming product.' },
] };

const principles = [
  { icon: <GitBranch size={18} />, title: 'Start with the system you have', body: 'Bring a repository URL, a rough description, or Mermaid. ArchDraw gives the conversation around an architecture a visible starting point.' },
  { icon: <PencilRuler size={18} />, title: 'Keep the diagram editable', body: 'Generation is the beginning, not the handoff. Nodes, edges, groups, labels, and layout remain available on the canvas for your team to refine.' },
  { icon: <Blocks size={18} />, title: 'Use a system vocabulary', body: 'Client, compute, data, async, and external components are expressed with a consistent visual language so the structure reads faster.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] text-[#16211f]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1160px] px-6 pb-20 pt-28 sm:px-8">
        <div className="grid gap-12 border-b border-[#dfe4df] pb-14 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#4786bf]">About ArchDraw</p>
            <h1 className="max-w-3xl tracking-[-.055em] text-[#16211f]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(3rem, 6vw, 5.4rem)', lineHeight: 0.9 }}>Make the system<br />visible enough to think with.</h1>
          </div>
          <p className="max-w-md text-base leading-8 text-[#65706c]">ArchDraw helps engineers turn a repository, Mermaid diagram, or system description into an editable architecture canvas—so the whole team can see how the pieces fit.</p>
        </div>

        <section className="grid gap-5 py-14 md:grid-cols-3" aria-label="How ArchDraw is designed">
          {principles.map((principle) => <article key={principle.title} className="rounded-xl border border-[#dfe4df] bg-white p-6 shadow-[0_12px_30px_rgba(23,39,35,.04)]">
            <span className="mb-8 grid h-10 w-10 place-items-center rounded-lg bg-[#eaf4ff] text-[#0873db]">{principle.icon}</span>
            <h2 className="text-base font-semibold tracking-tight text-[#16211f]">{principle.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#65706c]">{principle.body}</p>
          </article>)}
        </section>

        <section className="rounded-2xl border border-[#dfe4df] bg-[#f4f8f5] p-7 sm:p-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#4786bf]">The product</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.045em] text-[#16211f]">From generated map to working design surface.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#65706c]">ArchDraw combines AI-assisted generation with a React Flow canvas. You can arrange a diagram, change its direction, work with groups and templates, round-trip Mermaid, and share or export the result when it is ready.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/#generate" className="inline-flex items-center gap-2 rounded-lg bg-[#1686f5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0873db]">Generate a diagram <ArrowRight size={16} /></Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg border border-[#d7ddd8] bg-white px-4 py-2.5 text-sm font-semibold text-[#26332f] transition-colors hover:bg-[#f8faf8]">Read the documentation</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
