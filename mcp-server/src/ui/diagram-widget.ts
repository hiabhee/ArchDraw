import { readFileSync } from 'node:fs';

export const DIAGRAM_WIDGET_URI = 'ui://archdraw/diagram-v2.html';
/** Tool-result `_meta` key holding the drawn diagram (SVG) for the preview. */
export const PREVIEW_SVG_META_KEY = 'archdraw/previewSvg';
export const DIAGRAM_WIDGET_HTML = readFileSync(new URL('./diagram-widget.html', import.meta.url), 'utf8');
