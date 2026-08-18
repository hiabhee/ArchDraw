import { describe, it, expect } from 'vitest';
import { parseMermaid } from './parse';
import { validateDiagramOutput } from './validation';
import { classifyNode } from './planTranslator';
import type { RFNode, RFEdge } from './types';

describe('Mermaid Parser Chained Edges', () => {
  it('should parse chained edges without labels correctly', () => {
    const code = `graph LR
  A --> B --> C`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(3);
      expect(res.ast.edges.length).toBe(2);
      expect(res.ast.edges[0].source).toBe('A');
      expect(res.ast.edges[0].target).toBe('B');
      expect(res.ast.edges[1].source).toBe('B');
      expect(res.ast.edges[1].target).toBe('C');
    }
  });

  it('should parse chained edges with labels correctly', () => {
    const code = `graph LR
  A -->|sends request| B -->|processes| C`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(3);
      expect(res.ast.edges.length).toBe(2);
      expect(res.ast.edges[0].source).toBe('A');
      expect(res.ast.edges[0].target).toBe('B');
      expect(res.ast.edges[0].label).toBe('sends request');
      expect(res.ast.edges[1].source).toBe('B');
      expect(res.ast.edges[1].target).toBe('C');
      expect(res.ast.edges[1].label).toBe('processes');
    }
  });
});

describe('Mermaid Parser Subgraphs with Spaces', () => {
  it('should parse subgraphs with spaces and normalize IDs to underscores', () => {
    const code = `graph LR
  subgraph Client Layer
    A["Web Client"]
  end`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.subgraphs.length).toBe(1);
      expect(res.ast.subgraphs[0].id).toBe('Client_Layer');
      expect(res.ast.subgraphs[0].label).toBe('Client Layer');
      expect(res.ast.nodes[0].subgraphId).toBe('Client_Layer');
    }
  });
});

describe('Mermaid Parser Semicolon-Delimited Statements', () => {
  it('should parse semicolon-delimited statements on the header line', () => {
    const code = `graph TD; A-->B; A-->C; B-->D; C-->D;`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(4);
      expect(res.ast.edges.length).toBe(4);
      expect(res.ast.edges.map(e => `${e.source}->${e.target}`).sort()).toEqual(['A->B', 'A->C', 'B->D', 'C->D']);
    }
  });

  it('should parse semicolon-delimited statements mixed with newlines', () => {
    const code = `graph TD;\n  A-->B;\n  B-->C;`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(3);
      expect(res.ast.edges.length).toBe(2);
    }
  });

  it('should preserve semicolons inside quoted labels', () => {
    const code = `graph LR
  A["semi;colon"] --> B`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(2);
      const a = res.ast.nodes.find(n => n.id === 'A');
      expect(a?.label).toBe('semi;colon');
    }
  });

  it('should parse semicolon-delimited subgraph statements', () => {
    const code = `graph TD
  subgraph G["Group"]; A; B; end
  A --> B`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.subgraphs.length).toBe(1);
      expect(res.ast.nodes.length).toBe(2);
      expect(res.ast.nodes.every(n => n.subgraphId === 'G')).toBe(true);
      expect(res.ast.edges.length).toBe(1);
    }
  });

  it('should parse edge statements with trailing semicolons on separate lines', () => {
    const code = `graph TD
  A-->B;
  B-->C;`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.nodes.length).toBe(3);
      expect(res.ast.edges.length).toBe(2);
    }
  });
});

describe('Node Classification Precedence', () => {
  it('should prioritize name-based matching over group name', () => {
    // Database named "postgres_db" inside "Service Layer" group should be a database shape
    const dbRes = classifyNode('postgres_db', 'Service Layer');
    expect(dbRes.shape).toBe('cylinder');
    expect(dbRes.serviceType).toBe('database');

    // Queue named "event_stream" inside "Service Layer" group should be a queue
    const queueRes = classifyNode('event_stream', 'Service Layer');
    expect(queueRes.shape).toBe('queue');
    expect(queueRes.serviceType).toBe('queue');

    // Load balancer inside "Data Layer" group should be load-balancer shape (hexagon silhouette)
    const lbRes = classifyNode('api_gateway', 'Data Layer');
    expect(lbRes.shape).toBe('hexagon');
    expect(lbRes.serviceType).toBe('load-balancer');
  });

  it('should fall back to group name if node name is generic', () => {
    // Generic name "auth" inside "Client Layer" — auth/authN match the security
    // concern first (rounded-rectangle silhouette), so group fallback never applies.
    const clientRes = classifyNode('auth', 'Client Layer');
    expect(clientRes.serviceType).toBe('security');

    // Generic name "auth" inside "Data Layer"
    const dataRes = classifyNode('auth', 'Data Layer');
    expect(dataRes.serviceType).toBe('security');
  });
});

describe('Layout Direction Validation', () => {
  it('should validate layout direction correctly for graph LR (horizontal check)', () => {
    const nodes = [
      { id: 'A', position: { x: 100, y: 50 }, data: { label: 'A' } },
      { id: 'B', position: { x: 50, y: 50 }, data: { label: 'B' } }
    ] as unknown as RFNode[];
    const edges = [
      { id: 'A-B', source: 'A', target: 'B' }
    ] as unknown as RFEdge[];

    // Source A is at x=100, Target B is at x=50. A is to the right of B.
    // For LR, source must be to the left of target (x_src < x_tgt).
    // So this should fail.
    const resLR = validateDiagramOutput(nodes, edges, 'LR');
    expect(resLR.passed).toBe(false);
    expect(resLR.warnings[0].type).toBe('LAYOUT_DIRECTION_FAILURE');

    // If source is x=50 and target is x=100, it should pass LR.
    const nodesPass = [
      { id: 'A', position: { x: 50, y: 50 }, data: { label: 'A' } },
      { id: 'B', position: { x: 100, y: 50 }, data: { label: 'B' } }
    ] as unknown as RFNode[];
    const resLRPass = validateDiagramOutput(nodesPass, edges, 'LR');
    expect(resLRPass.passed).toBe(true);
  });

  it('should validate layout direction correctly for graph TD (vertical check)', () => {
    const nodes = [
      { id: 'A', position: { x: 50, y: 100 }, data: { label: 'A' } },
      { id: 'B', position: { x: 50, y: 50 }, data: { label: 'B' } }
    ] as unknown as RFNode[];
    const edges = [
      { id: 'A-B', source: 'A', target: 'B' }
    ] as unknown as RFEdge[];

    // Source A is at y=100, Target B is at y=50.
    // For TD, source must be above target (y_src < y_tgt).
    // So this should fail.
    const resTD = validateDiagramOutput(nodes, edges, 'TD');
    expect(resTD.passed).toBe(false);
    expect(resTD.warnings[0].type).toBe('LAYOUT_DIRECTION_FAILURE');
  });
});

describe('Mermaid Parser ArchDraw Text Directives', () => {
  it('should parse an archdraw-text directive into the AST texts array', () => {
    const code = `graph LR
  %% archdraw-text: {"id":"title","text":"System Architecture","size":"heading","anchor":"top"}
  A[API]-->B[(DB)]`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts).toHaveLength(1);
      expect(res.ast.texts[0]).toMatchObject({
        id: 'title',
        kind: 'text',
        text: 'System Architecture',
        size: 'heading',
        anchor: 'top',
      });
      // Regular nodes are unaffected
      expect(res.ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    }
  });

  it('should parse an archdraw-note directive with title/body and anchorTarget', () => {
    const code = `graph TD
  %% archdraw-note: {"id":"n1","title":"Note","body":"async via queue","anchor":"node","anchorTarget":"A"}
  A[API]`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts[0]).toMatchObject({
        id: 'n1',
        kind: 'note',
        title: 'Note',
        body: 'async via queue',
        anchor: 'node',
        anchorTarget: 'A',
      });
    }
  });

  it('should preserve a stored position for anchor none text', () => {
    const code = `graph LR
  %% archdraw-text: {"id":"t1","text":"Free text","x":10,"y":20}
  A[API]`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts[0].position).toEqual({ x: 10, y: 20 });
      expect(res.ast.texts[0].anchor).toBe('none');
    }
  });

  it('should default anchor to none and size to undefined when omitted', () => {
    const code = `graph LR
  %% archdraw-text: {"id":"t1","text":"Just text"}
  A[API]`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts[0].anchor).toBe('none');
      expect(res.ast.texts[0].size).toBeUndefined();
    }
  });

  it('should not treat trailing comments or malformed directives as text elements', () => {
    const code = `graph LR
  A[API] %% archdraw-text: {"id":"x","text":"nope"}
  %% archdraw-text: {broken json
  A-->B`;
    const res = parseMermaid(code);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts).toHaveLength(0);
      expect(res.ast.nodes.map((n) => n.id)).toEqual(['A', 'B']);
    }
  });

  it('should accept a text-only diagram and still parse ok', () => {
    const res = parseMermaid('%% archdraw-text: {"id":"title","text":"Only text"}');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ast.texts).toHaveLength(1);
      expect(res.ast.nodes).toHaveLength(0);
      expect(res.ast.edges).toHaveLength(0);
    }
  });
});
