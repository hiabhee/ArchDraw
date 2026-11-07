import type { Metadata } from 'next';
import { Footer } from '@/components/landing/Footer';
import { LandingNav } from '@/components/landing/LandingNav';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'ArchDraw Terms of Service.',
  alternates: { canonical: 'https://archdraw.hiabhee.online/terms' },
  openGraph: {
    type: 'website',
    url: 'https://archdraw.hiabhee.online/terms',
    title: 'Terms of Service — ArchDraw',
    description: 'The terms of service for using ArchDraw.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Terms of Service' }],
  },
};

const CONTACT_EMAIL = 'jamdadeabhishek039@gmail.com';
const link = 'text-brand-text hover:underline';

const SECTIONS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'Acceptance of Terms',
    body: <p>By accessing or using ArchDraw at https://archdraw.hiabhee.online/, including its editor, APIs, MCP server, <code>archdraw-live</code> command and plugins, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>,
  },
  {
    title: 'Accounts and projects',
    body: <p>You can sign in with Google or GitHub and are responsible for activity under your account. Some features, such as live projects created with <code>archdraw-live</code>, work without an account: an unclaimed project is deleted 30 days after its last activity, and anyone holding its claim link can save it to their account. Keep agent tokens, claim links and watch links private.</p>,
  },
  {
    title: 'Use of Service',
    body: <p>ArchDraw is provided for lawful purposes only. You agree not to use it to create, store or share content that is illegal, harmful or infringes the rights of others; not to probe, overload or disrupt the service; not to get around rate limits, quotas or access controls (for example by rotating accounts or addresses); and not to use the API or MCP server to resell or mirror the service. We may limit or end access for violations.</p>,
  },
  {
    title: 'Your Content',
    body: <p>You keep full ownership of the diagrams, prompts and other content you create or submit. You grant ArchDraw a limited licence to store, process and display that content only as needed to run the service, including sending generation inputs to its AI providers and serving shared diagrams to people who have the link. Only submit repositories and content you have the right to use.</p>,
  },
  {
    title: 'Coding-agent integrations',
    body: <p>The ArchDraw plugin and the hooks installed by <code>archdraw-live</code> run on your computer and report file paths, the kind of action, branch names, to-do items and token counts to your project, as described in the <a href="/privacy" className={link}>Privacy Policy</a>. They never send file contents, commands or prompts. You can remove them from your Claude Code settings at any time.</p>,
  },
  {
    title: 'AI-generated output',
    body: <p>Diagrams, component maps and layouts are generated automatically and can be incomplete or wrong. Review them before relying on them for design, security or business decisions.</p>,
  },
  {
    title: 'Public links and retention',
    body: <p>Share, embed, image and watch links can be opened by anyone who has them. Share links expire after about 30 days. Live-project activity and history are kept for a limited time (see the Privacy Policy). Export anything you need to keep.</p>,
  },
  {
    title: 'Free Beta',
    body: <p>ArchDraw is in public beta and free of charge. Features, limits, pricing and availability may change; we will give reasonable notice of significant changes.</p>,
  },
  {
    title: 'Limitation of Liability',
    body: <p>ArchDraw is provided &quot;as is&quot; without warranties of any kind. To the extent the law allows, we are not liable for any loss of data, diagrams or business resulting from use of the service.</p>,
  },
  {
    title: 'Termination',
    body: <p>You can stop using ArchDraw and delete your canvases and projects at any time. We may suspend or end access at any time, with or without notice, including for violations of these terms.</p>,
  },
  {
    title: 'Changes to Terms',
    body: <p>We may update these terms from time to time; the date above shows the latest version. Continued use of ArchDraw after changes means you accept the new terms.</p>,
  },
  {
    title: 'Contact',
    body: <p>Questions about these terms? Email <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a> or open an issue on <a href="https://github.com/hiabhee/ArchDraw/issues" className={link}>GitHub</a>.</p>,
  },
];

export default function TermsPage() {
  return (
    <>
      <LandingNav />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-12">Last updated: November 7, 2026</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-10 text-text-secondary">
          {SECTIONS.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-2xl font-bold text-text-primary mb-3">{index + 1}. {section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
