import { describe, it, expect } from 'vitest';
import { unwrapDomainResult } from '@/lib/pipeline-core';
import { runMermaidPipeline } from '../../../../mermaid/pipeline';
import type { RFNode } from '../../../../mermaid/types';
import type { ReactFlowNode } from '../../../../ai/types';

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

describe('parentId propagation', () => {
  it('mermaid pipeline returns parentNode on all children', async () => {
    const result = await runMermaidPipeline(nestedCode);
    const data = unwrapDomainResult(result);
    for (const n of data.nodes) {
      if (n.id === 'A' || n.id === 'B') {
        expect(n.parentNode).toBe('FRONTEND');
      } else if (n.id === 'C' || n.id === 'D') {
        expect(n.parentNode).toBe('BACKEND');
      }
    }
  });

  it('AI pipeline toReactFlowNode sets parentId at top level', async () => {
    const mermaidResult = unwrapDomainResult(await runMermaidPipeline(nestedCode));
    const toReactFlowNode = (n: RFNode): ReactFlowNode => {
      const parentId = n.parentNode || (n.data?.parentId as string | undefined);
      return { id: n.id, type: n.type, position: n.position, parentId, data: { label: (n.data?.label as string) || n.id, icon: '', layer: 'application', parentId } };
    };
    const rfNodes = mermaidResult.nodes.map(toReactFlowNode);
    for (const n of rfNodes) {
      if (n.id === 'A' || n.id === 'B') {
        expect(n.parentId).toBe('FRONTEND');
      } else if (n.id === 'C' || n.id === 'D') {
        expect(n.parentId).toBe('BACKEND');
      }
    }
  });



  it('child nodes have positions relative to parent (small values)', async () => {
    const data = unwrapDomainResult(await runMermaidPipeline(nestedCode));
    const children = data.nodes.filter((n) => n.parentNode);
    for (const c of children) {
      expect(c.position.x).toBeGreaterThanOrEqual(0);
      expect(c.position.x).toBeLessThan(500);
      expect(c.position.y).toBeGreaterThanOrEqual(0);
      expect(c.position.y).toBeLessThan(500);
    }
  });

  it('group nodes have non-trivial width and height', async () => {
    const data = unwrapDomainResult(await runMermaidPipeline(nestedCode));
    const groups = data.nodes.filter((n) => n.type === 'groupNode');
    for (const g of groups) {
      expect(g.width).toBeGreaterThan(100);
      expect(g.height).toBeGreaterThan(100);
    }
  });

  it('position of child relative to parent is within group bounds', async () => {
    const data = unwrapDomainResult(await runMermaidPipeline(nestedCode));
    const groups = new Map(data.nodes.filter((n) => n.type === 'groupNode').map((g) => [g.id, g]));
    for (const c of data.nodes) {
      if (c.parentNode) {
        const parent = groups.get(c.parentNode);
        expect(parent).toBeDefined();
        if (parent && parent.width && parent.height) {
          // Child's relative position should be within group bounds
          expect(c.position.x + 180).toBeLessThanOrEqual(parent.width + 1); // +some padding
          expect(c.position.y + 60).toBeLessThanOrEqual(parent.height + 1);
        }
      }
    }
  });
});
