import { describe, it, expect } from 'vitest';
import { ParseStage } from '../ParseStage';
import { ValidateStage } from '../ValidateStage';
import { BuildStage } from '../BuildStage';
import { LayoutStage } from '../LayoutStage';
import { SizeStage } from '../SizeStage';
import { FinalValidationStage } from '../ValidationStage';
import type { MermaidAST, RFObjects, RFNode, RFEdge, Direction } from '../../types';
import { DefaultPipelineContext } from '@/lib/pipeline-core/PipelineContext';

const validMermaidCode = `graph TD
  A[Service A] --> B[Service B]
  B --> C[Database]
  subgraph GROUP["My Group"]
    B
  end`;

const invalidMermaidCode = `graph TD
  A --> B
  %% this is fine
  `;

const emptyMermaidCode = `graph TD`;

function createContext() {
  return new DefaultPipelineContext('test-exec');
}

describe('ParseStage', () => {
  it('parses valid mermaid code', async () => {
    const stage = new ParseStage();
    const result = await stage.execute(validMermaidCode, createContext());

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.nodes.length).toBeGreaterThan(0);
    expect(result.data!.edges.length).toBeGreaterThan(0);
  });

  it('returns error for genuinely unparseable content', async () => {
    const stage = new ParseStage();
    const result = await stage.execute('graph TD\n!!!@@@### invalid $$ %%', createContext());

    expect(result.success).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('ValidateStage', () => {
  it('passes valid AST', async () => {
    const parseStage = new ParseStage();
    const parseResult = await parseStage.execute(validMermaidCode, createContext());
    expect(parseResult.success).toBe(true);

    const stage = new ValidateStage();
    const result = await stage.execute(parseResult.data!, createContext());

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

describe('BuildStage', () => {
  it('builds ReactFlow objects from AST', async () => {
    const parseStage = new ParseStage();
    const parseResult = await parseStage.execute(validMermaidCode, createContext());
    expect(parseResult.success).toBe(true);

    const validateStage = new ValidateStage();
    const validateResult = await validateStage.execute(parseResult.data!, createContext());
    expect(validateResult.success).toBe(true);

    const stage = new BuildStage();
    const result = await stage.execute(validateResult.data!, createContext());

    expect(result.success).toBe(true);
    expect(result.data!.nodes.length).toBeGreaterThan(0);
    expect(result.data!.edges.length).toBeGreaterThan(0);
  });
});

describe('LayoutStage', () => {
  it('applies layout to objects', async () => {
    const parseStage = new ParseStage();
    const parseResult = await parseStage.execute(validMermaidCode, createContext());
    expect(parseResult.success).toBe(true);

    const validateStage = new ValidateStage();
    const validateResult = await validateStage.execute(parseResult.data!, createContext());

    const buildStage = new BuildStage();
    const objects = await buildStage.execute(validateResult.data!, createContext());
    expect(objects.success).toBe(true);

    const stage = new LayoutStage();
    const result = await stage.execute(
      { objects: objects.data!, direction: 'TD' as Direction },
      createContext()
    );

    expect(result.success).toBe(true);
    expect(result.data!.nodes.every(n => n.position.x !== 0 || n.position.y !== 0)).toBe(true);
  });
});

describe('SizeStage', () => {
  it('sizes subgraph containers', async () => {
    const stage = new SizeStage();
    const nodes: RFNode[] = [
      { id: 'group1', type: 'groupNode', position: { x: 0, y: 0 }, data: {}, width: 100, height: 100 },
      { id: 'node1', type: 'shapeNode', position: { x: 20, y: 20 }, data: { label: 'N1' }, width: 100, height: 50, parentNode: 'group1' },
      { id: 'node2', type: 'shapeNode', position: { x: 20, y: 100 }, data: { label: 'N2' }, width: 100, height: 50, parentNode: 'group1' },
    ];

    const result = await stage.execute(nodes, createContext());
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(3);
  });
});

describe('FinalValidationStage', () => {
  it('validates correct output', async () => {
    const stage = new FinalValidationStage();
    const nodes: RFNode[] = [
      { id: 'a', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'A' }, width: 100, height: 50 },
      { id: 'b', type: 'shapeNode', position: { x: 0, y: 100 }, data: { label: 'B' }, width: 100, height: 50 },
    ];
    const edges: RFEdge[] = [
      { id: 'a-b', source: 'a', target: 'b', sourceHandle: null, targetHandle: null, type: 'simpleFloating' },
    ];

    const result = await stage.execute({ nodes, edges, direction: 'TD' as Direction }, createContext());
    expect(result.success).toBe(true);
    expect(result.data!.validationWarnings).toBeDefined();
  });

  it('detects missing parent nodes', async () => {
    const stage = new FinalValidationStage();
    const nodes: RFNode[] = [
      { id: 'orphan', type: 'shapeNode', position: { x: 0, y: 0 }, data: { label: 'Orphan' }, width: 100, height: 50, parentNode: 'nonexistent' },
    ];

    const result = await stage.execute({ nodes, edges: [], direction: 'TD' as Direction }, createContext());
    expect(result.success).toBe(true);
    expect(result.data!.validationWarnings.length).toBeGreaterThan(0);
  });
});

describe('Pipeline integration - full Mermaid pipeline', () => {
  it('processes valid mermaid code end-to-end', async () => {
    const { runMermaidPipeline } = await import('../../pipeline');
    const result = await runMermaidPipeline(validMermaidCode);

    expect(result.success).toBe(true);
    expect(result.data.nodes.length).toBeGreaterThan(0);
    expect(result.data.edges.length).toBeGreaterThan(0);
    expect(result.data.nodes.every(n => n.position.x !== 0 || n.position.y !== 0)).toBe(true);
  });

  it('returns partial result for minimal mermaid code', async () => {
    const { runMermaidPipeline } = await import('../../pipeline');
    const result = await runMermaidPipeline(`graph TD
      A[Single Node]`);

    expect(result.success).toBe(true);
    expect(result.data.nodes.length).toBe(1);
    expect(result.data.edges.length).toBe(0);
  });

  it('composes production path from class stages', async () => {
    const { createMermaidPipelineStages } = await import('../../pipeline');
    const names = createMermaidPipelineStages().map(s => s.name);
    expect(names).toEqual(['parse', 'validate', 'build', 'layout', 'size', 'validate-output']);
  });
});
