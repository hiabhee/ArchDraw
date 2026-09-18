import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { editorGenerateHref, FEATURED_REPO_URL, START_CTA_LABEL } from './cta';
import styles from './RevampedLanding.module.css';

export function FeaturedProof() {
  return (
    <section className={styles.featured} aria-labelledby="featured-proof-heading">
      <div className={styles.shell}>
        <div className={styles.featuredPanel}>
          <div>
            <p className={styles.proofKicker}>From source to shared understanding</p>
            <h2 id="featured-proof-heading">A repository becomes a visual system.</h2>
            <p>
              Bring a repository, a Mermaid graph, or a rough idea. ArchDraw turns the parts and relationships into a canvas your team can inspect, refine, and share.
            </p>
            <Link
              className={styles.primaryAction}
              href={editorGenerateHref(FEATURED_REPO_URL)}
              data-track="proof_generate"
            >
              {START_CTA_LABEL} <ArrowRight size={17} />
            </Link>
          </div>
          <dl>
            <div>
              <dt>Start with</dt>
              <dd>A repository, a prompt, or Mermaid</dd>
            </div>
            <div>
              <dt>It reveals</dt>
              <dd>Boundaries, services, and relationships</dd>
            </div>
            <div>
              <dt>You shape</dt>
              <dd>An editable canvas—not a static PNG</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
