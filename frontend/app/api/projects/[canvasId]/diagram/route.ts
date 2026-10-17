import { NextRequest, NextResponse } from 'next/server';
import type { Edge, Node } from 'reactflow';
import { z } from 'zod';
import logger from '@/lib/logger';
import prisma from '@/lib/server/prisma';
import { type Prisma } from '@/src/generated/prisma/client';
import { getUserQuotas, getUserTier } from '@/lib/quotas/userQuotas';
import { isTextNode } from '@/lib/diagram/mermaid/textNodes';
import { runMermaidPipeline } from '@/lib/diagram/mermaid/pipeline';
import { isDomainSuccess } from '@/lib/diagram/pipeline-core';
import { reactFlowToMermaid } from '@/lib/ai/pipeline/mermaid-pipeline/mermaidTranslator';
import { checkRateLimitWithFallback } from '@/lib/server/redis';
import { authorizeAgentForCanvas, readJsonBody } from '@/lib/server/projects/projectCanvas';
import { createComponentMatcher, getCodePaths, type CodePathNode } from '@/lib/diagram/projects/pathMatcher';
import { pickSessionName } from '@/lib/server/projects/liveSessions';
import { publishGraph } from '@/lib/diagram/projects/publishGraph';
import { isEmptyChange, summarizeChange } from '@/lib/diagram/projects/structureDiff';
import { recordAddedComponents } from '@/lib/server/projects/componentHistory';

export const runtime = 'nodejs';

/** Publishing runs the layout pipeline; bound it per agent credential. */
const PUBLISH_LIMIT_PER_HOUR = 120;
/** The stored canvas row is capped well below this by maxNodesPerCanvas. */
const MAX_PUBLISH_BYTES = 2 * 1024 * 1024;

type StoredNode = CodePathNode & { parentId?: string; parentNode?: string };

function storedGraph(canvas: { nodes: unknown; edges: unknown }) {
  return {
    nodes: (Array.isArray(canvas.nodes) ? canvas.nodes : []) as unknown as Node[],
    edges: (Array.isArray(canvas.edges) ? canvas.edges : []) as unknown as Edge[],
  };
}

/**
 * Agent view of the project diagram. Default: compact component → code-path
 * map. `?format=mermaid[&direction=LR|TD]`: the current diagram as Mermaid plus
 * its componentPaths, so an agent can edit it and publish it back.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const agent = await authorizeAgentForCanvas(request, canvasId);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { nodes, edges } = storedGraph(agent.canvas);
    const componentNodes = (nodes as unknown as StoredNode[]).filter((node) => !isTextNode(node as never));
    const base = { canvasId: agent.canvas.id, name: agent.canvas.name, updatedAt: agent.canvas.updatedAt.getTime() };

    if (request.nextUrl.searchParams.get('format') === 'mermaid') {
      const direction = request.nextUrl.searchParams.get('direction') === 'TD' ? 'TD' : 'LR';
      const componentPaths = Object.fromEntries(
        componentNodes.map((node) => [node.id, getCodePaths(node)]).filter(([, paths]) => paths.length > 0),
      );
      return NextResponse.json({ ...base, mermaid: reactFlowToMermaid(nodes, edges, direction), componentPaths });
    }

    return NextResponse.json({
      ...base,
      components: componentNodes.map((node) => ({
        id: node.id,
        label: typeof node.data?.label === 'string' ? node.data.label : node.id,
        type: node.type ?? null,
        parentId: node.parentId ?? node.parentNode ?? null,
        codePaths: getCodePaths(node),
      })),
    });
  } catch (error) {
    logger.error('Project diagram GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const pathList = z.array(z.string().trim().min(1).max(512)).max(50);

const putSchema = z
  .object({
    /** Preferred: Mermaid (graph LR/TD + subgraphs), laid out by the canonical pipeline. */
    mermaid: z.string().min(1).max(200_000).optional(),
    /** Or a ready React Flow graph (stored as-is). */
    nodes: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(1000).optional(),
    edges: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(4000).optional(),
    /** Mermaid/node id → repo-relative paths or globs that component owns. */
    componentPaths: z.record(z.string(), pathList).optional(),
    /** Discard the user's layout and lay out from scratch (default: keep positions). */
    relayout: z.boolean().optional(),
    /** Agent session publishing the change; shown on the canvas. */
    sessionKey: z.string().trim().min(1).max(200).optional(),
    /** Server `updatedAt` (ms) the agent last read; stale writes get 409. */
    baseUpdatedAt: z.number().int().nonnegative().optional(),
    /**
     * `detail`: the detailed map (overview components as boxes of their
     * modules/files, same ids). Always laid out fresh; the overview canvas
     * is not touched.
     */
    level: z.enum(['overview', 'detail']).optional(),
  })
  .refine((body) => Boolean(body.mermaid) !== Boolean(body.nodes), {
    message: 'Provide either mermaid or nodes/edges',
  });

/** Update the project diagram (agent bootstrap / structural changes). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ canvasId: string }> }) {
  try {
    const { canvasId } = await params;
    const agent = await authorizeAgentForCanvas(request, canvasId);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await checkRateLimitWithFallback(
      `project-publish:${agent.principal.credentialId}`,
      PUBLISH_LIMIT_PER_HOUR,
      3600,
    );
    if (!rate.allowed) return NextResponse.json({ error: 'Too many diagram updates' }, { status: 429 });

    const raw = await readJsonBody(request, MAX_PUBLISH_BYTES);
    if (raw.tooLarge) return NextResponse.json({ error: 'Diagram payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    const parsed = putSchema.safeParse(raw.value);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid diagram payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    if (body.level === 'detail') return publishDetailMap(agent, body);
    // The agent read an older copy than the one we would merge into.
    if (body.baseUpdatedAt !== undefined && agent.canvas.updatedAt.getTime() > body.baseUpdatedAt) {
      return NextResponse.json(
        { error: 'The canvas changed since you read it. Retry.', code: 'CANVAS_CONFLICT', serverUpdatedAt: agent.canvas.updatedAt.getTime() },
        { status: 409 },
      );
    }
    const existing = storedGraph(agent.canvas);
    const now = Date.now();

    let warnings: string[] = [];
    let result;
    if (body.mermaid) {
      const pipeline = await runMermaidPipeline(body.mermaid, { layoutProfile: 'studio-minimal', areaOrder: 'flow' });
      if (!isDomainSuccess(pipeline)) {
        return NextResponse.json({ error: 'Failed to parse Mermaid code', warnings: pipeline.warnings }, { status: 400 });
      }
      warnings = pipeline.data.warnings;
      result = publishGraph({
        existingNodes: existing.nodes,
        laidOut: { nodes: pipeline.data.nodes as unknown as Node[], edges: pipeline.data.edges as unknown as Edge[] },
        componentPaths: body.componentPaths,
        relayout: body.relayout,
        now,
      });
    } else {
      // A ready graph is the agent's exact layout: store it, only attaching paths.
      result = publishGraph({
        existingNodes: existing.nodes,
        laidOut: { nodes: body.nodes as unknown as Node[], edges: (body.edges ?? []) as unknown as Edge[] },
        componentPaths: body.componentPaths,
        relayout: true,
        now,
      });
    }
    if (result.unknownPathIds.length > 0) {
      warnings = [...warnings, `componentPaths ids not in the diagram: ${result.unknownPathIds.slice(0, 10).join(', ')}`];
    }

    const { maxNodesPerCanvas } = getUserQuotas(getUserTier(agent.canvas.userId));
    const componentCount = result.nodes.filter((n) => !isTextNode(n)).length;
    if (componentCount > maxNodesPerCanvas) {
      return NextResponse.json(
        { error: `Diagram too large. Maximum ${maxNodesPerCanvas} nodes allowed.`, code: 'CANVAS_SIZE_EXCEEDED' },
        { status: 400 },
      );
    }

    const updated = await prisma.userCanvas.updateMany({
      where: {
        id: agent.canvas.id,
        userId: agent.canvas.userId,
        // Merges are computed from the canvas we just read; never apply one
        // over a newer save (e.g. the user moving nodes meanwhile).
        updatedAt: agent.canvas.updatedAt,
      },
      data: { nodes: result.nodes as never, edges: result.edges as never },
    });
    const row = await prisma.userCanvas.findUnique({ where: { id: agent.canvas.id }, select: { updatedAt: true } });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'The canvas changed since you read it. Retry.', code: 'CANVAS_CONFLICT', serverUpdatedAt: row?.updatedAt.getTime() ?? null },
        { status: 409 },
      );
    }

    // Construction sites the new diagram now covers become that component.
    const matcher = createComponentMatcher(result.nodes as unknown as CodePathNode[]);
    const sites = await prisma.agentSession.findMany({
      where: { canvasId: agent.canvas.id, siteArea: { not: null } },
      select: { id: true, siteArea: true },
    }).catch(() => []);
    for (const site of sites) {
      const componentId = matcher.match(`${site.siteArea}/_`);
      if (!componentId) continue;
      await prisma.agentSession.update({
        where: { id: site.id },
        data: { siteArea: null, siteAnchorId: null, currentComponentId: componentId },
      }).catch((error: unknown) => logger.warn('Project diagram PUT: could not settle a construction site', error));
    }

    if (body.sessionKey && !isEmptyChange(result.change)) {
      const change = result.change as unknown as Prisma.InputJsonObject;
      // The diagram is already saved: a failure here (e.g. a race with the
      // session's activity report) must not tell the agent to publish again.
      const publisher = await prisma.agentSession.upsert({
        where: { canvasId_sessionKey: { canvasId: agent.canvas.id, sessionKey: body.sessionKey } },
        create: {
          canvasId: agent.canvas.id,
          sessionKey: body.sessionKey,
          label: 'Agent session',
          name: await pickSessionName(agent.canvas.id, body.sessionKey, now),
          lastChange: change,
        },
        update: { lastChange: change, lastSeenAt: new Date(now), status: 'active' },
        select: { name: true },
      }).catch((error: unknown) => {
        logger.warn('Project diagram PUT: could not record session change', error);
        return null;
      });
      await recordAddedComponents(
        { canvasId: agent.canvas.id, sessionKey: body.sessionKey, sessionName: publisher?.name ?? null },
        result.change.added.map((c) => c.id),
        new Date(now),
      );
    }

    return NextResponse.json({
      ok: true,
      canvasId: agent.canvas.id,
      updatedAt: row?.updatedAt.getTime() ?? null,
      mode: result.mode,
      componentCount,
      mappedCount: result.nodes.filter((n) => getCodePaths(n as CodePathNode).length > 0).length,
      change: result.change,
      summary: summarizeChange(result.change),
      warnings,
    });
  } catch (error) {
    logger.error('Project diagram PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type AgentCanvas = NonNullable<Awaited<ReturnType<typeof authorizeAgentForCanvas>>>;

/** Store the detailed map (Mermaid only, always a fresh layout). */
async function publishDetailMap(agent: AgentCanvas, body: z.infer<typeof putSchema>) {
  if (!body.mermaid) {
    return NextResponse.json({ error: 'The detailed map is published as mermaid' }, { status: 400 });
  }
  // The detailed map keeps the overview's left-to-right order of areas.
  const overviewAreas = storedGraph(agent.canvas).nodes
    .filter((node) => node.type === 'groupNode' && !node.parentNode && !(node as { parentId?: string }).parentId)
    .sort((a, b) => a.position.x - b.position.x)
    .map((node) => node.id);
  const pipeline = await runMermaidPipeline(body.mermaid, {
    layoutProfile: 'studio-minimal',
    areaOrder: overviewAreas.length > 1 ? overviewAreas : 'flow',
  });
  if (!isDomainSuccess(pipeline)) {
    return NextResponse.json({ error: 'Failed to parse Mermaid code', warnings: pipeline.warnings }, { status: 400 });
  }
  const result = publishGraph({
    existingNodes: [],
    laidOut: { nodes: pipeline.data.nodes as unknown as Node[], edges: pipeline.data.edges as unknown as Edge[] },
    componentPaths: body.componentPaths,
    relayout: true,
    now: Date.now(),
  });
  const { maxNodesPerCanvas } = getUserQuotas(getUserTier(agent.canvas.userId));
  const componentCount = result.nodes.filter((n) => !isTextNode(n)).length;
  if (componentCount > maxNodesPerCanvas) {
    return NextResponse.json(
      { error: `Detailed map too large. Maximum ${maxNodesPerCanvas} nodes allowed.`, code: 'CANVAS_SIZE_EXCEEDED' },
      { status: 400 },
    );
  }
  const graph = { nodes: result.nodes as never, edges: result.edges as never };
  const row = await prisma.projectDetailMap.upsert({
    where: { canvasId: agent.canvas.id },
    create: { canvasId: agent.canvas.id, ...graph },
    update: graph,
    select: { updatedAt: true },
  });
  const warnings = [
    ...pipeline.data.warnings,
    ...(result.unknownPathIds.length > 0 ? [`componentPaths ids not in the diagram: ${result.unknownPathIds.slice(0, 10).join(', ')}`] : []),
  ];
  return NextResponse.json({
    ok: true,
    canvasId: agent.canvas.id,
    level: 'detail',
    updatedAt: row.updatedAt.getTime(),
    componentCount,
    mappedCount: result.nodes.filter((n) => getCodePaths(n as CodePathNode).length > 0).length,
    warnings,
  });
}
