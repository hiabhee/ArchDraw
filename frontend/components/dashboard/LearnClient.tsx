'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import type { AnyTutorial } from '@/data/tutorials';

function TutorialCard({
  title,
  description,
  difficulty,
  time,
  onClick,
}: {
  title: string;
  description: string;
  difficulty: string;
  time: string;
  onClick: () => void;
}) {
  const getDifficultyColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'beginner') return { bg: 'hsl(142 70% 95%)', color: 'hsl(142 70% 25%)' };
    if (l === 'intermediate') return { bg: 'hsl(25 90% 95%)', color: 'hsl(25 90% 30%)' };
    if (l === 'advanced') return { bg: 'hsl(0 90% 95%)', color: 'hsl(0 90% 35%)' };
    return { bg: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' };
  };

  const colors = getDifficultyColor(difficulty);

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
          📖
        </div>
        <span
          className="px-2.5 py-1 rounded-[8px] text-xs font-medium"
          style={{ background: colors.bg, color: colors.color }}
        >
          {difficulty}
        </span>
      </div>
      <h3 className="font-semibold text-foreground text-lg mb-2">{title}</h3>
      <p className="text-sm mb-3 line-clamp-2 text-muted-foreground">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{time}</span>
        <div className="flex items-center gap-1 text-sm font-medium text-foreground opacity-70">
          Start <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}

export function LearnClient({ tutorials }: { tutorials: AnyTutorial[] }) {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">System Design Tutorials</h2>
        <p className="text-lg text-muted-foreground">Master system design by building real architectures from top tech companies</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tutorials.map((tutorial: AnyTutorial) => {
          const estimatedTime = `${tutorial.estimatedMinutes} mins`;
          
          return (
            <TutorialCard
              key={tutorial.id}
              title={tutorial.title}
              description={tutorial.description}
              difficulty={tutorial.difficulty}
              time={estimatedTime}
              onClick={() => router.push(`/tutorials/${tutorial.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}
