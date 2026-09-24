import type { Metadata } from 'next';
import { JevArchitectureTest } from '@/components/JevArchitectureTest';

export const metadata: Metadata = {
  title: 'Jev Architecture Test',
  description: 'Compare deterministic vs Jev architecture decisions side by side.',
  robots: { index: false, follow: false },
};

export default function JevTestPage() {
  return <JevArchitectureTest />;
}
