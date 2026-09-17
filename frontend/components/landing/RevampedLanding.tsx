import { ArrowRight, GitBranch, Sparkles, FileCode2, LayoutDashboard, Boxes, Terminal } from 'lucide-react';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import { LandingNav } from './LandingNav';
import { LandingGenerate } from './LandingGenerate';
import { FeaturedProof } from './FeaturedProof';
import { Footer } from './Footer';
import { START_CTA_HASH, START_CTA_LABEL } from './cta';
import styles from './RevampedLanding.module.css';

const FEATURES = [
  { icon: Sparkles, title: 'Prompt → Diagram', desc: 'Describe in plain English. Tiers stay ordered, edges flow left→right, no star topology.' },
  { icon: GitBranch, title: 'Repo → Diagram', desc: 'Paste a GitHub URL. We ingest, classify, and map real dependencies.' },
  { icon: FileCode2, title: 'Mermaid round-trip', desc: 'Import or export graph LR/TD with subgraphs. Shapes survive the trip.' },
  { icon: LayoutDashboard, title: 'Auto-layout', desc: 'Mermaid → Dagre. One Dagre path for toolbar, templates, and generation.' },
  { icon: Boxes, title: 'Templates & Tutorials', desc: 'E-commerce, RAG, ride-share — start from something real.' },
  { icon: Terminal, title: 'MCP — run locally', desc: 'Claude / Cursor / opencode drive the canvas via stdio JSON-RPC: generate, update, validate, fix-layout, export.' },
];

function BrandMark() {
  return <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>;
}

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'HowTo',
      '@id': 'https://archdraw.hiabhee.online/#howto',
      name: 'How to generate an architecture diagram with ArchDraw',
      description: 'Turn a GitHub repository, Mermaid, or plain English prompt into an editable architecture diagram.',
      totalTime: 'PT2M',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Give it context', text: 'Paste a repository URL, describe a system, or bring your Mermaid.' },
        { '@type': 'HowToStep', position: 2, name: 'Find the shape', text: 'ArchDraw maps services, boundaries, and the connections that matter.' },
        { '@type': 'HowToStep', position: 3, name: 'Make it yours', text: 'Refine the live canvas, then share the diagram behind the decision.' },
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
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span /> Architecture, made legible</p>
              <h1>See your codebase<br />as a <em>system.</em></h1>
              <p className={styles.intro}>Paste a GitHub URL or describe a system. Get an editable architecture map.</p>
              <LandingGenerate />
            </div>
            <div className={styles.heroDiagram}><LandingCanvasPreview /></div>
          </div>
        </section>

        <FeaturedProof />

        <section id="features" className={styles.features}><div className={styles.shell}>
          <div className={styles.featuresIntro}><p className={styles.eyebrow}><span /> What you can do</p><h2>Every step, <em>not just the first.</em></h2><p>The same canvas from prompt to handoff — no tool switching.</p></div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <f.icon size={16} />
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div></section>

        <section id="how-it-works" className={styles.workflow}><div className={styles.shell}>
          <div className={styles.workflowIntro}><p className={styles.eyebrow}><span /> A faster first draft</p><h2>Less box-drawing.<br /><em>More clarity.</em></h2></div>
          <ol className={styles.steps}>
            <li><span>01</span><strong>Give it context</strong><p>Paste a repository URL, describe a system, or bring your Mermaid.</p></li>
            <li><span>02</span><strong>Find the shape</strong><p>ArchDraw maps services, boundaries, and the connections that matter.</p></li>
            <li><span>03</span><strong>Make it yours</strong><p>Refine the live canvas, then share the diagram behind the decision.</p></li>
          </ol>
        </div></section>

        <section className={styles.finalCta}><div className={styles.shell}><p className={styles.eyebrow}><span /> Your next system review starts here</p><h2>Make the invisible<br /><em>easy to discuss.</em></h2><a className={styles.primaryAction} href={START_CTA_HASH} data-track="final_cta">{START_CTA_LABEL} <ArrowRight size={17} /></a><p>Free during beta. Your diagram stays editable.</p></div></section>
      </main>
      <Footer />
      <LandingBootstrap />
    </div>
  );
}
