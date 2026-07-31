import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserTier, getUserQuotas, isExportFormatAllowed, shouldWatermark } from '@/lib/userQuotas';
import { getSessionFromRequest } from '@/lib/middleware/quotaCheck';
import { generatePureSVG } from '@/lib/svgExport';

interface DiagramData {
  nodes: unknown[];
  edges: unknown[];
  label?: string;
}

const ExportSchema = z.object({
  sessionId: z.string().min(1),
  format: z.enum(['json', 'png', 'svg']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ExportSchema.parse(body);

    const session = await getSessionFromRequest(request);
    const userId = session?.user?.id;
    const tier = getUserTier(userId);

    if (!isExportFormatAllowed(tier, validated.format)) {
      return NextResponse.json(
        {
          error: `${validated.format.toUpperCase()} export requires sign in`,
          code: 'FEATURE_RESTRICTED',
          allowedFormats: getUserQuotas(tier).allowedExportFormats,
        },
        { status: 403 }
      );
    }

    let diagram: DiagramData | null = null;

    try {
      const shared = await prisma.sharedCanvas.findUnique({
        where: { id: validated.sessionId },
        select: { canvasName: true, nodes: true, edges: true, expiresAt: true },
      });
      if (shared) {
        if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
          return NextResponse.json(
            { error: 'Session has expired' },
            { status: 410 }
          );
        }
        diagram = {
          nodes: shared.nodes as unknown[],
          edges: shared.edges as unknown[],
          label: shared.canvasName,
        };
      }
    } catch {
      // Prisma unavailable — continue to 404 below
    }

    if (!diagram) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const { format } = validated;

    if (format === 'json') {
      return NextResponse.json({
        nodes: diagram.nodes,
        edges: diagram.edges,
        label: diagram.label,
      });
    }

    if (format === 'png' || format === 'svg') {
      if (format === 'svg') {
        // Generate SVG directly in the API
        console.log('🚨 API SVG Export: Generating SVG for session', validated.sessionId);
        const svgContent = generatePureSVG(
          diagram.nodes as any[],
          diagram.edges as any[],
          true, // default to dark mode
          '#0f172a' // default background
        );
        
        console.log('🚨 API SVG Export: SVG generated, size:', svgContent.length);
        
        return new NextResponse(svgContent, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Content-Disposition': `attachment; filename="diagram-v2-fixed-${validated.sessionId}.svg"`,
          },
        });
      }
      
      // For PNG, still return the redirect message
      const watermark = shouldWatermark(tier, format);
      return NextResponse.json({
        nodes: diagram.nodes,
        edges: diagram.edges,
        format,
        watermark,
        message: `For ${format.toUpperCase()} export, open the editor URL and use the export button.`,
        editorUrl: `/editor?session=${validated.sessionId}`,
      });
    }

    return NextResponse.json(
      { error: 'Unsupported format' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
