import { NextRequest, NextResponse } from 'next/server';
import { generateRepoArchitectureDiagramV2 as generateRepoArchitectureDiagram } from '@/lib/repo-diagram/pipeline-v2';
import { parseGitHubUrl } from '@/lib/utils/githubUrl';
import { clear } from '@/lib/ai/services/diagramCache';
import { clearBlobCaches } from '@/lib/cache/blobCache';
import logger from '@/lib/logger';
import { checkAIGenerationQuota, incrementAIGeneration, logUsage, getGuestId, getSessionFromRequest } from '@/lib/middleware/quotaCheck';
import { requireAdmin } from '@/lib/admin-auth';

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

  // Validate user-provided GitHub token — support legacy (ghp_/gho_/ghs_/ghu_/ghr_) + fine-grained (github_pat_)
  // GH2R-002: old regex /^gh[pos]_[A-Za-z0-9_]{36,}$/ rejected fine-grained PATs and ghu_/ghr_ silently → unauthenticated 60/hr
  const GITHUB_TOKEN_RE = /^(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})$/;
  const rawUserToken = typeof userGithubToken === 'string' ? userGithubToken.trim() : '';
  const safeUserToken = rawUserToken && GITHUB_TOKEN_RE.test(rawUserToken) ? rawUserToken : undefined;
  if (typeof userGithubToken === 'string' && userGithubToken.trim() && !safeUserToken) {
    logger.warn('[API] userGithubToken supplied but did not match PAT format — ignoring; set GITHUB_TOKEN or supply a valid ghp_/github_pat_ token');
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let clientAborted = false;
  // GH2R-008: track client disconnect — abort between-stages already handled via req.signal,
  // but detached SSE IIFE kept running + charging quota. Mirror signal to flag.
  req.signal.addEventListener('abort', () => {
    clientAborted = true;
  });

  const send = async (data: object) => {
    if (clientAborted) return;
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (e) {
      clientAborted = true;
      logger.warn('[API] SSE writer closed (client abort)', e instanceof Error ? e.message : String(e));
    }
  };

  // Run pipeline in background, stream events:
  (async () => {
    try {
      const outcome = await generateRepoArchitectureDiagram(
        parsed.canonical,
        resolvedDetail,
        req.signal,
        safeUserToken,
        (event) => {
          void send({ type: 'progress', ...event });
        }
      );

      if (clientAborted) {
        logger.info('[API] Client aborted before result — skipping quota increment');
        return;
      }

      if (!outcome.success) {
        await send({
          type: 'error',
          message: outcome.error.message,
          code: outcome.code,
        });
        return;
      }

      const result = outcome.data;

      // GH2R-008: only charge quota if client is still connected and result succeeded
      if (!clientAborted) {
        const session = await getSessionFromRequest(req);
        const resolvedUserId = session?.user?.id ?? null;
        await incrementAIGeneration(resolvedUserId);
        await logUsage(resolvedUserId, getGuestId(req), 'ai_generation', {
          description: `repo:${parsed.canonical}`,
          nodeCount: result.nodeCount || 0,
        });
      }

      if (!clientAborted) {
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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      if (!clientAborted) {
        await send({ type: 'error', message, code: 'unknown' });
      } else {
        logger.warn('[API] Pipeline error after client abort (ignored):', message);
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // writer already closed / aborted — ignore
      }
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

export async function DELETE(req: NextRequest) {
  // Cache flushing is an administrative action; never allow anonymous callers.
  const adminError = await requireAdmin(req);
  if (adminError) return adminError;

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
