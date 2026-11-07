import { LearnClient } from '@/components/dashboard/LearnClient';
import { TUTORIALS } from '@/data/tutorials';

export const metadata = {
  title: 'Learn System Design',
  description: 'Master system design by building real architectures from top tech companies.',
};

export default async function LearnPage() {
  // Pre-rendering tutorials as a server component
  return (
    <LearnClient tutorials={TUTORIALS} />
  );
}
