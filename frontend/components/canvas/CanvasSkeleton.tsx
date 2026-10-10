'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const PLACEHOLDER_NODES = [
  { x: 65, y: 174, w: 160, h: 72 },
  { x: 270, y: 52, w: 160, h: 72 },
  { x: 570, y: 52, w: 160, h: 72 },
  { x: 775, y: 174, w: 160, h: 72 },
  { x: 270, y: 296, w: 160, h: 72 },
  { x: 570, y: 296, w: 160, h: 72 },
];

const PLACEHOLDER_EDGES = [
  { x1: 225, y1: 196, x2: 270, y2: 88 },
  { x1: 225, y1: 224, x2: 270, y2: 332 },
  { x1: 430, y1: 88, x2: 570, y2: 88 },
  { x1: 430, y1: 332, x2: 570, y2: 332 },
  { x1: 730, y1: 88, x2: 775, y2: 196 },
  { x1: 730, y1: 332, x2: 775, y2: 224 },
];

const LOADING_MESSAGES = [
  'Analyzing requirements',
  'Designing architecture',
  'Generating components',
  'Creating connections',
  'Computing layout',
  'Validating diagram',
];

export function CanvasSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 bg-[hsl(var(--canvas-bg))]/40 backdrop-blur-[1.5px]">
      <div className="relative w-full h-full flex items-center justify-center">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 420"
          className="max-w-[900px] max-h-[400px]"
          style={{ filter: 'blur(0.5px)' }}
        >
          {/* Grid */}
          <defs>
            <pattern id="skeleton-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.15" />
            </pattern>
          </defs>
          <rect width="1000" height="420" fill="url(#skeleton-grid)" />

          {/* Edges */}
          {PLACEHOLDER_EDGES.map((e, i) => (
            <line
              key={`e-${i}`}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="hsl(var(--border))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.3}
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
            </line>
          ))}

          {/* Edge endpoints */}
          {PLACEHOLDER_EDGES.map((e, i) => (
            <circle key={`dot-${i}`} cx={e.x2} cy={e.y2} r={3} fill="hsl(var(--muted-foreground))" opacity={0.3} />
          ))}

          {/* Nodes */}
          {PLACEHOLDER_NODES.map((n, i) => (
            <g key={`n-${i}`} opacity={0.85}>
              {/* Shadow */}
              <rect x={n.x + 2} y={n.y + 2} width={n.w} height={n.h} rx={12} fill="hsl(var(--foreground))" opacity={0.06} />
              {/* Body */}
              <rect
                x={n.x} y={n.y} width={n.w} height={n.h} rx={12}
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              {/* Icon circle */}
              <circle cx={n.x + 28} cy={n.y + n.h / 2} r={12} fill="hsl(var(--muted))" opacity={0.4} />
              {/* Title */}
              <rect
                x={n.x + 48} y={n.y + n.h / 2 - 8} width={n.w * 0.45} height={7} rx={3.5}
                fill="hsl(var(--muted-foreground))"
                opacity={0.35}
              >
                <animate attributeName="opacity" values="0.25;0.55;0.25" dur={`${1.5 + i * 0.1}s`} repeatCount="indefinite" />
              </rect>
              {/* Subtitle */}
              <rect
                x={n.x + 48} y={n.y + n.h / 2 + 5} width={n.w * 0.3} height={5} rx={2.5}
                fill="hsl(var(--muted-foreground))"
                opacity={0.2}
              >
                <animate attributeName="opacity" values="0.15;0.45;0.15" dur={`${1.8 + i * 0.15}s`} repeatCount="indefinite" />
              </rect>
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/95 backdrop-blur-md border border-border/60 shadow-xl shadow-foreground/10" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground/80">
                {LOADING_MESSAGES[messageIndex]}
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
