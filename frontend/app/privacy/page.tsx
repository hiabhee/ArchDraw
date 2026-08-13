import type { Metadata } from 'next';
import { Footer } from '@/components/landing/Footer';
import { Navbar } from '@/components/landing/Navbar';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'ArchDraw Privacy Policy — how we collect, use, and protect your data.',
  openGraph: {
    type: 'website',
    url: 'https://archdraw.app/privacy',
    title: 'Privacy Policy — ArchDraw',
    description: 'How ArchDraw collects, uses, and protects your data.',
    images: [{ url: '/api/og/home', width: 1200, height: 630, alt: 'ArchDraw Privacy Policy' }],
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-12">Last updated: March 2026</p>

        <div className="prose prose-slate max-w-none space-y-10 text-slate-700">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Introduction</h2>
            <p>ArchDraw is a visual system architecture design tool. This policy explains how we collect, use, and protect your information when you use our service at archdraw.app.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Email address (when you sign up or use share/download features)</li>
              <li>Auth provider data (name, avatar from Google/GitHub OAuth)</li>
              <li>Diagram data (nodes, edges, canvas structure)</li>
              <li>Usage analytics (page views, feature usage via Vercel Analytics)</li>
              <li>No payment data is collected — ArchDraw is free</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To save and sync your diagrams across devices</li>
              <li>To authenticate and manage your account</li>
              <li>To generate shareable diagram links</li>
              <li>To improve the product based on usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Data Storage</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Stored in Neon (PostgreSQL) hosted on AWS</li>
              <li>Guest data stored in browser localStorage only — never sent to our servers</li>
              <li>Shared diagrams stored for 30 days then auto-deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Third Party Services</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Neon — PostgreSQL database</li>
              <li>Better Auth — authentication</li>
              <li>Vercel — hosting and analytics</li>
              <li>Resend — transactional email delivery</li>
              <li>Google OAuth / GitHub OAuth — optional sign-in providers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Your Rights</h2>
            <p>You may request access to, export of, or deletion of your data at any time. Contact us at <a href="mailto:hello@archdraw.app" className="text-blue-600 hover:underline">hello@archdraw.app</a>.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Cookies</h2>
            <p>We use a single auth session cookie required for login. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Contact</h2>
            <p>Questions? Email us at <a href="mailto:hello@archdraw.app" className="text-blue-600 hover:underline">hello@archdraw.app</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
