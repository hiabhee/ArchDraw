/**
 * Single source of truth for repository ingestion skip rules.
 * Extracted from github-ingestion.ts to break circular import and unify
 * tarball vs Contents-API filtering (Phase 1.1: GH2R-007).
 */

export const MAX_FILE_SIZE_BYTES = 500 * 1024;
export const MAX_ARCHIVE_CONTENT_LENGTH_BYTES = 500 * 1024 * 1024; // 500MB → reject only truly enormous repos
export const MAX_TOTAL_EXTRACTED_BYTES = 200 * 1024 * 1024; // 200MB of text → abort cleanly
export const MAX_PER_FILE_BYTES = 500 * 1024; // 500KB per file — canonical (same as MAX_FILE_SIZE_BYTES)

/** Detail-level file budgets — replaces IngestionStage inline constants (Phase 1.4: GH2R-006) */
export const DEFAULT_FILE_BUDGET: Record<number, number> = { 1: 400, 2: 900, 3: 1800 };
/** Detail-level content budgets in KB */
export const DEFAULT_CONTENT_BUDGET_KB: Record<number, number> = { 1: 1500, 2: 8000, 3: 12000 };

// ─── Architecture-meta priority read (GH2R-024) ────────────────────────────
// Meta files (READMEs, package.json, docker-compose, terraform, CI workflows,
// manifests) IMPLY the architecture — a handful of small text files describe
// what the whole codebase does (services, boundaries, data stores, exports).
// They are read FIRST and in FULL regardless of the source file/content budget,
// and de-prioritize raw source-code sampling. All caps below are the "ceiling
// for everything small" — real repos almost never hit them.

/** Max README files read in full across the whole tree (was 5 in phase 1 only). */
export const MAX_README_FILES = 40;
/** Max total meta files read by the meta-first phase (across all categories). */
export const MAX_META_FILES = 300;
/** Max total meta text bytes (generous — meta files are tiny vs source code). */
export const MAX_META_CONTENT_BYTES = 256 * 1024;
/** Max chars per meta file kept when building the LLM manifest context (see repo-component-extractor). */
export const MAX_META_FILE_CONTEXT_CHARS = 6000;

/**
 * Single root-level/well-known architecture-signaling file (any depth).
 * Deliberately excludes lockfiles and generated artifacts — those reveal
 * dependencies, not architecture.
 */
export const ARCHITECTURE_META_FILE_RE =
  /(^|\/)(README(\.[a-zA-Z0-9]+)?|package\.json|pnpm-workspace\.ya?ml|turbo\.json|nx\.json|lerna\.json|rush\.json|docker-compose\.ya?ml|compose\.ya?ml|Dockerfile[^/]*|go\.mod|Cargo\.toml|Gemfile|Rakefile|composer\.json|pyproject\.toml|setup\.cfg|requirements.*\.txt|Pipfile|makefile|justfile|procfile|mix\.exs|pom\.xml|build\.gradle(\.kts)?|[^/]*\.(csproj|sln)|\.env\.(example|sample)|schema\.prisma|serverless\.ya?ml|vercel\.json|netlify\.toml|now\.json|amplify\.ya?ml|kustomization\.ya?ml|Chart\.ya?ml|values\.ya?ml|openapi[^/]*\.(ya?ml|json)|swagger[^/]*\.(ya?ml|json)|angular\.json|workspace\.json|next\.config\.(js|ts|mjs|cjs)|nuxt\.config\.(ts|js|mjs)|vite\.config\.(ts|js|mjs)|webpack\.config\.(js|ts|mjs)|rollup\.config\.(js|ts|mjs)|svelte\.config\.(js|ts)|tailwind\.config\.(js|ts|mjs|cjs)|\.gitlab-ci\.ya?ml|azure-pipelines\.ya?ml|cloudbuild\.ya?ml)$/i;

/** CI workflow files under .github/workflows (any depth). */
export const CI_WORKFLOW_RE = /(^|\/)\.github\/workflows\/.+\.(ya?ml)$/i;

/** Infrastructure-as-code files — terraform resources are explicit architecture. */
export const INFRASTRUCTURE_AS_CODE_RE = /\.(tf|tfvars)$/i;

/** Documentation source under a docs/ directory — describes intended architecture. */
export const DOCS_DIR_RE = /(^|\/)docs?\/.+\.(md|mdx)$/i;

export function isArchitectureMetaFile(path: string): string | null {
  // Defense in depth: skip vendored/generated dirs even if the caller forgot
  // isSkipped() (e.g. node_modules/manifest.json, .next/README.md).
  const parts = path.split('/');
  if (parts.some((p) => SKIPPED_DIRECTORIES.has(p))) return null;
  if (ARCHITECTURE_META_FILE_RE.test(path)) return 'well_known';
  if (CI_WORKFLOW_RE.test(path)) return 'ci_workflow';
  if (INFRASTRUCTURE_AS_CODE_RE.test(path)) return 'terraform';
  if (DOCS_DIR_RE.test(path)) return 'docs';
  return null;
}

// Mirrors tarball BINARY_RE but is the single source for ingestion decisions.
// Extended vs old github-ingestion: adds webp/mp3/mp4/wav/ogg/avif/heic etc. so both paths match.
export const BINARY_RE =
  /\.(png|jpe?g|gif|ico|svg|woff2?|eot|ttf|otf|pdf|zip|tar|gz|br|webp|mp[34]|wav|ogg|avif|heic)$/i;

export const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'public',
  '__pycache__',
  '.git',
  '.cache',
  '.turbo',
  '.nyc_output',
  'coverage',
  '.vercel',
  '.serverless',
  '.webpack',
  '.svelte-kit',
  '.nuxt',
  '.output',
]);

export const ConfigSkipReason = {
  LARGE_FILE: 'large_file',
  SKIPPED_DIR: 'skipped_directory',
  LOCKFILE: 'lockfile',
  TEST_FILE: 'test_file',
  BINARY: 'binary',
} as const;

export type SkipReason = (typeof ConfigSkipReason)[keyof typeof ConfigSkipReason];

export const isSkipped = (path: string, size?: number): string | null => {
  if (size && size > MAX_FILE_SIZE_BYTES) return ConfigSkipReason.LARGE_FILE;
  const parts = path.split('/');
  if (parts.some((p) => SKIPPED_DIRECTORIES.has(p))) {
    return ConfigSkipReason.SKIPPED_DIR;
  }
  const filename = parts[parts.length - 1];
  if (
    filename.endsWith('.lock') ||
    filename === 'package-lock.json' ||
    filename === 'yarn.lock' ||
    filename === 'pnpm-lock.yaml'
  ) {
    return ConfigSkipReason.LOCKFILE;
  }
  if (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    parts.includes('__tests__')
  ) {
    return ConfigSkipReason.TEST_FILE;
  }
  // Skip binary-looking file extensions (single source; tarball no longer needs duplicate check)
  if (BINARY_RE.test(filename)) {
    return ConfigSkipReason.BINARY;
  }
  return null;
};
