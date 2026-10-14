// Derive a first architecture diagram from a repository's layout, on this
// machine: folders become components, imports between them become edges, and
// well-known SDKs (Stripe, Supabase, OpenAI, …) become external services.
// File contents are read locally to find imports and never leave the machine;
// the result holds only names, ids and repository-relative paths.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, posix } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.turbo', '.vercel', '.output',
  'coverage', 'vendor', 'target', '__pycache__', '.venv', 'venv', '.idea', '.vscode', '.cache', '.expo', 'Pods',
  'DerivedData', '.gradle', 'obj', '.dart_tool', '.pytest_cache', '.mypy_cache', 'generated', '__generated__', 'site-packages',
]);
/** Folders that hold no architecture of their own. */
const NOISE_DIRS = new Set([
  'docs', 'doc', 'examples', 'example', '.github', '.husky', '.changeset', '.storybook', 'public', 'static', 'assets',
  'images', 'img', 'fonts', 'styles', 'css', 'locales', 'i18n', 'types', 'typings', '@types', 'mocks', 'fixtures',
  'test', 'tests', '__tests__', 'spec', 'e2e', 'cypress', 'playwright', 'stories', 'benchmarks', 'bench',
]);
const SOURCE_RE = /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro|py|go|rs|java|kt|kts|rb|php|cs|swift|dart|ex|exs|scala|c|cc|cpp|h|hpp|sql|prisma|graphql|gql|proto)$/i;
const TEST_RE = /(^|\/)(__tests__|__mocks__|tests?|spec|e2e|__snapshots__)(\/|$)|\.(test|spec|stories)\.[^/]+$/i;
const MANIFESTS = new Set(['package.json', 'pyproject.toml', 'setup.py', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', 'pubspec.yaml', 'mix.exs']);
const DATA_DIRS = new Set(['prisma', 'db', 'database', 'migrations', 'supabase', 'sql', 'drizzle', 'schema']);

export const MAX_COMPONENTS = 24;
const MAX_FILES = 30_000;
const MAX_IMPORT_FILES = 6_000;
const MAX_READ_BYTES = 64 * 1024;
const MAX_EDGES = 40;
/** Per component, so a hub (utilities, the API layer) doesn't turn into a hairball. */
const MAX_OUT_EDGES = 4;
const MAX_EXTERNALS = 8;

const LABELS = {
  app: 'App', pages: 'Pages', 'app/api': 'API routes', 'pages/api': 'API routes', api: 'API', routes: 'Routes',
  components: 'UI components', ui: 'UI', hooks: 'Hooks', store: 'State store', stores: 'State store', state: 'State',
  lib: 'Shared lib', utils: 'Utilities', util: 'Utilities', helpers: 'Helpers', services: 'Services', server: 'Server',
  controllers: 'Controllers', models: 'Data models', schemas: 'Schemas', prisma: 'Database', db: 'Database',
  database: 'Database', migrations: 'Database migrations', supabase: 'Supabase', drizzle: 'Database', workers: 'Background workers',
  jobs: 'Background jobs', queues: 'Queues', middleware: 'Middleware', auth: 'Auth', config: 'Config', cmd: 'Commands',
  internal: 'Internal', pkg: 'Packages', cli: 'CLI', scripts: 'Scripts', emails: 'Emails', plugins: 'Plugins',
  views: 'Views', templates: 'Templates', screens: 'Screens', navigation: 'Navigation', features: 'Features',
  modules: 'Modules', core: 'Core', engine: 'Engine', agents: 'Agents', handlers: 'Handlers', providers: 'Providers',
  context: 'Context', contexts: 'Context', actions: 'Actions', integrations: 'Integrations', webhooks: 'Webhooks',
};
const ACRONYMS = new Set(['ai', 'api', 'db', 'ui', 'mcp', 'sdk', 'cli', 'aws', 'gcp', 'llm', 'sql', 'ws', 'io', 'id', 'url', 'pdf', 'svg', 'css', 'jwt', 'oauth', 'rpc', 'grpc', 'css', 'seo', 'cms', 'crm']);

/** External services recognised from imports: [matcher, key, label, kind]. */
const SERVICES = [
  [(s) => s === 'stripe' || s.startsWith('@stripe/'), 'stripe', 'Stripe', 'ext'],
  [(s) => s.startsWith('@supabase/') || s === 'supabase', 'supabase', 'Supabase', 'db'],
  [(s) => s === 'firebase' || s === 'firebase-admin' || s.startsWith('firebase/') || s.startsWith('@firebase/') || s === 'firebase_admin', 'firebase', 'Firebase', 'ext'],
  [(s) => s === 'openai', 'openai', 'OpenAI', 'ext'],
  [(s) => s.startsWith('@anthropic-ai/') || s === 'anthropic', 'anthropic', 'Anthropic', 'ext'],
  [(s) => s === 'groq-sdk' || s === 'groq', 'groq', 'Groq', 'ext'],
  [(s) => s.startsWith('@google/generative-ai') || s.startsWith('@google/genai') || s === 'google.generativeai', 'gemini', 'Gemini', 'ext'],
  [(s) => s === '@prisma/client' || s.startsWith('@prisma/'), 'database', 'Database', 'db'],
  [(s) => s === 'drizzle-orm' || s.startsWith('drizzle-orm/') || s === 'sqlalchemy' || s === 'knex' || s === 'typeorm' || s === 'sequelize', 'database', 'Database', 'db'],
  [(s) => s === 'pg' || s === 'postgres' || s === 'psycopg2' || s === 'psycopg' || s === 'asyncpg', 'postgres', 'PostgreSQL', 'db'],
  [(s) => s === 'mysql2' || s === 'mysql', 'mysql', 'MySQL', 'db'],
  [(s) => s === 'mongoose' || s === 'mongodb' || s === 'pymongo' || s === 'motor', 'mongodb', 'MongoDB', 'db'],
  [(s) => s === 'redis' || s === 'ioredis' || s === '@upstash/redis' || s === '@vercel/kv', 'redis', 'Redis', 'db'],
  [(s) => s === 'bullmq' || s === 'bull' || s === 'celery', 'queue', 'Job queue', 'db'],
  [(s) => s === 'kafkajs' || s === 'kafka', 'kafka', 'Kafka', 'db'],
  [(s) => s === '@aws-sdk/client-s3' || s === '@vercel/blob', 'storage', 'File storage', 'db'],
  [(s) => s.startsWith('@aws-sdk/') || s === 'aws-sdk' || s === 'boto3', 'aws', 'AWS', 'ext'],
  [(s) => s === 'resend' || s === 'nodemailer' || s.startsWith('@sendgrid/') || s === 'sendgrid' || s === 'postmark', 'email', 'Email', 'ext'],
  [(s) => s === 'twilio', 'twilio', 'Twilio', 'ext'],
  [(s) => s.startsWith('@clerk/'), 'clerk', 'Clerk', 'ext'],
  [(s) => s === 'next-auth' || s.startsWith('next-auth/') || s.startsWith('@auth/'), 'authjs', 'Auth.js', 'ext'],
  [(s) => s.startsWith('@octokit/') || s === 'octokit', 'github', 'GitHub API', 'ext'],
  [(s) => s === 'posthog-js' || s === 'posthog-node' || s === 'posthog', 'posthog', 'PostHog', 'ext'],
  [(s) => s.startsWith('@sentry/') || s === 'sentry_sdk', 'sentry', 'Sentry', 'ext'],
  [(s) => s === 'algoliasearch', 'algolia', 'Algolia', 'ext'],
  [(s) => s === 'cloudinary', 'cloudinary', 'Cloudinary', 'ext'],
  [(s) => s === 'replicate', 'replicate', 'Replicate', 'ext'],
];

function words(name) {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s.]+/)
    .filter(Boolean);
}

export function labelFor(path) {
  if (LABELS[path]) return LABELS[path];
  const name = (path.split('/').pop() ?? path).replace(/^[@_]+/, '');
  if (LABELS[name]) return LABELS[name];
  const parts = words(name).map((w, i) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase()));
  return parts.join(' ') || name;
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, timeout: 15_000 });
  } catch {
    return null;
  }
}

function skipped(path) {
  return path.split('/').some((segment) => SKIP_DIRS.has(segment));
}

/** Repository files (repo-relative, POSIX), honouring .gitignore when git is available. */
export function listFiles(root) {
  const fromGit = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root);
  if (fromGit !== null) {
    return fromGit.split('\0').filter((p) => p && !skipped(p)).slice(0, MAX_FILES);
  }
  const files = [];
  const walk = (dir, rel) => {
    if (files.length >= MAX_FILES) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(join(dir, entry.name), path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  walk(root, '');
  return files;
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const within = (path, dir) => !dir || path === dir || path.startsWith(`${dir}/`);
const relTo = (path, dir) => (dir ? path.slice(dir.length + 1) : path);
const joinPath = (dir, rest) => (dir && rest ? `${dir}/${rest}` : dir || rest);

function isNoisePath(path) {
  return path.split('/').some((segment) => NOISE_DIRS.has(segment));
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Drop comments and trailing commas (tsconfig/jsconfig), leaving strings intact. */
export function stripJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function readJsonc(path) {
  try {
    return JSON.parse(stripJsonc(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
}

/** Packages: folders with a manifest (plus the repository root). */
function findPackages(root, files) {
  const dirs = new Set(['']);
  for (const file of files) {
    const name = file.split('/').pop();
    if (MANIFESTS.has(name) && !isNoisePath(file)) dirs.add(dirOf(file));
  }
  return [...dirs].sort((a, b) => b.length - a.length).map((dir) => {
    const pkgJson = readJson(join(root, dir, 'package.json'));
    const goMod = existsSync(join(root, dir, 'go.mod')) ? readFileSync(join(root, dir, 'go.mod'), 'utf8') : '';
    return {
      dir,
      name: typeof pkgJson?.name === 'string' ? pkgJson.name : null,
      goModule: goMod.match(/^module\s+(\S+)/m)?.[1] ?? null,
      files: [],
    };
  });
}

/** Folder → number of source files under it (relative to `base`). */
function countByDir(files, base) {
  const counts = new Map();
  for (const file of files) {
    const rel = relTo(file, base);
    const segments = rel.split('/');
    for (let depth = 1; depth < segments.length; depth++) {
      const dir = segments.slice(0, depth).join('/');
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
  }
  return counts;
}

function childDirs(counts, dir) {
  const prefix = dir ? `${dir}/` : '';
  return [...counts.entries()]
    .filter(([d]) => d.startsWith(prefix) && !d.slice(prefix.length).includes('/') && d !== dir)
    .map(([d, n]) => ({ dir: d, count: n }));
}

/**
 * `src/my_package/…` (Python src layout) and similar wrappers: when nearly all
 * of a folder's files sit in one subfolder, name the component after that one.
 */
function throughWrappers(counts, sources, base, dir) {
  let current = dir;
  for (let depth = 0; depth < 3; depth++) {
    const count = counts.get(current) ?? 0;
    const children = childDirs(counts, current);
    const direct = sources.filter((f) => dirOf(relTo(f, base)) === current).length;
    const main = children.sort((a, b) => b.count - a.count)[0];
    if (!main || children.length > 1 || direct > 1 || main.count < count * 0.8) break;
    current = main.dir;
  }
  return current;
}

/** Components of one package: [{ dir (repo-relative), files?, label, count, kind }]. */
function packageComponents(pkg, files) {
  const sources = files.filter((f) => SOURCE_RE.test(f) && !TEST_RE.test(f));
  if (sources.length === 0) return [];
  const srcDir = joinPath(pkg.dir, 'src');
  const inSrc = sources.filter((f) => within(f, srcDir)).length;
  let base = inSrc / sources.length > 0.5 ? srcDir : pkg.dir;
  let counts = countByDir(sources, base);
  // Single-folder wrappers (src/my_package, src/main/java/com/acme): start where the code branches.
  for (let depth = 0; depth < 6; depth++) {
    const only = childDirs(counts, '');
    if (only.length !== 1 || sources.some((f) => dirOf(f) === base)) break;
    base = joinPath(base, only[0].dir);
    counts = countByDir(sources, base);
  }
  const total = sources.length;
  const out = [];

  const add = (relDir, count, label) => {
    const name = relDir.split('/').pop();
    out.push({
      dir: joinPath(base, relDir),
      count,
      label: label ?? labelFor(relDir),
      kind: DATA_DIRS.has(name) ? 'db' : 'code',
    });
  };

  for (const { dir, count } of childDirs(counts, '')) {
    if (NOISE_DIRS.has(dir) || dir.startsWith('.')) continue;
    const children = childDirs(counts, dir).filter((c) => !NOISE_DIRS.has(c.dir.split('/').pop()));
    // Route folders: the API is a component of its own (more specific paths win).
    if ((dir === 'app' || dir === 'pages') && counts.get(`${dir}/api`)) {
      add(`${dir}/api`, counts.get(`${dir}/api`), 'API routes');
      const rest = count - counts.get(`${dir}/api`);
      if (rest > 0) add(dir, rest, dir === 'app' ? 'Pages' : 'Pages');
      continue;
    }
    // A folder holding much of the code splits into its sub-areas (lib/ai, lib/server, …).
    const big = children.filter((c) => c.count >= 3);
    if (count >= 12 && count / total > 0.3 && big.length >= 2) {
      let covered = 0;
      for (const child of big) {
        add(child.dir, child.count);
        covered += child.count;
      }
      if (count - covered >= 2) add(dir, count - covered);
      continue;
    }
    if (count >= 2 || DATA_DIRS.has(dir) || ['api', 'server', 'auth'].includes(dir)) add(throughWrappers(counts, sources, base, dir), count);
  }

  // Source files directly in the package root (main.py, index.ts, server.go, …).
  const rootFiles = sources.filter((f) => dirOf(f) === base && basename(f) !== '__init__.py');
  if (rootFiles.length > 0 && (out.length === 0 || rootFiles.length >= 2 || rootFiles.some((f) => /^(main|index|app|server|cli)\./i.test(basename(f))))) {
    out.push({ dir: null, files: rootFiles.slice(0, 20), count: rootFiles.length, label: out.length === 0 ? labelFor(pkg.name || basename(pkg.dir) || 'App') : 'Entry point', kind: 'code' });
  }
  return out;
}

/**
 * Keep the diagram readable: at most MAX_COMPONENTS, but every package keeps
 * its biggest few, so a large vendored folder can't crowd out the backend.
 */
function pickComponents(all) {
  const byPkg = new Map();
  for (const comp of [...all].sort((a, b) => b.count - a.count)) {
    if (!byPkg.has(comp.pkg)) byPkg.set(comp.pkg, []);
    byPkg.get(comp.pkg).push(comp);
  }
  const picked = new Set();
  for (const comps of byPkg.values()) {
    for (const comp of comps.slice(0, 3)) if (picked.size < MAX_COMPONENTS) picked.add(comp);
  }
  for (const comp of [...all].sort((a, b) => b.count - a.count)) {
    if (picked.size >= MAX_COMPONENTS) break;
    picked.add(comp);
  }
  return all.filter((c) => picked.has(c)).sort((a, b) => b.count - a.count);
}

function slug(text) {
  return text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'root';
}

/** Escape a label for a quoted Mermaid node label. */
function mermaidLabel(text) {
  return String(text).replace(/"/g, "'").replace(/[\r\n]+/g, ' ').slice(0, 60);
}

const JS_IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
const PY_IMPORT_RE = /^\s*(?:from\s+([.\w]+)\s+import|import\s+([\w.]+))/gm;
const GO_STRING_RE = /"([^"\s]+)"/g;

function serviceFor(spec) {
  const bare = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  for (const [match, key, label, kind] of SERVICES) {
    if (match(spec) || match(bare)) return { key, label, kind };
  }
  return null;
}

/** Path aliases from tsconfig/jsconfig `paths` (e.g. "@/*" → "src/*"), repo-relative. */
function aliasesFor(root, pkg, base) {
  const config = readJsonc(join(root, pkg.dir, 'tsconfig.json')) ?? readJsonc(join(root, pkg.dir, 'jsconfig.json'));
  const options = config?.compilerOptions ?? {};
  const baseUrl = typeof options.baseUrl === 'string' ? posix.normalize(joinPath(pkg.dir, options.baseUrl)).replace(/^\.$/, '') : pkg.dir;
  const aliases = [];
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const target = Array.isArray(targets) ? targets[0] : null;
    if (typeof target !== 'string') continue;
    aliases.push({
      prefix: pattern.replace(/\*$/, ''),
      target: posix.normalize(joinPath(baseUrl, target.replace(/\*$/, ''))).replace(/^\.\/?/, '').replace(/\/$/, ''),
    });
  }
  if (aliases.length === 0) {
    aliases.push({ prefix: '@/', target: base }, { prefix: '~/', target: base });
  }
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Scan a repository. Returns `{ mermaid, componentPaths, components, edges, externals }`;
 * `componentPaths` maps each node id to the repo-relative paths/globs it owns.
 */
export function scanRepository(root, { repoName = basename(root) } = {}) {
  const files = listFiles(root);
  const packages = findPackages(root, files);
  for (const file of files) {
    const owner = packages.find((pkg) => within(file, pkg.dir));
    owner?.files.push(file);
  }

  let components = [];
  for (const pkg of packages) {
    for (const comp of packageComponents(pkg, pkg.files)) components.push({ ...comp, pkg });
  }
  if (components.length === 0) {
    components.push({ dir: '', count: files.length, label: labelFor(repoName), kind: 'code', pkg: packages[packages.length - 1] });
  }
  components = pickComponents(components);

  // Ids and unique labels within a package.
  const usedIds = new Set();
  for (const comp of components) {
    let id = `c_${slug(comp.dir ?? `${comp.pkg.dir}_entry`)}`;
    while (usedIds.has(id)) id = `${id}_`;
    usedIds.add(id);
    comp.id = id;
  }
  for (const comp of components) {
    const twins = components.filter((o) => o !== comp && o.pkg === comp.pkg && o.label === comp.label);
    if (twins.length > 0 && comp.dir) {
      const parent = comp.dir.split('/').slice(-2, -1)[0];
      if (parent) comp.label = `${comp.label} (${parent})`;
    }
  }

  const dirComponents = components.filter((c) => c.dir !== null).sort((a, b) => b.dir.length - a.dir.length);
  const fileComponents = components.filter((c) => c.dir === null);
  const componentFor = (path) => {
    if (!path) return null;
    for (const comp of fileComponents) {
      if (comp.files.some((f) => f === path || f.startsWith(`${path}.`) || f.startsWith(`${path}/index.`))) return comp;
    }
    return dirComponents.find((comp) => within(path, comp.dir)) ?? null;
  };

  // Imports → edges.
  const byName = new Map(packages.filter((p) => p.name).map((p) => [p.name, p]));
  const goModules = packages.filter((p) => p.goModule);
  const largestIn = (pkg) => components.filter((c) => c.pkg === pkg).sort((a, b) => b.count - a.count)[0] ?? null;
  const aliasCache = new Map();
  const edgeWeights = new Map();
  const externals = new Map();
  const link = (from, to) => {
    if (!from || !to || from === to) return;
    const key = `${from.id}>${to.id}`;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  };
  const linkExternal = (from, service) => {
    if (!from) return;
    const entry = externals.get(service.key) ?? { ...service, id: `x_${service.key}`, from: new Map() };
    entry.from.set(from.id, (entry.from.get(from.id) ?? 0) + 1);
    externals.set(service.key, entry);
  };

  const scanned = files.filter((f) => /\.(m?[jt]sx?|c[jt]s|vue|svelte|astro|py|go)$/i.test(f) && !TEST_RE.test(f)).slice(0, MAX_IMPORT_FILES);
  for (const file of scanned) {
    const from = componentFor(file);
    if (!from) continue;
    let text;
    try {
      const full = join(root, file);
      if (statSync(full).size > 1024 * 1024) continue;
      text = readFileSync(full, 'utf8').slice(0, MAX_READ_BYTES);
    } catch {
      continue;
    }
    const pkg = from.pkg;
    const dir = dirOf(file);

    if (/\.py$/i.test(file)) {
      for (const m of text.matchAll(PY_IMPORT_RE)) {
        const mod = m[1] ?? m[2];
        if (!mod) continue;
        if (mod.startsWith('.')) {
          const ups = mod.match(/^\.+/)[0].length;
          const rest = mod.slice(ups).replace(/\./g, '/');
          let target = dir;
          for (let i = 1; i < ups; i++) target = dirOf(target);
          link(from, componentFor(joinPath(target, rest)));
          continue;
        }
        const path = mod.replace(/\./g, '/');
        const internal = componentFor(joinPath(pkg.dir, path)) ?? componentFor(joinPath(joinPath(pkg.dir, 'src'), path));
        if (internal) link(from, internal);
        else {
          const service = serviceFor(mod.split('.')[0]) ?? serviceFor(mod);
          if (service) linkExternal(from, service);
        }
      }
      continue;
    }

    if (/\.go$/i.test(file)) {
      for (const m of text.matchAll(GO_STRING_RE)) {
        const spec = m[1];
        const owner = goModules.find((p) => spec === p.goModule || spec.startsWith(`${p.goModule}/`));
        if (owner) link(from, componentFor(joinPath(owner.dir, spec.slice(owner.goModule.length + 1))));
      }
      continue;
    }

    if (!aliasCache.has(pkg)) aliasCache.set(pkg, aliasesFor(root, pkg, existsSync(join(root, pkg.dir, 'src')) ? joinPath(pkg.dir, 'src') : pkg.dir));
    for (const m of text.matchAll(JS_IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3] ?? m[4];
      if (!spec || spec.startsWith('node:')) continue;
      if (spec.startsWith('.')) {
        link(from, componentFor(posix.normalize(joinPath(dir, spec)).replace(/^\.\//, '')));
        continue;
      }
      const alias = aliasCache.get(pkg).find((a) => spec.startsWith(a.prefix));
      if (alias) {
        link(from, componentFor(joinPath(alias.target, spec.slice(alias.prefix.length))));
        continue;
      }
      const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      const workspace = byName.get(pkgName);
      if (workspace && workspace !== pkg) {
        const rest = spec.slice(pkgName.length + 1);
        link(from, (rest && componentFor(joinPath(workspace.dir, rest))) || largestIn(workspace));
        continue;
      }
      const service = serviceFor(spec);
      if (!service) continue;
      // A Prisma/ORM import points at the repo's own database folder when it has one.
      const ownDb = service.key === 'database' ? components.find((c) => c.kind === 'db' && c.pkg === pkg) ?? components.find((c) => c.kind === 'db') : null;
      if (ownDb) link(from, ownDb);
      else linkExternal(from, service);
    }
  }

  const externalList = [...externals.values()]
    .map((e) => ({ ...e, weight: [...e.from.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_EXTERNALS);
  const edges = [...edgeWeights.entries()].map(([key, weight]) => {
    const [from, to] = key.split('>');
    return { from, to, weight };
  });
  for (const ext of externalList) for (const [from, weight] of ext.from) edges.push({ from, to: ext.id, weight });
  edges.sort((a, b) => b.weight - a.weight);
  const outDegree = new Map();
  const keptEdges = [];
  for (const edge of edges) {
    if (keptEdges.length >= MAX_EDGES) break;
    const out = outDegree.get(edge.from) ?? 0;
    if (out >= MAX_OUT_EDGES) continue;
    outDegree.set(edge.from, out + 1);
    keptEdges.push(edge);
  }

  // Mermaid: one subgraph per package when there are several.
  const lines = ['graph LR'];
  const nodeLine = (comp) => (comp.kind === 'db' ? `${comp.id}[("${mermaidLabel(comp.label)}")]` : `${comp.id}["${mermaidLabel(comp.label)}"]`);
  const pkgsWithComponents = [...new Set(components.map((c) => c.pkg))];
  const grouped = pkgsWithComponents.length > 1;
  for (const pkg of pkgsWithComponents) {
    const members = components.filter((c) => c.pkg === pkg);
    if (grouped) lines.push(`  subgraph g_${slug(pkg.dir || 'root')}["${mermaidLabel(pkg.dir ? basename(pkg.dir) : repoName)}"]`);
    for (const comp of members) lines.push(`${grouped ? '    ' : '  '}${nodeLine(comp)}`);
    if (grouped) lines.push('  end');
  }
  for (const ext of externalList) {
    lines.push(ext.kind === 'db' ? `  ${ext.id}[("${mermaidLabel(ext.label)}")]` : `  ${ext.id}["${mermaidLabel(ext.label)}"]`);
    if (ext.kind !== 'db') lines.push(`  %% archdraw-shape: {"id":"${ext.id}","shape":"cloud"}`);
  }
  for (const edge of keptEdges) lines.push(`  ${edge.from} --> ${edge.to}`);

  const componentPaths = Object.fromEntries(
    components.map((c) => [c.id, c.dir === null ? c.files : [c.dir ? `${c.dir}/**` : '**']]),
  );

  return {
    mermaid: `${lines.join('\n')}\n`,
    componentPaths,
    components: components.map((c) => ({ id: c.id, label: c.label, paths: componentPaths[c.id], files: c.count })),
    externals: externalList.map((e) => ({ id: e.id, label: e.label })),
    edges: keptEdges,
    fileCount: files.length,
  };
}
