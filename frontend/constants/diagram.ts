import { MarkerType } from 'reactflow';
import { EDGE_CONFIG, NODE_CONFIG, ELK_CONFIG } from '@/lib/config';

export const DIAGRAM_CONSTANTS = {
  node: {
    width: NODE_CONFIG.defaultWidth,
    minHeight: NODE_CONFIG.defaultHeight,
    padding: 16,
    borderRadius: 12,
    iconSize: 10,
  },
  edge: {
    stroke: EDGE_CONFIG.strokeColor,
    strokeWidth: EDGE_CONFIG.strokeWidth,
    dashArray: '5,4',
    arrowWidth: EDGE_CONFIG.markerWidth,
    arrowHeight: EDGE_CONFIG.markerHeight,
    labelFontSize: EDGE_CONFIG.label.fontSize,
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  },
  elk: {
    nodeSpacing: parseInt(ELK_CONFIG['elk.spacing.nodeNode']),
    layerSpacing: parseInt(ELK_CONFIG['elk.layered.spacing.nodeNodeBetweenLayers']),
    edgeNodeSpacing: parseInt(ELK_CONFIG['elk.spacing.edgeNode']),
  },
};

export const EDGE_MARKER: { type: MarkerType; color: string; width: number; height: number } = {
  type: EDGE_CONFIG.markerType,
  color: EDGE_CONFIG.strokeColor,
  width: EDGE_CONFIG.markerWidth,
  height: EDGE_CONFIG.markerHeight,
};
