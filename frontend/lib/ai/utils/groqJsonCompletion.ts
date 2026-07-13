import type Groq from 'groq-sdk';
import type { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions';
import logger from '@/lib/logger';

function isResponseFormatError(error: unknown): boolean {
  const err = error as { message?: string; status?: number };
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('response_format') ||
    msg.includes('json_object') ||
    msg.includes('json mode') ||
    msg.includes('unsupported') ||
    msg.includes('json_validate_failed')
  );
}

// Extend the base params with gpt-oss / reasoning-model features
// that Groq's SDK doesn't type yet but the API supports.
interface ReasoningModelParams {
  /**
   * Controls how much reasoning effort the model spends.
   * Only supported by reasoning models (gpt-oss-*, deepseek-r1, etc).
   * Default: 'medium'
   */
  reasoning_effort?: 'low' | 'medium' | 'high';
  /**
   * A JSON schema to guide the model's output structure.
   * When provided, it is embedded in the system message at call time
   * (the Groq API does not yet support response_format.json_schema natively).
   */
  json_schema?: Record<string, unknown>;
}

type CompletionParams = Omit<ChatCompletionCreateParamsNonStreaming, 'response_format'> & ReasoningModelParams;

// Extend the message type to include reasoning_content
interface ExtendedChatMessage {
  content: string | null;
  role: string;
  reasoning_content?: string | null;
}

const REASONING_MODEL_PATTERNS = [
  /^gpt-oss/i,
  /^deepseek-r1/i,
  /^o[1-9]/i, // openai o1, o3, o4 series
];

function modelSupportsReasoning(model?: string): boolean {
  if (!model) return false;
  return REASONING_MODEL_PATTERNS.some(p => p.test(model));
}

/**
 * Groq chat completion with support for reasoning-model parameters.
 *
 * - Uses `response_format: { type: 'json_object' }` by default (falls back
 *   to plain text if the model doesn't support it).
 * - Passes `reasoning_effort` only for models that support it (gpt-oss, deepseek-r1).
 * - Logs reasoning traces (CoT) when available for debugging.
 */
export async function groqJsonCompletion(
  client: Groq,
  params: CompletionParams
): Promise<string> {
  const { reasoning_effort, json_schema, ...coreParams } = params;
  const shouldUseReasoning = reasoning_effort && modelSupportsReasoning(coreParams.model);

  const body: ChatCompletionCreateParamsNonStreaming = {
    ...coreParams,
    response_format: { type: 'json_object' as const },
    temperature: coreParams.temperature ?? 0.7,
    ...(shouldUseReasoning ? { reasoning_effort } : {}),
  };

  try {
    const completion = await client.chat.completions.create(
      body,
    );

    const msg = completion.choices[0]?.message as ExtendedChatMessage | undefined;
    const content = msg?.content ?? '';
    const finishReason = completion.choices[0]?.finish_reason;
    const usage = completion.usage;

    // Log reasoning trace for debugging (CoT)
    if (msg?.reasoning_content) {
      logger.log('[groqJsonCompletion] Reasoning trace:', msg.reasoning_content.slice(0, 500));
    }

    // If content is empty, retry without response_format (some models return empty with json_object mode)
    if (!content.trim()) {
      logger.warn(`[groqJsonCompletion] Empty content with response_format (finish_reason=${finishReason}, prompt_tokens=${usage?.prompt_tokens ?? '?'}, completion_tokens=${usage?.completion_tokens ?? '?'}), retrying without...`);
      const { reasoning_effort: _r2, json_schema: _j2, response_format: _rf2, ...retryParams } = params as CompletionParams & Record<string, unknown>;
      const retryBody: ChatCompletionCreateParamsNonStreaming = {
        ...retryParams,
        ...(shouldUseReasoning ? { reasoning_effort } : {}),
        ...(json_schema ? { json_schema } : {}),
      } as ChatCompletionCreateParamsNonStreaming;
      const retryCompletion = await client.chat.completions.create(retryBody);
      const retryMsg = retryCompletion.choices[0]?.message as ExtendedChatMessage | undefined;
      const retryContent = retryMsg?.content ?? '';
      const retryFinishReason = retryCompletion.choices[0]?.finish_reason;
      const retryUsage = retryCompletion.usage;
      if (retryContent.trim()) {
        logger.log('[groqJsonCompletion] Retry without response_format succeeded');
        return retryContent;
      }
      logger.warn(`[groqJsonCompletion] Retry also empty (finish_reason=${retryFinishReason}, prompt_tokens=${retryUsage?.prompt_tokens ?? '?'}, completion_tokens=${retryUsage?.completion_tokens ?? '?'})`);
    }

    return content;
  } catch (error) {
    if (!isResponseFormatError(error)) throw error;

    // Retry without response_format if JSON mode is unsupported
    const { reasoning_effort: _r, json_schema: _j, response_format: _rf, ...fallbackParams } = params as CompletionParams & Record<string, unknown>;
    const fallbackBody: ChatCompletionCreateParamsNonStreaming = {
      ...fallbackParams,
      ...(shouldUseReasoning ? { reasoning_effort } : {}),
      ...(json_schema ? { json_schema } : {}),
    } as ChatCompletionCreateParamsNonStreaming;

    const completion = await client.chat.completions.create(
      fallbackBody,
    );

    const msg = completion.choices[0]?.message as ExtendedChatMessage | undefined;
    if (msg?.reasoning_content) {
      logger.log('[groqJsonCompletion] Reasoning trace:', msg.reasoning_content.slice(0, 500));
    }

    return msg?.content ?? '';
  }
}
