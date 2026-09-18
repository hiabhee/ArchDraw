'use client';

import type { ReactNode } from 'react';
import { LUCIDE_TO_ARCH_ICON, toCanvasArchIcon } from '@/lib/iconAliases';
import { CUSTOM_ICON_SET, type CustomNodeIconName } from '@/lib/archIconCatalog';

export type { CustomNodeIconName };

export function isCustomNodeIcon(iconName?: string): iconName is CustomNodeIconName {
  return toCustomNodeIconName(iconName) !== null;
}

export function toCustomNodeIconName(iconName?: string): CustomNodeIconName | null {
  if (!iconName) return null;
  const canvas = toCanvasArchIcon(iconName);
  if (canvas && CUSTOM_ICON_SET.has(canvas)) return canvas as CustomNodeIconName;
  if (LUCIDE_TO_ARCH_ICON[iconName] && CUSTOM_ICON_SET.has(LUCIDE_TO_ARCH_ICON[iconName])) {
    return LUCIDE_TO_ARCH_ICON[iconName] as CustomNodeIconName;
  }
  return null;
}

interface CustomNodeIconProps {
  name: CustomNodeIconName;
  color?: string;
  size?: number;
}

function mark(color: string) {
  return {
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function Glyphs({ name, color }: { name: CustomNodeIconName; color: string }): ReactNode {
  const s = mark(color);
  switch (name) {
    case 'arch-web':
      return (
        <>
          <rect x="4" y="5.5" width="16" height="11" rx="1.75" {...s} />
          <path d="M4 8.5h16M9 16.5v2h6v-2" {...s} />
        </>
      );
    case 'arch-mobile':
      return (
        <>
          <rect x="8" y="3.5" width="8" height="17" rx="1.75" {...s} />
          <path d="M11 18.5h2" {...s} />
        </>
      );
    case 'arch-desktop':
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" {...s} />
          <path d="M8 18.5h8M12 15.5v3" {...s} />
        </>
      );
    case 'arch-terminal':
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="1.75" {...s} />
          <path d="M7.5 10 10 12.5 7.5 15M12.5 15h4" {...s} />
        </>
      );
    case 'arch-users':
      return (
        <>
          <circle cx="9" cy="8.5" r="2.4" {...s} />
          <path d="M4.5 18c.4-3 2.2-4.6 4.5-4.6S13.1 15 13.5 18" {...s} />
          <circle cx="16" cy="9.2" r="2" {...s} />
          <path d="M13.6 18c.3-2.2 1.5-3.3 2.9-3.3 1.5 0 2.7 1.1 3 3.3" {...s} />
        </>
      );
    case 'arch-api-gateway':
      return (
        <>
          <rect x="8.25" y="5" width="7.5" height="14" rx="1.5" {...s} />
          <path d="M3.5 12H8.25M15.75 12H20.5M5.5 9.5 3.5 12l2 2.5M18.5 9.5l2 2.5-2 2.5" {...s} />
        </>
      );
    case 'arch-grpc':
      return (
        <>
          <path d="M12 4.5 19 8.5v7L12 19.5 5 15.5v-7L12 4.5Z" {...s} />
          <path d="M8.5 10 12 12l3.5-2M8.5 14 12 12l3.5 2" {...s} />
        </>
      );
    case 'arch-load-balancer':
      return (
        <>
          <circle cx="12" cy="6" r="2.1" {...s} />
          <circle cx="6.2" cy="17.5" r="2.1" {...s} />
          <circle cx="17.8" cy="17.5" r="2.1" {...s} />
          <path d="M12 8.1V11.5H6.2v4M12 11.5h5.8v4" {...s} />
        </>
      );
    case 'arch-proxy':
      return (
        <>
          <path d="M4 8.5h9M4 15.5h9M11 6l3.5 2.5L11 11M11 13l3.5 2.5L11 18" {...s} />
          <rect x="15.25" y="6" width="4.75" height="12" rx="1.25" {...s} />
        </>
      );
    case 'arch-router':
      return (
        <>
          <rect x="6.5" y="8.5" width="11" height="7" rx="1.5" {...s} />
          <path d="M4 12h2.5M17.5 9.5H20M17.5 14.5H20M9 11.2h6M9 13h4" {...s} />
        </>
      );
    case 'arch-cdn':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <circle cx="12" cy="12" r="2" {...s} />
          <path d="M12 5.5V10M16.8 16.2 14 14.2M7.2 16.2 10 14.2" {...s} />
        </>
      );
    case 'arch-dns':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <path d="M12 4.75v14.5M4.75 12h14.5M7.2 8.2c1.5 1.3 3.1 2 4.8 2s3.3-.7 4.8-2M7.2 15.8c1.5-1.3 3.1-2 4.8-2s3.3.7 4.8 2" {...s} />
        </>
      );
    case 'arch-graphql':
      return (
        <>
          <path d="M12 4.25 19 8.25v7.5L12 19.75 5 15.75v-7.5L12 4.25Z" {...s} />
          <circle cx="12" cy="7.5" r="1.15" {...s} />
          <circle cx="7.7" cy="15" r="1.15" {...s} />
          <circle cx="16.3" cy="15" r="1.15" {...s} />
        </>
      );
    case 'arch-webhook':
      return (
        <>
          <circle cx="7" cy="8" r="2.4" {...s} />
          <circle cx="17" cy="8" r="2.4" {...s} />
          <circle cx="12" cy="16.5" r="2.4" {...s} />
          <path d="M9 9.4c.9.9 1.7 2.3 2 3.9M15 9.4c-.9.9-1.7 2.3-2 3.9" {...s} />
        </>
      );
    case 'arch-realtime':
      return (
        <>
          <path d="M6.5 13a5.5 5.5 0 0 1 11 0M8.5 13a3.5 3.5 0 0 1 7 0" {...s} />
          <circle cx="12" cy="13" r="1.35" {...s} />
          <path d="M12 14.4V19.5M9.75 19.5h4.5" {...s} />
        </>
      );
    case 'arch-external':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <path d="M4.75 12h14.5M12 4.75c2.1 2.2 3.2 4.6 3.2 7.25S14.1 17.05 12 19.25M12 4.75C9.9 6.95 8.8 9.35 8.8 12s1.1 5.05 3.2 7.25" {...s} />
        </>
      );
    case 'arch-server':
      return (
        <>
          <rect x="4.5" y="4.5" width="15" height="4.6" rx="1.1" {...s} />
          <rect x="4.5" y="9.7" width="15" height="4.6" rx="1.1" {...s} />
          <rect x="4.5" y="14.9" width="15" height="4.6" rx="1.1" {...s} />
          <path d="M7 6.8h.01M7 12h.01M7 17.2h.01" {...s} />
        </>
      );
    case 'arch-service':
      return (
        <>
          <path d="M12 4.5 19 8.5v7L12 19.5 5 15.5v-7L12 4.5Z" {...s} />
          <circle cx="12" cy="12" r="1.6" {...s} />
        </>
      );
    case 'arch-function':
      return (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="2" {...s} />
          <path d="M10.2 7.5h2.1l-2.7 4.5h2.6L9.4 16.6" {...s} />
        </>
      );
    case 'arch-worker':
      return (
        <>
          <circle cx="12" cy="12" r="3.1" {...s} />
          <path d="M12 5.2v1.8M12 17v1.8M5.2 12h1.8M17 12h1.8M7.1 7.1l1.3 1.3M15.6 15.6l1.3 1.3M16.9 7.1l-1.3 1.3M8.4 15.6 7.1 16.9" {...s} />
        </>
      );
    case 'arch-scheduler':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <path d="M12 8v4.2l3 1.7" {...s} />
        </>
      );
    case 'arch-batch':
      return (
        <>
          <rect x="5" y="4.5" width="14" height="4.4" rx="1.1" {...s} />
          <rect x="5" y="9.8" width="14" height="4.4" rx="1.1" {...s} />
          <rect x="5" y="15.1" width="14" height="4.4" rx="1.1" {...s} />
        </>
      );
    case 'arch-docker':
      return (
        <>
          <rect x="6" y="9" width="3.2" height="3.2" rx="0.4" {...s} />
          <rect x="10.4" y="9" width="3.2" height="3.2" rx="0.4" {...s} />
          <rect x="10.4" y="5" width="3.2" height="3.2" rx="0.4" {...s} />
          <rect x="14.8" y="9" width="3.2" height="3.2" rx="0.4" {...s} />
          <path d="M4.5 14.2h15c.7 0 1.6.6 1.6 1.8 0 2.4-2.4 3.5-6.2 3.5H9.2c-2.4 0-4.7-1.1-4.7-3.5 0-.6.2-1.2.6-1.6" {...s} />
        </>
      );
    case 'arch-kubernetes':
      return (
        <>
          <path d="M12 4.2 16.6 7.4v6.4L12 17.2 7.4 13.8V7.4L12 4.2Z" {...s} />
          <path d="M12 17.2v2.6M7.4 13.8 4.8 15.4M16.6 13.8l2.6 1.6" {...s} />
        </>
      );
    case 'arch-cluster':
      return (
        <>
          <rect x="3.8" y="4.8" width="6.4" height="6.4" rx="1.2" {...s} />
          <rect x="13.8" y="4.8" width="6.4" height="6.4" rx="1.2" {...s} />
          <rect x="8.8" y="13" width="6.4" height="6.4" rx="1.2" {...s} />
        </>
      );
    case 'arch-vm':
      return (
        <>
          <rect x="4.5" y="5" width="15" height="14" rx="1.75" {...s} />
          <rect x="7.5" y="8" width="9" height="6.5" rx="1" {...s} />
        </>
      );
    case 'arch-upload':
      return (
        <>
          <path d="M12 16V5.5M8.2 9 12 5.2 15.8 9" {...s} />
          <path d="M5 14.5v3.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6v-3.2" {...s} />
        </>
      );
    case 'arch-download':
      return (
        <>
          <path d="M12 5.5V16M8.2 12.5 12 16.2 15.8 12.5" {...s} />
          <path d="M5 14.5v3.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6v-3.2" {...s} />
        </>
      );
    case 'arch-database':
      return (
        <>
          <ellipse cx="12" cy="6.5" rx="6.5" ry="2.4" {...s} />
          <path d="M5.5 6.5v9.2c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6.5" {...s} />
          <path d="M5.5 11.2c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5" {...s} />
        </>
      );
    case 'arch-document-db':
      return (
        <>
          <rect x="5.5" y="4.5" width="10" height="12.5" rx="1.25" {...s} />
          <rect x="8.5" y="7" width="10" height="12.5" rx="1.25" {...s} />
          <path d="M11 11h5M11 13.5h5" {...s} />
        </>
      );
    case 'arch-key-value':
      return (
        <>
          <circle cx="7.5" cy="12" r="3.2" {...s} />
          <path d="M10.4 12H20M16.5 9.2 20 12l-3.5 2.8" {...s} />
        </>
      );
    case 'arch-timeseries':
      return (
        <>
          <ellipse cx="12" cy="6.8" rx="6.2" ry="2.2" {...s} />
          <path d="M5.8 6.8v9.6c0 1.3 2.8 2.3 6.2 2.3s6.2-1 6.2-2.3V6.8" {...s} />
          <path d="M8 14.2 10.4 11.6l2.1 1.7 3.8-4.4" {...s} />
        </>
      );
    case 'arch-cache':
      return (
        <>
          <rect x="4.5" y="5" width="15" height="14" rx="2" {...s} />
          <path d="M14.8 8 11.6 12.2h3.2L11.2 16.5" {...s} />
        </>
      );
    case 'arch-storage':
      return (
        <>
          <path d="M4.8 8.5 12 4.8l7.2 3.7-7.2 3.7-7.2-3.7Z" {...s} />
          <path d="M4.8 12.2 12 15.9l7.2-3.7M4.8 15.8 12 19.5l7.2-3.7" {...s} />
        </>
      );
    case 'arch-file':
      return (
        <>
          <path d="M5 8h5l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V9.5A1.5 1.5 0 0 1 5 8Z" {...s} />
          <path d="M5 8V6.2A1.2 1.2 0 0 1 6.2 5h3.8L11.4 7" {...s} />
        </>
      );
    case 'arch-warehouse':
      return (
        <>
          <path d="M4.5 10.5 12 4.8l7.5 5.7V19.5H4.5V10.5Z" {...s} />
          <path d="M9.2 19.5v-5h5.6v5" {...s} />
        </>
      );
    case 'arch-search':
      return (
        <>
          <circle cx="10.4" cy="10.4" r="5.4" {...s} />
          <path d="m14.4 14.4 4.8 4.8" {...s} />
        </>
      );
    case 'arch-vector':
      return (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.75" {...s} />
          <circle cx="8.5" cy="8.5" r="0.9" fill={color} stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="15.5" cy="8.5" r="0.9" fill={color} stroke="none" />
          <circle cx="8.5" cy="15.5" r="0.9" fill={color} stroke="none" />
          <circle cx="15.5" cy="15.5" r="0.9" fill={color} stroke="none" />
        </>
      );
    case 'arch-replication':
      return (
        <>
          <ellipse cx="7.2" cy="8.2" rx="3.4" ry="1.5" {...s} />
          <path d="M3.8 8.2v6.2c0 .9 1.5 1.6 3.4 1.6s3.4-.7 3.4-1.6V8.2" {...s} />
          <ellipse cx="16.8" cy="8.2" rx="3.4" ry="1.5" {...s} />
          <path d="M13.4 8.2v6.2c0 .9 1.5 1.6 3.4 1.6s3.4-.7 3.4-1.6V8.2" {...s} />
          <path d="M10.8 12h2.4" {...s} />
        </>
      );
    case 'arch-backup':
      return (
        <>
          <ellipse cx="12" cy="7.4" rx="5.4" ry="2.1" {...s} />
          <path d="M6.6 7.4v5.4c0 1.2 2.4 2.1 5.4 2.1s5.4-.9 5.4-2.1V7.4" {...s} />
          <path d="M12 11.5v6.5M9.8 15.6 12 17.8l2.2-2.2" {...s} />
        </>
      );
    case 'arch-etl':
      return (
        <>
          <rect x="3.5" y="9.2" width="5" height="5.6" rx="1" {...s} />
          <rect x="9.5" y="7.2" width="5" height="9.6" rx="1.1" {...s} />
          <rect x="15.5" y="9.2" width="5" height="5.6" rx="1" {...s} />
        </>
      );
    case 'arch-message-queue':
      return (
        <>
          <rect x="4" y="7.5" width="16" height="9" rx="4.5" {...s} />
          <path d="M8 10.2v3.6M12 10.2v3.6M16 10.2v3.6" {...s} />
        </>
      );
    case 'arch-event-stream':
      return (
        <>
          <path d="M4 8.2c2.4-2 4.8-2 7.2 0s4.8 2 7.2 0M4 12c2.4-2 4.8-2 7.2 0s4.8 2 7.2 0M4 15.8c2.4-2 4.8-2 7.2 0s4.8 2 7.2 0" {...s} />
        </>
      );
    case 'arch-stream-processor':
      return (
        <>
          <path d="M6.5 5.5h11L15 11H9L6.5 5.5Z" {...s} />
          <path d="M9 11h6l-2.5 7.5H7.5L9 11Z" {...s} />
        </>
      );
    case 'arch-producer':
      return (
        <>
          <rect x="4" y="6.5" width="10" height="11" rx="1.5" {...s} />
          <path d="M15.5 9.2 20 12l-4.5 2.8M14.8 12H20" {...s} />
        </>
      );
    case 'arch-consumer':
      return (
        <>
          <rect x="10" y="6.5" width="10" height="11" rx="1.5" {...s} />
          <path d="M8.5 9.2 4 12l4.5 2.8M4 12h5.2" {...s} />
        </>
      );
    case 'arch-consumer-group':
      return (
        <>
          <rect x="4.5" y="5" width="7" height="8" rx="1.25" {...s} />
          <rect x="12.5" y="5" width="7" height="8" rx="1.25" {...s} />
          <rect x="8.5" y="11.5" width="7" height="8" rx="1.25" {...s} />
        </>
      );
    case 'arch-broker':
      return (
        <>
          <ellipse cx="12" cy="12" rx="8" ry="5.4" {...s} />
          <circle cx="12" cy="12" r="1.6" {...s} />
        </>
      );
    case 'arch-topic':
      return (
        <>
          <path d="M5.5 8.2c0-1.4 2.9-2.6 6.5-2.6s6.5 1.2 6.5 2.6v7.4c0 1.4-2.9 2.6-6.5 2.6s-6.5-1.2-6.5-2.6V8.2Z" {...s} />
          <path d="M5.5 8.2c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6" {...s} />
        </>
      );
    case 'arch-partition':
      return (
        <>
          <rect x="4.5" y="6" width="15" height="12" rx="1.5" {...s} />
          <path d="M9.5 6v12M14.5 6v12" {...s} />
        </>
      );
    case 'arch-coordinator':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <circle cx="12" cy="12" r="1.6" {...s} />
          <path d="M12 4.75v3.2M12 16.05v3.2M4.75 12h3.2M16.05 12h3.2" {...s} />
        </>
      );
    case 'arch-dead-letter':
      return (
        <>
          <rect x="4.5" y="6.5" width="15" height="11" rx="1.75" {...s} />
          <path d="M8 10h8M8 13h5M14.8 15.2l3.2 3.2M18 15.2l-3.2 3.2" {...s} />
        </>
      );
    case 'arch-auth':
      return (
        <>
          <path d="M12 4 5.5 6.6v5c0 4 2.7 6.9 6.5 8.1 3.8-1.2 6.5-4.1 6.5-8.1v-5L12 4Z" {...s} />
          <path d="m9.4 12.2 1.8 1.8 3.6-3.8" {...s} />
        </>
      );
    case 'arch-sso':
      return (
        <>
          <circle cx="8" cy="9" r="2.1" {...s} />
          <circle cx="16" cy="9" r="2.1" {...s} />
          <path d="M5.2 17.2c.4-2.2 1.6-3.3 2.8-3.3s2.4 1.1 2.8 3.3M13.2 17.2c.4-2.2 1.6-3.3 2.8-3.3s2.4 1.1 2.8 3.3" {...s} />
        </>
      );
    case 'arch-secrets':
      return (
        <>
          <rect x="6.2" y="10.5" width="11.6" height="8.5" rx="1.6" {...s} />
          <path d="M9 10.5V8.4a3 3 0 0 1 6 0v2.1" {...s} />
        </>
      );
    case 'arch-firewall':
      return (
        <>
          <rect x="4.5" y="5" width="15" height="14" rx="1.5" {...s} />
          <path d="M4.5 9.7h15M4.5 14.3h15M9.5 5v14M14.5 5v14" {...s} />
        </>
      );
    case 'arch-observability':
      return (
        <>
          <path d="M3.8 12c2.4-4.4 5.2-6.6 8.2-6.6S18 7.6 20.2 12c-2.2 4.4-5 6.6-8.2 6.6S6.2 16.4 3.8 12Z" {...s} />
          <circle cx="12" cy="12" r="2.4" {...s} />
        </>
      );
    case 'arch-metrics':
      return (
        <>
          <path d="M6.5 16.5V11M12 16.5V8M17.5 16.5V5.5" {...s} />
          <path d="M4.5 19h15" {...s} />
        </>
      );
    case 'arch-logs':
      return (
        <>
          <path d="M7 4.5h7.2L19 9.2V19a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 19V6.1A1.6 1.6 0 0 1 7 4.5Z" {...s} />
          <path d="M14.2 4.7V9h4.6M8.4 12.2h7M8.4 15h7M8.4 17.8h4.4" {...s} />
        </>
      );
    case 'arch-trace':
      return (
        <>
          <circle cx="6" cy="7.2" r="1.8" {...s} />
          <circle cx="12" cy="12" r="1.8" {...s} />
          <circle cx="18" cy="16.8" r="1.8" {...s} />
          <path d="M7.6 8.4 10.4 10.6M13.6 13.4l2.8 2.2" {...s} />
        </>
      );
    case 'arch-health-check':
      return (
        <>
          <circle cx="12" cy="12" r="7.25" {...s} />
          <path d="M8.2 12.3 10.6 14.7l5.2-5.6" {...s} />
        </>
      );
    case 'arch-notification':
      return (
        <>
          <path d="M8.4 17.6h7.2M12 4.2a5.2 5.2 0 0 1 5.2 5.2c0 3.3 1 4.4 1.7 5.4H5.1c.7-1 1.7-2.1 1.7-5.4A5.2 5.2 0 0 1 12 4.2Z" {...s} />
        </>
      );
    case 'arch-ai':
      return (
        <>
          <circle cx="12" cy="12" r="2.6" {...s} />
          <path d="M12 4.8v2.4M12 16.8v2.4M4.8 12h2.4M16.8 12h2.4M7 7l1.7 1.7M15.3 15.3 17 17M17 7l-1.7 1.7M8.7 15.3 7 17" {...s} />
        </>
      );
    case 'arch-agent':
      return (
        <>
          <rect x="5.5" y="7.5" width="13" height="11" rx="2.5" {...s} />
          <path d="M12 4.5v3M9.4 12.2h.01M14.6 12.2h.01M9.6 15.2h4.8" {...s} />
        </>
      );
    case 'arch-knowledge':
      return (
        <>
          <path d="M6.5 5.2h8.4a1.6 1.6 0 0 1 1.6 1.6v12.2H8.1A1.6 1.6 0 0 1 6.5 17.4V5.2Z" {...s} />
          <path d="M16.5 6.8h1.8A1.6 1.6 0 0 1 20 8.4v10.2h-3.5" {...s} />
        </>
      );
    case 'arch-cicd':
      return (
        <>
          <rect x="4" y="4.8" width="5.2" height="5.2" rx="1.2" {...s} />
          <rect x="14.8" y="4.8" width="5.2" height="5.2" rx="1.2" {...s} />
          <rect x="9.4" y="14" width="5.2" height="5.2" rx="1.2" {...s} />
          <path d="M9.2 7.4h5.6M17.4 10v2.2c0 1-.8 1.8-1.8 1.8h-1M6.6 10v2.2c0 1 .8 1.8 1.8 1.8h1" {...s} />
        </>
      );
    case 'arch-registry':
      return (
        <>
          <rect x="4.5" y="4.5" width="6.4" height="6.4" rx="1.1" {...s} />
          <rect x="13.1" y="4.5" width="6.4" height="6.4" rx="1.1" {...s} />
          <rect x="4.5" y="13.1" width="6.4" height="6.4" rx="1.1" {...s} />
          <rect x="13.1" y="13.1" width="6.4" height="6.4" rx="1.1" {...s} />
        </>
      );
    case 'arch-config':
      return (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="2" {...s} />
          <path d="M8 9.2h8M8 12h5.2M8 14.8h6.6" {...s} />
        </>
      );
    case 'arch-payment':
      return (
        <>
          <rect x="3.8" y="6.5" width="16.4" height="11" rx="1.75" {...s} />
          <path d="M3.8 10.2h16.4M7 14.6h4.4" {...s} />
        </>
      );
    case 'arch-email':
      return (
        <>
          <rect x="3.8" y="6.2" width="16.4" height="11.6" rx="1.75" {...s} />
          <path d="m4.6 7.6 7.4 5.4 7.4-5.4" {...s} />
        </>
      );
    case 'arch-chat':
      return (
        <>
          <path d="M5.2 6.2h13.6A2 2 0 0 1 21 8.2v6.2a2 2 0 0 1-2.2 2H11l-3.6 3v-3H5.2A2 2 0 0 1 3.2 14.4V8.2A2 2 0 0 1 5.2 6.2Z" {...s} />
        </>
      );
    case 'arch-maps':
      return (
        <>
          <path d="M12 4c-3.1 0-5.6 2.4-5.6 5.4 0 4.1 5.6 10.2 5.6 10.2s5.6-6.1 5.6-10.2C17.6 6.4 15.1 4 12 4Z" {...s} />
          <circle cx="12" cy="9.4" r="1.7" {...s} />
        </>
      );
    case 'arch-workflow':
      return (
        <>
          <circle cx="6.2" cy="12" r="2.2" {...s} />
          <circle cx="12" cy="12" r="2.2" {...s} />
          <circle cx="17.8" cy="12" r="2.2" {...s} />
          <path d="M8.4 12h1.4M14.2 12h1.4" {...s} />
        </>
      );
    case 'arch-circuit-breaker':
      return (
        <>
          <path d="M4.5 12h4.6M14.9 12h4.6" {...s} />
          <rect x="9.1" y="8.6" width="5.8" height="6.8" rx="1.2" {...s} />
          <path d="M11.2 10.6v2.8M13 10.6v2.8" {...s} />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="7.25" {...s} />;
  }
}

export function CustomNodeIcon({ name, color = '#334155', size = 18 }: CustomNodeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <Glyphs name={name} color={color} />
    </svg>
  );
}
