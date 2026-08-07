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
import type { CloudProviderId } from '@/lib/cloudIcons/types';

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
}

export function NodeIcon({ technology, fallbackIcon, fallbackColor, size = 18 }: NodeIconProps) {
  const entry = technology ? iconRegistry[technology] : undefined;
  const iconName = entry?.icon ?? fallbackIcon ?? 'Server';
  const color = entry?.color ?? fallbackColor ?? '#6B7280';

  if (technology && getTechnologyBrandSlug(technology) && entry?.kind !== 'aws') {
    return <TechnologyBrandIcon technology={technology} size={size} color={color} />;
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

export function resolveNodeColor(technology?: string, fallbackColor?: string): string {
  if (technology && iconRegistry[technology]) return iconRegistry[technology].color;
  return fallbackColor ?? '#6B7280';
}
