import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import { LandingCursorShine } from './LandingCursorShine';
import { LandingInstall } from './LandingInstall';
import { LandingReveal } from './LandingReveal';
import { LandingScrollStory } from './LandingScrollStory';
import { LandingNav } from './LandingNav';
import { Footer } from './Footer';
import styles from './RevampedLanding.module.css';

const LANDING_FAQS = [
  {
    question: 'Do I need a coding agent to use ArchDraw?',
    answer: 'No. Describe a system or paste a public GitHub URL to start in the browser. Connect an agent only if you want to work with diagrams from your coding workflow.',
  },
  {
    question: 'Can ArchDraw map a private repository?',
    answer: 'The repo diagram flow currently supports public GitHub repositories that ArchDraw can reach over the network.',
  },
  {
    question: 'Can I edit a generated diagram?',
    answer: 'Yes. Generated diagrams open as editable canvases. Move and reconnect nodes, organize components into groups, adjust layout, or edit Mermaid.',
  },
  {
    question: 'What can I export or share?',
    answer: 'Guests can export PNG and JSON. Signed-in accounts add SVG, PDF, HTML embed, and share links.',
  },
  {
    question: 'Which coding agents work with ArchDraw?',
    answer: 'Connect Codex, Claude Code, Cursor, or another MCP-compatible client with the ArchDraw setup guide.',
  },
];

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://archdraw.hiabhee.online/#application',
      name: 'ArchDraw',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description: 'Create and edit architecture diagrams from system descriptions, public GitHub repositories, Mermaid, or coding agents.',
      url: 'https://archdraw.hiabhee.online/',
    },
    {
      '@type': 'HowTo',
      '@id': 'https://archdraw.hiabhee.online/#howto',
      name: 'Create an architecture diagram with ArchDraw',
      description: 'Start with a system idea or public repository, inspect the generated architecture map, and refine it on an editable canvas.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Choose a starting point', text: 'Describe a system or provide a public GitHub repository.' },
        { '@type': 'HowToStep', position: 2, name: 'Generate a map', text: 'ArchDraw builds a graph of components and relationships.' },
        { '@type': 'HowToStep', position: 3, name: 'Refine the canvas', text: 'Review, edit, lay out, and export the diagram.' },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://archdraw.hiabhee.online/#faq',
      mainEntity: LANDING_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};

export default function RevampedLanding() {
  return (
    <LandingCursorShine className={styles.landing}>
      <LandingNav tone="dark" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }} />
      <main>
        <section id="generate" className={styles.hero}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <LandingReveal className={styles.heroCopy} distance={26}>
                <p className={styles.eyebrow}><span aria-hidden="true" /> Architecture diagrams for the way you build</p>
                <h1>See the system<br /><span>behind your code.</span></h1>
                <p className={styles.heroLead}>
                  Map a system idea or public GitHub repo to an editable diagram, in your browser or from your coding agent.
                </p>
              </LandingReveal>
            </div>
            <LandingReveal className={styles.heroProduct} delay={0.12} distance={14}>
              <LandingCanvasPreview />
            </LandingReveal>
          </div>
        </section>

        <LandingScrollStory />

        <section id="features" className={styles.sourcesSection} aria-labelledby="sources-title">
          <LandingReveal className={styles.shell}>
            <div className={styles.sourcesIntro}>
              <p className={styles.sectionEyebrow}>Two ways in</p>
              <h2 id="sources-title">Start with what you already know.</h2>
              <p className={styles.sectionLead}>
                Map a system you are building or get oriented in an existing codebase.
              </p>
            </div>
            <div className={styles.sourceGrid}>
              <article className={styles.sourceBlock}>
                <h3>Describe a system</h3>
                <p>
                  Explain the services and flows in plain language. Add constraints to guide the architecture, then refine the diagram as the design changes.
                </p>
                <Link href="/editor" className={styles.textLink}>
                  Open the canvas <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
              <article className={styles.sourceBlock}>
                <h3>Map a public repository</h3>
                <p>
                  ArchDraw analyzes repository documentation and code relationships to identify components, dependencies, and request paths.
                </p>
                <Link href="/repo-diagram" className={styles.textLink}>
                  See how repo mapping works <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </LandingReveal>
        </section>

        <section className={styles.agentSection} aria-labelledby="agent-section-title">
          <LandingReveal className={`${styles.shell} ${styles.contentGrid}`}>
            <div>
              <p className={styles.sectionEyebrow}>Inside your workflow</p>
              <h2 id="agent-section-title">Ask your coding agent about the system.</h2>
              <p className={styles.sectionLead}>
                Connect ArchDraw to Codex, Claude Code, Cursor, or another MCP-compatible client. The agent can build and update diagrams on your canvas.
              </p>
            </div>
            <ul className={styles.questionList} aria-label="Example questions for your coding agent">
              <li>Where does checkout go after payment?</li>
              <li>Which services handle sign-in?</li>
              <li>What reads from the database?</li>
            </ul>
          </LandingReveal>
        </section>

        <section id="install" className={styles.setupSection} aria-labelledby="setup-title" data-cursor-shine-exclude>
          <LandingReveal className={`${styles.shell} ${styles.setupGrid}`}>
            <div>
              <p className={styles.sectionEyebrow}>For your coding agent</p>
              <h2 id="setup-title">Add architecture tools to your workflow.</h2>
              <p className={styles.sectionLead}>
                The ArchDraw skill helps your agent shape clear diagrams. The MCP server lets it generate, edit, validate, lay out, and export them.
              </p>
              <p className={styles.supportedAgents}>Works with Codex, Claude Code, Cursor, and other MCP-compatible clients.</p>
              <Link href="/mcp" className={styles.textLink}>
                Explore the MCP tools <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <LandingInstall />
              <p className={styles.setupNote}>
                ArchDraw is free during beta. Guest and signed-in limits differ.{' '}
                <Link href="/pricing">See pricing and account limits.</Link>
              </p>
            </div>
          </LandingReveal>
        </section>

        <section id="faq" className={styles.faqSection} aria-labelledby="faq-title">
          <LandingReveal className={styles.shell}>
            <div className={styles.faqIntro}>
              <p className={styles.sectionEyebrow}>Answers before you begin</p>
              <h2 id="faq-title">Good to know before you start</h2>
            </div>
            <div className={styles.faqList}>
              {LANDING_FAQS.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>{faq.question}</summary>
                  <p>
                    {faq.answer}{' '}
                    {faq.question === 'What can I export or share?' && <Link href="/pricing">View pricing.</Link>}
                    {faq.question === 'Which coding agents work with ArchDraw?' && <Link href="/agent-skill">Open the setup guide.</Link>}
                  </p>
                </details>
              ))}
            </div>
          </LandingReveal>
        </section>
      </main>
      <Footer tone="dark" />
      <LandingBootstrap />
    </LandingCursorShine>
  );
}
