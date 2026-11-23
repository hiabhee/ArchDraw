import type { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { computeDiagramGeometryPlan, findNodeCollisions } from '../geometry/diagramGeometry';
import { recoverMcpLayout } from './recoverMcpLayout';

const studio = { renderStyleId: 'studio-minimal', iconMode: 'all' } as const;

describe('opening a saved Studio diagram', () => {
  it('repairs the overlapping family-tree layout and routes each generation top down', async () => {
    // Positions from the reported canvas. The saved widths are the old card widths.
    const nodes: Node[] = [
      ['key', 52, 29, 'Family Tree of Chhatrapati Shivaji Maharaj', 'Solid arrows show descent. Dashed arrows show marriages.'],
      ['parents', 468, 66, 'Shahaji Bhosale and Jijabai', 'Parents'],
      ['shivaji', 460, 144, 'Chhatrapati Shivaji Maharaj'],
      ['saibai', 146, 239, 'Saibai', 'Wife of Shivaji Maharaj'],
      ['soyarabai', 476, 239, 'Soyarabai', 'Wife of Shivaji Maharaj'],
      ['sakvarbai', 668, 239, 'Sakvarbai', 'Wife of Shivaji Maharaj'],
      ['sagunabai', 834, 239, 'Sagunabai', 'Wife of Shivaji Maharaj'],
      ['other', 1004, 239, 'Other wives', 'Putalabai, Kashibai, Lakshmibai, Gunwantabai'],
      ['sambhaji', 42, 335, 'Sambhaji Maharaj and Yesubai', 'Son and daughter-in-law'],
      ['daughters', 241, 335, 'Sakhubai, Ranubai, Ambikabai', 'Daughters'],
      ['rajaram', 450, 335, 'Rajaram Maharaj', 'Son'],
      ['dipabai', 626, 335, 'Dipabai', 'Daughter'],
      ['kamalabai', 812, 335, 'Kamalabai', 'Daughter'],
      ['rajkunvarbai', 984, 335, 'Rajkunvarbai', 'Daughter'],
      ['tarabai', 385, 427, 'Rajaram Maharaj and Tarabai', 'Marriage'],
      ['rajasbai', 561, 427, 'Rajaram Maharaj and Rajasbai', 'Marriage'],
      ['shahu', 47, 519, 'Shahu I of Satara', 'Grandson'],
      ['bhavanibai', 213, 519, 'Bhavanibai', 'Granddaughter'],
      ['shivaji2', 389, 519, 'Shivaji II of Kolhapur', 'Grandson'],
      ['sambhaji2', 567, 519, 'Sambhaji II of Kolhapur', 'Grandson'],
    ].map(([id, x, y, label, subtitle]) => ({
      id: String(id), type: 'systemNode', width: 240, height: 80,
      position: { x: Number(x) / 0.64, y: Number(y) / 0.64 }, data: { label, subtitle },
    }));
    const relationships = {
      parents: ['shivaji'], shivaji: ['saibai', 'soyarabai', 'sakvarbai', 'sagunabai', 'other'],
      saibai: ['sambhaji', 'daughters'], soyarabai: ['rajaram', 'dipabai'], sakvarbai: ['kamalabai'],
      sagunabai: ['rajkunvarbai'], sambhaji: ['shahu', 'bhavanibai'], rajaram: ['tarabai', 'rajasbai'],
      tarabai: ['shivaji2'], rajasbai: ['sambhaji2'],
    };
    const edges: Edge[] = Object.entries(relationships).flatMap(([source, targets]) => targets.map(target => ({
      id: target, source, target, type: 'simpleFloating',
      data: { edgeVariant: source === 'shivaji' || source === 'rajaram' ? 'dashed' : 'solid' },
    })));

    expect(findNodeCollisions(nodes, studio).length).toBeGreaterThan(5);
    const recovered = await recoverMcpLayout(nodes, edges);
    expect(recovered.direction).toBe('TD');
    expect(recovered.nodes.map(node => node.id).sort()).toEqual(nodes.map(node => node.id).sort());
    expect(findNodeCollisions(recovered.nodes, studio)).toEqual([]);
    const plan = computeDiagramGeometryPlan(recovered.nodes, edges, { ...studio, direction: 'TD' });
    expect(plan.violations.filter(issue => issue.severity === 'hard')).toEqual([]);
    expect(plan.quality.crossings).toBe(0);
    const fan = relationships.shivaji.map(id => plan.routes.get(id)!);
    expect(fan.map(route => [route.sourcePosition, route.targetPosition])).toEqual(fan.map(() => ['bottom', 'top']));
    expect(fan.filter(route => route.waypoints.length > 2).every(route => route.renderedPath.commands.some(command => command.kind === 'arc'))).toBe(true);
    expect((await recoverMcpLayout(recovered.nodes, edges, 'TD')).nodes).toBe(recovered.nodes);
  });
});
