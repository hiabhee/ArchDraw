import { LandingBootstrap } from '@/components/landing/LandingBootstrap';
import { LandingCanvasPreview } from './LandingCanvasPreview';
import { LandingInstall } from './LandingInstall';
import { LandingNav } from './LandingNav';
import { Footer } from './Footer';
import styles from './RevampedLanding.module.css';

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://archdraw.hiabhee.online/#application',
      name: 'ArchDraw',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description: 'An editable architecture canvas coding agents can use to map repositories and explain system flows.',
      url: 'https://archdraw.hiabhee.online/',
    },
    {
      '@type': 'HowTo',
      '@id': 'https://archdraw.hiabhee.online/#howto',
      name: 'Connect Codex to ArchDraw',
      description: 'Install ArchDraw MCP tools, ask Codex to map a system, then inspect and edit the diagram.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Install ArchDraw', text: 'Run the setup command in the project you want to map.' },
        { '@type': 'HowToStep', position: 2, name: 'Ask Codex', text: 'Ask Codex to map the repository or trace a request flow.' },
        { '@type': 'HowToStep', position: 3, name: 'Explore the diagram', text: 'Review and edit the architecture map on the canvas.' },
      ],
    },
  ],
};

export default function RevampedLanding() {
  return (
    <div className={styles.landing}>
      <LandingNav tone="dark" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }} />
      <main>
        <section id="install" className={styles.hero}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1>Spaghetti code,<br /><span>made visible.</span></h1>
                <p className={styles.heroLead}>
                  Let Codex map services and trace request flows in an editable diagram.
                </p>
                <LandingInstall />
              </div>
              <div className={styles.heroProduct}>
                <LandingCanvasPreview />
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className={styles.workflow}>
          <div className={styles.shell}>
            <h2>How it works</h2>
            <ol className={styles.workflowSteps}>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>01</span>
                <div className={styles.stepCopy}>
                  <h3>Install ArchDraw</h3>
                  <p>Run one command in the project you want to map.</p>
                </div>
              </li>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>02</span>
                <div className={styles.stepCopy}>
                  <h3>Ask Codex</h3>
                  <p>Map the repository or trace a request flow.</p>
                </div>
              </li>
              <li className={styles.workflowStep}>
                <span className={styles.stepNumber}>03</span>
                <div className={styles.stepCopy}>
                  <h3>Explore the diagram</h3>
                  <p>Review and edit the architecture on the canvas.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className={styles.agentSection} aria-labelledby="agent-section-title">
          <div className={`${styles.shell} ${styles.contentGrid}`}>
            <div>
              <h2 id="agent-section-title">Ask the question you’re stuck on.</h2>
              <p className={styles.sectionLead}>
                Trace a request, map a repository, or find where a service fits—all from your coding agent.
              </p>
            </div>
            <ul className={styles.questionList} aria-label="Example questions for your coding agent">
              <li>Where does checkout go after payment?</li>
              <li>Which services handle sign-in?</li>
              <li>What reads from the database?</li>
            </ul>
          </div>
        </section>

        <section className={styles.canvasSection} aria-labelledby="canvas-section-title">
          <div className={`${styles.shell} ${styles.contentGrid}`}>
            <div>
              <h2 id="canvas-section-title">Keep shaping the answer.</h2>
              <p className={styles.sectionLead}>
                The result is an editable diagram. Refine the services and relationships, then share a clear view with your team.
              </p>
            </div>
            <ul className={styles.canvasList} aria-label="Ways to work with the diagram">
              <li>Move services into a clearer layout</li>
              <li>Group components by system boundary</li>
              <li>Share or export the diagram</li>
            </ul>
          </div>
        </section>
      </main>
      <Footer tone="dark" />
      <LandingBootstrap />
    </div>
  );
}
