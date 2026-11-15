import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../archdraw');

// An allowlist keeps local commands, hooks, credentials and marketplace files
// out of the public package, even if more files are added to the source plugin.
export const PACKAGE_FILES = [
  'plugin.json',
  'mcp.json',
  'README.md',
  'assets/archdraw.png',
  'skills/archdraw/SKILL.md',
];

export function hostedSkill(text) {
  const marker = '\n## Live projects (Claude Code)\n';
  if (text.split(marker).length !== 2) {
    throw new Error('Live-project skill section changed; review the public skill before packaging.');
  }
  // Local-project instructions depend on hooks that are not in this package.
  return `${text.slice(0, text.indexOf(marker)).trimEnd()}\n`;
}

export async function buildPackage(outputDirectory = resolve(here, '..')) {
  const manifest = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8'));
  const hosted = JSON.parse(await readFile(join(source, '.mcp.json'), 'utf8')).mcpServers.archdraw;
  if (hosted.type !== 'http' || new URL(hosted.url).protocol !== 'https:') {
    throw new Error('The public package requires a hosted HTTPS MCP server.');
  }
  const openai = manifest.extensions['com.openai'];
  openai.interface.supportURL = `${manifest.repository}/issues`;
  openai.interface.defaultPrompt = [
    'Draw a web application with an API, Postgres database, and Redis cache.',
    'Add a message queue to my current ArchDraw diagram.',
    'Rearrange my current ArchDraw diagram from top to bottom.',
  ];
  openai.review = JSON.parse(await readFile(join(here, 'review.json'), 'utf8'));
  openai.publication = {
    release_notes: 'Public directory package using the hosted ArchDraw MCP server. Includes diagram creation, editing, layout, templates and shareable previews. Local lifecycle hooks are excluded.',
  };
  const mcp = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { archdraw: { type: 'streamable-http', url: hosted.url } },
  };
  const stage = await mkdtemp(join(tmpdir(), 'archdraw-openai-'));
  try {
    await mkdir(join(stage, 'assets'), { recursive: true });
    await mkdir(join(stage, 'skills/archdraw'), { recursive: true });
    await writeFile(join(stage, 'plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(stage, 'mcp.json'), `${JSON.stringify(mcp, null, 2)}\n`);
    await writeFile(join(stage, 'skills/archdraw/SKILL.md'), hostedSkill(await readFile(join(source, 'skills/archdraw/SKILL.md'), 'utf8')));
    await copyFile(join(source, 'assets/archdraw.png'), join(stage, 'assets/archdraw.png'));
    await writeFile(join(stage, 'README.md'), `# ArchDraw\n\nCreate, edit and lay out architecture diagrams with the hosted ArchDraw MCP server.\n\n## Connection and data\n\nThis public directory package connects to ${hosted.url} over HTTPS. It runs no local commands, installs no npm packages, and contains no lifecycle hooks or live-project tracking. No ArchDraw sign-in is required for these anonymous diagram tools.\n\nThe diagram content supplied to the tools (including labels, connections and Mermaid text) is sent to ArchDraw for processing. The server sees the caller's IP address for rate limiting. The server does not scan source files itself. An assistant may include source-derived information in the diagram it sends; do not include secrets.\n\nGenerated diagrams are published by default as unguessable preview links, readable by anyone with the URL, which expire after seven days. Request publish: false to avoid creating a public link; the hosted working session is still stored for 24 hours. Working-session IDs should be treated as private.\n\n## Support\n\n[Documentation](${manifest.homepage}/mcp) · [Support](${openai.interface.supportURL}) · [Privacy](${openai.interface.privacyPolicyURL}) · [Terms](${openai.interface.termsOfServiceURL})\n`);
    await mkdir(outputDirectory, { recursive: true });
    const output = resolve(outputDirectory, `archdraw-openai-${manifest.version}.zip`);
    // zip updates existing archives, so start fresh to prevent stale entries.
    await rm(output, { force: true });
    execFileSync('zip', ['-X', '-q', output, ...PACKAGE_FILES], { cwd: stage });
    return output;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildPackage());
}
