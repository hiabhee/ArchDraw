import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelFor, scanRepository, stripJsonc } from './scan.mjs';

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'archdraw-scan-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test('maps a Next.js app: API routes apart from pages, imports become edges, SDKs become services', () => {
  const root = repo({
    'package.json': JSON.stringify({ name: 'shop', dependencies: { stripe: '1' } }),
    'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } // comment\n}',
    'app/page.tsx': "import { Cart } from '@/components/Cart';",
    'app/checkout/page.tsx': "import { Cart } from '@/components/Cart';",
    'app/api/pay/route.ts': "import { charge } from '@/lib/payments';",
    'app/api/orders/route.ts': "import { db } from '@/lib/db';",
    'components/Cart.tsx': "import { format } from '../lib/format';",
    'components/Button.tsx': '',
    'lib/payments.ts': "import Stripe from 'stripe';",
    'lib/db.ts': "import { PrismaClient } from '@prisma/client';",
    'lib/format.ts': '',
    'prisma/schema.prisma': 'model User { id String @id }',
    'components/__tests__/Cart.test.tsx': "import x from '@/lib/db';",
    'node_modules/stripe/index.js': '',
  });
  const result = scanRepository(root, { repoName: 'shop' });
  const labels = result.components.map((c) => c.label).sort();
  assert.deepEqual(labels, ['API routes', 'Database', 'Pages', 'Shared lib', 'UI components']);
  const byLabel = Object.fromEntries(result.components.map((c) => [c.label, c]));
  assert.deepEqual(byLabel['API routes'].paths, ['app/api/**']);
  const edge = (a, b) => result.edges.some((e) => e.from === byLabel[a].id && e.to === b);
  assert.ok(edge('API routes', byLabel['Shared lib'].id));
  assert.ok(edge('Pages', byLabel['UI components'].id));
  assert.ok(edge('Shared lib', 'x_stripe'), 'Stripe is an external service');
  assert.ok(edge('Shared lib', byLabel.Database.id), 'Prisma points at the repo’s own database folder');
  assert.match(result.mermaid, /^graph LR\n/);
  assert.match(result.mermaid, /c_prisma\[\("Database"\)\]/);
  assert.match(result.mermaid, /%% archdraw-shape: \{"id":"x_stripe","shape":"cloud"\}/);
  assert.ok(!result.mermaid.includes('node_modules'));
});

test('a monorepo gets one group per package and keeps every package visible', () => {
  const files = { 'package.json': JSON.stringify({ name: 'mono', workspaces: ['apps/*'] }) };
  for (let i = 0; i < 40; i++) files[`apps/web/src/views/v${i % 8}/f${i}.tsx`] = '';
  files['apps/api/package.json'] = JSON.stringify({ name: '@mono/api' });
  files['apps/api/src/routes/a.ts'] = "import { x } from '../services/s';";
  files['apps/api/src/routes/b.ts'] = '';
  files['apps/api/src/services/s.ts'] = '';
  files['apps/api/src/services/t.ts'] = '';
  files['apps/web/package.json'] = JSON.stringify({ name: '@mono/web' });
  const result = scanRepository(repo(files), { repoName: 'mono' });
  assert.match(result.mermaid, /subgraph g_apps_api\["api"\]/);
  assert.match(result.mermaid, /subgraph g_apps_web\["web"\]/);
  assert.ok(result.components.some((c) => c.label === 'Services'));
});

test('a Python src layout is named after its package', () => {
  const files = { 'pyproject.toml': '[project]\nname = "glacier"' };
  for (const m of ['data', 'train', 'infer']) {
    files[`src/glacier/${m}/__init__.py`] = '';
    files[`src/glacier/${m}/core.py`] = m === 'train' ? 'from glacier.data import core\nimport openai' : '';
  }
  const result = scanRepository(repo(files), { repoName: 'glacier' });
  assert.deepEqual(result.components.map((c) => c.label).sort(), ['Data', 'Infer', 'Train']);
  assert.ok(result.edges.some((e) => e.to === 'x_openai'));
});

test('an empty folder still yields one component', () => {
  const result = scanRepository(repo({ 'README.md': '# hi' }), { repoName: 'hello-world' });
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].label, 'Hello world');
});

test('labels read like words', () => {
  assert.equal(labelFor('repo-diagram'), 'Repo diagram');
  assert.equal(labelFor('lib/ai'), 'AI');
  assert.equal(labelFor('@core'), 'Core');
  assert.equal(labelFor('app/api'), 'API routes');
});

test('JSONC comments are stripped without touching strings', () => {
  assert.deepEqual(JSON.parse(stripJsonc('{ "a/*": ["./*"], // x\n "b": "http://x", /* y */ }')), { 'a/*': ['./*'], b: 'http://x' });
});

test('the bundled hook script matches the plugin copy', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  assert.equal(
    readFileSync(join(here, '..', 'hooks', 'archdraw-project.mjs'), 'utf8'),
    readFileSync(join(here, '..', '..', 'plugins', 'archdraw', 'scripts', 'archdraw-project.mjs'), 'utf8'),
    'run: cp plugins/archdraw/scripts/archdraw-project.mjs cli/hooks/',
  );
});
