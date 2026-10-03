import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import { LandingGenerate } from './LandingGenerate';
import { LandingInstall } from './LandingInstall';
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
    <div className={styles.landing}>
      <LandingNav tone="dark" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }} />
      <main>
        <section id="generate" className={styles.hero}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1>See the system<br /><span>behind your code.</span></h1>
                <p className={styles.heroLead}>
                  Map a system idea or public GitHub repo to an editable diagram, in your browser or from your coding agent.
                </p>
                <LandingGenerate />
              </div>
              <div className={styles.heroProduct}>
                <LandingCanvasPreview />
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className={styles.workflow}>
          <div className={styles.shell}>
            <h2>From starting point to system map</h2>
            <ol className={styles.workflowSteps}>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>01</span>
                <div className={styles.stepCopy}>
                  <h3>Choose what to map</h3>
                  <p>Describe a new system or paste a public GitHub repository.</p>
                </div>
              </li>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>02</span>
                <div className={styles.stepCopy}>
                  <h3>Review the architecture</h3>
                  <p>See components, boundaries, and the relationships between them.</p>
                </div>
              </li>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>03</span>
                <div className={styles.stepCopy}>
                  <h3>Refine and share</h3>
                  <p>Edit the canvas, adjust its layout, and export the view you need.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section id="features" className={styles.sourcesSection} aria-labelledby="sources-title">
          <div className={styles.shell}>
            <div className={styles.sourcesIntro}>
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
          </div>
        </section>

        <section className={styles.capabilitySection} aria-labelledby="canvas-section-title">
          <div className={styles.shell}>
            <div className={styles.capabilityIntro}>
              <h2 id="canvas-section-title">A working diagram, not a screenshot.</h2>
              <p className={styles.sectionLead}>
                Keep exploring after generation. The graph, source, and layout stay available to edit.
              </p>
            </div>
            <ul className={styles.capabilityList}>
              <li>
                <h3>Edit the graph</h3>
                <p>Move services, reconnect dependencies, and group components by system boundary.</p>
              </li>
              <li>
                <h3>Work with Mermaid</h3>
                <p>Import or edit Mermaid and see the changes reflected on the visual canvas.</p>
              </li>
              <li>
                <h3>Clarify the layout</h3>
                <p>Rearrange the graph with horizontal or vertical auto-layout.</p>
              </li>
              <li>
                <h3>Share or export</h3>
                <p>Export PNG or JSON. Sign in to share diagrams or export SVG, PDF, and HTML embed.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.agentSection} aria-labelledby="agent-section-title">
          <div className={`${styles.shell} ${styles.contentGrid}`}>
            <div>
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
          </div>
        </section>

        <section id="install" className={styles.setupSection} aria-labelledby="setup-title">
          <div className={`${styles.shell} ${styles.setupGrid}`}>
            <div>
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
          </div>
        </section>

        <section id="faq" className={styles.faqSection} aria-labelledby="faq-title">
          <div className={styles.shell}>
            <div className={styles.faqIntro}>
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
          </div>
        </section>
      </main>
      <Footer tone="dark" />
      <LandingBootstrap />
    </div>
  );
}
