import type { Metadata } from 'next';
import 'reactflow/dist/style.css';

export const metadata: Metadata = {
  title: 'Editor',
  description: 'Draw, generate and arrange system architecture diagrams.',
  robots: { index: false, follow: false },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
