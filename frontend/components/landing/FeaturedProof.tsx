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
            <h2 id="featured-proof-heading">The same pipeline, on a real repository.</h2>
            <p>
              ArchDraw maps its own GitHub tree: Next.js canvas, Groq generation path, local MCP server, Dagre layout. Paste the URL. Edit the result.
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
              <dt>Input</dt>
              <dd>github.com/hiabhee/ArchDraw</dd>
            </div>
            <div>
              <dt>What it reads</dt>
              <dd>README, package manifests, app routes, MCP tools</dd>
            </div>
            <div>
              <dt>What you get</dt>
              <dd>An editable canvas, not a static PNG</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
