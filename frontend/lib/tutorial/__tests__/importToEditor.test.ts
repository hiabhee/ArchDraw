import { describe, expect, it } from 'vitest';
import { tutorialCanvasToEditorGraph } from '@/lib/tutorial/importToEditor';

describe('tutorialCanvasToEditorGraph', () => {
  it('normalizes node and edge types for diagramStore.importDiagram', () => {
    const nodes = [
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: { label: 'API Gateway', componentId: 'api_gateway' },
      },
    ];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
      },
    ];

    const { nodes: editorNodes, edges: editorEdges } = tutorialCanvasToEditorGraph(nodes, edges);

    expect(editorNodes[0].type).toBe('systemNode');
    expect(editorNodes[0].data.label).toBe('API Gateway');
    expect(editorEdges[0].type).toBe('simpleFloating');
    expect(editorEdges[0].animated).toBe(false);
  });
});
