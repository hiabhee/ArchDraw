'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';
import {
  ArrowRight,
  Clock,
  Layers,
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  Rocket,
  Compass,
} from 'lucide-react';

import type { AnyTutorial } from '@/data/tutorials';
import type { Difficulty } from '@/lib/tutorial/schema';

type FilterValue = 'all' | Difficulty;

const FILTERS: { value: FilterValue; label: string; dot: string }[] = [
  { value: 'all', label: 'All', dot: 'bg-text-muted' },
  { value: 'beginner', label: 'Beginner', dot: 'bg-emerald-500' },
  { value: 'intermediate', label: 'Intermediate', dot: 'bg-amber-500' },
  { value: 'advanced', label: 'Advanced', dot: 'bg-rose-500' },
];

const ICON_LIB = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (normalized.length !== 6) return `rgba(120,120,120,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDifficultyMeta(level: Difficulty) {
  switch (level) {
    case 'beginner':
      return {
        label: 'Beginner',
        className:
          'text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-400/10',
        dot: 'bg-emerald-500',
      };
    case 'intermediate':
      return {
        label: 'Intermediate',
        className:
          'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-400/10',
        dot: 'bg-amber-500',
      };
    case 'advanced':
      return {
        label: 'Advanced',
        className:
          'text-rose-700 bg-rose-500/10 border-rose-500/20 dark:text-rose-300 dark:bg-rose-400/10',
        dot: 'bg-rose-500',
      };
  }
}

function formatStepCount(steps: number): string {
  if (steps === 1) return '1 step';
  return `${steps} steps`;
}

function TutorialCard({
  tutorial,
  onClick,
}: {
  tutorial: AnyTutorial;
  onClick: () => void;
}) {
  const Icon = tutorial.icon ? ICON_LIB[tutorial.icon] ?? BookOpen : BookOpen;
  const accent = tutorial.color || '#6FA8DC';
  const totalSteps = tutorial.levels.reduce(
    (sum, level) => sum + (level.steps?.length || 0),
    0
  );
  const levelCount = tutorial.levels.length;
  const difficulty = getDifficultyMeta(tutorial.difficulty);
  const tags = (tutorial.tags || []).slice(0, 3);

  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full bg-surface-panel border border-border hover:border-border-strong hover:-translate-y-1"
      style={{
        boxShadow:
          '0 1px 2px hsl(var(--foreground) / 0.04), 0 4px 16px hsl(var(--foreground) / 0.04)',
      }}
    >
      {/* Decorative gradient header */}
      <div
        className="relative h-28 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.04)} 70%, transparent 100%)`,
        }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
            backgroundSize: '14px 14px',
            color: hexToRgba(accent, 0.6),
          }}
        />

        {/* Soft orb */}
        <div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-60"
          style={{ background: hexToRgba(accent, 0.25) }}
        />

        {/* Icon container */}
        <div className="absolute left-5 bottom-[-22px]">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center border border-border bg-surface-panel transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
            style={{
              color: accent,
              boxShadow:
                '0 4px 12px hsl(var(--foreground) / 0.08), 0 1px 2px hsl(var(--foreground) / 0.05)',
            }}
          >
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </div>
        </div>

        {/* Difficulty badge */}
        <div className="absolute top-3.5 right-3.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${difficulty.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${difficulty.dot}`} />
            {difficulty.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-5 pt-7 pb-5">
        <h3 className="font-semibold text-[15px] leading-snug text-text-primary mb-2 line-clamp-2 group-hover:text-brand-text transition-colors">
          {tutorial.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-text-muted line-clamp-2 mb-4">
          {tutorial.description}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-surface-page text-text-secondary border border-border/60"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between text-[11.5px] text-text-muted">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" strokeWidth={1.75} />
              {formatStepCount(totalSteps)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              {tutorial.estimatedMinutes} min
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-text-primary font-semibold opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
            Start
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        </div>
      </div>

      {/* Accent left bar on hover */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"
        style={{ background: accent }}
      />
    </button>
  );
}

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
  const router = useRouter();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    return tutorials.reduce(
      (acc, t) => {
        acc.all += 1;
        acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
        return acc;
      },
      { all: 0, beginner: 0, intermediate: 0, advanced: 0 } as Record<string, number>
    );
  }, [tutorials]);

  const totalMinutes = useMemo(
    () => tutorials.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0),
    [tutorials]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tutorials.filter((t) => {
      if (filter !== 'all' && t.difficulty !== filter) return false;
      if (!q) return true;
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.description.toLowerCase().includes(q)) return true;
      if ((t.tags || []).some((tag) => tag.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [tutorials, filter, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const order: Record<Difficulty, number> = {
        beginner: 0,
        intermediate: 1,
        advanced: 2,
      };
      return order[a.difficulty] - order[b.difficulty];
    });
  }, [filtered]);

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

      {/* Toolbar: Search + Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface-panel flex-1 max-w-md focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 transition-all">
          <Search className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search by name, topic, or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm w-full text-text-primary placeholder:text-text-muted p-0"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-border bg-surface-panel overflow-x-auto">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const count = counts[f.value] || 0;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-text-primary text-surface-panel shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-page'
                }`}
              >
                {f.value !== 'all' && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      active ? 'bg-surface-panel/70' : f.dot
                    }`}
                  />
                )}
                {f.label}
                <span
                  className={`text-[10px] font-semibold tabular-nums ${
                    active ? 'text-surface-panel/70' : 'text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sorted.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              onClick={() => router.push(`/tutorials/${tutorial.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-dashed border-border bg-surface-panel/50">
          <div className="w-12 h-12 rounded-2xl bg-surface-page border border-border flex items-center justify-center mb-4 text-text-muted">
            <Rocket className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            No tutorials found
          </h3>
          <p className="text-[12.5px] text-text-muted max-w-xs">
            Try a different difficulty or search term. We&apos;re adding new
            architectures every week.
          </p>
          <button
            onClick={() => {
              setFilter('all');
              setQuery('');
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-brand-text hover:bg-brand-bg transition-colors cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
