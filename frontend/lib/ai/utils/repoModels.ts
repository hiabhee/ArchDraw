/**
 * Centralized model names for the repo-diagram LLM agents.
 * Env-overridable so evals/dev can swap models without code changes.
 *
 * Default: 'groq/compound-mini' (Groq compound, tool-aware) — was 'openai/gpt-oss-120b' before Phase 6.
 * Override via `REPO_LLM_MODEL` env var (e.g. REPO_LLM_MODEL=openai/gpt-oss-120b to revert).
 */

export const REPO_LLM_MODEL: string =
  process.env.REPO_LLM_MODEL || 'groq/compound-mini';

/** Max tokens for classification (small — single JSON object). */
export const CLASSIFIER_MAX_TOKENS = Number(process.env.REPO_CLASSIFIER_MAX_TOKENS) || 3000;
/** Max tokens for component extraction (larger — list of nodes + descriptions). */
export const EXTRACTOR_MAX_TOKENS = Number(process.env.REPO_EXTRACTOR_MAX_TOKENS) || 8000;
/** Max tokens for relationship + workflow analysis. */
export const RELATIONSHIP_MAX_TOKENS = Number(process.env.REPO_RELATIONSHIP_MAX_TOKENS) || 8000;
/** Max tokens for the docs revalidation pass (verifies the graph against README/docs). */
export const DOCS_MAX_TOKENS = Number(process.env.REPO_DOCS_MAX_TOKENS) || 4000;

// Prompt character budgets (~4 chars ≈ 1 token). Sized for gpt-oss-120b / compound-mini
// 128-131k context — the old 28–36k caps were sized for the retired llama-3.3-70b
// 12K TPM ceiling and starved the agents of evidence.
export const CLASSIFIER_PROMPT_CHARS = Number(process.env.REPO_CLASSIFIER_PROMPT_CHARS) || 100_000;
export const EXTRACTOR_PROMPT_CHARS = Number(process.env.REPO_EXTRACTOR_PROMPT_CHARS) || 80_000;
export const SOURCE_FILES_PROMPT_CHARS = Number(process.env.REPO_SOURCE_FILES_PROMPT_CHARS) || 120_000;
export const DOCS_PROMPT_CHARS = Number(process.env.REPO_DOCS_PROMPT_CHARS) || 60_000;