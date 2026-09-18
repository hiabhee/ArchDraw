import { ArrowRight, GitBranch, Sparkles, FileCode2, LayoutDashboard, Boxes, Terminal } from 'lucide-react';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import { LandingNav } from './LandingNav';
import { LandingGenerate } from './LandingGenerate';
import { FeaturedProof } from './FeaturedProof';
import { Footer } from './Footer';
import { ScrollTextReveal } from './ScrollTextReveal';
import { START_CTA_HASH, START_CTA_LABEL } from './cta';
import styles from './RevampedLanding.module.css';

const FEATURES = [
  { icon: Sparkles, title: 'Begin with an idea', desc: 'Describe the system you need to reason about, then start with an editable first draft.' },
  { icon: GitBranch, title: 'Read the codebase', desc: 'Turn a repository into a map of the services, paths, and relationships that matter.' },
  { icon: FileCode2, title: 'Keep it portable', desc: 'Move between Mermaid and canvas without losing the structure behind the diagram.' },
  { icon: LayoutDashboard, title: 'Bring order to change', desc: 'Reflow the system as it evolves, so the important connections stay easy to follow.' },
  { icon: Boxes, title: 'Make it your own', desc: 'Start from real architecture patterns, then edit every label, shape, connection, and group.' },
  { icon: Terminal, title: 'Meet your workflow', desc: 'Use the MCP server from the AI tools already beside your editor.' },
];

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'HowTo',
      '@id': 'https://archdraw.hiabhee.online/#howto',
      name: 'How to generate an architecture diagram with ArchDraw',
      description: 'Turn a GitHub repository, Mermaid graph, or plain English prompt into an editable visual system.',
      totalTime: 'PT2M',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Start anywhere', text: 'Paste a repository URL, describe a system, or bring your Mermaid.' },
        { '@type': 'HowToStep', position: 2, name: 'See the system', text: 'ArchDraw organizes the services, boundaries, and connections that matter.' },
        { '@type': 'HowToStep', position: 3, name: 'Shape the story', text: 'Refine the live canvas, then share the diagram behind the decision.' },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': 'https://archdraw.hiabhee.online/#features',
      name: 'ArchDraw Features',
      itemListElement: FEATURES.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: f.title, description: f.desc })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://archdraw.hiabhee.online/' },
        { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://archdraw.hiabhee.online/#features' },
        { '@type': 'ListItem', position: 3, name: 'How it works', item: 'https://archdraw.hiabhee.online/#how-it-works' },
      ],
    },
  ],
};

export default function RevampedLanding() {
  return (
    <div className={styles.landing}>
      <LandingNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }} />
      <main>
        <section id="generate" className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.shell}>
            <div className={styles.heroStage}>
              <div className={styles.heroCopy}>
                <h1><ScrollTextReveal eager>Reimagine your codebase<br />as a <em>visual system.</em></ScrollTextReveal></h1>
                <LandingGenerate />
              </div>
            </div>
            <div className={styles.heroDiagram}>
              <LandingCanvasPreview />
            </div>
          </div>
        </section>

        <FeaturedProof />

        <section id="features" className={styles.features}><div className={styles.shell}>
          <div className={styles.featuresIntro}><p className={styles.eyebrow}><span /> A tool for thinking in systems</p><h2><ScrollTextReveal>More than a first draft.<br /><em>A place to keep thinking.</em></ScrollTextReveal></h2><p>One visual workspace from raw context to the conversation that follows.</p></div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f, index) => (
              <article key={f.title} className={styles.featureCard}>
                <span className={styles.featureNumber} aria-hidden="true">0{index + 1}</span>
                <f.icon size={16} aria-hidden="true" />
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </div></section>

        <section id="how-it-works" className={styles.workflow}><div className={styles.shell}>
          <div className={styles.workflowIntro}><p className={styles.eyebrow}><span /> A canvas, not a screenshot</p><h2><ScrollTextReveal>See the whole system.<br /><em>Then shape the story.</em></ScrollTextReveal></h2></div>
          <ol className={styles.steps}>
            <li><span>01</span><h3>Start anywhere</h3><p>Bring a repository, describe an idea, or import the diagram you already have.</p></li>
            <li><span>02</span><h3>See the system</h3><p>ArchDraw organizes the moving parts into boundaries, services, and relationships.</p></li>
            <li><span>03</span><h3>Design the conversation</h3><p>Edit the details, make the diagram yours, and share the view behind a decision.</p></li>
          </ol>
        </div></section>

        <section className={styles.finalCta}><div className={styles.shell}><p className={styles.eyebrow}><span /> Your next system review starts here</p><h2><ScrollTextReveal>Make the next review<br /><em>unmistakably visual.</em></ScrollTextReveal></h2><a className={styles.primaryAction} href={START_CTA_HASH} data-track="final_cta">{START_CTA_LABEL} <ArrowRight size={17} /></a><p>Free during beta. Your diagram stays editable.</p></div></section>
      </main>
      <Footer />
      <LandingBootstrap />
    </div>
  );
}
