import { describe, it, expect } from 'vitest';
import { createAiMermaidStages } from '../createAiMermaidStages';
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  getDetailGuidance,
  getMaxNodesForSize,
} from '../plannerPrompts';

describe('createAiMermaidStages', () => {
  it('registers a flat stage list with canonical names', () => {
    const names = createAiMermaidStages().map((s) => s.name);
    expect(names).toEqual([
      'concept-detection',
      'architecture-planning',
      'layout-override',
      'mermaid-materialize',
      'scoring',
      'validation',
    ]);
    expect(names).not.toContain('planning-orchestrator');
  });
});

describe('plannerPrompts', () => {
  it('requires intent classification and anti-pattern rules', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Classify intent');
    expect(prompt).toContain('Anti-patterns');
    expect(prompt).toContain('Do NOT add Browser');
    expect(prompt).toContain('agent loop');
    expect(prompt).toContain('Kafka broker');
  });

  it('includes four detailed few-shot examples', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Example 1');
    expect(prompt).toContain('Example 2');
    expect(prompt).toContain('Example 3');
    expect(prompt).toContain('Example 4');
  });

  it('teaches the title/note directive format', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('archdraw-text');
    expect(prompt).toContain('archdraw-note');
    expect(prompt).toContain('anchor":"top"');
    expect(prompt).toContain('do NOT count toward the node limit');
    // Few-shot examples imitate the directive line
    expect(prompt).toContain('archdraw-text: {\\"id\\":\\"title\\"');
  });

  it('user prompt reinforces intent-first design', () => {
    const user = buildPlannerUserPrompt('agent loop with tools', {
      diagramSize: 'medium',
      maxNodes: 12,
      detailGuidance: getDetailGuidance(2),
    });
    expect(user).toContain('classify the intent');
    expect(user).toContain('do not default to Browser');
    expect(user).toContain('Title');
  });

  it('maps diagram sizes to node caps', () => {
    expect(getMaxNodesForSize('small')).toBe(7);
    expect(getMaxNodesForSize('medium')).toBe(12);
    expect(getMaxNodesForSize('large')).toBe(20);
  });
});
