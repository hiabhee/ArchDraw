'use client';

import { useMemo, useState } from 'react';
import { Rocket, Search } from 'lucide-react';
import type { AnyTutorial } from '@/data/tutorials';
import type { Difficulty } from '@/lib/tutorial/schema';
import { getTotalStepCount } from '@/lib/tutorial/progress';
import { TutorialCard } from './TutorialCard';

export type CatalogSort = 'recommended' | 'shortest' | 'alphabetical';

type FilterValue = 'all' | Difficulty;

const FILTERS: { value: FilterValue; label: string; dot: string }[] = [
  { value: 'all', label: 'All', dot: 'bg-text-muted' },
  { value: 'beginner', label: 'Beginner', dot: 'bg-emerald-500' },
  { value: 'intermediate', label: 'Intermediate', dot: 'bg-amber-500' },
  { value: 'advanced', label: 'Advanced', dot: 'bg-rose-500' },
];

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'alphabetical', label: 'A–Z' },
];

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export interface TutorialCatalogProps {
  tutorials: AnyTutorial[];
  /** Show the copy-link share action on not-started cards. */
  showShare?: boolean;
}

export function TutorialCatalog({ tutorials, showShare = false }: TutorialCatalogProps) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>('recommended');

  const counts = useMemo(
    () =>
      tutorials.reduce(
        (acc, t) => {
          acc.all += 1;
          acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
          return acc;
        },
        { all: 0, beginner: 0, intermediate: 0, advanced: 0 } as Record<string, number>
      ),
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
    const list = [...filtered];
    switch (sort) {
      case 'shortest':
        list.sort((a, b) => getTotalStepCount(a) - getTotalStepCount(b));
        break;
      case 'alphabetical':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'recommended':
      default:
        // Beginner-first funnel, preserving curated order within each level.
        list.sort(
          (a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]
        );
        break;
    }
    return list;
  }, [filtered, sort]);

  const recommended = useMemo(
    () =>
      tutorials
        .filter((t) => typeof t.recommendedOrder === 'number')
        .sort((a, b) => (a.recommendedOrder ?? 0) - (b.recommendedOrder ?? 0)),
    [tutorials]
  );

  const rest = useMemo(
    () => sorted.filter((t) => typeof t.recommendedOrder !== 'number'),
    [sorted]
  );

  return (
    <div className="space-y-6">
      {/* Toolbar: Search + Filters + Sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border-default bg-surface-panel flex-1 max-w-md focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10 transition-all">
          <Search className="w-4 h-4 text-text-muted shrink-0" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search by name, topic, or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm w-full text-text-primary placeholder:text-text-muted p-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl border border-border-default bg-surface-panel overflow-x-auto">
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

          <div className="flex items-center gap-1 p-1 rounded-xl border border-border-default bg-surface-panel">
            {SORT_OPTIONS.map((o) => {
              const active = sort === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => setSort(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-surface-page text-text-primary border border-border-default'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Start here — curated funnel for new users */}
      {sort === 'recommended' && !query && filter === 'all' && recommended.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-accent/15 text-accent">
                <Rocket className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
              Start here
            </h2>
            <p className="mt-1 text-[12.5px] text-text-muted">
              New to architecture? Work through these in order to learn the
              fundamentals.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {recommended.map((tutorial) => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} showShare={showShare} />
            ))}
          </div>
          {rest.length > 0 && (
            <div className="pt-5 border-t border-border-default">
              <h2 className="text-sm font-semibold text-text-primary">All tutorials</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {rest.map((tutorial) => (
                  <TutorialCard key={tutorial.id} tutorial={tutorial} showShare={showShare} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {!(sort === 'recommended' && !query && filter === 'all' && recommended.length > 0) &&
        (sorted.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sorted.map((tutorial) => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} showShare={showShare} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-dashed border-border-default bg-surface-panel/50">
            <div className="w-12 h-12 rounded-2xl bg-surface-page border border-border-default flex items-center justify-center mb-4 text-text-muted">
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
        ))}
    </div>
  );
}
