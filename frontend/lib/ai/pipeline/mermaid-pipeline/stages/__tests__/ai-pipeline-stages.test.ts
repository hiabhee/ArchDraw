import { describe, it, expect, vi } from 'vitest';
import { ConceptDetectionStage } from '../ConceptDetectionStage';
import { LayoutOverrideStage } from '../LayoutOverrideStage';
import { generateFallbackPlan } from '../FallbackPlan';
import { ValidationStage } from '../ValidationStage';
import type { ConceptDetectionOutput } from '../ConceptDetectionStage';
import type { ArchitecturePlan } from '../ArchitecturePlanningStage';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';

function createContext() {
  return new DefaultPipelineContext('test-exec');
}

describe('ConceptDetectionStage', () => {
  const stage = new ConceptDetectionStage();

  it('detects implicit docker concept', async () => {
    const result = await stage.execute('Describe docker architecture', createContext());
    expect(result.success).toBe(true);
    expect(result.data!.implicitConcept).not.toBeNull();
    expect(result.data!.implicitConcept!.subject).toBe('Docker');
    expect(result.data!.implicitConcept!.domain).toBe('container-runtime');
  });

  it('detects implicit kafka concept', async () => {
    const result = await stage.execute('Explain Kafka architecture', createContext());
    expect(result.success).toBe(true);
    expect(result.data!.implicitConcept).not.toBeNull();
    expect(result.data!.implicitConcept!.subject).toBe('Kafka');
    expect(result.data!.implicitConcept!.domain).toBe('messaging');
  });

  it('returns null concept for generic prompts with details', async () => {
    const result = await stage.execute('Build a simple web app with frontend and backend', createContext());
    expect(result.success).toBe(true);
    expect(result.data!.implicitConcept).toBeNull();
  });

  it('detects vertical layout request', async () => {
    const result = await stage.execute('Create a vertical layout diagram', createContext());
    expect(result.success).toBe(true);
    expect(result.data!.isVerticalRequested).toBe(true);
  });

  it('detects LR layout as not vertical', async () => {
    const result = await stage.execute('Show me a left to right architecture', createContext());
    expect(result.success).toBe(true);
    expect(result.data!.isVerticalRequested).toBe(false);
  });
});

describe('LayoutOverrideStage', () => {
  const stage = new LayoutOverrideStage();
  const basePlan: ArchitecturePlan = {
    formatConfig: { format: 'mermaid', diagramType: 'graph LR', optionalVariants: [] },
    styleConfig: {
      primaryColor: '#000', secondaryColor: '#fff', background: '#fff',
      backgroundColor: '#fff', fontFamily: 'sans', theme: 'default', nodeTypeStyles: {},
    },
    mermaidCode: 'graph LR\nA-->B',
    reasoning: 'Step 0: plan\nStep 1: design',
    usedFallback: false,
    droppedExistingContext: false,
    inEditMode: false,
  };

  it('forces horizontal layout by default when no concept or explicit vertical request', async () => {
    const conceptDetection: ConceptDetectionOutput = {
      implicitConcept: null,
      promptLower: 'build a web app',
      isVerticalRequested: false,
    };
    const result = await stage.execute({ plan: basePlan, conceptDetection }, createContext());
    expect(result.success).toBe(true);
    expect(result.data!.formatConfig.diagramType).toBe('graph LR');
    expect(result.data!.mermaidCode).toContain('graph LR');
  });

  it('uses LR layout for implicit concepts', async () => {
    const conceptDetection: ConceptDetectionOutput = {
      implicitConcept: { subject: 'Docker', domain: 'container-runtime', template: 'docker' },
      promptLower: 'docker architecture',
      isVerticalRequested: false,
    };
    const result = await stage.execute({ plan: basePlan, conceptDetection }, createContext());
    expect(result.success).toBe(true);
    expect(result.data!.formatConfig.diagramType).toBe('graph LR');
  });

  it('uses TD layout when vertical is explicitly requested', async () => {
    const conceptDetection: ConceptDetectionOutput = {
      implicitConcept: null,
      promptLower: 'vertical layout please',
      isVerticalRequested: true,
    };
    const result = await stage.execute({
      plan: { ...basePlan, mermaidCode: 'graph LR\nA-->B' },
      conceptDetection,
    }, createContext());
    expect(result.success).toBe(true);
    expect(result.data!.formatConfig.diagramType).toBe('graph TD');
    expect(result.data!.mermaidCode).toBe('graph TD\nA-->B');
  });
});

describe('generateFallbackPlan', () => {
  it('generates a valid fallback plan', () => {
    const plan = generateFallbackPlan('test prompt');
    expect(plan.formatConfig.format).toBe('mermaid');
    expect(plan.formatConfig.diagramType).toBe('graph LR');
    expect(plan.mermaidCode).toContain('graph LR');
    expect(plan.mermaidCode).toContain('API Gateway');
    expect(plan.mermaidCode).toContain('Database');
    expect(plan.styleConfig.primaryColor).toBe('#0f766e');
  });
});

describe('ValidationStage', () => {
  const stage = new ValidationStage();

  it('validates diagram with reasoning', async () => {
    const result = await stage.execute({
      nodes: [
        { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 50 },
        { id: 'b', type: 'shapeNode', position: { x: 100, y: 100 }, data: { label: 'B' }, width: 100, height: 50 },
      ],
      edges: [{ id: 'a-b', source: 'a', target: 'b', sourceHandle: null, targetHandle: null, type: 'simpleFloating' }],
      reasoning: 'Step 0: plan\nStep 1: design\nStep 2: build\nStep 3: test\nStep 4: deploy\nStep 5: monitor\nStep 6: scale\nStep 7: maintain',
      diagramSize: 'small',
      detailLevel: 1,
      parseWarnings: [],
    }, createContext());

    expect(result.success).toBe(true);
    expect(result.data!.semanticIssues).toBeDefined();
    expect(result.data!.mechanicalRepairs).toBeDefined();
  });

  it('flags missing reasoning', async () => {
    const result = await stage.execute({
      nodes: [
        { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 50 },
      ],
      edges: [],
      reasoning: '',
      diagramSize: 'small',
      detailLevel: 1,
      parseWarnings: [],
    }, createContext());

    expect(result.success).toBe(true);
    const reasoningIssues = result.data!.semanticIssues.filter((i: any) => i.type === 'REASONING_MISSING');
    expect(reasoningIssues.length).toBeGreaterThan(0);
  });

  it('parses warnings into semantic and mechanical categories', async () => {
    const result = await stage.execute({
      nodes: [],
      edges: [],
      reasoning: 'Step 0: plan\nStep 1: design\nStep 2: build\nStep 3: test\nStep 4: deploy\nStep 5: monitor\nStep 6: scale\nStep 7: maintain with 5 nodes',
      diagramSize: 'small',
      detailLevel: 1,
      parseWarnings: [
        '[LAYOUT_DIRECTION_FAILURE] Edge direction wrong',
        '[ORPHANED_NODE] Node X is orphaned',
        '[NODE_LABEL_ARTIFACT] Label has artifacts',
      ],
    }, createContext());

    expect(result.success).toBe(true);
    expect(result.data!.semanticIssues.length).toBeGreaterThan(0);
    expect(result.data!.mechanicalRepairs.length).toBeGreaterThan(0);
  });
});
