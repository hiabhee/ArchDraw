import { BaseStage, type StageResult, errorResult, successResult } from '@/lib/pipeline-core';
import type { PipelineContext } from '@/lib/pipeline-core';
import { parseMermaid } from '../parse';
import type { MermaidAST } from '../types';

export class ParseStage extends BaseStage<string, MermaidAST> {
  constructor() {
    super('parse', { description: 'Parse Mermaid text into AST', weight: 1 });
  }

  async execute(input: string, _context: PipelineContext): Promise<StageResult<MermaidAST>> {
    const parseResult = parseMermaid(input);
    if (!parseResult.ok) {
      const warnings = parseResult.errors.map(e => `Parse error (line ${e.line}): ${e.reason}`);
      return errorResult(new Error('Mermaid parsing failed'), warnings);
    }
    return successResult(parseResult.ast);
  }
}

export class ParseWithDirectionStage extends BaseStage<string, { ast: MermaidAST; direction: string }> {
  constructor() {
    super('parse', { description: 'Parse Mermaid text into AST with direction', weight: 1 });
  }

  async execute(input: string, _context: PipelineContext): Promise<StageResult<{ ast: MermaidAST; direction: string }>> {
    const parseResult = parseMermaid(input);
    if (!parseResult.ok) {
      const warnings = parseResult.errors.map(e => `Parse error (line ${e.line}): ${e.reason}`);
      return errorResult(new Error('Mermaid parsing failed'), warnings);
    }
    return successResult({ ast: parseResult.ast, direction: parseResult.ast.direction });
  }
}
