import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connect a coding agent',
  description: 'Pair a coding agent with your ArchDraw project and manage its credentials.',
  robots: { index: false, follow: false },
};

export default function ConnectAgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
