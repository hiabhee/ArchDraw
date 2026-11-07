import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { TUTORIALS } from '@/data/tutorials';
import { evaluateValidationRule } from '@/lib/tutorial/detection';
import components from '@/data/components.json';
import awsComponents from '@/data/aws-components.json';
import dbComponents from '@/data/db-components.json';
import servicesComponents from '@/data/services-components.json';

/** Every registry component the ⌘K search can add, id → label. */
function registryLabels(): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.label === 'string') labels.set(o.id, o.label);
      Object.values(o).forEach(walk);
    }
  };
  [components, awsComponents, dbComponents, servicesComponents].forEach(walk);
  return labels;
}

/**
 * Plays each tutorial as a learner who does exactly what every step asks: adds the
 * step's component from the registry (it keeps the registry's label, as the tutorial
 * canvas does) and draws the connections the step names. Every step must then pass.
 * A parent named in a way no node on the canvas carries (e.g. "Add Guild Service"
 * for a generic Microservice) makes a step impossible to finish.
 */
describe('tutorial playthrough', () => {
  const labels = registryLabels();

  for (const tutorial of TUTORIALS) {
    it(`${tutorial.id}: every step can be completed`, () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const idByComponent = new Map<string, string>();
      const stuck: string[] = [];

      for (const level of tutorial.levels) {
        for (const step of level.steps) {
          const nodeType = (step.validation.flatMap(function types(r): string[] {
            if (r.type === 'node_exists') return [r.nodeType];
            if (r.type === 'node_count') return [r.nodeType];
            if (r.type === 'all_of' || r.type === 'any_of') return r.rules.flatMap(types);
            return [];
          })[0]) ?? '';
          const id = `n${nodes.length}`;
          nodes.push({
            id,
            type: 'systemNode',
            position: { x: 0, y: 0 },
            data: { componentId: nodeType, label: labels.get(nodeType) ?? step.component ?? nodeType },
          });
          if (step.component) idByComponent.set(step.component, id);
          for (const parent of step.connectsFrom ?? []) {
            const source = idByComponent.get(parent);
            if (source) edges.push({ id: `e${edges.length}`, source, target: id });
          }
          const passed = step.validation.every((rule) => evaluateValidationRule(rule, nodes, edges));
          if (!passed) stuck.push(`${level.title} → ${step.title}`);
        }
      }
      expect(stuck).toEqual([]);
    });

    it(`${tutorial.id}: step ids are unique (progress counts each step once)`, () => {
      const ids = tutorial.levels.flatMap((l) => l.steps.map((s) => s.id));
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});
