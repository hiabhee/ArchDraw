'use client';

import {
  Server, Zap, Boxes, Box, CircleDot, Sprout,
  HardDrive, Disc, FolderOpen, Archive,
  Database, Layers, Gauge, Sparkles, BarChart2, FileText,
  Webhook, RadioTower, Globe, Network, Scale, Shuffle,
  MessageSquare, Bell, Radio, Activity,
  Users, KeyRound, Lock, ShieldAlert, Shield,
  LayoutDashboard, GitBranch, ScrollText,
  GitPullRequest, Hammer, Package, Settings,
  Leaf, Bug, Flame, Triangle, Droplets, Code2,
  ShieldCheck, UserCheck, Search, AlertTriangle,
  Brain, Cpu, Link, Bot,
  Train, Cloud, Plane,
  Monitor, Timer, AppWindow, Key,
  GitMerge, Mail, CreditCard, Smartphone, Map, Plug,
  Upload, User, Play, Clock, MessageCircle, ArrowLeftRight, Inbox,
  LucideIcon,
} from 'lucide-react';
import { iconRegistry } from '@/lib/iconRegistry';
import { CustomNodeIcon, toCustomNodeIconName, isCustomNodeIcon } from './icons/CustomNodeIcon';
import { ProviderServiceIcon } from './icons/ProviderServiceIcon';
import { TechnologyBrandIcon } from './icons/TechnologyBrandIcon';
import { getTechnologyBrandSlug } from '@/lib/brandIcons';
import { filterIconForMode, shouldUseBrandLogoInMode, type RenderStyleId } from '@/lib/iconModeFilter';
import { normalizeColor } from '@/lib/semanticColors';
import type { CloudProviderId } from '@/lib/cloudIcons/types';

const GENERIC_ICON_COLOR = '#0891B2'; // Cyan-600 - semantic default

const LUCIDE_MAP: Record<string, LucideIcon> = {
  Server, Zap, Boxes, Box, CircleDot, Sprout,
  HardDrive, Disc, FolderOpen, Archive,
  Database, Layers, Gauge, Sparkles, BarChart2, FileText,
  Webhook, RadioTower, Globe, Network, Scale, Shuffle,
  MessageSquare, Bell, Radio, Activity,
  Users, KeyRound, Lock, ShieldAlert, Shield,
  LayoutDashboard, GitBranch, ScrollText,
  GitPullRequest, Hammer, Package, Settings,
  Leaf, Bug, Flame, Triangle, Droplets, Code2,
  ShieldCheck, UserCheck, Search, AlertTriangle,
  Brain, Cpu, Link, Bot,
  Train, Cloud, Plane,
  Monitor, Timer, AppWindow, Key,
  GitMerge, Mail, CreditCard, Smartphone, Map, Plug,
  Upload, User, Play, Clock, MessageCircle, ArrowLeftRight, Inbox,
};

function parseProviderServiceKey(iconName: string): { provider: CloudProviderId; serviceKey: string } | null {
  if (iconName.startsWith('aws-')) return { provider: 'aws', serviceKey: iconName };
  if (iconName.startsWith('azure-')) return { provider: 'azure', serviceKey: iconName };
  return null;
}

interface NodeIconProps {
  technology?: string;
  fallbackIcon?: string;
  fallbackColor?: string;
  size?: number;
  renderStyle?: RenderStyleId;
}

export function NodeIcon({ 
  technology, 
  fallbackIcon, 
  fallbackColor, 
  size = 18,
  renderStyle = 'precision', // Default to precision for backwards compatibility
}: NodeIconProps) {
  const entry = technology ? iconRegistry[technology] : undefined;
  let iconName = entry?.icon ?? fallbackIcon ?? 'Server';
  
  // Apply mode-specific filtering: in sketch mode, replace brand logos with role glyphs
  iconName = filterIconForMode(iconName, technology, renderStyle);
  
  // Normalize color (replace legacy purple with semantic colors)
  const normalizedFallbackColor = normalizeColor(fallbackColor, iconName);
  const color = entry?.color ?? normalizedFallbackColor ?? GENERIC_ICON_COLOR;

  // Technology brand logos: only render in modes where they're allowed
  if (technology && getTechnologyBrandSlug(technology) && entry?.kind !== 'aws') {
    if (shouldUseBrandLogoInMode(technology, renderStyle)) {
      return <TechnologyBrandIcon technology={technology} size={size} color={color} />;
    }
    // If brand logo suppressed in sketch mode, fall through to render the filtered glyph
  }

  if (entry?.kind === 'aws') {
    return <ProviderServiceIcon provider="aws" serviceKey={entry.icon} size={size} color={color} />;
  }

  const providerFromIcon = parseProviderServiceKey(iconName);
  if (providerFromIcon) {
    return (
      <ProviderServiceIcon
        provider={providerFromIcon.provider}
        serviceKey={providerFromIcon.serviceKey}
        size={size}
        color={color}
      />
    );
  }

  if (technology?.startsWith('azure-')) {
    return <ProviderServiceIcon provider="azure" serviceKey={technology} size={size} color={color} />;
  }

  // Handle custom icons (arch-*) from icon registry
  if (entry?.kind === 'custom' || iconName.startsWith('arch-')) {
    const customIconName = toCustomNodeIconName(iconName);
    if (customIconName) {
      return <CustomNodeIcon name={customIconName} color={color} size={size} />;
    }
  }

  // Handle custom icons via aliases (Database -> arch-database, etc.)
  if (isCustomNodeIcon(iconName)) {
    const customIconName = toCustomNodeIconName(iconName);
    if (customIconName) {
      return <CustomNodeIcon name={customIconName} color={color} size={size} />;
    }
  }

  if (!LUCIDE_MAP[iconName] && /[^\w\s-]/.test(iconName)) {
    return (
      <span style={{ color, fontSize: size, lineHeight: 1 }} aria-hidden="true">
        {iconName}
      </span>
    );
  }

  const Icon = LUCIDE_MAP[iconName] ?? Server;
  return <Icon size={size} style={{ color }} strokeWidth={2} />;
}

export function resolveNodeColor(technology?: string, fallbackColor?: string, iconName?: string): string {
  if (technology && iconRegistry[technology]) return iconRegistry[technology].color;
  return normalizeColor(fallbackColor, iconName) ?? GENERIC_ICON_COLOR;
}
