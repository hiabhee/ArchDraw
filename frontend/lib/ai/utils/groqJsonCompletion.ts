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
    msg.includes('unsupported')
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

/**
 * Groq chat completion with support for reasoning-model parameters.
 *
 * - Uses `response_format: { type: 'json_object' }` by default (falls back
 *   to plain text if the model doesn't support it).
 * - Passes `reasoning_effort` for models like gpt-oss-120b that support it.
 * - Logs reasoning traces (CoT) when available for debugging.
 */
export async function groqJsonCompletion(
  client: Groq,
  params: CompletionParams
): Promise<string> {
  const { reasoning_effort, json_schema, ...coreParams } = params;

  let body: ChatCompletionCreateParamsNonStreaming = {
    ...coreParams,
    response_format: { type: 'json_object' as const },
    temperature: coreParams.temperature ?? 0.7,
    ...(reasoning_effort ? { reasoning_effort } : {}),
  };

  try {
    const completion = await client.chat.completions.create(
      body,
    );

    const msg = completion.choices[0]?.message as ExtendedChatMessage | undefined;
    const content = msg?.content ?? '';

    // Log reasoning trace for debugging (CoT)
    if (msg?.reasoning_content) {
      logger.log('[groqJsonCompletion] Reasoning trace:', msg.reasoning_content.slice(0, 500));
    }

    return content;
  } catch (error) {
    if (!isResponseFormatError(error)) throw error;

    // Retry without response_format if JSON mode is unsupported
    const { reasoning_effort: _r, json_schema: _j, response_format: _rf, ...fallbackParams } = params as any;
    const fallbackBody: ChatCompletionCreateParamsNonStreaming = {
      ...fallbackParams,
      ...(reasoning_effort ? { reasoning_effort } : {}),
      ...(json_schema ? { json_schema } : {}),
    } as any;

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
