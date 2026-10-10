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
      'quality-repair',
    ]);
    expect(names).not.toContain('planning-orchestrator');
  });
});

describe('plannerPrompts', () => {
  it('requires intent classification and anti-pattern rules', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Classify intent');
    expect(prompt).toContain('Anti-patterns');
    expect(prompt).toContain('Browser');
    expect(prompt).toContain('EXPLAIN_CONCEPT');
    expect(prompt).toContain('APPLICATION');
  });

  it('selects a diagram type instead of treating every request as architecture', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Diagram type');
    expect(prompt).toContain('Flowchart / workflow / process diagram');
    expect(prompt).toContain('Architecture is the default only when');
    expect(prompt).toContain('action nodes');
  });

  it('includes three few-shot examples covering concept, app, and async', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Example 1');
    expect(prompt).toContain('Example 2');
    expect(prompt).toContain('Example 3');
    expect(prompt).toContain('Example 6 — WORKFLOW');
  });

  it('teaches async vs sync rules for queues', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('Async vs Sync');
    expect(prompt).toContain('publishes event');
    expect(prompt).toContain('consumes message');
  });

  it('teaches the title/note directive format', () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain('archdraw-text');
    expect(prompt).toContain('archdraw-note');
    expect(prompt).toContain('anchor":"top"');
  });

  it('user prompt includes quality requirements', () => {
    const user = buildPlannerUserPrompt('agent loop with tools', {
      diagramSize: 'medium',
      maxNodes: 12,
      detailGuidance: getDetailGuidance(2),
    });
    expect(user).toContain('Classify intent');
    expect(user).toContain('requested diagram type');
    expect(user).toContain('Design a diagram for');
    expect(user).toContain('Title');
    expect(user).toContain('max 12 nodes');
  });

  it('maps diagram sizes to node caps', () => {
    expect(getMaxNodesForSize('small')).toBe(7);
    expect(getMaxNodesForSize('medium')).toBe(12);
    expect(getMaxNodesForSize('large')).toBe(20);
  });
});
