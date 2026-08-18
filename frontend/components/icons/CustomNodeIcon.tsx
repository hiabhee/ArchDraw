'use client';

import { useId } from 'react';
import { LUCIDE_TO_ARCH_ICON, normalizeArchIconName } from '@/lib/iconAliases';
import { CUSTOM_ICON_SET, type CustomNodeIconName } from '@/lib/archIconCatalog';

export type { CustomNodeIconName };

export function isCustomNodeIcon(iconName?: string): iconName is CustomNodeIconName {
  if (!iconName) return false;
  return CUSTOM_ICON_SET.has(iconName) || Boolean(LUCIDE_TO_ARCH_ICON[iconName]);
}

export function toCustomNodeIconName(iconName?: string): CustomNodeIconName | null {
  if (!iconName) return null;
  const normalized = normalizeArchIconName(iconName);
  if (normalized && CUSTOM_ICON_SET.has(normalized)) return normalized as CustomNodeIconName;
  return null;
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

export function CustomNodeIcon({ name, color = '#1E90FF', size = 18 }: CustomNodeIconProps) {
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
      case 'arch-cdn':
        return (
          <>
            <circle cx="12" cy="12" r="7.4" {...filled} />
            <circle cx="12" cy="12" r="2.2" fill={color} opacity={0.9} />
            <circle cx="12" cy="5.4" r="1.3" fill={color} opacity={0.75} />
            <circle cx="17.8" cy="15.4" r="1.3" fill={color} opacity={0.55} />
            <circle cx="6.2" cy="15.4" r="1.3" fill={color} opacity={0.55} />
            <path d="M12 9.8V7M14.1 13.2l2.4 1.5M9.9 13.2 7.5 14.7" {...common} strokeWidth={1.15} opacity={0.65} />
          </>
        );
      case 'arch-dns':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" {...filled} />
            <path d="M12 5.2v13.6M5.4 12h13.2" {...common} strokeWidth={1.15} opacity={0.55} />
            <path d="M7.2 8.2c1.4 1.2 3 1.9 4.8 1.9s3.4-.7 4.8-1.9M7.2 15.8c1.4-1.2 3-1.9 4.8-1.9s3.4.7 4.8 1.9" {...common} strokeWidth={1.15} opacity={0.7} />
            <circle cx="12" cy="12" r="1.4" fill={color} />
          </>
        );
      case 'arch-search':
        return (
          <>
            <circle cx="10.4" cy="10.4" r="5.6" {...filled} />
            <path d="m14.6 14.6 4.6 4.6" {...common} strokeWidth={2.1} />
            <path d="M8.2 10.4h4.4M10.4 8.2v4.4" {...common} strokeWidth={1.2} opacity={0.7} />
          </>
        );
      case 'arch-function':
        return (
          <>
            <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.2" {...filled} />
            <path d="M10.2 7.2h2.2l-2.8 4.6h2.6L9.4 17.2" {...common} strokeWidth={1.7} />
            <path d="M14.8 7.6v8.8" {...common} strokeWidth={1.3} opacity={0.45} />
          </>
        );
      case 'arch-worker':
        return (
          <>
            <rect x="5" y="6.2" width="14" height="11.6" rx="2.8" {...filled} />
            <circle cx="12" cy="12" r="3.2" fill={soft} stroke={color} strokeWidth={1.35} />
            <path d="M12 7.4v1.6M12 15v1.6M7.4 12h1.6M15 12h1.6M8.7 8.7l1.1 1.1M14.2 14.2l1.1 1.1M15.3 8.7l-1.1 1.1M9.8 14.2l-1.1 1.1" {...common} strokeWidth={1.15} />
          </>
        );
      case 'arch-payment':
        return (
          <>
            <rect x="3.8" y="6.4" width="16.4" height="11.2" rx="2.6" {...filled} />
            <path d="M3.8 10.2h16.4" {...common} strokeWidth={1.4} />
            <path d="M7 14.4h4.2M14.6 14.4h2.4" {...common} strokeWidth={1.3} opacity={0.7} />
          </>
        );
      case 'arch-email':
        return (
          <>
            <rect x="3.8" y="6.2" width="16.4" height="11.6" rx="2.6" {...filled} />
            <path d="m4.6 7.4 7.4 5.6 7.4-5.6" {...common} />
            <path d="M4.6 16.4 9.8 12.2M19.4 16.4 14.2 12.2" {...common} strokeWidth={1.2} opacity={0.55} />
          </>
        );
      case 'arch-firewall':
        return (
          <>
            <rect x="4.2" y="5" width="15.6" height="14" rx="2.4" {...filled} />
            <path d="M4.2 9.2h15.6M4.2 13.4h15.6M9.4 5v14M14.6 5v14" {...common} strokeWidth={1.25} opacity={0.7} />
          </>
        );
      case 'arch-vector':
        return (
          <>
            <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3" {...filled} />
            <circle cx="8" cy="8" r="1.35" fill={color} />
            <circle cx="12" cy="8" r="1.35" fill={color} opacity={0.75} />
            <circle cx="16" cy="8" r="1.35" fill={color} opacity={0.5} />
            <circle cx="8" cy="12" r="1.35" fill={color} opacity={0.75} />
            <circle cx="12" cy="12" r="1.35" fill={color} />
            <circle cx="16" cy="12" r="1.35" fill={color} opacity={0.75} />
            <circle cx="8" cy="16" r="1.35" fill={color} opacity={0.5} />
            <circle cx="12" cy="16" r="1.35" fill={color} opacity={0.75} />
            <circle cx="16" cy="16" r="1.35" fill={color} opacity={0.45} />
          </>
        );
      case 'arch-kubernetes':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" {...filled} />
            <path d="M12 5.4 15.4 7.4v4.2L12 13.6 8.6 11.6V7.4L12 5.4Z" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M12 13.6v4.8M8.6 11.6 5.2 13.6M15.4 11.6l3.4 2" {...common} strokeWidth={1.2} opacity={0.7} />
            <circle cx="12" cy="10.4" r="1.3" fill={color} />
          </>
        );
      case 'arch-cicd':
        return (
          <>
            <rect x="4" y="5.2" width="5.2" height="5.2" rx="1.6" {...filled} />
            <rect x="14.8" y="5.2" width="5.2" height="5.2" rx="1.6" {...filled} />
            <rect x="9.4" y="13.6" width="5.2" height="5.2" rx="1.6" {...filled} />
            <path d="M9.2 7.8h5.6M17.4 10.4v2.4c0 1.1-.9 2-2 2h-1.2M6.6 10.4v2.4c0 1.1.9 2 2 2h1.2" {...common} />
          </>
        );
      case 'arch-document-db':
        return (
          <>
            <rect x="5.2" y="4.4" width="10.4" height="13.2" rx="1.8" fill={soft} stroke={color} strokeWidth={1.25} />
            <rect x="7.6" y="6.4" width="10.4" height="13.2" rx="1.8" {...filled} />
            <path d="M10 10h5.2M10 12.8h5.2M10 15.6h3.2" {...common} strokeWidth={1.15} opacity={0.7} />
          </>
        );
      case 'arch-key-value':
        return (
          <>
            <rect x="10.4" y="6.2" width="9.2" height="11.6" rx="2.4" {...filled} />
            <circle cx="7.2" cy="12" r="3.4" fill={soft} stroke={color} strokeWidth={1.4} />
            <circle cx="7.2" cy="12" r="1.2" fill={color} />
            <path d="M12.6 9.4h4.4M12.6 12h5.2M12.6 14.6h3.2" {...common} strokeWidth={1.15} opacity={0.7} />
          </>
        );
      case 'arch-warehouse':
        return (
          <>
            <path d="M4.4 10.2 12 4.8l7.6 5.4V19H4.4v-8.8Z" {...filled} />
            <path d="M9 19v-5.2h6V19" {...common} />
            <path d="M4.8 12.2h14.4M4.8 15h14.4" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-notification':
        return (
          <>
            <path d="M8.2 17.6h7.6M12 3.8a5.4 5.4 0 0 1 5.4 5.4c0 3.4 1.1 4.6 1.8 5.6H4.8c.7-1 1.8-2.2 1.8-5.6A5.4 5.4 0 0 1 12 3.8Z" {...filled} />
            <path d="M10.4 17.6a1.6 1.6 0 0 0 3.2 0" {...common} />
          </>
        );
      case 'arch-graphql':
        return (
          <>
            <path d="M12 4.2 19 8.2v7.6L12 19.8 5 15.8V8.2L12 4.2Z" {...filled} />
            <circle cx="12" cy="7.2" r="1.35" fill={color} />
            <circle cx="7.6" cy="14.8" r="1.35" fill={color} opacity={0.75} />
            <circle cx="16.4" cy="14.8" r="1.35" fill={color} opacity={0.75} />
            <path d="M12 8.6v3.2M11.1 12.4 8.4 14.2M12.9 12.4l2.7 1.8" {...common} strokeWidth={1.15} opacity={0.65} />
          </>
        );
      case 'arch-proxy':
        return (
          <>
            <path d="M5 8.2h8.4M5 15.8h8.4" {...common} />
            <path d="M11.2 5.8 14.8 8.2 11.2 10.6M11.2 13.4 14.8 15.8 11.2 18.2" {...common} />
            <rect x="15.2" y="5.6" width="4.4" height="12.8" rx="2" {...filled} />
          </>
        );
      case 'arch-secrets':
        return (
          <>
            <rect x="6.2" y="10.2" width="11.6" height="9" rx="2.4" {...filled} />
            <path d="M9 10.2V8.2a3 3 0 0 1 6 0v2" {...common} />
            <circle cx="12" cy="14.4" r="1.3" fill={color} />
            <path d="M12 15.7v1.8" {...common} strokeWidth={1.4} />
          </>
        );
      case 'arch-metrics':
        return (
          <>
            <rect x="4.2" y="4.8" width="15.6" height="14.4" rx="2.8" {...filled} />
            <path d="M7.2 15.6V12M12 15.6V9.2M16.8 15.6V7.4" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-logs':
        return (
          <>
            <path d="M7.2 4.6h7.2l4.4 4.4v10.4a2.4 2.4 0 0 1-2.4 2.4H7.2A2.4 2.4 0 0 1 4.8 19.4V7a2.4 2.4 0 0 1 2.4-2.4Z" {...filled} />
            <path d="M14.2 4.8v3.8h3.8" {...common} />
            <path d="M8.2 12h7.6M8.2 14.8h7.6M8.2 17.6h4.8" {...common} strokeWidth={1.15} opacity={0.7} />
          </>
        );
      case 'arch-trace':
        return (
          <>
            <circle cx="5.6" cy="7.2" r="2" {...filled} />
            <circle cx="12" cy="12" r="2" {...filled} />
            <circle cx="18.4" cy="16.8" r="2" {...filled} />
            <path d="M7.4 8.4 10.2 10.6M13.8 13.4l2.8 2.2" {...common} />
            <path d="M5.6 12.8v4.4M12 7.2V9.2M18.4 7.2v5.6" {...common} strokeWidth={1.1} opacity={0.45} />
          </>
        );
      case 'arch-file':
        return (
          <>
            <path d="M5 7.2h5.2l1.8 2H19a1.8 1.8 0 0 1 1.8 1.8v7.2A1.8 1.8 0 0 1 19 20H5a1.8 1.8 0 0 1-1.8-1.8V9A1.8 1.8 0 0 1 5 7.2Z" {...filled} />
            <path d="M5 7.2V5.6A1.6 1.6 0 0 1 6.6 4h4.2l1.6 1.8H5" {...common} strokeWidth={1.25} opacity={0.7} />
          </>
        );
      case 'arch-webhook':
        return (
          <>
            <circle cx="7.2" cy="8.2" r="2.6" {...filled} />
            <circle cx="16.8" cy="8.2" r="2.6" {...filled} />
            <circle cx="12" cy="16.4" r="2.6" {...filled} />
            <path d="M9.4 9.4c1 .9 1.8 2.4 2 4M14.6 9.4c-1 .9-1.8 2.4-2 4" {...common} />
          </>
        );
      case 'arch-chat':
        return (
          <>
            <path d="M5.2 6.2h13.6a2.2 2.2 0 0 1 2.2 2.2v6.2a2.2 2.2 0 0 1-2.2 2.2H11l-3.8 3.2v-3.2H5.2A2.2 2.2 0 0 1 3 14.6V8.4a2.2 2.2 0 0 1 2.2-2.2Z" {...filled} />
            <path d="M7.6 10.4h8.8M7.6 13h5.6" {...common} strokeWidth={1.2} opacity={0.7} />
          </>
        );
      case 'arch-upload':
        return (
          <>
            <rect x="4.6" y="12.4" width="14.8" height="7" rx="2.4" {...filled} />
            <path d="M12 15.2V4.8M8.4 8.2 12 4.6l3.6 3.6" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-config':
        return (
          <>
            <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.2" {...filled} />
            <path d="M8 9.2h8M8 12h5.2M8 14.8h6.8" {...common} strokeWidth={1.35} />
            <circle cx="16.2" cy="12" r="1.3" fill={color} />
            <circle cx="14.4" cy="14.8" r="1.3" fill={color} opacity={0.7} />
          </>
        );
      case 'arch-registry':
        return (
          <>
            <rect x="4.4" y="5" width="6.4" height="6.4" rx="1.6" {...filled} />
            <rect x="13.2" y="5" width="6.4" height="6.4" rx="1.6" {...filled} />
            <rect x="4.4" y="13.2" width="6.4" height="6.4" rx="1.6" {...filled} />
            <rect x="13.2" y="13.2" width="6.4" height="6.4" rx="1.6" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M15.4 15.4h2.2M15.4 17.4h2.2" {...common} strokeWidth={1.1} opacity={0.65} />
          </>
        );
      case 'arch-agent':
        return (
          <>
            <rect x="5.2" y="7.2" width="13.6" height="11.2" rx="3.2" {...filled} />
            <path d="M12 4.4v2.8" {...common} />
            <circle cx="12" cy="4" r="1.2" fill={color} />
            <circle cx="9.2" cy="12" r="1.4" fill={color} />
            <circle cx="14.8" cy="12" r="1.4" fill={color} />
            <path d="M9.4 15.4h5.2" {...common} strokeWidth={1.3} opacity={0.7} />
          </>
        );
      case 'arch-realtime':
        return (
          <>
            <path d="M6.4 12a5.6 5.6 0 0 1 11.2 0" {...common} />
            <path d="M8.4 12a3.6 3.6 0 0 1 7.2 0" {...common} opacity={0.7} />
            <circle cx="12" cy="12" r="1.6" fill={color} />
            <path d="M12 13.6v4.2M9.6 19.2h4.8" {...common} />
          </>
        );
      case 'arch-maps':
        return (
          <>
            <path d="M12 3.8c-3.2 0-5.8 2.5-5.8 5.6 0 4.2 5.8 10.4 5.8 10.4s5.8-6.2 5.8-10.4c0-3.1-2.6-5.6-5.8-5.6Z" {...filled} />
            <circle cx="12" cy="9.4" r="2" fill={color} opacity={0.85} />
          </>
        );
      case 'arch-users':
        return (
          <>
            <circle cx="9" cy="8.4" r="2.6" {...filled} />
            <circle cx="16" cy="9.2" r="2.1" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M4.4 18.4c.4-3 2.4-4.6 4.6-4.6s4.2 1.6 4.6 4.6" {...common} />
            <path d="M13.2 18.4c.3-2.2 1.6-3.4 3-3.4 1.5 0 2.8 1.1 3.2 3.4" {...common} opacity={0.7} />
          </>
        );
      case 'arch-desktop':
        return (
          <>
            <rect x="3.8" y="4.6" width="16.4" height="11.2" rx="2.4" {...filled} />
            <path d="M8.2 7.4h7.6M8.2 10h5.2M8.2 12.6h6.4" {...common} strokeWidth={1.15} opacity={0.7} />
            <path d="M9.6 15.8h4.8l1.2 3.6H8.4l1.2-3.6Z" {...filled} />
          </>
        );
      case 'arch-terminal':
        return (
          <>
            <rect x="4.2" y="5" width="15.6" height="13.6" rx="2.8" {...filled} />
            <path d="M7.2 9.2 10 12l-2.8 2.8M12.4 14.8h4.8" {...common} strokeWidth={1.6} />
            <circle cx="6.4" cy="7.2" r=".8" fill={color} opacity={0.55} />
            <circle cx="8.4" cy="7.2" r=".8" fill={color} opacity={0.4} />
          </>
        );
      case 'arch-grpc':
        return (
          <>
            <path d="M12 4.2 18.4 8v8L12 20 5.6 16V8L12 4.2Z" {...filled} />
            <path d="M8.4 9.6 12 12l3.6-2.4M8.4 14.4 12 12l3.6 2.4" {...common} strokeWidth={1.5} />
            <circle cx="12" cy="12" r="1.4" fill={color} />
          </>
        );
      case 'arch-router':
        return (
          <>
            <rect x="6.8" y="8.2" width="10.4" height="7.6" rx="2" {...filled} />
            <circle cx="4.4" cy="12" r="1.6" fill={color} opacity={0.75} />
            <circle cx="19.6" cy="8.8" r="1.6" fill={color} opacity={0.75} />
            <circle cx="19.6" cy="15.2" r="1.6" fill={color} opacity={0.75} />
            <path d="M6 12H5.2M17.2 8.8h-1M17.2 15.2h-1" {...common} strokeWidth={1.35} />
            <path d="M9.4 11.2h5.2M9.4 13.6h3.2" {...common} strokeWidth={1.1} opacity={0.65} />
          </>
        );
      case 'arch-scheduler':
        return (
          <>
            <circle cx="12" cy="12" r="7.4" {...filled} />
            <path d="M12 7.8v4.6l3.2 1.8" {...common} strokeWidth={1.6} />
            <path d="M12 4.6v1.6M12 17.8v1.6M4.6 12H3M21 12h-1.6" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-batch':
        return (
          <>
            <rect x="5.2" y="4.8" width="13.6" height="4.8" rx="1.8" {...filled} />
            <rect x="5.2" y="10.4" width="13.6" height="4.8" rx="1.8" fill={soft} stroke={color} strokeWidth={1.25} />
            <rect x="5.2" y="16" width="13.6" height="4.8" rx="1.8" fill={soft} stroke={color} strokeWidth={1.25} opacity={0.72} />
            <path d="M12 9.6v1.2M12 15.2v1.2" {...common} strokeWidth={1.4} />
          </>
        );
      case 'arch-cluster':
        return (
          <>
            <rect x="3.8" y="5.2" width="6.4" height="6.4" rx="1.6" {...filled} />
            <rect x="13.8" y="5.2" width="6.4" height="6.4" rx="1.6" {...filled} />
            <rect x="8.8" y="13.2" width="6.4" height="6.4" rx="1.6" {...filled} />
            <path d="M10.2 8.4h3.6M16.8 8.4 12.2 13.2M7.2 8.4l4.6 4.8" {...common} strokeWidth={1.1} opacity={0.55} />
          </>
        );
      case 'arch-vm':
        return (
          <>
            <rect x="4.6" y="5.2" width="14.8" height="13.6" rx="2.6" {...filled} />
            <rect x="7.4" y="8" width="9.2" height="6.4" rx="1.4" fill={soft} stroke={color} strokeWidth={1.2} />
            <path d="M9.2 10.4h5.6M9.2 12.4h3.6" {...common} strokeWidth={1.05} opacity={0.65} />
            <circle cx="15.6" cy="12.4" r=".9" fill={color} />
          </>
        );
      case 'arch-download':
        return (
          <>
            <rect x="4.6" y="12.4" width="14.8" height="7" rx="2.4" {...filled} />
            <path d="M12 4.8v9.6M8.4 11.2 12 14.8l3.6-3.6" {...common} strokeWidth={1.7} />
          </>
        );
      case 'arch-timeseries':
        return (
          <>
            <ellipse cx="12" cy="6.4" rx="6.4" ry="2.4" {...filled} />
            <path d="M5.6 6.4v10.4c0 1.4 2.9 2.6 6.4 2.6s6.4-1.2 6.4-2.6V6.4" {...common} />
            <path d="M7.6 14.2 10.2 11.6l2.2 1.8 4-4.8" {...common} strokeWidth={1.5} />
          </>
        );
      case 'arch-replication':
        return (
          <>
            <ellipse cx="7.2" cy="8.2" rx="3.6" ry="1.6" {...filled} />
            <path d="M3.6 8.2v6.4c0 .9 1.6 1.6 3.6 1.6s3.6-.7 3.6-1.6V8.2" {...common} />
            <ellipse cx="16.8" cy="8.2" rx="3.6" ry="1.6" {...filled} />
            <path d="M13.2 8.2v6.4c0 .9 1.6 1.6 3.6 1.6s3.6-.7 3.6-1.6V8.2" {...common} />
            <path d="M10.8 12h2.4M11.4 12l-.8 1.2M12.6 12l.8 1.2" {...common} strokeWidth={1.35} />
          </>
        );
      case 'arch-backup':
        return (
          <>
            <ellipse cx="12" cy="7.2" rx="5.6" ry="2.2" {...filled} />
            <path d="M6.4 7.2v5.6c0 1.2 2.5 2.2 5.6 2.2s5.6-1 5.6-2.2V7.2" {...common} />
            <rect x="8.4" y="14.8" width="7.2" height="5.2" rx="1.4" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M12 11.2v4.2M10.2 14l1.8 1.8 1.8-1.8" {...common} strokeWidth={1.5} />
          </>
        );
      case 'arch-etl':
        return (
          <>
            <rect x="3.6" y="9.2" width="5.2" height="5.2" rx="1.4" {...filled} />
            <rect x="9.4" y="7.2" width="5.2" height="9.2" rx="1.6" fill={soft} stroke={color} strokeWidth={1.25} />
            <rect x="15.2" y="9.2" width="5.2" height="5.2" rx="1.4" {...filled} />
            <path d="M8.8 11.8h.6M14.6 11.8h.6M11.6 9.8v1.2M11.6 14.2v1.2" {...common} strokeWidth={1.5} />
          </>
        );
      case 'arch-stream-processor':
        return (
          <>
            <path d="M6.4 6.2h11.2l-2.4 5.6H8.8L6.4 6.2Z" {...filled} />
            <path d="M8.8 11.8h6.4l-2.4 5.6H6.4l2.4-5.6Z" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M4 8.2c1.6.8 3.4 1.2 5.4 1.2M20 8.2c-1.6.8-3.4 1.2-5.4 1.2" {...common} strokeWidth={1.05} opacity={0.5} />
          </>
        );
      case 'arch-dead-letter':
        return (
          <>
            <rect x="4.4" y="6.8" width="15.2" height="10.4" rx="2.6" {...filled} />
            <path d="M8.2 9.6h7.6M8.2 12.4h5.2M8.2 15.2h3.2" {...common} strokeWidth={1.1} opacity={0.65} />
            <path d="m15.6 14.8 2.8 2.8M18.4 14.8l-2.8 2.8" {...common} strokeWidth={1.6} />
          </>
        );
      case 'arch-sso':
        return (
          <>
            <circle cx="7.2" cy="9.2" r="2.2" {...filled} />
            <circle cx="16.8" cy="9.2" r="2.2" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M4.8 17.2c.4-2.2 1.8-3.4 2.4-3.4s2 .8 2.4 3.4M14.4 17.2c.4-2.2 1.8-3.4 2.4-3.4s2 .8 2.4 3.4" {...common} strokeWidth={1.1} />
            <path d="M10.8 12.4h2.4l1.6 3.2h-5.6l1.6-3.2Z" {...filled} />
          </>
        );
      case 'arch-health-check':
        return (
          <>
            <circle cx="12" cy="12" r="7.2" {...filled} />
            <path d="M8.4 12.4 10.8 14.8l5.2-5.6" {...common} strokeWidth={1.8} />
            <path d="M6.8 18.4c1.2-2.4 3-3.6 5.2-3.6s4 .8 5.2 3.6" {...common} strokeWidth={1.05} opacity={0.45} />
          </>
        );
      case 'arch-knowledge':
        return (
          <>
            <path d="M6.4 5.2h8.8a1.8 1.8 0 0 1 1.8 1.8v12.4a1.8 1.8 0 0 0-1.8-1.2H6.4V5.2Z" {...filled} />
            <path d="M15.2 6.8h2.4a1.8 1.8 0 0 1 1.8 1.8v10.2a1.8 1.8 0 0 0-1.8-1.2h-2.4" fill={soft} stroke={color} strokeWidth={1.25} />
            <path d="M8.8 9.2h4.8M8.8 12h4.8M8.8 14.8h3.2" {...common} strokeWidth={1.1} opacity={0.65} />
          </>
        );
      case 'arch-workflow':
        return (
          <>
            <circle cx="6.4" cy="12" r="2.4" {...filled} />
            <circle cx="12" cy="12" r="2.4" {...filled} />
            <circle cx="17.6" cy="12" r="2.4" {...filled} />
            <path d="M8.8 12h1.6M14.4 12h1.6" {...common} strokeWidth={1.6} />
            <path d="M6.4 8.8V6.4M12 8.8V5.6M17.6 8.8V6.4" {...common} strokeWidth={1.1} opacity={0.45} />
          </>
        );
      case 'arch-circuit-breaker':
        return (
          <>
            <path d="M4.4 12h4.8M14.8 12h4.8" {...common} strokeWidth={1.7} />
            <rect x="9.2" y="8.4" width="5.6" height="7.2" rx="1.6" {...filled} />
            <path d="M11.6 10.4v3.2M13.6 10.4v3.2" {...common} strokeWidth={1.5} />
            <path d="M9.2 6.8 11.6 8.4M14.8 6.8 12.4 8.4" {...common} strokeWidth={1.2} opacity={0.55} />
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
