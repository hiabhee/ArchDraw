import { NextRequest, NextResponse } from 'next/server';
import { generateRepoArchitectureDiagram } from '@/lib/repo-diagram-pipeline';
import type { RepoDiagramApiResponse } from '@/lib/types/repo-diagram';
import { parseGitHubUrl } from '@/lib/utils/githubUrl';
import logger from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allows pipeline up to 5 minutes to complete

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON in request body', 400);
    }

    const { repoUrl, detailLevel } = body;

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

    const result = await generateRepoArchitectureDiagram(parsed.canonical, resolvedDetail, req.signal);

    const payload: RepoDiagramApiResponse = {
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
    };

    return NextResponse.json(payload);
  } catch (error) {
    logger.error('[API] Repo diagram generation failed:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    // Map known error messages to status codes
    if (message.includes('not found') || message.includes('is private')) {
      return errorResponse(message, 404);
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return errorResponse(message, 429);
    }
    if (message.includes('too large') || message.includes('exceeds')) {
      return errorResponse(message, 413);
    }
    if (message.includes('Invalid GitHub URL') || message.includes('Invalid')) {
      return errorResponse(message, 400);
    }
    return errorResponse(message, 500);
  }
}
