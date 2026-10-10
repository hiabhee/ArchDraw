import { describe, expect, it } from 'vitest';
import {
  decodeSvgDataUrl,
  reactFlowExportFilter,
  resolveExportBackgroundColor,
} from '@/lib/utils/prepareReactFlowForImageExport';

describe('prepareReactFlowForImageExport helpers', () => {
  it('decodes utf8 svg data urls', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    expect(decodeSvgDataUrl(dataUrl)).toBe(svg);
  });

  it('decodes base64 svg data urls', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    expect(decodeSvgDataUrl(dataUrl)).toBe(svg);
  });

  it('filters react-flow chrome nodes', () => {
    const minimap = document.createElement('div');
    minimap.classList.add('react-flow__minimap');
    const controls = document.createElement('div');
    controls.classList.add('react-flow__controls');
    const node = document.createElement('div');
    node.classList.add('react-flow__node');

    expect(reactFlowExportFilter(minimap)).toBe(false);
    expect(reactFlowExportFilter(controls)).toBe(false);
    expect(reactFlowExportFilter(node)).toBe(true);
  });

  it('resolves export background colors', () => {
    const host = document.createElement('div');
    host.style.backgroundColor = 'rgb(248, 250, 252)';
    const flow = document.createElement('div');
    host.appendChild(flow);

    expect(resolveExportBackgroundColor('transparent', flow)).toBeUndefined();
    expect(resolveExportBackgroundColor('dark', flow)).toBe('#000000');
    expect(resolveExportBackgroundColor('light', flow)).toBe('rgb(248, 250, 252)');
  });
});
