import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import logger from '@/lib/logger';
import { getUserTier, getUserQuotas, isExportFormatAllowed, shouldWatermark } from '@/lib/userQuotas';
import { getSessionFromRequest } from '@/lib/middleware/quotaCheck';

export interface DiagramData {
  nodes: unknown[];
  edges: unknown[];
  label?: string;
  createdAt: Date;
  source?: 'mcp' | 'manual';
}

const STORAGE_FILE = path.join(process.cwd(), '.diagram-sessions.json');

function loadStore(): Map<string, DiagramData> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8')) as Record<string, DiagramData>;
      const map = new Map<string, DiagramData>();
      for (const [key, value] of Object.entries(data)) {
        map.set(key, {
          ...value,
          createdAt: new Date(value.createdAt),
        });
      }
      return map;
    }
  } catch (e) {
    logger.error('Failed to load diagram store:', e);
  }
  return new Map();
}

const diagramStore = loadStore();

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

    const diagram = diagramStore.get(validated.sessionId);
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
