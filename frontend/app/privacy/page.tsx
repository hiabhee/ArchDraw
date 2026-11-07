import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn what information ArchDraw handles, why it is used, and the controls available for your architecture diagrams.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/privacy' },
  openGraph: {
    type: 'website', url: 'https://archdraw.hiabhee.online/privacy', title: 'Privacy Policy | ArchDraw',
    description: 'How ArchDraw handles account, diagram, usage and live-project information.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Privacy Policy' }],
  },
};

const JSON_LD = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'ArchDraw Privacy Policy', url: 'https://archdraw.hiabhee.online/privacy', description: 'How ArchDraw handles account, diagram, usage and live-project information.' };

/** One address for privacy, access and deletion requests (also used in the terms). */
const CONTACT_EMAIL = 'jamdadeabhishek039@gmail.com';
const contactLink = <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-text underline underline-offset-4">{CONTACT_EMAIL}</a>;

const sections = [
  { id: 'scope', title: '1. Scope', content: <>This policy describes how ArchDraw handles information when you use the service at <a href="https://archdraw.hiabhee.online" className="text-brand-text underline underline-offset-4">archdraw.hiabhee.online</a>: the editor, AI diagram generation, repository diagrams, sharing and embeds, live projects (the <code>archdraw-live</code> command and the ArchDraw plugin for coding agents) and the MCP server.</> },
  { id: 'information', title: '2. Information ArchDraw handles', content: <ul className="list-disc space-y-2 pl-5"><li><strong>Account information:</strong> your name, email address and profile image from Google or GitHub when you sign in. Email and password sign-in is not offered.</li><li><strong>Diagrams:</strong> nodes, edges, labels, groups, settings and related metadata for the canvases you save, share or publish through the MCP server.</li><li><strong>Generation inputs:</strong> the prompts, Mermaid code and GitHub repository URLs you submit. For a repository diagram ArchDraw downloads the public repository from GitHub to analyse it.</li><li><strong>Usage information:</strong> pages visited, product events, a random visitor ID, browser type, device type, country (from the hosting network), referrer and campaign parameters. Client IP addresses are used to apply rate limits and quotas.</li></ul> },
  { id: 'live-projects', title: '3. Live projects and coding agents', content: <><p>When you link a repository with <code>archdraw-live</code> or the ArchDraw plugin, hooks run on your computer and report your coding-agent sessions to the project. They send:</p><ul className="mt-3 list-disc space-y-2 pl-5"><li>repository-relative file paths the agent reads or edits, and the kind of action (reading, editing, running a command, waiting for you);</li><li>the repository name, branch name and a session label;</li><li>the agent&apos;s current to-do item (up to 280 characters) when it changes;</li><li>cumulative token counts and the model name, read locally from the session transcript.</li></ul><p className="mt-3">They never send file contents, the commands that are run, or your prompts. Matching a prompt to a component happens on your computer. The component map (component names and the code paths they cover) is drawn by your own coding agent and published to the project.</p><p className="mt-3">A project can be created without an account. It is kept for 30 days after its last activity unless you sign in and claim it.</p></> },
  { id: 'use', title: '4. How information is used', content: <ul className="list-disc space-y-2 pl-5"><li>Provide, secure and maintain the editor, accounts and live projects.</li><li>Generate diagrams from the inputs you submit.</li><li>Save diagrams for signed-in users and create share, embed, preview and watch links when requested.</li><li>Understand how the product is used, prevent abuse and enforce usage limits.</li></ul> },
  { id: 'sharing', title: '5. Sharing and public links', content: <>Anyone with a share, embed or diagram image link can view that diagram. Anyone with a live project&apos;s watch link can see its map and its sessions&apos; names, branches, activity and to-do items, but no file paths, code paths or token usage. Treat these links as access credentials and send them only to the people you mean. Stopping a live project revokes its watch link.</> },
  { id: 'providers', title: '6. Service providers', content: <><p>ArchDraw relies on these providers, which process information only to provide their part of the service:</p><ul className="mt-3 list-disc space-y-2 pl-5"><li><strong>Vercel</strong>: hosting and privacy-friendly page analytics.</li><li><strong>Supabase</strong>: the database for accounts, saved canvases, shares and live projects.</li><li><strong>Upstash</strong>: rate limits, caches and MCP working sessions.</li><li><strong>Groq</strong> (and <strong>OpenRouter</strong> as a fallback): AI models that receive your prompts and repository content to generate diagrams.</li><li><strong>Google and GitHub</strong>: sign-in. GitHub also serves repositories for repository diagrams.</li></ul></> },
  { id: 'retention', title: '7. Retention', content: <ul className="list-disc space-y-2 pl-5"><li>Saved canvases: until you delete them or your account.</li><li>Share links: about 30 days, then deleted automatically.</li><li>Live-project sessions: 7 days. Component history: 30 days. Unclaimed anonymous projects: 30 days after their last activity.</li><li>MCP working sessions: 24 hours. Generated diagrams may be cached for up to 30 minutes.</li><li>Guest canvases and prompt history stay in your browser&apos;s local storage until you clear it.</li></ul> },
  { id: 'choices', title: '8. Your choices', content: <>You can delete canvases, stop a live project (which revokes its agent credentials and watch link) and export your work at any time. Removing the plugin or the hooks from your Claude Code settings stops all activity reports. To access or delete your account data, email {contactLink}.</> },
  { id: 'cookies', title: '9. Cookies and similar storage', content: <>ArchDraw uses a session cookie for sign-in and browser storage for saved work, preferences and an analytics visitor ID. We do not use advertising cookies or sell personal information.</> },
  { id: 'changes', title: '10. Changes and contact', content: <>We may update this policy as the product changes. Material updates will appear on this page with a revised date. For privacy questions, email {contactLink} or open an issue on <a href="https://github.com/hiabhee/ArchDraw/issues" className="text-brand-text underline underline-offset-4">GitHub</a>.</> },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <main className="mx-auto w-full max-w-[1040px] px-6 pb-20 pt-28 sm:px-8">
        <div className="border-b border-border-default pb-11">
          <span className="mb-5 grid h-10 w-10 place-items-center rounded-lg bg-brand-bg text-brand-text"><ShieldCheck size={20} /></span>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-brand-text">Legal</p>
          <h1 className="mt-3 tracking-[-.055em] text-text-primary" style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: 'clamp(3rem, 6vw, 5.2rem)', lineHeight: 0.9 }}>Privacy policy</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary">A plain-language overview of the information ArchDraw handles while helping you map software systems.</p>
          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-text-muted">Last updated: November 7, 2026</p>
        </div>
        <div className="grid gap-12 py-12 lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="hidden lg:block"><nav className="sticky top-20 space-y-1" aria-label="Privacy policy sections">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="block rounded-md px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-card hover:text-text-primary">{section.title.replace(/^\d+\.\s*/, '')}</a>)}</nav></aside>
          <article className="max-w-2xl"><div className="space-y-10">{sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-28"><h2 className="text-xl font-semibold tracking-[-.025em] text-text-primary">{section.title}</h2><div className="policy-copy mt-3 text-sm leading-7 text-text-secondary">{section.content}</div></section>)}</div>
            <div className="mt-12 rounded-xl border border-border-default bg-surface-card p-6"><p className="text-sm font-semibold text-text-primary">Want to understand how the product works?</p><p className="mt-1 text-sm leading-6 text-text-secondary">Read the documentation for the editor, diagram generation, sharing, and export.</p><Link href="/docs" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-text">Visit documentation <ArrowRight size={15} /></Link></div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
