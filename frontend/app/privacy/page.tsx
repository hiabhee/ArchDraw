import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';

export const metadata: Metadata = {
  title: 'Privacy Policy | ArchDraw',
  description: 'Learn what information ArchDraw handles, why it is used, and the controls available for your architecture diagrams.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/privacy' },
  openGraph: {
    type: 'website', url: 'https://archdraw.hiabhee.online/privacy', title: 'Privacy Policy | ArchDraw',
    description: 'How ArchDraw handles account, diagram, and usage information.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Privacy Policy' }],
  },
};

const JSON_LD = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'ArchDraw Privacy Policy', url: 'https://archdraw.hiabhee.online/privacy', description: 'How ArchDraw handles account, diagram, and usage information.' };

const sections = [
  { id: 'scope', title: '1. Scope', content: <>This policy describes how ArchDraw handles information when you use the service at <a href="https://archdraw.hiabhee.online" className="text-[#0873db] underline underline-offset-4">archdraw.hiabhee.online</a>, including the editor, generated diagrams, sharing features, and documentation.</> },
  { id: 'information', title: '2. Information ArchDraw handles', content: <ul className="list-disc space-y-2 pl-5"><li><strong>Account information:</strong> identity details made available by a sign-in provider when you create an account.</li><li><strong>Diagram information:</strong> canvas nodes, edges, labels, settings, and related metadata for diagrams you save.</li><li><strong>Generation inputs:</strong> prompts, Mermaid content, and repository URLs or content needed to create a requested diagram.</li><li><strong>Operational information:</strong> technical and usage data used to operate the service, enforce product limits, and understand product usage.</li></ul> },
  { id: 'use', title: '3. How information is used', content: <ul className="list-disc space-y-2 pl-5"><li>Provide, secure, and maintain the editor and account experience.</li><li>Generate diagrams from the inputs you submit.</li><li>Save diagrams for signed-in users and create share links when requested.</li><li>Measure product activity, prevent abuse, and enforce applicable usage limits.</li></ul> },
  { id: 'storage', title: '4. Storage and sharing', content: <>Signed-in diagrams may be stored so they can be reopened and managed from your account. Guest canvases may be kept in your browser&apos;s local storage. A shared diagram can be viewed by people who have its share link; treat share links as access credentials and only distribute them to intended recipients.</> },
  { id: 'providers', title: '5. Service providers', content: <>ArchDraw may use infrastructure providers for authentication, data storage, analytics, hosting, AI-assisted generation, and repository access. Optional sign-in methods can include Google or GitHub. These providers process information only as needed to provide their part of the service.</> },
  { id: 'choices', title: '6. Your choices', content: <>You can manage your saved canvases in the product and use available export options to take a copy of your work. To ask about access to or deletion of account data, contact <a href="mailto:hello@archdraw.app" className="text-[#0873db] underline underline-offset-4">hello@archdraw.app</a>.</> },
  { id: 'cookies', title: '7. Cookies and similar storage', content: <>ArchDraw uses browser storage and session mechanisms that support sign-in, saved work, and essential product behavior. We do not use advertising cookies in the product experience.</> },
  { id: 'changes', title: '8. Changes and contact', content: <>We may update this policy as the product changes. Material updates will appear on this page with a revised date. For privacy questions, email <a href="mailto:hello@archdraw.app" className="text-[#0873db] underline underline-offset-4">hello@archdraw.app</a>.</> },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fbfcfa] text-[#16211f]">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1040px] px-6 pb-20 pt-28 sm:px-8">
        <div className="border-b border-[#dfe4df] pb-11">
          <span className="mb-5 grid h-10 w-10 place-items-center rounded-lg bg-[#eaf4ff] text-[#0873db]"><ShieldCheck size={20} /></span>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-[#4786bf]">Legal</p>
          <h1 className="mt-3 tracking-[-.055em] text-[#16211f]" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(3rem, 6vw, 5.2rem)', lineHeight: 0.9 }}>Privacy policy</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#65706c]">A plain-language overview of the information ArchDraw handles while helping you map software systems.</p>
          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-[#8b9691]">Last updated: September 18, 2026</p>
        </div>
        <div className="grid gap-12 py-12 lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="hidden lg:block"><nav className="sticky top-20 space-y-1" aria-label="Privacy policy sections">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="block rounded-md px-3 py-1.5 text-xs text-[#65706c] transition-colors hover:bg-white hover:text-[#16211f]">{section.title.slice(3)}</a>)}</nav></aside>
          <article className="max-w-2xl"><div className="space-y-10">{sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28"><h2 className="text-xl font-semibold tracking-[-.025em] text-[#16211f]">{section.title}</h2><div className="policy-copy mt-3 text-sm leading-7 text-[#596560]">{section.content}</div></section>)}</div>
            <div className="mt-12 rounded-xl border border-[#dfe4df] bg-white p-6"><p className="text-sm font-semibold text-[#16211f]">Want to understand how the product works?</p><p className="mt-1 text-sm leading-6 text-[#65706c]">Read the documentation for the editor, diagram generation, sharing, and export.</p><Link href="/docs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0873db]">Visit documentation <ArrowRight size={15} /></Link></div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
