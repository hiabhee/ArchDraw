import type { Metadata } from 'next';
import RevampedLanding from '@/components/landing/RevampedLanding';

export const metadata: Metadata = {
  title: 'ArchDraw — See your codebase as a system',
  description: 'Turn a GitHub repository, Mermaid, or a prompt into an editable architecture map your team can understand at a glance.',
};

export default function LandingPage() {
  return <RevampedLanding />;
}
