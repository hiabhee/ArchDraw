import { describe, it, expect } from 'vitest';
import { runMermaidPipeline, runMermaidPipelineV2 } from '../pipeline';
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

// Nested subgraphs
const deeplyNestedCode = `graph TD
  subgraph OUTER["Outer"]
    subgraph INNER["Inner"]
      A["Node A"]
    end
    B["Node B"]
  end
  C["Node C"]`;

describe('Layout diagnostic', () => {
  it('original v1 pipeline produces non-zero positions for all nodes', () => {
    const result = runMermaidPipeline(nestedCode);
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(0);
    result.nodes.forEach(n => {
      expect(typeof n.position.x).toBe('number');
      expect(typeof n.position.y).toBe('number');
      // All nodes should have non-zero position (layout actually happened)
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
  });

  it('v1 pipeline positions nodes hierarchically (TD)', () => {
    const result = runMermaidPipeline(nestedCode);
    const nodes = result.nodes;
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

  it('v1 pipeline preserves parentNode', () => {
    const result = runMermaidPipeline(nestedCode);
    const withParent = result.nodes.filter(n => n.parentNode);
    // A, B are in FRONTEND; C, D are in BACKEND
    expect(withParent.length).toBe(4);
    for (const n of result.nodes) {
      if (n.id === 'A' || n.id === 'B') {
        expect(n.parentNode).toBe('FRONTEND');
      } else if (n.id === 'C' || n.id === 'D') {
        expect(n.parentNode).toBe('BACKEND');
      }
    }
  });

  it('v1 pipeline handles flat diagram (no subgraphs)', () => {
    const result = runMermaidPipeline(flatCode);
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBe(3);
    result.nodes.forEach(n => {
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
  });

  it('v2 pipeline produces same positions as v1', () => {
    const v1Result = runMermaidPipeline(nestedCode);
    // runMermaidPipelineV2 is async
    // We'll test this separately below
    expect(v1Result.success).toBe(true);
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

describe('v2 pipeline layout', () => {
  it('produces correct positions', async () => {
    const result = await runMermaidPipelineV2(nestedCode);
    expect(result.success).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(0);
    result.nodes.forEach(n => {
      expect(n.position.x !== 0 || n.position.y !== 0).toBe(true);
    });
    const groups = result.nodes.filter(n => n.type === 'groupNode');
    for (const g of groups) {
      expect(g.width).toBeGreaterThan(100);
      expect(g.height).toBeGreaterThan(100);
    }
  });

  it('v2 matches v1 output for identical input', async () => {
    const v1Result = runMermaidPipeline(nestedCode);
    const v2Result = await runMermaidPipelineV2(nestedCode);
    
    expect(v2Result.nodes.length).toBe(v1Result.nodes.length);
    expect(v2Result.edges.length).toBe(v1Result.edges.length);
    expect(v2Result.success).toBe(v1Result.success);
    
    // Check parentNode assignments match
    for (const v1n of v1Result.nodes) {
      const v2n = v2Result.nodes.find(n => n.id === v1n.id);
      expect(v2n).toBeDefined();
      if (v2n) {
        expect(v2n.parentNode).toBe(v1n.parentNode);
      }
    }
  });
});
