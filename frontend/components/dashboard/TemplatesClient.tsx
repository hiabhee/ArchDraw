'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import type { Node, Edge } from 'reactflow';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
}

function TemplateCard({
  name,
  description,
  icon,
  tags,
  onClick,
}: {
  name: string;
  description: string;
  icon: string;
  tags: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-5 rounded-[20px] text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      style={{ background: 'var(--surface-panel)', border: '1px solid var(--border-default)', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl"
          style={{ background: 'linear-gradient(135deg, #595959, #8A8A8A)' }}
        >
          {icon}
        </div>
      </div>
      <h3 className="font-semibold text-foreground text-lg mb-2">{name}</h3>
      <p className="text-sm mb-3 line-clamp-2 text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-[6px] text-xs bg-muted text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm font-medium text-foreground opacity-70">
        Use Template <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
}

export function TemplatesClient({ templates }: { templates: Template[] }) {
  const router = useRouter();

  const handleUseTemplate = (templateId: string) => {
    router.push(`/editor?template=${templateId}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Architecture Templates</h2>
        <p className="text-lg text-muted-foreground">Start with pre-built system architectures for common use cases</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            name={template.name}
            description={template.description}
            icon={template.icon}
            tags={template.tags}
            onClick={() => handleUseTemplate(template.id)}
          />
        ))}
      </div>
    </div>
  );
}
