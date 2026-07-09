import { ELK_CONFIG } from '@/lib/config';

export const LAYOUT_PRESETS = [
  {
    id: 'freeform',
    label: 'Free-form',
    description: 'Keep nodes where they are',
    icon: '✋',
    elkOptions: null,
    isFreeform: true,
  },
  {
    id: 'layered-lr',
    label: 'Left → Right',
    description: 'Classic architecture flow',
    icon: '→',
    elkOptions: { 
      ...ELK_CONFIG,
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '160', // vertical gap between parallel (stacked) nodes
      'elk.layered.spacing.nodeNodeBetweenLayers': '220', // horizontal gap between layers
      'elk.portConstraints': 'FREE',
    }
  },
  {
    id: 'layered-tb',
    label: 'Top → Bottom',
    description: 'Vertical flow, good for pipelines',
    icon: '↓',
    elkOptions: { 
      ...ELK_CONFIG, 
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '200', // horizontal gap between parallel nodes
      'elk.layered.spacing.nodeNodeBetweenLayers': '200', // vertical gap between layers
      'elk.portConstraints': 'FREE',
    }
  },
  {
    id: 'force',
    label: 'Force Directed',
    description: 'Organic clustering by relationships',
    icon: '✦',
    elkOptions: { 
      ...ELK_CONFIG, 
      'elk.algorithm': 'force', 
      'elk.force.iterations': '300',
      'elk.portConstraints': 'FREE',
    }
  },
] as const;

export interface LayoutPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  elkOptions: Record<string, string> | null;
  isFreeform?: boolean;
}

export const DEFAULT_PRESET_ID = 'layered-lr';
