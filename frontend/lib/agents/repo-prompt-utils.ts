import type {
  FileEntry,
} from '@/lib/types/repo-diagram';

// ~60k characters ≈ ~15k tokens — expanded for comprehensive repo coverage
const PROMPT_CHAR_BUDGET = 60_000;

// Per-file hard cap so one giant file can't consume the entire budget
const PER_FILE_MAX_CHARS = 10_000;

// Files we want to show first because they reveal architecture best.
// Lower number = higher priority.
function fileImportancePriority(path: string): number {
  const p = path.toLowerCase();
  // README first — high-level project/architecture description
  if (/(^|\/)readme(\.[^/]+)?$/.test(p)) return 0;
  if (/route\.(ts|js|tsx)|router\.(ts|js)|controller\.(ts|js)|api\/.+\.(ts|js)/.test(p)) return 1;
  if (/main\.py|app\.py|server\.(ts|js)|index\.(ts|js)|manage\.py|main\.go/.test(p)) return 2;
  if (/model|schema|entity|migration|prisma/.test(p)) return 3;
  if (/service|worker|task|job/.test(p)) return 4;
  if (/middleware|auth|guard/.test(p)) return 5;
  if (/package\.json|requirements\.txt|go\.mod|cargo\.toml/.test(p)) return 6;
  if (/docker-compose|dockerfile/.test(p)) return 7;
  if (/\.env|env\.example/.test(p)) return 8;
  if (/\.md$|\.lock$/.test(p)) return 10; // other docs / lockfiles last
  return 6;
}

/** Allow READMEs a larger share of the prompt budget than typical source files. */
function perFileMaxChars(path: string): number {
  return /(^|\/)readme(\.[^/]+)?$/i.test(path) ? 20_000 : PER_FILE_MAX_CHARS;
}

/**
 * Format all ingested source files for LLM context within a character budget.
 * Prioritizes README, then architecture-signal files (routes, models, services,
 * entry points), then configuration and other documentation.
 */
export function formatSourceFilesForPrompt(files: FileEntry[]): string {
  if (files.length === 0) return '(no source files ingested)';

  const prioritized = [...files].sort(
    (a, b) => fileImportancePriority(a.path) - fileImportancePriority(b.path)
  );

  let remainingBudget = PROMPT_CHAR_BUDGET;
  const chunks: string[] = [];

  for (const file of prioritized) {
    if (remainingBudget <= 0) break;
    const maxChars = perFileMaxChars(file.path);
    const content =
      file.content.length > maxChars
        ? `${file.content.slice(0, maxChars)}\n... [truncated at ${maxChars} chars]`
        : file.content;
    const block = `### ${file.path}\n${content}`;
    const blockLen = block.length;
    if (blockLen > remainingBudget) {
      // Include a partial snippet rather than skipping entirely
      const partial = block.slice(0, remainingBudget);
      chunks.push(`${partial}\n... [budget exhausted]`);
      remainingBudget = 0;
      break;
    }
    chunks.push(block);
    remainingBudget -= blockLen;
  }

  const skipped = prioritized.length - chunks.length;
  const footer = skipped > 0 ? `\n\n(${skipped} additional files omitted — budget exhausted)` : '';
  return chunks.join('\n\n') + footer;
}

export const JSON_OUTPUT_REMINDER =
  'Respond with a single JSON object only. Do not repeat or quote the source files. Do not use markdown fences.';
