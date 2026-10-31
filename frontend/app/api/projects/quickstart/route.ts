import { NextRequest, NextResponse } from 'next/server';
import type { Edge, Node } from 'reactflow';
import { z } from 'zod';
import logger from '@/lib/logger';
import { getClientIP } from '@/lib/server/ip';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/diagram/pipeline-core';
import { isTextNode } from '@/lib/diagram/mermaid/textNodes';
import { publishGraph } from '@/lib/diagram/projects/publishGraph';
import { getUserQuotas } from '@/lib/quotas/userQuotas';
import { normalizeRepositoryRemote } from '@/lib/server/projects/agenticProjects';
import { createAnonymousProject } from '@/lib/server/projects/anonymousProjects';
import { readJsonBody } from '@/lib/server/projects/projectCanvas';

export const runtime = 'nodejs';

/** Each call creates a project and runs the layout pipeline. */
const QUICKSTARTS_PER_HOUR = 10;
const MAX_BODY_BYTES = 512 * 1024;

const pathList = z.array(z.string().trim().min(1).max(512)).max(50);

const quickstartSchema = z.object({
  /** Repository folder name; becomes the canvas name. */
  repoName: z.string().trim().min(1).max(100),
  /** Optional starting diagram (paths only, no code). Omitted: the canvas starts empty and the user's own Claude draws it. */
  mermaid: z.string().min(1).max(200_000).optional(),
  componentPaths: z.record(z.string(), pathList).optional(),
  repositoryRemote: z.string().trim().max(2048).optional().nullable(),
  branch: z.string().trim().max(255).optional().nullable(),
});

/**
 * One-command setup (`npx archdraw-live`): create a live project without an
 * account and return an agent credential for this checkout, a watch link and
 * a claim secret (sign in later to keep and edit it).
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimitWithFallback(`project-quickstart:${getClientIP(request)}`, QUICKSTARTS_PER_HOUR, 3600);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many new projects from this network. Try again in an hour.' }, { status: 429 });
    }

    const raw = await readJsonBody(request, MAX_BODY_BYTES);
    if (raw.tooLarge) return NextResponse.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    const parsed = quickstartSchema.safeParse(raw.value);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid quick start payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    if (body.mermaid) {
      const pipeline = await runMermaidPipeline(body.mermaid, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
      if (!isDomainSuccess(pipeline)) {
        return NextResponse.json({ error: 'Could not lay out the diagram', warnings: pipeline.warnings }, { status: 400 });
      }
      const graph = publishGraph({
        existingNodes: [],
        laidOut: { nodes: pipeline.data.nodes as unknown as Node[], edges: pipeline.data.edges as unknown as Edge[] },
        componentPaths: body.componentPaths,
        relayout: true,
        now: Date.now(),
      });
      nodes = graph.nodes;
      edges = graph.edges;
    }
    const componentCount = nodes.filter((n) => !isTextNode(n)).length;
    const { maxNodesPerCanvas } = getUserQuotas('authenticated');
    if (componentCount > maxNodesPerCanvas) {
      return NextResponse.json({ error: `Diagram too large. Maximum ${maxNodesPerCanvas} nodes allowed.`, code: 'CANVAS_SIZE_EXCEEDED' }, { status: 400 });
    }

    const project = await createAnonymousProject({
      name: body.repoName,
      nodes,
      edges,
      repositoryRemote: normalizeRepositoryRemote(body.repositoryRemote) ?? null,
      branch: body.branch,
    });
    logger.info('[Projects] Quick start project created', { canvasId: project.canvasId, componentCount });

    return NextResponse.json(
      { ...project, componentCount },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Project quick start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
