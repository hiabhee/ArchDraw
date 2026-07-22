import type { Metadata } from 'next';
import { Footer } from '@/components/landing/Footer';
import { Navbar } from '@/components/landing/Navbar';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'ArchDraw Terms of Service.',
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-12">Last updated: March 2026</p>

        <div className="prose prose-slate max-w-none space-y-10 text-slate-700">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using ArchDraw at archdraw.app, you agree to be bound by these Terms of Service. If you do not agree, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">2. Use of Service</h2>
            <p>ArchDraw is provided for lawful purposes only. You agree not to use the service to create, store, or share content that is illegal, harmful, or infringes on the rights of others. We reserve the right to terminate access for violations.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">3. User Content</h2>
            <p>You retain full ownership of all diagrams and content you create using ArchDraw. By using the share feature, you grant ArchDraw a limited license to store and serve that content to recipients of your share link.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">4. Free Beta</h2>
            <p>ArchDraw is currently in public beta and provided free of charge. Features, pricing, and availability may change. We will provide reasonable notice of any significant changes.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">5. Limitation of Liability</h2>
            <p>ArchDraw is provided &quot;as is&quot; without warranties of any kind. We are not liable for any loss of data, diagrams, or business resulting from use of the service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">6. Termination</h2>
            <p>We reserve the right to suspend or terminate access to ArchDraw at any time, with or without notice, for any reason including violation of these terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">7. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of ArchDraw after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">8. Contact</h2>
            <p>Questions about these terms? Email <a href="mailto:hello@archdraw.app" className="text-blue-600 hover:underline">hello@archdraw.app</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
