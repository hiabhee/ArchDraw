import { type ShapeType } from '@/lib/shapeRegistry';

export interface ShapeNodeData {
  label: string;
  sublabel?: string;
  /** Alias of `sublabel` written by planTranslator / buildReactFlow. */
  subtitle?: string;
  shape: ShapeType;
  color?: string;
  accentColor?: string;
  category?: string;
  componentType?: string;
  typeId?: string;
  icon?: string;
  iconSource?: string;
  technology?: string;
  serviceType?: string;
  nodeWidth?: number;
  nodeHeight?: number;
  showIcon?: boolean;
  /** true = icon only, false = always show label, undefined = auto (brand logos hide label). */
  iconOnly?: boolean;
  /** Vertical drum (database) vs horizontal pipe (queue / pub-sub). */
  cylinderAxis?: 'vertical' | 'horizontal';
  /** One-shot signal: enter inline label edit when the node mounts (blank draft nodes). */
  autoStartLabelEdit?: boolean;
}
