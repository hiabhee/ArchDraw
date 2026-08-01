'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  Globe2,
  GitBranch,
  Target,
  Tag,
  BookOpen,
  MousePointerClick,
  CircleDot,
} from 'lucide-react';
import type { NodeDetailsInfo } from './TutorialCanvas';

interface NodeDetailsPanelProps {
  info: NodeDetailsInfo | null;
  onClose: () => void;
}

function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(120, 120, 120, ${alpha})`;
  const clean = hex.replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (normalized.length !== 6) return `rgba(120, 120, 120, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function Section({
  icon: Icon,
  label,
  accent,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span style={{ color: accent, display: 'inline-flex' }}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <span
          className="text-[10.5px] font-semibold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      <div className="text-[12.5px] leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}

export function NodeDetailsPanel({ info, onClose }: NodeDetailsPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (info) {
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    }
    setIsVisible(false);
  }, [info]);

  if (!info) return null;

  const accent = info.color || '#6FA8DC';
  const accentSoft = hexToRgba(accent, 0.12);
  const accentEdge = hexToRgba(accent, 0.3);
  const hasRich =
    info.role ||
    info.whyItMatters ||
    info.realWorldFact ||
    info.tradeoff ||
    info.interviewTip ||
    (info.concepts && info.concepts.length > 0);

  return (
    <aside
      className={`flex flex-col h-full overflow-hidden bg-surface-panel border-l border-border transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'
      }`}
      style={{ width: 340 }}
    >
      {/* Header */}
      <div
        className="relative px-4 pt-4 pb-4 border-b border-border"
        style={{
          background: `linear-gradient(180deg, ${accentSoft} 0%, transparent 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, currentColor 0.5px, transparent 0.5px)',
            backgroundSize: '14px 14px',
            color: hexToRgba(accent, 0.5),
            maskImage:
              'linear-gradient(to bottom, black 0%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 0%, transparent 100%)',
          }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: accent }}
              />
              {info.category && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{
                    background: accentSoft,
                    color: accent,
                    border: `1px solid ${accentEdge}`,
                  }}
                >
                  {info.category}
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-semibold text-text-primary leading-snug">
              {info.label}
            </h3>
            {info.description && (
              <p className="text-[12px] text-text-muted mt-1.5 leading-relaxed line-clamp-3">
                {info.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {!hasRich && (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: accentSoft,
                color: accent,
              }}
            >
              <BookOpen className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <p className="text-[12.5px] font-semibold text-text-primary mb-1">
              No deep-dive yet
            </p>
            <p className="text-[11.5px] text-text-muted leading-relaxed">
              We haven&apos;t written an architectural breakdown for this
              component yet. Check other nodes — most have rich content.
            </p>
          </div>
        )}

        {info.role && (
          <Section icon={CircleDot} label="Role" accent={accent}>
            <p>{info.role}</p>
          </Section>
        )}

        {info.whyItMatters && (
          <Section
            icon={AlertTriangle}
            label="Without this"
            accent="#D97706"
          >
            <div
              className="p-3 rounded-lg text-[12px] leading-relaxed"
              style={{
                background: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.18)',
                color: '#92400E',
              }}
            >
              {info.whyItMatters}
            </div>
          </Section>
        )}

        {info.realWorldFact && (
          <Section icon={Globe2} label="In the real world" accent="#0EA5E9">
            <div
              className="pl-3 border-l-2 text-[12px] italic leading-relaxed"
              style={{ borderColor: '#0EA5E9', color: 'var(--text-secondary)' }}
            >
              {info.realWorldFact}
            </div>
          </Section>
        )}

        {info.tradeoff && (
          <Section icon={GitBranch} label="Tradeoff" accent="#6366F1">
            <p>{info.tradeoff}</p>
          </Section>
        )}

        {info.interviewTip && (
          <Section icon={Target} label="Interview" accent="#DC2626">
            <div
              className="p-3 rounded-lg text-[12px] leading-relaxed"
              style={{
                background: 'rgba(220, 38, 38, 0.06)',
                border: '1px solid rgba(220, 38, 38, 0.16)',
                color: '#7F1D1D',
              }}
            >
              {info.interviewTip}
            </div>
          </Section>
        )}

        {info.concepts && info.concepts.length > 0 && (
          <Section icon={Tag} label="Concepts" accent={accent}>
            <div className="flex flex-wrap gap-1.5">
              {info.concepts.map((c) => (
                <span
                  key={c}
                  className="text-[10.5px] font-medium px-2 py-0.5 rounded-md"
                  style={{
                    background: accentSoft,
                    color: accent,
                    border: `1px solid ${accentEdge}`,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="px-4 py-2.5 border-t border-border flex items-center gap-2 text-[10.5px] text-text-muted"
        style={{ background: 'var(--surface-page)' }}
      >
        <MousePointerClick className="w-3 h-3" strokeWidth={1.75} />
        <span>
          Double-click another node, or click empty canvas to dismiss.
        </span>
      </div>
    </aside>
  );
}

export function NodeDetailsPanelEmpty({ onClose: _onClose }: { onClose?: () => void }) {
  return (
    <aside
      className="flex flex-col h-full overflow-hidden bg-surface-panel border-l border-border"
      style={{ width: 340 }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: 'var(--surface-page)',
            border: '1px solid var(--border-default)',
          }}
        >
          <Sparkles className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
        </div>
        <h3 className="text-[13px] font-semibold text-text-primary mb-1">
          Component deep-dive
        </h3>
        <p className="text-[11.5px] text-text-muted leading-relaxed max-w-[240px]">
          Double-click any node on the canvas to see its role, tradeoffs, and
          real-world facts here.
        </p>
      </div>
    </aside>
  );
}
