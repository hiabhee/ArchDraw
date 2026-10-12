import { getBinding, removeBinding, resolveRepoRoot, saveBinding, bindingFilePath } from '../lib/project-binding.js';

/**
 * `archdraw-mcp-server link|unlink|status` — pair this git checkout with an
 * ArchDraw live project. Pairing uses the browser approval flow
 * (`/api/agentic/pairing`): the CLI shows a code, the user enters it in the
 * editor's Live project panel, and the CLI receives a project-scoped token.
 * Output goes to stderr except the final machine-readable line.
 */

export const PROJECT_COMMANDS = new Set(['link', 'unlink', 'status']);

const POLL_INTERVAL_MS = 3000;

interface CliIO {
  log: (message: string) => void;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

const defaultIO = (): CliIO => ({
  log: (message) => process.stderr.write(`${message}\n`),
  fetch,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  cwd: process.cwd(),
  env: process.env,
});

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2);
      flags[key] = inline ?? argv[++i] ?? '';
    }
  }
  return flags;
}

function formatUserCode(code: string) {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

function normalizeApiBase(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function link(flags: Record<string, string>, io: CliIO): Promise<number> {
  const apiBase = normalizeApiBase(flags.api || io.env.API_BASE_URL);
  if (!apiBase) {
    io.log('Pass the ArchDraw URL: link --api https://archdraw.hiabhee.online (https, or http://localhost for development).');
    return 2;
  }
  const repoRoot = resolveRepoRoot(io.cwd);

  const start = await io.fetch(`${apiBase}/api/agentic/pairing`, { method: 'POST' });
  if (!start.ok) {
    io.log(`Could not start pairing (${start.status}).`);
    return 1;
  }
  const pairing = (await start.json()) as { pairingId: string; userCode: string; pollToken: string; expiresAt: string };

  io.log('');
  io.log(`Linking ${repoRoot} to an ArchDraw live project.`);
  io.log(`Open your project canvas in ArchDraw → Live project → Link a checkout (or the pairing code field when you make the project), and enter:`);
  io.log('');
  io.log(`    ${formatUserCode(pairing.userCode)}`);
  io.log('');
  io.log(`Waiting for approval (expires ${new Date(pairing.expiresAt).toLocaleTimeString()})…`);

  const deadline = new Date(pairing.expiresAt).getTime();
  while (Date.now() < deadline) {
    await io.sleep(POLL_INTERVAL_MS);
    const res = await io.fetch(`${apiBase}/api/agentic/pairing/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingId: pairing.pairingId, pollToken: pairing.pollToken }),
    });
    if (res.status === 202) continue;
    if (res.status === 410) break;
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      projectId?: string;
      workspaceId?: string;
      canvasId?: string | null;
    };
    if (res.ok && body.status === 'complete' && body.projectId && body.workspaceId) {
      if (!body.canvasId) {
        io.log('Approved, but that project is not linked to a canvas. Use "Make live project" on a canvas and try again.');
        return 1;
      }
      saveBinding(repoRoot, {
        apiBase,
        canvasId: body.canvasId,
        agenticProjectId: body.projectId,
        workspaceId: body.workspaceId,
        token: pairing.pollToken,
        linkedAt: new Date().toISOString(),
      });
      io.log(`Linked. Credentials saved to ${bindingFilePath()} (outside the repository).`);
      io.log(`Project canvas: ${apiBase}/editor?canvas=${encodeURIComponent(body.canvasId)}`);
      return 0;
    }
    if (!res.ok && res.status !== 409) {
      io.log(`Pairing failed (${res.status}).`);
      return 1;
    }
  }
  io.log('Pairing code expired. Run link again.');
  return 1;
}

function unlink(io: CliIO): number {
  const repoRoot = resolveRepoRoot(io.cwd);
  const removed = removeBinding(repoRoot);
  io.log(removed
    ? `Unlinked ${repoRoot}. To revoke the credential too, use "Stop" in the editor's Live project panel.`
    : `${repoRoot} is not linked.`);
  return 0;
}

function status(io: CliIO): number {
  const repoRoot = resolveRepoRoot(io.cwd);
  const binding = getBinding(repoRoot);
  if (!binding) {
    io.log(`${repoRoot} is not linked to an ArchDraw project.`);
    return 1;
  }
  io.log(`${repoRoot} → ${binding.apiBase}/editor?canvas=${encodeURIComponent(binding.canvasId)} (linked ${binding.linkedAt})`);
  return 0;
}

export async function runProjectCommand(command: string, argv: string[], io: CliIO = defaultIO()): Promise<number> {
  const flags = parseArgs(argv);
  if (command === 'link') return link(flags, io);
  if (command === 'unlink') return unlink(io);
  return status(io);
}
