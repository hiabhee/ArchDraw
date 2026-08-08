import { describe, it, expect } from 'vitest';
import { step, level, defineTutorial, node, edge } from '@/lib/tutorial/builder';
import { COMPONENT_TOOLTIPS } from '@/data/componentTooltips';

describe('tutorial builder — teaching enrichment', () => {
  it('auto-fills whyItMatters and tradeoff from component tooltips', () => {
    const s = step({ component: 'API Gateway', parent: 'Web' });
    const teaching = s.phases.teaching;
    expect(teaching.whyItMatters).toBe(COMPONENT_TOOLTIPS['API Gateway']?.whyItMatters);
    expect(teaching.tradeoff).toBe(COMPONENT_TOOLTIPS['API Gateway']?.tradeoff);
    expect(teaching.whyItMatters).toBeTruthy();
    expect(teaching.tradeoff).toBeTruthy();
  });

  it('preserves author-written whyItMatters but still auto-fills tradeoff', () => {
    const custom = 'Custom explanation for this architecture.';
    const s = step({
      component: 'API Gateway',
      parent: 'Web',
      phases: { teaching: { heading: 'Deep dive', body: 'Body', whyItMatters: custom } },
    });
    const teaching = s.phases.teaching;
    expect(teaching.whyItMatters).toBe(custom);
    expect(teaching.tradeoff).toBe(COMPONENT_TOOLTIPS['API Gateway']?.tradeoff);
  });

  it('applies generic pedagogy fallback when the component has no tooltip', () => {
    const s = step({ component: 'Totally Custom Component 42', parent: 'Web' });
    const teaching = s.phases.teaching;
    expect(teaching.whyItMatters).toBeTruthy();
    expect(teaching.tradeoff).toBeTruthy();
    expect(teaching.whyItMatters).toContain('Totally Custom Component 42');
  });
});

describe('tutorial builder — step/level/tutorial structure', () => {
  it('builds a connectable step with auto validation', () => {
    const s = step({ component: 'Redis Cache', parent: 'API Gateway' });
    expect(s.id).toBe('step-redis_cache');
    expect(s.skipPhases).toEqual([]);
    expect(s.validation).toHaveLength(1);
    const wrapper = s.validation[0];
    expect(wrapper.type).toBe('all_of');
  });

  it('skips connecting phase for first steps (noConnect / no parent)', () => {
    const s = step({ component: 'Web' });
    expect(s.skipPhases).toContain('connecting');
  });

  it('supports explicit node type and aliases', () => {
    const s = step({ component: 'App Cache', nodeType: 'in_memory_cache', aliases: ['app_cache'], parent: 'API Gateway' });
    const wrapper = s.validation[0];
    expect(wrapper.type).toBe('all_of');
    const first = (wrapper as { rules: unknown[] }).rules[0];
    expect(first).toMatchObject({ type: 'any_of' });
  });

  it('defines a tutorial with levels', () => {
    const t = defineTutorial({
      id: 'test-architecture',
      title: 'Test',
      description: 'desc',
      difficulty: 'beginner',
      estimatedMinutes: 20,
      tags: ['test'],
      icon: 'Cpu',
      color: '#000',
      levels: [level({ title: 'Foundation', steps: [step({ component: 'Web' })] })],
    });
    expect(t.levels).toHaveLength(1);
    expect(t.levels[0].id).toBe('level-foundation');
  });
});
