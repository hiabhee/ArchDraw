/**
 * Centralized model names for the repo-diagram LLM agents.
 * Env-overridable so evals/dev can swap models without code changes.
 *
 * Default: 'llama-3.3-70b-versatile' (Groq). Chosen over the previous default
 * 'openai/gpt-oss-120b' because the free tier only allows 8K TPM for that
 * model, while Llama 3.3 70B gets 12K TPM — and our classifier/extractor
 * requests routinely exceed 8K. Override via `REPO_LLM_MODEL` env var.
 *
 * The max-token budgets below are sized so each request (prompt tokens +
 * max output tokens) stays under the 12K TPM ceiling. Raise them only if you
 * have a paid Groq tier.
 */

export const REPO_LLM_MODEL: string =
  process.env.REPO_LLM_MODEL || 'llama-3.3-70b-versatile';

/** Max tokens for classification (small — single JSON object). */
export const CLASSIFIER_MAX_TOKENS = Number(process.env.REPO_CLASSIFIER_MAX_TOKENS) || 2000;
/** Max tokens for component extraction (larger — list of nodes + descriptions). */
export const EXTRACTOR_MAX_TOKENS = Number(process.env.REPO_EXTRACTOR_MAX_TOKENS) || 4000;
/** Max tokens for relationship + workflow analysis. */
export const RELATIONSHIP_MAX_TOKENS = Number(process.env.REPO_RELATIONSHIP_MAX_TOKENS) || 5000;