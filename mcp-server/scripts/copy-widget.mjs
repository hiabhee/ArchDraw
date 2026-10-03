import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../src/ui/diagram-widget.html', import.meta.url);
const destinationDirectory = new URL('../dist/ui/', import.meta.url);
const destination = new URL('../dist/ui/diagram-widget.html', import.meta.url);

await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, destination);
