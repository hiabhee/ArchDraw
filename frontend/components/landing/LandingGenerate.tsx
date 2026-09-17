'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { coerceGitHubRepoInput } from '@/lib/utils/githubUrl';
import { editorGenerateHref, FEATURED_REPO_URL, START_CTA_LABEL } from './cta';
import styles from './RevampedLanding.module.css';

const EXAMPLES = [
  { label: 'hiabhee/ArchDraw', value: FEATURED_REPO_URL },
  { label: 'Ride-sharing with dispatch', value: 'Ride-sharing app with payments, dispatch, and live location' },
  { label: 'nestjs/nest', value: 'https://github.com/nestjs/nest' },
] as const;

export function LandingGenerate() {
  const router = useRouter();
  const [value, setValue] = useState('');

  function submit(raw: string) {
    const next = coerceGitHubRepoInput(raw);
    if (!next) return;
    router.push(editorGenerateHref(next));
  }

  return (
    <div className={styles.generate}>
      <form
        className={styles.generateForm}
        action="/editor"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <label className={styles.generateLabel} htmlFor="landing-generate-input">
          GitHub URL or system description
        </label>
        <div className={styles.generateRow}>
          <input
            id="landing-generate-input"
            name="generate"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://github.com/owner/repo or describe a system"
          />
          <button
            className={styles.primaryAction}
            type="submit"
            data-track="hero_generate"
            disabled={!value.trim()}
          >
            {START_CTA_LABEL} <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <div className={styles.generateChips}>
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            className={styles.generateChip}
            onClick={() => {
              setValue(example.value);
              submit(example.value);
            }}
          >
            {example.label}
          </button>
        ))}
      </div>
      <p className={styles.reassurance}>Free during beta. No credit card. Every diagram stays editable.</p>
    </div>
  );
}
