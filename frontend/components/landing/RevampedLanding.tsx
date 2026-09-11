import { ArrowRight, Check, GitBranch, Github, Sparkles } from 'lucide-react';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import styles from './RevampedLanding.module.css';

function BrandMark() {
  return <span className={styles.brandMark} aria-hidden="true"><i /><i /><i /></span>;
}

function Header() {
  return <header className={styles.header}><div className={styles.shell}>
    <a className={styles.logo} href="/" aria-label="ArchDraw home"><BrandMark /> ArchDraw</a>
    <nav className={styles.nav} aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="/docs">Docs</a><a href="/dashboard">Sign in</a></nav>
    <a className={styles.navAction} href="/dashboard">Map your codebase <ArrowRight size={15} /></a>
  </div></header>;
}

export default function RevampedLanding() {
  return (
    <div className={styles.landing}>
      <Header />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.shell}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span /> Architecture, made legible</p>
              <h1>See your codebase<br />as a <em>system.</em></h1>
              <p className={styles.intro}>Turn a GitHub repository, a prompt, or Mermaid into an architecture map your team can understand at a glance.</p>
              <div className={styles.heroActions}><a className={styles.primaryAction} href="/dashboard">Map your codebase <ArrowRight size={17} /></a><a className={styles.textAction} href="#how-it-works">See how it works <ArrowRight size={15} /></a></div>
              <p className={styles.reassurance}><Check size={14} /> Free to start <span>·</span> No credit card <span>·</span> Edit every detail</p>
            </div>
            <div className={styles.heroDiagram}><LandingCanvasPreview /></div>
          </div>
          <div className={`${styles.shell} ${styles.heroMeta}`}><span>FROM REPOSITORY</span><i /><span>TO SHARED CONTEXT</span></div>
        </section>

        <section className={styles.proof} aria-label="Supported starting points"><div className={styles.shell}><p>Start wherever the architecture already lives</p><div><span><Github size={16} /> GitHub repository</span><span><GitBranch size={16} /> Mermaid</span><span><Sparkles size={16} /> Plain English</span></div></div></section>

        <section id="how-it-works" className={styles.workflow}><div className={styles.shell}>
          <div className={styles.workflowIntro}><p className={styles.eyebrow}><span /> A faster first draft</p><h2>Less box-drawing.<br /><em>More clarity.</em></h2></div>
          <ol className={styles.steps}>
            <li><span>01</span><strong>Give it context</strong><p>Paste a repository URL, describe a system, or bring your Mermaid.</p></li>
            <li><span>02</span><strong>Find the shape</strong><p>ArchDraw maps services, boundaries, and the connections that matter.</p></li>
            <li><span>03</span><strong>Make it yours</strong><p>Refine the live canvas, then share the diagram behind the decision.</p></li>
          </ol>
        </div></section>

        <section className={styles.finalCta}><div className={styles.shell}><p className={styles.eyebrow}><span /> Your next system review starts here</p><h2>Make the invisible<br /><em>easy to discuss.</em></h2><a className={styles.primaryAction} href="/dashboard">Map your codebase <ArrowRight size={17} /></a><p>Free during beta. Your diagram stays editable.</p></div></section>
      </main>
      <footer className={styles.footer}><div className={styles.shell}><a className={styles.logo} href="/"><BrandMark /> ArchDraw</a><span>Architecture diagrams for people who think in systems.</span><div><a href="/docs">Docs</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div></footer>
      <LandingBootstrap />
    </div>
  );
}
