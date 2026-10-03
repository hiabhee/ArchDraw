import { readFileSync } from 'node:fs';

export const DIAGRAM_WIDGET_URI = 'ui://archdraw/diagram-v1.html';
export const DIAGRAM_WIDGET_HTML = readFileSync(new URL('./diagram-widget.html', import.meta.url), 'utf8');
