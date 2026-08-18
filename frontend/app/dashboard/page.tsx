import { Suspense } from 'react';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { TEMPLATES } from '@/data/templates/index';


export const metadata = {
  title: 'Dashboard | ArchDraw',
  description: 'Manage your architecture diagrams and templates.',
};

const aiPrompts = [
  'E-commerce System',
  'Real-time Chat',
  'SaaS Platform',
];

export default async function DashboardPage() {
  const layoutedTemplates = TEMPLATES.slice(0, 5);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardClient 
        templates={layoutedTemplates} 
        aiPrompts={aiPrompts} 
      />
    </Suspense>
  );
}
