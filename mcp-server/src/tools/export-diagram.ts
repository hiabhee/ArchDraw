import { getDiagramState } from '../lib/diagram-state.js';
import { ExportDiagramInputSchema } from '../lib/schema.js';
import { fetchWithTimeout } from '../lib/http.js';

const API_BASE = process.env.API_BASE_URL || 'https://archdraw.hiabhee.online';

export async function exportDiagram(input: unknown) {
  const validated = ExportDiagramInputSchema.parse(input);
  const format = validated.format;
  const sessionId = validated.sessionId || getDiagramState().sessionId;

  const state = getDiagramState();
  if (state.nodes.length === 0) {
    return {
      success: false,
      error: 'No diagram loaded. Generate or load a diagram first.',
    };
  }

  if (format === 'json') {
    return {
      success: true,
      format: 'json',
      nodes: state.nodes,
      edges: state.edges,
      label: 'ArchDraw Diagram',
      message: 'Diagram exported as JSON. You can save this data to a file.',
    };
  }

  if (!sessionId) {
    return {
      success: false,
      error: 'No sessionId available for this diagram. Export as JSON instead, or generate a diagram first.',
    };
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/diagram/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, format }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      return {
        success: false,
        error: errorData.error || `Export failed: ${response.status}`,
      };
    }

    const data = await response.json() as { nodes?: unknown[]; edges?: unknown[]; label?: string; editorUrl?: string };

    return {
      success: true,
      format,
      message: `To export as ${format.toUpperCase()}, open the editor URL in your browser and use the export button.`,
      editorUrl: data.editorUrl,
      instructions: {
        json: 'Use format: "json" to get raw diagram data',
        png: 'Open editor and click Export → PNG',
        svg: 'Open editor and click Export → SVG',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}
