import { describe, expect, it } from 'vitest';
import { resolveEdgeFlowSemantics } from '../edgeFlowSemantics';
import { layoutDiagramViaMermaid } from '../relayout';
import { getCachedDiagramGeometryPlan } from '@/lib/diagram/geometry/diagramGeometry';
import { composeEdgeDisplayLabel } from '@/lib/diagram/edges/edgeLabelLayout';
import { measureText } from '@/lib/diagram/export/svg/textMeasure';
import { requestResponseNodes, requestResponseEdges } from '@/data/templates/request-response';
import { TEMPLATES } from '@/data/templates';
import { rrNodes, rrEdges } from './fixtures/requestResponseEdited';

const node = (id: string, label: string) => ({ id, type: 'shapeNode', position: { x: 0, y: 0 }, data: { label } });
const edge = (id: string, source: string, target: string, label: string) => ({ id, source, target, label, data: { label, importance: 'secondary' } });
const roles = (nodes: ReturnType<typeof node>[], edges: ReturnType<typeof edge>[]) => {
  const result = resolveEdgeFlowSemantics(nodes as never, edges as never);
  return Object.fromEntries(edges.map((e) => [e.label, result.assignments.get(e.id)?.role]));
};

describe('a request and its reply', () => {
  it('treats the request as the flow and the reply as feedback when the steps are numbered', () => {
    const r = roles(
      [node('client', 'Client'), node('gateway', 'API Gateway'), node('auth', 'Auth Service')],
      [edge('a', 'client', 'gateway', '4. Forward'), edge('b', 'gateway', 'auth', '5. Verify JWT'), edge('c', 'auth', 'gateway', '6. Auth OK')],
    );
    expect(r['5. Verify JWT']).not.toBe('feedback');
    expect(r['6. Auth OK']).toBe('feedback');
  });

  it('reads an unnumbered reply ("rows", "200 OK", "result") as feedback', () => {
    const r = roles(
      [node('client', 'Client'), node('service', 'Application Server'), node('db', 'Database')],
      [edge('a', 'client', 'service', 'call'), edge('b', 'service', 'db', 'SQL'), edge('c', 'db', 'service', 'rows')],
    );
    expect(r.SQL).not.toBe('feedback');
    expect(r.rows).toBe('feedback');
  });

  it('ignores roles a previous layout inferred and saved (a wrong guess must not stick)', () => {
    const stale = (e: ReturnType<typeof edge>, role: string) => ({ ...e, data: { ...e.data, flowRole: role, flowRoleSource: 'inferred' } });
    const nodes = [node('lb', 'Load Balancer'), node('gateway', 'API Gateway'), node('auth', 'Auth Service')];
    const edges = [
      stale(edge('a', 'lb', 'gateway', '4. Forward'), 'feedback'),
      stale(edge('b', 'gateway', 'auth', '5. Verify JWT'), 'feedback'),
      stale(edge('c', 'auth', 'gateway', '6. Auth OK'), 'supporting'),
      stale(edge('d', 'gateway', 'lb', '12. 200 OK'), 'supporting'),
    ];
    const result = resolveEdgeFlowSemantics(nodes as never, edges as never);
    const role = (id: string) => result.assignments.get(id)?.role;
    expect(role('b')).not.toBe('feedback');
    expect(role('c')).toBe('feedback');
    expect(role('a')).not.toBe('feedback');
    expect(role('d')).toBe('feedback');
  });

  it('still honours a role the author set explicitly', () => {
    const nodes = [node('a', 'A'), node('b', 'B')];
    const edges = [{ ...edge('x', 'a', 'b', 'call'), data: { label: 'call', importance: 'secondary', flowRole: 'feedback', flowRoleSource: 'explicit' } }];
    expect(resolveEdgeFlowSemantics(nodes as never, edges as never).assignments.get('x')?.role).toBe('feedback');
  });

  it('leaves the entry request of a longer loop alone (food delivery: customer to gateway)', () => {
    const template = (TEMPLATES as Array<{ id: string; nodes: unknown[]; edges: Array<{ id: string; source: string; target: string; label?: string; data?: { label?: string } }> }>).find((t) => t.id === 'food_delivery')!;
    const result = resolveEdgeFlowSemantics(template.nodes as never, template.edges.map((e) => ({ ...e, label: e.label ?? e.data?.label })) as never);
    const browse = template.edges.find((e) => (e.label ?? e.data?.label) === 'browse')!;
    expect(result.assignments.get(browse.id)?.role).not.toBe('feedback');
  });
});

describe('the Layout buttons on a request/response diagram', () => {
  for (const direction of ['LR', 'TD'] as const) {
    it(`${direction}: lays the request path out in reading order, with no edge through a card and no label covering another`, async () => {
      const laid = await layoutDiagramViaMermaid(requestResponseNodes, requestResponseEdges, direction, { renderStyleId: 'studio-metallic', layoutStyle: 'flow' });
      expect(laid.success).toBe(true);
      const along = (id: string) => {
        const n = laid.nodes.find((candidate) => candidate.id === id)!;
        return direction === 'LR' ? n.position.x : n.position.y;
      };
      // The request path runs forwards: nothing on it is placed before the step that calls it.
      const path = ['rr_client', 'rr_lb', 'rr_gateway', 'rr_service'].filter((id) => laid.nodes.some((n) => n.id === id));
      for (let i = 1; i < path.length; i++) expect(along(path[i]), `${path[i]} after ${path[i - 1]}`).toBeGreaterThan(along(path[i - 1]));

      const plan = getCachedDiagramGeometryPlan(laid.nodes as never, laid.edges as never, { direction, renderStyleId: 'studio-metallic', iconMode: 'off' } as never);
      expect(plan.quality.criticalPathDisconnectCount).toBe(0);
      // Labels as the canvas draws them zoomed out (1.4x): none covers another.
      const boxes = [...plan.labels.entries()].map(([id, anchor]) => {
        const e = laid.edges.find((candidate) => candidate.id === id) as { data?: { label?: string; responseLabel?: string } } | undefined;
        const text = composeEdgeDisplayLabel(e?.data?.label, e?.data?.responseLabel) || '';
        const w = (measureText(text, 500, 10.5) + 16) * 1.4;
        const h = 22 * 1.4;
        return { text, x: anchor.x - w / 2, y: anchor.y - h / 2, w, h };
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `"${a.text}" covers "${b.text}"`).toBe(false);
      }
    }, 120000);
  }
});

describe('the main path is one straight line', () => {
  it('LR: client, DNS, CDN, load balancer and gateway share one line', async () => {
    const laid = await layoutDiagramViaMermaid(rrNodes as never, rrEdges as never, 'LR', { renderStyleId: 'studio-metallic', layoutStyle: 'flow' });
    const centre = (id: string) => {
      const n = laid.nodes.find((candidate) => candidate.id === id)!;
      return n.position.y + (n.height ?? 0) / 2;
    };
    const lines = ['rr_client', 'rr_dns', 'rr_cdn', 'rr_lb', 'rr_gateway'].map(centre);
    expect(Math.max(...lines) - Math.min(...lines), `centres: ${lines.map(Math.round).join(', ')}`).toBeLessThan(1);
  }, 120000);
});
