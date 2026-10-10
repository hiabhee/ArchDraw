import { describe, expect, it } from 'vitest';
import { reactFlowExportFilter } from '@/lib/utils/prepareReactFlowForImageExport';

function el(...classes: string[]): HTMLElement {
  const div = document.createElement('div');
  div.className = classes.join(' ');
  return div;
}

describe('reactFlowExportFilter', () => {
  it('removes chrome (minimap, controls, panels, handles, toolbars)', () => {
    for (const cls of [
      'react-flow__minimap',
      'react-flow__controls',
      'react-flow__panel',
      'react-flow__handle',
      'rh rh--left',
      'node-toolbar',
      'group-resize-handle',
    ]) {
      expect(reactFlowExportFilter(el(...cls.split(' ')))).toBe(false);
    }
  });

  it('keeps the dot/line background grid so the PNG matches the canvas', () => {
    expect(reactFlowExportFilter(el('react-flow__background'))).toBe(true);
  });

  it('keeps nodes, edges and labels', () => {
    expect(reactFlowExportFilter(el('react-flow__node'))).toBe(true);
    expect(reactFlowExportFilter(el('react-flow__edge'))).toBe(true);
    expect(reactFlowExportFilter(el('node-card'))).toBe(true);
  });
});
