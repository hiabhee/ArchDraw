import Link from 'next/link';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingReveal } from '@/components/landing/LandingReveal';
import { Footer } from '@/components/landing/Footer';
import { LiveMapHero } from './LiveMapHero';
import { buildHeroGraphs } from './heroGraph';
import { CopyCommand } from './CopyCommand';
import { HeadlineWire } from './HeadlineWire';
import { HeroSouvenirs } from './HeroSouvenirs';
import { PlayOnView } from './PlayOnView';
import { MorphingTabs, Parallax, ScrollProgress, ScrollSteps, ScrollTilt, WordRise } from './ScrollFx';
import {
  AimVignette, ConstructionVignette, CoverageVignette, LevelsVignette, NeedsYouVignette, WatchLinkVignette,
} from './Vignettes';
import styles from './LiveLanding.module.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const body = Geist({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const LIVE_FAQS = [
  {
    question: 'Is it free? Do I need an account?',
    answer: 'It is free, and you don’t need an account to start. Sign in with Google or GitHub to keep a project and edit its diagram; you can keep two. Projects nobody saves are deleted after 30 days without activity.',
  },
  {
    question: 'Does it work on private repositories?',
    answer: 'Yes. The scan and the mapping run on your machine, so the code never has to be public. ArchDraw only receives component names, folder paths and which files each session touches.',
  },
  {
    question: 'Which coding agents does it follow?',
    answer: 'Claude Code, through its hooks. Every session started in a connected repository appears on the map, including sessions in git worktrees of that repository.',
  },
  {
    question: 'Does mapping use my Claude plan?',
    answer: 'Yes. The map is drawn by your own Claude Code with read-only tools (Read, Grep, Glob). The overview takes one to three minutes, the detailed map a little longer. You can skip it and keep the folder-based map.',
  },
  {
    question: 'Will it slow my agents down?',
    answer: 'No. Each report is a few file paths sent from a background process, so a slow network never blocks a session.',
  },
  {
    question: 'How do I disconnect a repository?',
    answer: 'Run npx archdraw-live stop in it. Sessions there stop reporting right away.',
  },
];

const FEATURES = [
  {
    title: 'Who needs you, in order',
    body: 'Permission requests first, longest wait first. The terminal tab says it too, and browser notifications are one click away.',
    art: <NeedsYouVignette />,
    wide: true,
  },
  {
    title: 'New code shows up before the map does',
    body: 'When an agent writes code no component owns, a dashed site appears next to the closest one. Update the map and it becomes a real box.',
    art: <ConstructionVignette />,
  },
  {
    title: 'Overview, then the detail',
    body: 'A one-screen overview of how the system works. Switch to Detailed to open every component into its modules and files.',
    art: <LevelsVignette />,
  },
  {
    title: 'See where a task is headed',
    body: 'Send a prompt and the session’s star points at the part of the system it’s about. The prompt is matched on your machine and never sent.',
    art: <AimVignette />,
  },
  {
    title: 'Share it live',
    body: 'Send a read-only live map to a teammate or a client. They watch without signing in.',
    art: <WatchLinkVignette />,
  },
  {
    title: 'Know when the map drifts',
    body: 'Edits outside the map lower its coverage, so you know when it’s time to ask Claude to re-map.',
    art: <CoverageVignette />,
    wide: true,
  },
];

const TERMINAL: { text: string; kind?: 'cmd' | 'ok' | 'dim' | 'ask' | 'bold' }[] = [
  { text: '~/code/acme-shop $ npx archdraw-live', kind: 'cmd' },
  { text: 'Setting up a live map for acme-shop…' },
  { text: '✓ Mapped 9 components and 3 services from 412 files (on this machine)', kind: 'ok' },
  { text: '✓ Project created (link saved in ~/.archdraw/projects.json, outside your repo)', kind: 'ok' },
  { text: '✓ Claude Code connected (hooks in ~/.claude/settings.json)', kind: 'ok' },
  { text: 'Let Claude read your code and draw an accurate map? [Y/n] y', kind: 'ask' },
  { text: 'Claude is reading your code (read-only) to draw the map.', kind: 'dim' },
  { text: '✓ Claude mapped 14 components (the live map has updated)', kind: 'ok' },
  { text: '✓ Detailed map: 46 parts (switch to "Detailed" at the top of the live map)', kind: 'ok' },
  { text: 'Next: start Claude Code in this folder (run claude).', kind: 'bold' },
];

const STEPS = [
  {
    n: '01',
    title: 'Run one command in your repo',
    body: 'It reads folder names and imports on your machine, sends only names and paths, connects Claude Code and opens your live map. No account, no config file.',
  },
  {
    n: '02',
    title: 'Let Claude draw the real map',
    body: 'Say yes and your own Claude Code reads the repository, read-only. The overview lands in one to three minutes; the detailed map follows.',
  },
  {
    n: '03',
    title: 'Start your sessions',
    body: 'Each new Claude Code session in the repo appears as a named star and walks to the code it is working on. Run as many as you like.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://archdraw.hiabhee.online/#application',
      name: 'ArchDraw',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'A live map of your codebase that shows where each Claude Code session is working, and which one needs you.',
      url: 'https://archdraw.hiabhee.online/',
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://archdraw.hiabhee.online/#faq',
      mainEntity: LIVE_FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
};

export default async function LiveLanding() {
  const heroGraphs = await buildHeroGraphs();
  return (
    <div className={`${styles.landing} ${display.variable} ${body.variable} ${mono.variable}`}>
      <LandingNav tone="dark" />
      <ScrollProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section id="start" className={styles.hero} aria-labelledby="hero-title">
          <Parallax speed={-90} className={styles.skyLayer}><div className={styles.sky} aria-hidden="true" /></Parallax>
          <div className={`${styles.shell} ${styles.heroFold}`}>
            <LandingReveal className={styles.heroTop} distance={18}>
              <p className={styles.eyebrow}><span className={styles.liveDot} /> Live maps for Claude Code · free, no account</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Six agents are coding.{' '}
                <em>
                  {/* The question, drawn as a selected node on the canvas. */}
                  <span className={styles.selected} data-wire-from>
                    Which one needs you?
                    <i className={styles.handle} data-at="tl" aria-hidden="true" />
                    <i className={styles.handle} data-at="tr" aria-hidden="true" />
                    <i className={styles.handle} data-at="bl" aria-hidden="true" />
                    <i className={styles.handle} data-at="br" aria-hidden="true" />
                    <span className={styles.selTag} aria-hidden="true"><i /> Otter · needs you</span>
                  </span>
                </em>
              </h1>
              <div className={styles.heroAside}>
                <p className={styles.heroLead}>
                  A live map of your codebase with every Claude Code session on it.
                </p>
                <div className={styles.ctaRow}>
                  <span data-wire-to><CopyCommand size="lg" track="landing_copy_hero" /></span>
                </div>
                <p className={styles.fineprint}>
                  No credit card required.<br />
                  Only file names and paths leave your machine.<br />
                  Or <Link href="/editor" className={styles.fineprintLink} data-track="landing_hero_editor">draw a diagram in the browser →</Link>
                </p>
              </div>
              <HeadlineWire />
            </LandingReveal>
          </div>
          <LandingReveal className={styles.heroStage} amount={0.02} duration={0.4} blur={false} distance={24}>
            <Parallax speed={36} className={styles.shelfLayer}><HeroSouvenirs /></Parallax>
            <ScrollTilt><LiveMapHero graphs={heroGraphs} /></ScrollTilt>
            <ul className={styles.legend} aria-label="How to read the map">
              <li><span className={styles.lgStar} /> working</li>
              <li><span className={styles.lgHollow} /> heading there</li>
              <li><span className={styles.lgFlag} data-tone="attention" /> needs permission</li>
              <li><span className={styles.lgFlag} /> finished, your turn</li>
              <li><span className={styles.lgPlot} /> new code, not on the map yet</li>
            </ul>
          </LandingReveal>
        </section>

        {/* ── Problem ──────────────────────────────────────── */}
        <section className={styles.problem} aria-labelledby="problem-title">
          <LandingReveal className={`${styles.shell} ${styles.split}`}>
            <div>
              <p className={styles.kicker}>The problem</p>
              <h2 id="problem-title" className={styles.h2}>Parallel agents.<br /><em>Serial attention.</em></h2>
            </div>
            <div className={styles.problemBody}>
              <p className={styles.lead}>
                You started six sessions to go faster. Then you spent the afternoon cycling through tabs, looking for the one
                that has been waiting eleven minutes for a yes.
              </p>
              <MorphingTabs
                tabs={[
                  { before: 'claude', after: 'Otter needs you', tone: 'attention' },
                  { before: 'claude', after: 'Fox · your turn', tone: 'done', color: '#ec4899' },
                  { before: 'claude', after: 'Owl' },
                  { before: 'claude', after: 'Lynx' },
                  { before: 'claude', after: 'Heron' },
                  { before: 'claude', after: 'Gecko' },
                ]}
              />
              <p className={styles.note}>Every session gets a name, a star on the map and a terminal title that tells you when it’s blocked.</p>
            </div>
          </LandingReveal>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section id="how" className={styles.how} aria-labelledby="how-title">
          <div className={styles.shell}>
            <LandingReveal className={styles.sectionHead}>
              <p className={styles.kicker}>How it works</p>
              <h2 id="how-title" className={styles.h2}>Three minutes to <em>a live map.</em></h2>
            </LandingReveal>
            <div className={styles.howGrid}>
              <ScrollSteps steps={STEPS} />
              <PlayOnView className={styles.terminal}>
                <div className={styles.terminalBar} aria-hidden="true"><i /><i /><i /><span>zsh — acme-shop</span></div>
                <pre className={styles.terminalBody} aria-label="Example output of npx archdraw-live">
                  {TERMINAL.map((line, i) => (
                    <span key={i} className={styles.tLine} data-kind={line.kind} style={{ animationDelay: `${0.25 + i * 0.32}s` }}>
                      {line.text}
                      {'\n'}
                    </span>
                  ))}
                  <span className={styles.cursor} style={{ animationDelay: `${0.25 + TERMINAL.length * 0.32}s` }} aria-hidden="true" />
                </pre>
              </PlayOnView>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section id="features" className={styles.features} aria-labelledby="features-title">
          <div className={styles.shell}>
            <LandingReveal className={styles.sectionHead}>
              <p className={styles.kicker}>On the map</p>
              <h2 id="features-title" className={styles.h2}>Everything a glance<br /><em>should tell you.</em></h2>
            </LandingReveal>
            <div className={styles.bento}>
              {FEATURES.map((feature, i) => (
                <LandingReveal key={feature.title} delay={(i % 3) * 0.06} className={feature.wide ? styles.cellWide : styles.cell}>
                  <article className={styles.card}>
                    <div className={styles.art}>{feature.art}</div>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </article>
                </LandingReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Privacy ──────────────────────────────────────── */}
        <section id="privacy" className={styles.privacy} aria-labelledby="privacy-title">
          <LandingReveal className={styles.shell}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>What leaves your machine</p>
              <h2 id="privacy-title" className={styles.h2}>Paths, <em>never code.</em></h2>
            </div>
            <div className={styles.ledger}>
              <div className={styles.ledgerCol}>
                <h3><span className={styles.ledgerMark} data-tone="sent" /> Sent to ArchDraw</h3>
                <ul>
                  <li>Component names and the folders they own</li>
                  <li>Which files each session reads or edits</li>
                  <li>Session status: working, waiting, done</li>
                </ul>
              </div>
              <div className={styles.ledgerCol}>
                <h3><span className={styles.ledgerMark} data-tone="kept" /> Stays on your machine</h3>
                <ul>
                  <li>File contents and diffs</li>
                  <li>Your prompts, matched to the map locally</li>
                  <li>Your agent token, kept in <code>~/.archdraw</code>, outside the repo and out of Claude’s context</li>
                </ul>
              </div>
              <div className={styles.ledgerProof}>
                <p>Don’t take our word for it.</p>
                <code className={styles.inlineCmd}><span>$</span> npx archdraw-live --dry-run</code>
                <p className={styles.ledgerSmall}>prints exactly what would be sent, and sends nothing.</p>
                <code className={styles.inlineCmd}><span>$</span> npx archdraw-live stop</code>
                <p className={styles.ledgerSmall}>disconnects the repo.</p>
              </div>
            </div>
          </LandingReveal>
        </section>

        {/* ── Who it's for ─────────────────────────────────── */}
        <section className={styles.who} aria-labelledby="who-title">
          <LandingReveal className={styles.shell}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>Made for</p>
              <h2 id="who-title" className={styles.h2}>However you <em>build with agents.</em></h2>
            </div>
            <div className={styles.whoGrid}>
              <article>
                <span className={styles.whoIndex}>i.</span>
                <h3>You run agents in parallel</h3>
                <p>Five sessions, three worktrees, one screen. See all of them at once and answer the one that’s blocked first.</p>
              </article>
              <article>
                <span className={styles.whoIndex}>ii.</span>
                <h3>You build by prompting</h3>
                <p>You don’t read every diff. The map shows what is being built and where, in boxes and arrows you can follow.</p>
              </article>
              <article>
                <span className={styles.whoIndex}>iii.</span>
                <h3>You’re new to a codebase</h3>
                <p>A real architecture map in minutes, drawn from the code, with every box tied to the files it owns.</p>
              </article>
            </div>
          </LandingReveal>
        </section>

        {/* ── FAQ ──────────────────────────────────────────── */}
        <section id="faq" className={styles.faq} aria-labelledby="faq-title">
          <LandingReveal className={`${styles.shell} ${styles.split}`}>
            <div>
              <p className={styles.kicker}>Questions</p>
              <h2 id="faq-title" className={styles.h2}>Good to know.</h2>
              <p className={styles.faqAside}>
                Need a diagram rather than a live map?{' '}
                <Link href="/editor" data-track="landing_open_editor">Describe a system</Link>,{' '}
                <Link href="/repo-diagram">map a public repo</Link> or{' '}
                <Link href="/mcp">draw from your agent</Link>.
              </p>
            </div>
            <div className={styles.faqList}>
              {LIVE_FAQS.map((faq) => (
                <details key={faq.question} className={styles.faqItem}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </LandingReveal>
        </section>

        {/* ── Final call ───────────────────────────────────── */}
        <section className={styles.final} aria-labelledby="final-title">
          <Parallax speed={-70} className={styles.skyLayer}><div className={styles.sky} aria-hidden="true" /></Parallax>
          <div className={`${styles.shell} ${styles.finalInner}`}>
            <h2 id="final-title" className={styles.finalTitle}><WordRise text="Open the map." /><br /><WordRise text="" italic="Then start the agents." /></h2>
            <CopyCommand size="lg" track="landing_copy_final" />
            <p className={styles.fineprint}>
              Free. No account to start. Needs Node 18 or later and Claude Code.
            </p>
          </div>
        </section>
      </main>
      <Footer tone="dark" />
      <LandingBootstrap />
    </div>
  );
}
