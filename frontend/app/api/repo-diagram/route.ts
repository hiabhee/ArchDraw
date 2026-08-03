import { NextRequest, NextResponse } from 'next/server';
import { generateRepoArchitectureDiagramV2 as generateRepoArchitectureDiagram } from '@/lib/repo-diagram/pipeline-v2';
import { parseGitHubUrl } from '@/lib/utils/githubUrl';
import { clear } from '@/lib/ai/services/diagramCache';
import { clearBlobCaches } from '@/lib/cache/blobCache';
import logger from '@/lib/logger';
import { checkAIGenerationQuota, incrementAIGeneration, logUsage, getGuestId } from '@/lib/middleware/quotaCheck';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allows pipeline up to 5 minutes to complete

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const quotaCheck = await checkAIGenerationQuota(req);
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: quotaCheck.error,
        code: 'QUOTA_EXCEEDED',
        remaining: quotaCheck.remaining || 0,
        upgradePrompt: quotaCheck.tier === 'guest' ? 'Sign in for more generations' : undefined,
      },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON in request body', 400);
  }

  const { repoUrl, detailLevel, userGithubToken } = body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return errorResponse('Repository URL is required and must be a string', 400);
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return errorResponse(
      'Invalid GitHub URL. Must match: https://github.com/{owner}/{repo} (no subdirectories, issues, or pull requests)',
      400
    );
  }

  const resolvedDetail: 1 | 2 | 3 = detailLevel === 1 || detailLevel === 3 ? detailLevel : 2;

  // Validate user-provided GitHub token — only accept ghp_ or gho_ prefix
  const safeUserToken =
    typeof userGithubToken === 'string' &&
    /^gh[pos]_[A-Za-z0-9_]{36,}$/.test(userGithubToken)
      ? userGithubToken
      : undefined;

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  // Run pipeline in background, stream events:
  (async () => {
    try {
      const outcome = await generateRepoArchitectureDiagram(
        parsed.canonical,
        resolvedDetail,
        req.signal,
        safeUserToken,
        (event) => send({ type: 'progress', ...event })
      );

      if (!outcome.success) {
        await send({
          type: 'error',
          message: outcome.error.message,
          code: outcome.code,
        });
        return;
      }

      const result = outcome.data;

      const userId = (await import('@/lib/middleware/quotaCheck')).getSessionFromRequest(req).then(s => s?.user?.id ?? null);
      const resolvedUserId = await userId;
      await incrementAIGeneration(resolvedUserId);
      await logUsage(resolvedUserId, getGuestId(req), 'ai_generation', {
        description: `repo:${parsed.canonical}`,
        nodeCount: result.nodeCount || 0,
      });

      await send({
        type: 'result',
        payload: {
          success: true,
          ndjson: result.ndjson,
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          workflowCount: result.workflowCount,
          workflows: result.workflows,
          repoMeta: result.repoMeta,
          repoProfile: result.repoProfile,
          dependencyMap: result.dependencyMap,
          reviewNotes: result.reviewNotes,
          confidence: result.confidence,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      await send({ type: 'error', message, code: 'unknown' });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function DELETE() {
  try {
    clear();
    clearBlobCaches();
    logger.info('[API] Repo diagram caches cleared');
    return NextResponse.json({ success: true, message: 'Repo diagram caches cleared' });
  } catch (error) {
    logger.error('[API] Failed to clear caches:', error);
    return errorResponse('Failed to clear caches', 500);
  }
}
