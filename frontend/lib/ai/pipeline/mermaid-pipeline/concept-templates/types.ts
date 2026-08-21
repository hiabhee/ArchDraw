import type { FormatConfig, StyleConfig } from '../types';
import { themePrimaryColor, themeToNodeTypeStyles, getDiagramTheme } from '@/lib/theme/stylingConstants';

export interface ConceptTemplatePlan {
  formatConfig: FormatConfig;
  styleConfig: StyleConfig;
  mermaidCode: string;
  reasoning: string;
}

export type ConceptDomain =
  | 'api-edge'
  | 'messaging'
  | 'container-runtime'
  | 'operating-system'
  | 'database'
  | 'cache'
  | 'orchestration'
  | 'observability'
  | 'security'
  | 'search'
  | 'storage'
  | 'runtime';

export interface ImplicitConcept {
  subject: string;
  domain: ConceptDomain;
  template?: 'docker' | 'api-gateway' | 'kafka' | 'linux';
}

export const BASE_STYLE: StyleConfig = {
  primaryColor: themePrimaryColor('slate'),
  secondaryColor: getDiagramTheme('slate').concerns.data.color,
  background: getDiagramTheme('slate').light.canvasHint,
  backgroundColor: getDiagramTheme('slate').light.canvasHint,
  fontFamily: 'Inter',
  theme: 'slate',
  nodeTypeStyles: themeToNodeTypeStyles('slate'),
};

export const FORMAT: FormatConfig = {
  format: 'mermaid',
  diagramType: 'graph LR',
  optionalVariants: [],
};
