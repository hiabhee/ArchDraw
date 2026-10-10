import logger from '@/lib/logger';

export type JevAnswer = {
  confidence?: number;
  [key: string]: unknown;
};

export type JevCallResult = {
  ok: boolean;
  answers?: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
  elapsedMs?: number;
  creditsUsed?: number;
  code?: 'SERVICE_UNAVAILABLE' | 'JEV_REQUEST_FAILED' | 'JEV_UNAVAILABLE';
  message?: string;
};

type JevPayload = {
  code?: number;
  data?: {
    result?: {
      answers?: Record<string, JevAnswer>;
      usage?: { input_tokens?: number; output_tokens?: number };
      elapsedMs?: number;
    };
    creditsUsed?: number;
  };
};

/** Jev connection settings resolved by the caller (the test endpoint). */
export type JevConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

/**
 * POST a set of bounded questions to Jev (/v1/systemone). The decision layer
 * never draws — it only classifies and validates. Returns normalized answers
 * or a typed failure the caller can surface without a 5xx.
 *
 * Credentials are passed in via `config` — this module must not read
 * JEV_API_KEY from the environment itself.
 */
export async function callJev(
  state: string,
  questions: Record<string, unknown>,
  config: JevConfig,
  timeoutMs = 10_000,
): Promise<JevCallResult> {
  if (!config.apiKey) {
    return { ok: false, code: 'SERVICE_UNAVAILABLE', message: 'Jev is not configured. Set JEV_API_KEY in frontend/.env.local.' };
  }

  const baseUrl = (config.baseUrl ?? 'https://thejevai.com').replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model ?? 'typesafe/jev-1.13',
        state,
        questions,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const payload = await response.json().catch(() => null) as JevPayload | null;
    if (!response.ok || payload?.code !== 0 || !payload.data?.result?.answers) {
      logger.error('Jev request failed', { status: response.status, code: payload?.code });
      return {
        ok: false,
        code: 'JEV_REQUEST_FAILED',
        message: response.status === 401
          ? 'Jev rejected the configured API key. Check JEV_API_KEY in frontend/.env.local.'
          : response.status === 402
            ? 'The Jev account has insufficient credits. Add credits at https://thejevai.com.'
            : response.status === 429
              ? 'Jev is rate-limiting requests right now. Try again shortly.'
              : 'Jev could not evaluate this input.',
      };
    }

    return {
      ok: true,
      answers: payload.data.result.answers,
      usage: payload.data.result.usage,
      elapsedMs: payload.data.result.elapsedMs,
      creditsUsed: payload.data.creditsUsed,
    };
  } catch (error) {
    logger.error('Jev request error', error);
    return { ok: false, code: 'JEV_UNAVAILABLE', message: 'Jev request timed out or could not be completed.' };
  }
}

/** Pre-generation intent routing. Turns a vague prompt into concrete constraints. */
export const classificationQuestions = {
  appType: {
    type: 'choice',
    criteria: {
      web_saas: 'A web application with a browser client and server-side API.',
      mobile_app: 'A mobile client with a backend API.',
      data_pipeline: 'Ingests, transforms, and stores data in batches or streams.',
      internal_tool: 'A low-traffic internal utility with a small known user group.',
    },
    instructions: 'What kind of application is requested?',
  },
  needsAsyncProcessing: {
    type: 'noul',
    instructions: 'Does the application need background or asynchronous processing?',
  },
  dataSensitivity: {
    type: 'choice',
    criteria: {
      public: 'Data that is already public or not sensitive.',
      internal: 'Internal business data with access limited to the organization.',
      sensitive: 'Personal data, credentials, or regulated data requiring strong protection.',
    },
    instructions: 'Classify the sensitivity of the described data.',
  },
  architectureTier: {
    type: 'choice',
    criteria: {
      simple_monolith: 'One deployable application with minimal dependencies.',
      modular_monolith: 'One deployable application with well-separated modules.',
      service_oriented: 'Multiple independently deployable services.',
    },
    instructions: 'Choose the least complex reasonable initial architecture.',
  },
} as const;

export type IntentDecisions = {
  appType?: string;
  needsAsyncProcessing?: boolean;
  dataSensitivity?: string;
  architectureTier?: string;
};

/** Atomic post-generation review checks. The spec itself is passed as `state`. */
export const reviewQuestions = {
  databasePubliclyExposed: {
    type: 'noul',
    instructions:
      'Sensitive data integrity: is any database or data store exposed to the public internet such that clients or unknown parties can reach it directly?',
  },
  hasUnjustifiedComplexity: {
    type: 'noul',
    instructions:
      'Simplicity discipline: does the design include infrastructure (queues, caches, workers, separate services, extra databases) not justified by the stated requirements, scale, or availability target?',
  },
  authGap: {
    type: 'noul',
    instructions:
      'Access control: can a user or admin interact with the system, or can sensitive data be reached, without passing through an authentication boundary?',
  },
  architectureFit: {
    type: 'score',
    criteria: [
      '1: The architecture does not satisfy the stated requirements.',
      '2: The architecture satisfies requirements with noticeable gaps or excess complexity.',
      '3: The architecture satisfies requirements with minor gaps or inefficiencies.',
      '4: The architecture satisfies requirements with minimal unnecessary complexity.',
      '5: The architecture satisfies requirements efficiently with no unnecessary complexity.',
    ],
    instructions:
      'Rate how well this architecture satisfies the stated requirements while minimizing complexity.',
  },
} as const;