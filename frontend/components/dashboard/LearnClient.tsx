'use client';

import { useMemo } from 'react';
import { Clock, Compass, GraduationCap, Sparkles } from 'lucide-react';

import type { AnyTutorial } from '@/data/tutorials';
import { TutorialCatalog } from '@/components/tutorial/TutorialCatalog';

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-border bg-surface-panel">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-page text-text-secondary border border-border/60">
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold text-text-primary">{value}</span>
        <span className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

export function LearnClient({ tutorials }: { tutorials: AnyTutorial[] }) {
  const totalMinutes = useMemo(
    () => tutorials.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0),
    [tutorials]
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-panel p-6 md:p-8">
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle, hsl(var(--border) / 0.25) 0.5px, transparent 0.5px)',
            backgroundSize: '18px 18px',
            maskImage:
              'radial-gradient(ellipse at top right, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at top right, black 30%, transparent 75%)',
          }}
        />
        <div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl"
          style={{ background: 'hsl(var(--brand) / 0.08)' }}
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-bg border border-brand/20 text-brand-text text-[10.5px] font-semibold uppercase tracking-wider mb-4">
              <GraduationCap className="w-3 h-3" strokeWidth={2} />
              <span>Learning Library</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary leading-[1.1]">
              Learn system design by{' '}
              <span
                className="italic"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                building
              </span>{' '}
              the architectures
              <br className="hidden md:block" /> that power the world.
            </h2>
            <p className="mt-3 text-sm md:text-[15px] text-text-muted leading-relaxed max-w-xl">
              Interactive, hands-on walkthroughs of the systems behind ChatGPT,
              Netflix, Uber, and more. Build each one component by component.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <StatPill
              icon={Compass}
              value={tutorials.length}
              label="Architectures"
            />
            <StatPill
              icon={Clock}
              value={`${Math.round(totalMinutes / 60)}h`}
              label="Of content"
            />
            <StatPill icon={Sparkles} value="100%" label="Interactive" />
          </div>
        </div>
      </section>

      {/* Shared catalog: search + filters + sort + cards */}
      <TutorialCatalog tutorials={tutorials} />
    </div>
  );
}
