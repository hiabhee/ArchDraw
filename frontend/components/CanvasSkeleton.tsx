'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const PLACEHOLDER_NODES = [
  { x: 40, y: 160, w: 160, h: 72 },
  { x: 40, y: 280, w: 160, h: 64 },
  { x: 300, y: 60, w: 200, h: 90 },
  { x: 300, y: 200, w: 200, h: 72 },
  { x: 300, y: 320, w: 200, h: 56 },
  { x: 600, y: 130, w: 140, h: 64 },
  { x: 600, y: 250, w: 140, h: 72 },
  { x: 830, y: 170, w: 120, h: 56 },
];

const PLACEHOLDER_EDGES = [
  { x1: 200, y1: 180, x2: 300, y2: 105 },
  { x1: 200, y1: 200, x2: 300, y2: 236 },
  { x1: 200, y1: 312, x2: 300, y2: 348 },
  { x1: 500, y1: 105, x2: 600, y2: 162 },
  { x1: 500, y1: 236, x2: 600, y2: 286 },
  { x1: 500, y1: 348, x2: 600, y2: 286 },
  { x1: 740, y1: 162, x2: 830, y2: 198 },
  { x1: 740, y1: 286, x2: 830, y2: 198 },
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

        {/* Bottom status bar */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground/80">
              {LOADING_MESSAGES[messageIndex]}
            </span>
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
