/**
 * Centralized model names for the repo-diagram LLM agents.
 * Env-overridable so evals/dev can swap models without code changes.
 *
 * Default: 'openai/gpt-oss-120b' (Groq). Override via `REPO_LLM_MODEL` env var.
 */

export const REPO_LLM_MODEL: string =
  process.env.REPO_LLM_MODEL || 'openai/gpt-oss-120b';

/** Max tokens for classification (small — single JSON object). */
export const CLASSIFIER_MAX_TOKENS = Number(process.env.REPO_CLASSIFIER_MAX_TOKENS) || 2000;
/** Max tokens for component extraction (larger — list of nodes + descriptions). */
export const EXTRACTOR_MAX_TOKENS = Number(process.env.REPO_EXTRACTOR_MAX_TOKENS) || 4000;
/** Max tokens for relationship + workflow analysis. */
export const RELATIONSHIP_MAX_TOKENS = Number(process.env.REPO_RELATIONSHIP_MAX_TOKENS) || 5000;