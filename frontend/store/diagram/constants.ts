export const MAX_GUEST_CANVASES = 1;
export const MAX_GUEST_NODES = 50;
export const MAX_AUTH_NODES = 150;

export const RESERVED_LAYER_LABELS = new Set([
  'presentation', 'presentation layer',
  'gateway', 'gateway layer',
  'application', 'application layer',
  'data', 'data layer',
  'async', 'async layer',
  'observability', 'observability layer',
  'external', 'external layer',
]);

export const KNOWN_NODE_TYPES = new Set([
  'systemNode',
  'architectureNode',
  'baseNode',
  'databaseNode',
  'cacheNode',
  'shapeNode',
  'groupNode',
  'group',
  'frameNode',
  'serviceNode',
  'textLabelNode',
  'annotationNode',
  'messageBrokerNode',
  'customNode',
]);

export const DEFAULT_EDGE_TYPE = 'smoothstep';

export const KNOWN_EDGE_TYPES = new Set([
  'custom',
  'simpleFloating',
  'default',
  'smoothstep',
  'floating',
  'flow',
  'async',
  'sync',
  'stream',
  'event',
  'dep',
  'dotted',
]);
