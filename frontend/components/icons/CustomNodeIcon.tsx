'use client';

import { useId } from 'react';

export type CustomNodeIconName =
  | 'arch-web'
  | 'arch-mobile'
  | 'arch-api-gateway'
  | 'arch-message-queue'
  | 'arch-event-stream'
  | 'arch-database'
  | 'arch-cache'
  | 'arch-storage'
  | 'arch-server'
  | 'arch-service'
  | 'arch-load-balancer'
  | 'arch-auth'
  | 'arch-ai'
  | 'arch-observability'
  | 'arch-external'
  | 'arch-docker'
  | 'arch-producer'
  | 'arch-consumer'
  | 'arch-consumer-group'
  | 'arch-broker'
  | 'arch-topic'
  | 'arch-partition'
  | 'arch-coordinator';

const CUSTOM_ICON_ALIASES: Record<string, CustomNodeIconName> = {
  Monitor: 'arch-web',
  Smartphone: 'arch-mobile',
  Webhook: 'arch-api-gateway',
  ArrowLeftRight: 'arch-api-gateway',
  Inbox: 'arch-message-queue',
  Radio: 'arch-event-stream',
  Activity: 'arch-observability',
  Database: 'arch-database',
  Gauge: 'arch-cache',
  HardDrive: 'arch-storage',
  Server: 'arch-server',
  Box: 'arch-service',
  Boxes: 'arch-service',
  Scale: 'arch-load-balancer',
  ShieldCheck: 'arch-auth',
  KeyRound: 'arch-auth',
  Brain: 'arch-ai',
  Globe: 'arch-external',
  // Direct mappings for custom icon types
  'arch-database': 'arch-database',
  'arch-cache': 'arch-cache',
  'arch-auth': 'arch-auth',
  'arch-event-stream': 'arch-event-stream',
  'arch-message-queue': 'arch-message-queue',
  'arch-observability': 'arch-observability',
  'arch-ai': 'arch-ai',
  'arch-storage': 'arch-storage',
  'arch-docker': 'arch-docker',
  'arch-service': 'arch-service',
  'arch-server': 'arch-server',
  'arch-web': 'arch-web',
  'arch-api-gateway': 'arch-api-gateway',
  'arch-external': 'arch-external',
};

export function isCustomNodeIcon(iconName?: string): iconName is CustomNodeIconName {
  return Boolean(iconName?.startsWith('arch-') || CUSTOM_ICON_ALIASES[iconName ?? '']);
}

export function toCustomNodeIconName(iconName?: string): CustomNodeIconName | null {
  if (isCustomNodeIcon(iconName)) return iconName;
  return iconName ? CUSTOM_ICON_ALIASES[iconName] ?? null : null;
}

interface CustomNodeIconProps {
  name: CustomNodeIconName;
  color?: string;
  size?: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { r: 99, g: 102, b: 241 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function tint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function CustomNodeIcon({ name, color = '#6366f1', size = 18 }: CustomNodeIconProps) {
  const rawId = useId().replace(/:/g, '');
  const grad = `nodeIconGrad${rawId}`;
  const glow = `nodeIconGlow${rawId}`;
  const soft = tint(color, 0.18);

  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const filled = {
    fill: `url(#${grad})`,
    stroke: color,
    strokeWidth: 1.4,
  };

  const glyph = (() => {
    switch (name) {
      case 'arch-web':
        return (
          <>
            <rect x="4.2" y="5.2" width="15.6" height="11.2" rx="2.6" {...filled} />
            <path d="M8 18.8h8M10.2 16.4l-.7 2.4M13.8 16.4l.7 2.4" {...common} />
            <circle cx="7.1" cy="8.1" r=".7" fill={color} />
            <path d="M9.2 8.1h6.8M7.1 11.2h9.8" {...common} strokeWidth={1.2} opacity={0.75} />
          </>
        );
      case 'arch-mobile':
        return (
          <>
            <rect x="7.4" y="3.2" width="9.2" height="17.6" rx="2.8" {...filled} />
            <path d="M10.2 5.8h3.6M11.2 18.2h1.6" {...common} strokeWidth={1.2} />
            <path d="M9.7 8.5h4.6M9.7 11.2h4.6M9.7 13.9h2.4" {...common} strokeWidth={1.1} opacity={0.7} />
          </>
        );
      case 'arch-api-gateway':
        return (
          <>
            <path d="M4.4 12h4.3M15.3 12h4.3" {...common} />
            <rect x="8.3" y="5.3" width="7.4" height="13.4" rx="2.2" {...filled} />
            <path d="M11.1 8.1h1.8M10.4 12h3.2M11.1 15.9h1.8" {...common} strokeWidth={1.25} />
            <path d="M6.1 9.5 3.6 12l2.5 2.5M17.9 9.5l2.5 2.5-2.5 2.5" {...common} strokeWidth={1.55} />
          </>
        );
      case 'arch-message-queue':
        return (
          <>
            <rect x="3.8" y="7.2" width="16.4" height="9.6" rx="4.8" fill={soft} stroke={color} strokeWidth={1.25} />
            <rect x="6" y="9.2" width="3.1" height="5.6" rx="1.4" fill={color} opacity={0.92} />
            <rect x="10.4" y="9.2" width="3.1" height="5.6" rx="1.4" fill={color} opacity={0.64} />
            <rect x="14.8" y="9.2" width="3.1" height="5.6" rx="1.4" fill={color} opacity={0.34} />
            <path d="M6.4 6.2c1.5-1.2 3.4-1.9 5.6-1.9s4.1.7 5.6 1.9M6.4 17.8c1.5 1.2 3.4 1.9 5.6 1.9s4.1-.7 5.6-1.9" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-event-stream':
        return (
          <>
            <path d="M4 8.2c2.4-2.1 4.8-2.1 7.2 0s4.8 2.1 7.2 0" {...common} />
            <path d="M4 12c2.4-2.1 4.8-2.1 7.2 0s4.8 2.1 7.2 0" {...common} opacity={0.75} />
            <path d="M4 15.8c2.4-2.1 4.8-2.1 7.2 0s4.8 2.1 7.2 0" {...common} opacity={0.5} />
            <circle cx="19" cy="8.2" r="1.5" fill={color} />
          </>
        );
      case 'arch-database':
        return (
          <>
            <ellipse cx="12" cy="6.1" rx="6.8" ry="2.8" {...filled} />
            <path d="M5.2 6.1v9.7c0 1.5 3 2.8 6.8 2.8s6.8-1.3 6.8-2.8V6.1" {...common} />
            <path d="M5.2 10.9c0 1.5 3 2.8 6.8 2.8s6.8-1.3 6.8-2.8" {...common} opacity={0.7} />
          </>
        );
      case 'arch-cache':
        return (
          <>
            <rect x="4.5" y="5.1" width="15" height="13.8" rx="3.2" {...filled} />
            <path d="M8.2 9.4h7.6M8.2 12h5.6M8.2 14.6h7.6" {...common} strokeWidth={1.25} />
            <path d="m15.2 6.8-2.4 4h3.1l-3.3 5.2" {...common} strokeWidth={1.4} />
          </>
        );
      case 'arch-storage':
        return (
          <>
            <path d="M4.4 8.4 12 4.6l7.6 3.8-7.6 3.8-7.6-3.8Z" {...filled} />
            <path d="M4.4 12 12 15.8 19.6 12M4.4 15.6 12 19.4l7.6-3.8" {...common} opacity={0.75} />
          </>
        );
      case 'arch-server':
        return (
          <>
            <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="2.8" {...filled} />
            <path d="M7.6 8.2h8.8M7.6 12h8.8M7.6 15.8h5.3" {...common} strokeWidth={1.25} />
            <circle cx="16.4" cy="15.8" r="1" fill={color} />
          </>
        );
      case 'arch-service':
        return (
          <>
            <rect x="5" y="5.2" width="14" height="13.6" rx="3.2" {...filled} />
            <circle cx="9" cy="9.1" r="1.45" fill={color} />
            <circle cx="15" cy="9.1" r="1.45" fill={color} opacity={0.75} />
            <circle cx="12" cy="14.4" r="1.45" fill={color} opacity={0.55} />
            <path d="m10.2 9.8 1.1 2.9M13.8 9.8l-1.1 2.9" {...common} strokeWidth={1.05} opacity={0.55} />
          </>
        );
      case 'arch-load-balancer':
        return (
          <>
            <circle cx="12" cy="6" r="2.2" {...filled} />
            <circle cx="6.4" cy="17" r="2.2" {...filled} />
            <circle cx="17.6" cy="17" r="2.2" {...filled} />
            <path d="M12 8.3v3.2M12 11.5H6.4v3.2M12 11.5h5.6v3.2" {...common} />
          </>
        );
      case 'arch-auth':
        return (
          <>
            <path d="M12 3.8 5.2 6.6v5.2c0 4.1 2.8 7.2 6.8 8.5 4-1.3 6.8-4.4 6.8-8.5V6.6L12 3.8Z" {...filled} />
            <path d="m9.2 12.2 1.9 1.9 4-4.2" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-ai':
        return (
          <>
            <circle cx="12" cy="12" r="3.2" {...filled} />
            <circle cx="6.1" cy="7.1" r="1.5" fill={color} opacity={0.68} />
            <circle cx="17.9" cy="7.1" r="1.5" fill={color} opacity={0.68} />
            <circle cx="6.1" cy="16.9" r="1.5" fill={color} opacity={0.68} />
            <circle cx="17.9" cy="16.9" r="1.5" fill={color} opacity={0.68} />
            <path d="M8 8.4 10 10M16 8.4 14 10M8 15.6 10 14M16 15.6 14 14" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-observability':
        return (
          <>
            <rect x="4.2" y="5.2" width="15.6" height="13.6" rx="3" {...filled} />
            <path d="M7.2 14.4 10 11.2l2.5 2 4.3-5.1" {...common} />
            <path d="M7.2 17h9.6" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-external':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" {...filled} />
            <path d="M4.8 12h14.4M12 4.8c2 2.1 3 4.5 3 7.2s-1 5.1-3 7.2M12 4.8c-2 2.1-3 4.5-3 7.2s1 5.1 3 7.2" {...common} strokeWidth={1.15} />
          </>
        );
      case 'arch-docker':
        return (
          <>
            <path d="M4.4 13.6h13.9c.8 0 1.5-.3 2.1-.8-.4 3.8-3.1 6.1-7.8 6.1H8.9c-2.7 0-4.9-2.1-4.9-4.9v-.4h.4Z" {...filled} />
            <rect x="6.2" y="8.4" width="3" height="3" rx=".5" fill={color} opacity={0.52} />
            <rect x="10.2" y="8.4" width="3" height="3" rx=".5" fill={color} opacity={0.72} />
            <rect x="10.2" y="4.6" width="3" height="3" rx=".5" fill={color} opacity={0.46} />
            <rect x="14.2" y="8.4" width="3" height="3" rx=".5" fill={color} opacity={0.92} />
          </>
        );
      case 'arch-producer':
        return (
          <>
            <rect x="4.3" y="6.1" width="10.6" height="11.8" rx="2.8" {...filled} />
            <path d="M8.1 9h3.1M8.1 12h4.7M8.1 15h2.4" {...common} strokeWidth={1.15} opacity={0.75} />
            <path d="M15.3 9.1 20 12l-4.7 2.9M14.7 12H20" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-consumer':
        return (
          <>
            <rect x="9.1" y="6.1" width="10.6" height="11.8" rx="2.8" {...filled} />
            <path d="M12.8 9h3.1M12.8 12h4.7M12.8 15h2.4" {...common} strokeWidth={1.15} opacity={0.75} />
            <path d="M8.7 9.1 4 12l4.7 2.9M4 12h5.3" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-consumer-group':
        return (
          <>
            <rect x="4.6" y="5.2" width="7.2" height="8.3" rx="2.2" fill={soft} stroke={color} strokeWidth={1.25} />
            <rect x="12.2" y="5.2" width="7.2" height="8.3" rx="2.2" fill={soft} stroke={color} strokeWidth={1.25} opacity={0.78} />
            <rect x="8.4" y="11.2" width="7.2" height="8.3" rx="2.2" {...filled} />
            <path d="M8.1 15.5H6.4c-1 0-1.8-.8-1.8-1.8M15.9 15.5h1.7c1 0 1.8-.8 1.8-1.8" {...common} strokeWidth={1.15} opacity={0.62} />
          </>
        );
      case 'arch-broker':
        return (
          <>
            <ellipse cx="12" cy="12" rx="8" ry="5.6" {...filled} />
            <circle cx="12" cy="12" r="2.3" fill={color} opacity={0.88} />
            <path d="M6.2 12h3.1M14.7 12h3.1M12 6.4v3.1M12 14.5v3.1" {...common} strokeWidth={1.25} opacity={0.65} />
            <path d="M8.2 8.8c1-.8 2.3-1.3 3.8-1.3s2.8.5 3.8 1.3M8.2 15.2c1 .8 2.3 1.3 3.8 1.3s2.8-.5 3.8-1.3" {...common} strokeWidth={1.05} opacity={0.5} />
          </>
        );
      case 'arch-topic':
        return (
          <>
            <path d="M5.2 8.2c0-1.5 3-2.8 6.8-2.8s6.8 1.3 6.8 2.8v7.6c0 1.5-3 2.8-6.8 2.8s-6.8-1.3-6.8-2.8V8.2Z" {...filled} />
            <path d="M5.2 8.2c0 1.5 3 2.8 6.8 2.8s6.8-1.3 6.8-2.8M5.2 12c0 1.5 3 2.8 6.8 2.8s6.8-1.3 6.8-2.8" {...common} opacity={0.72} />
            <path d="M9.2 7.6h5.6" {...common} strokeWidth={1.05} opacity={0.55} />
          </>
        );
      case 'arch-partition':
        return (
          <>
            <rect x="4.4" y="6.1" width="15.2" height="11.8" rx="2.6" {...filled} />
            <path d="M9.1 6.2v11.6M14.9 6.2v11.6" {...common} opacity={0.65} />
            <path d="M6.7 9.2h1.1M11.5 12h1.1M17.1 14.8h1.1" {...common} strokeWidth={1.9} />
          </>
        );
      case 'arch-coordinator':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" {...filled} />
            <circle cx="12" cy="12" r="2" fill={color} opacity={0.86} />
            <path d="M12 4.8v3.1M12 16.1v3.1M4.8 12h3.1M16.1 12h3.1M6.9 6.9l2.2 2.2M14.9 14.9l2.2 2.2M17.1 6.9l-2.2 2.2M9.1 14.9l-2.2 2.2" {...common} strokeWidth={1.1} opacity={0.65} />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={grad} x1="5" y1="4" x2="19" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="1" stopColor={color} stopOpacity="0.18" />
        </linearGradient>
        <filter id={glow} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor={color} floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter={`url(#${glow})`}>{glyph}</g>
    </svg>
  );
}
