import { apiKeyManager } from '@/lib/ai/utils/apiKeyManager';
import { groqJsonCompletion } from '@/lib/ai/utils/groqJsonCompletion';
import { parseLlmJson } from '@/lib/ai/utils/parseLlmJson';
import { formatSourceFilesForPrompt, JSON_OUTPUT_REMINDER } from './repo-prompt-utils';
import type { RepoSnapshot, DependencyMap } from '@/lib/types/repo-diagram';

export async function analyzeDependencies(snapshot: RepoSnapshot): Promise<DependencyMap> {
  // Collect dependency files
  const depFiles = snapshot.selectedFiles.filter(
    (f) =>
      f.path === 'package.json' ||
      f.path === 'requirements.txt' ||
      f.path === 'go.mod' ||
      f.path === 'Cargo.toml' ||
      f.path === 'composer.json' ||
      f.path === 'Gemfile' ||
      f.path === '.env.example'
  );

  const depContents = formatSourceFilesForPrompt(depFiles);
  const usageFiles = snapshot.selectedFiles.filter(
    (f) =>
      !depFiles.some((d) => d.path === f.path) &&
      !f.path.toLowerCase().startsWith('readme') &&
      !f.path.endsWith('.lock')
  );
  const sourceContents = formatSourceFilesForPrompt(usageFiles);

  const prompt = `Analyze dependency usage in this repository.

DEPENDENCY FILES:
${depContents}

SOURCE FILES (reference only):
${sourceContents}

${JSON_OUTPUT_REMINDER}
Required shape: { "dependencies": [ ... ] }`;

  console.log(`[DependencyIntelligence] Calling LLM to analyze dependency usage...`);

  try {
    const result = await apiKeyManager.executeWithRetry(async (client) =>
      groqJsonCompletion(client, {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect. You analyze how dependencies are actually
used in a codebase — not just what they are, but why they exist and what role
they play in the architecture.

You will receive:
1. The repo's dependency files (package.json, requirements.txt, etc.)
2. Selected source files showing how dependencies are used
3. The .env.example file if available (reveals external services)

For each ARCHITECTURALLY SIGNIFICANT dependency, produce an intelligence entry.

Skip: testing libraries, linters, formatters, type definitions, build tools.
Focus on: databases, auth, external APIs, queues, caches, payment systems, 
email services, storage, realtime, AI/ML services, monitoring, analytics.

For each significant dependency determine:

CATEGORY — pick one:
database, auth, cache, queue, email, payments, storage, realtime, 
ai_ml, monitoring, analytics, cdn, search, external_api, state_management,
ui_framework, http_client, utility

PURPOSE — what does it do in THIS project specifically?
Not the library's general description — what is it actually used for here?
Read the import sites and usage to determine this.

USAGE PATTERN — how is it used?
Where is it initialized? Is there a wrapper/client file? 
Is it used server-side, client-side, or both?
Is it used in middleware, API routes, background jobs?

ARCHITECTURAL ROLE — what would break without it?
Is it on the critical path? Is it optional/enhancement?

EXTERNAL ENDPOINT — if this dependency talks to an external service,
what is the endpoint? (detectable from .env.example variable names
like SUPABASE_URL, STRIPE_API_KEY, OPENAI_API_KEY, RESEND_API_KEY)

OUTPUT FORMAT — respond only with valid JSON, no markdown, no explanation:

{
  "dependencies": [
    {
      "name": "string",
      "category": "string",
      "purpose": "string — specific to this project",
      "usedIn": ["file paths where this dependency is imported or used"],
      "usagePattern": "string — one or two sentences",
      "architecturalRole": "string — one sentence",
      "externalEndpoint": "string or null",
      "isOnCriticalPath": true | false
    }
  ]
}

Include between 3 and 15 dependencies. Quality over quantity.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
      })
    );

    const parsed = parseLlmJson<{ dependencies?: unknown[] }>(result, 'DependencyIntelligence');
    return {
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
    } as DependencyMap;
  } catch (err) {
    console.error('[DependencyIntelligence] Failed to analyze dependencies:', err);
    if (err instanceof Error && err.message.includes('could not parse JSON')) {
      return { dependencies: [] };
    }
    throw new Error(`Failed to analyze dependencies: ${err instanceof Error ? err.message : String(err)}`);
  }
}
