import { describe, it, expect } from 'vitest';
import { runMermaidPipeline } from '../pipeline';
import { applyLayout } from '../layout';
import { buildReactFlowObjects } from '../buildReactFlow';
import { parseMermaid } from '../parse';
import { validateAST } from '../validate';
import { sizeSubgraphs } from '../subgraphSizing';

// A diagram with nested subgraphs
const nestedCode = `graph TD
  subgraph FRONTEND["Frontend"]
    A["Next.js App"]
    B["React UI"]
  end
  subgraph BACKEND["Backend"]
    C["API Server"]
    D["Database"]
  end
  A --> C
  B --> A
  C --> D`;

// A diagram without subgraphs
const flatCode = `graph LR
  A["Service A"] --> B["Service B"]
  B --> C["Database"]`;

describe('Layout diagnostic', () => {
  it('pipeline produces non-zero positions for all nodes', async () => {
    const result = await runMermaidPipeline(nestedCode);
    expect(result.success).toBe(true);
    expect(result.data.nodes.length).toBeGreaterThan(0);
    result.data.nodes.forEach(n => {
      expect(typeof n.position.x).toBe('number');
      expect(typeof n.position.y).toBe('number');
      // All nodes should have non-zero position (layout actually happened)
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
  });

  it('pipeline positions nodes hierarchically (TD)', async () => {
    const result = await runMermaidPipeline(nestedCode);
    const nodes = result.data.nodes;
    // Group nodes should have correct dimensions
    const groups = nodes.filter(n => n.type === 'groupNode');
    for (const g of groups) {
      expect(g.width).toBeGreaterThan(100);
      expect(g.height).toBeGreaterThan(100);
    }
    // Children should have parentNode
    const children = nodes.filter(n => n.parentNode);
    expect(children.length).toBeGreaterThan(0);
    for (const c of children) {
      expect(c.parentNode).toBeDefined();
      // Child position should be relative to parent (not massive offset)
      expect(Math.abs(c.position.x)).toBeLessThan(500);
      expect(Math.abs(c.position.y)).toBeLessThan(500);
    }
  });

  it('pipeline preserves parentNode', async () => {
    const result = await runMermaidPipeline(nestedCode);
    const withParent = result.data.nodes.filter(n => n.parentNode);
    // A, B are in FRONTEND; C, D are in BACKEND
    expect(withParent.length).toBe(4);
    for (const n of result.data.nodes) {
      if (n.id === 'A' || n.id === 'B') {
        expect(n.parentNode).toBe('FRONTEND');
      } else if (n.id === 'C' || n.id === 'D') {
        expect(n.parentNode).toBe('BACKEND');
      }
    }
  });

  it('pipeline handles flat diagram (no subgraphs)', async () => {
    const result = await runMermaidPipeline(flatCode);
    expect(result.success).toBe(true);
    expect(result.data.nodes.length).toBe(3);
    result.data.nodes.forEach(n => {
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
  });

  it('parse -> build -> applyLayout -> sizeSubgraphs produces correct parent-relative positions', () => {
    const parseResult = parseMermaid(nestedCode);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;
    
    const validateResult = validateAST(parseResult.ast);
    expect(validateResult.ok).toBe(true);
    if (!validateResult.ok) return;
    
    const objects = buildReactFlowObjects(validateResult.ast);
    
    // Before layout: nodes should have parentNode set
    const preLayoutChildren = objects.nodes.filter(n => n.parentNode);
    expect(preLayoutChildren.length).toBeGreaterThan(0);
    expect(preLayoutChildren.every(n => n.type === 'shapeNode')).toBe(true);
    
    const layouted = applyLayout(objects, parseResult.ast.direction);
    
    // After layout: nodes should have non-zero positions
    layouted.nodes.forEach(n => {
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
    
    // After layout: parentNode should still be set
    const postLayoutChildren = layouted.nodes.filter(n => n.parentNode);
    expect(postLayoutChildren.length).toBe(preLayoutChildren.length);
    
    const sized = sizeSubgraphs(layouted.nodes);
    
    // After sizing: children positions should be relative to parent
    for (const s of sized) {
      if (s.parentNode) {
        // Child positions should be small numbers (relative to parent)
        expect(s.position.x).toBeGreaterThanOrEqual(0);
        expect(s.position.y).toBeGreaterThanOrEqual(0);
      }
    }
    
    // Group nodes should have correct dimensions
    const groups = sized.filter(n => n.type === 'groupNode');
    for (const g of groups) {
      expect(g.width).toBeDefined();
      expect(g.height).toBeDefined();
      if (g.width && g.height) {
        expect(g.width).toBeGreaterThan(200);
        expect(g.height).toBeGreaterThan(100);
      }
    }
  });
});
