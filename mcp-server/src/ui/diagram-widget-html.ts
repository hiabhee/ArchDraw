import { readFileSync } from 'node:fs';

// Use the standalone HTML when running directly from source.
export default readFileSync(new URL('./diagram-widget.html', import.meta.url), 'utf8');
