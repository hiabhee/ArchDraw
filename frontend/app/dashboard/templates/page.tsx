import { TemplatesClient } from '@/components/dashboard/TemplatesClient';
import { TEMPLATES } from '@/data/templates/index';

export const metadata = {
  title: 'Your Templates',
  description: 'Start with pre-built system architectures for common use cases.',
};

export default async function TemplatesPage() {
  // Static data, but pre-rendering as a server component for speed
  return (
    <TemplatesClient templates={TEMPLATES} />
  );
}
