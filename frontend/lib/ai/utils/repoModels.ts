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

// The default compound-mini endpoint rejects the previous 60–120k-character
// payloads with HTTP 413. These caps leave room for system prompts and output
// tokens while preserving the highest-signal files and manifests.
export const CLASSIFIER_PROMPT_CHARS = Number(process.env.REPO_CLASSIFIER_PROMPT_CHARS) || 12_000;
export const EXTRACTOR_PROMPT_CHARS = Number(process.env.REPO_EXTRACTOR_PROMPT_CHARS) || 12_000;
export const SOURCE_FILES_PROMPT_CHARS = Number(process.env.REPO_SOURCE_FILES_PROMPT_CHARS) || 12_000;
export const DOCS_PROMPT_CHARS = Number(process.env.REPO_DOCS_PROMPT_CHARS) || 12_000;

/** Maximum output accepted by the default Groq model. */
export const REPO_LLM_MAX_OUTPUT_TOKENS = 8_192;

/** Keep each repo-agent attempt bounded; agent-level JSON retry remains available. */
export const REPO_LLM_REQUEST_OPTIONS = {
  maxRetries: 1,
  maxKeys: 1,
  timeoutMs: Number(process.env.REPO_LLM_TIMEOUT_MS) || 20_000,
  // Repo enrichment must fail fast by default; opt back in when a dependable
  // OpenRouter transport is configured and desired.
  disableOpenRouterFallback: process.env.REPO_DISABLE_OPENROUTER_FALLBACK !== 'false',
};
