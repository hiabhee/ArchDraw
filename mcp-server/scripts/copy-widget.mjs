import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const source = new URL('../src/ui/diagram-widget.html', import.meta.url);
const destinationDirectory = new URL('../dist/ui/', import.meta.url);
const destination = new URL('diagram-widget.html', destinationDirectory);
const frontend = new URL('../../frontend/', import.meta.url);
const frontendRequire = createRequire(new URL('package.json', frontend));
let html = await readFile(source, 'utf8');

let esbuild;
try {
  esbuild = frontendRequire('esbuild');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  console.warn('Frontend dependencies are unavailable. Building the SVG preview without the interactive canvas.');
}

if (esbuild) {
  const bundle = await esbuild.build({
    absWorkingDir: fileURLToPath(frontend),
    entryPoints: ['components/viewers/embed/McpCanvasSurface.tsx'],
    outfile: 'canvas.js',
    jsx: 'automatic',
    alias: { '@/store/diagramStore': './components/viewers/embed/mcpReadOnlyStore.ts' },
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'ArchDrawCanvas',
    define: { 'process.env': '{"NODE_ENV":"production"}' },
    write: false,
  });
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const assets = `<style>${css.replace(/<\/style/gi, '<\\/style')}</style><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  html = html.replace('<!-- ARCHDRAW_CANVAS_ASSETS -->', () => assets);
}

await mkdir(destinationDirectory, { recursive: true });
await writeFile(destination, html);
