import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '@/store/diagramStore';
import { runMermaidPipeline } from './pipeline';
import { getDeterministicColor } from './planTranslator';
import type { Node, Edge } from 'reactflow';

describe('Mermaid Editor Real-time Updates', () => {
  beforeEach(() => {
    const store = useDiagramStore.getState();
    if (store.clearDiagram) {
      store.clearDiagram();
    }
  });

  it('should parse simple Mermaid code and import it to the store', async () => {
    const code = `graph LR
  web_browser["Web Browser"] -->|requests| load_balancer["Load Balancer"]
  load_balancer -->|routes| web_server["Web Server"]`;

    const res = await runMermaidPipeline(code);
    expect(res.success).toBe(true);
    expect(res.data.nodes.length).toBeGreaterThan(0);
    expect(res.data.edges.length).toBeGreaterThan(0);

    const store = useDiagramStore.getState();
    store.importDiagram(res.data.nodes as Node[], res.data.edges as Edge[]);

    // Deriving nodes and edges from store should return the imported elements
    const updatedNodes = useDiagramStore.getState().nodes;
    const updatedEdges = useDiagramStore.getState().edges;

    expect(updatedNodes.length).toBe(3);
    expect(updatedEdges.length).toBe(2);

    const wbNode = updatedNodes.find(n => n.id === 'web_browser');
    expect(wbNode).toBeDefined();
    expect(wbNode?.data?.label).toBe('Web Browser');
  });

  it('should correctly classify shapes and colors based on node name and parent group, and respect explicit shape brackets', async () => {
    const code = `graph LR
  subgraph DATA_TIER["Data Storage"]
    postgres_db["PostgreSQL Database"]
  end
  custom_circle(("Explicit Circle Shape"))`;

    const res = await runMermaidPipeline(code);
    expect(res.success).toBe(true);
    
    // Group node and 2 leaf nodes = 3 nodes total
    expect(res.data.nodes.length).toBe(3);

    const dbNode = res.data.nodes.find(n => n.id === 'postgres_db');
    expect(dbNode).toBeDefined();
    // Database should be cylinder
    expect(dbNode?.data?.shape).toBe('cylinder');
    // Data layer category should be slate (#1e293b)
    expect(dbNode?.data?.color).toBe('#1e293b');

    const circleNode = res.data.nodes.find(n => n.id === 'custom_circle');
    expect(circleNode).toBeDefined();
    // Explicit circle brackets (("...")) should map to circle
    expect(circleNode?.data?.shape).toBe('circle');

    const groupNode = res.data.nodes.find(n => n.id === 'DATA_TIER');
    expect(groupNode).toBeDefined();
    expect(groupNode?.data?.color).toBe(getDeterministicColor('DATA_TIER'));
  });

});


