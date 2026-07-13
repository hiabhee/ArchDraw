/**
 * Bug Condition Exploration Test for Dark Mode Node Styling
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * - Dark mode nodes currently use gradient backgrounds instead of solid colors with backplates
 * - Dark mode nodes have empty backplate arrays instead of plate design structure
 * - SVG export uses gradient fills instead of solid fills with backplates
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/store/diagramStore';

// Hoisted mock controller - allows per-test theme control
const { mockTheme } = vi.hoisted(() => ({
  mockTheme: { isDark: true },
}));

vi.mock('@/lib/theme', () => ({
  useCanvasTheme: () => ({
    isDark: mockTheme.isDark,
    resolvedTheme: mockTheme.isDark ? 'dark' : 'light',
  }),
  useTheme: () => ({
    theme: mockTheme.isDark ? 'dark' : 'light',
    isDark: mockTheme.isDark,
    darkMode: mockTheme.isDark,
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/store/diagramStore', () => ({
  useDiagramStore: (selector: unknown) => {
    const mockState = {
      nodes: [],
      canvasDarkMode: true,
      darkMode: true,
      setSelectedNodeId: vi.fn(),
      addNode: vi.fn(),
      setSelectedNodeIds: vi.fn(),
      removeNode: vi.fn(),
      updateNodeData: vi.fn(),
      setSidebarOpen: vi.fn(),
    };
    if (typeof selector === 'function') return selector(mockState);
    return mockState;
  },
}));

const { SystemNode } = await import('@/components/SystemNode');
const { ShapeNode } = await import('@/components/ShapeNode');
const { generatePureSVG } = await import('@/lib/svgExport');

function getBackplates(container: HTMLElement): HTMLElement[] {
  const allDivs = container.querySelectorAll('div');
  return Array.from(allDivs).filter(div => {
    const style = (div as HTMLElement).style;
    return style.position === 'absolute' &&
           style.borderRadius &&
           style.background &&
           (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
  });
}


describe('Bug Condition Exploration: Dark Mode Gradient and Missing Backplates', () => {
  describe('Property 1: SystemNode Dark Mode Uses Plate Design (Not Gradient)', () => {
    it('should use solid background color instead of gradient in dark mode', () => {
      mockTheme.isDark = true;

      const nodeProps = {
        id: 'test-node-1',
        type: 'systemNode',
        data: {
          label: 'Test Service',
          subtitle: 'API Server',
          layer: 'compute',
        } as NodeData,
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container } = render(
        <ReactFlowProvider>
          <SystemNode {...nodeProps} />
        </ReactFlowProvider>
      );

      const nodeElement = container.querySelector('[style*="background"]');

      expect(nodeElement).toBeTruthy();

      if (nodeElement) {
        const background = (nodeElement as HTMLElement).style.background;

        // EXPECTED BEHAVIOR: Should use solid color, not gradient
        // On UNFIXED code, this will show: linear-gradient(135deg, #1E2235 0%, #141624 100%)
        expect(background).not.toContain('linear-gradient');
        expect(background).not.toContain('gradient');

        // Should use a solid color appropriate for dark mode
        expect(background).toMatch(/^#[0-9A-Fa-f]{6}$|^rgb/);
      }
    });

    it('should have backplate elements in dark mode (not empty array)', () => {
      mockTheme.isDark = true;

      const nodeProps = {
        id: 'test-node-2',
        type: 'systemNode',
        data: {
          label: 'Database',
          subtitle: 'PostgreSQL',
          layer: 'data',
        } as NodeData,
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container } = render(
        <ReactFlowProvider>
          <SystemNode {...nodeProps} />
        </ReactFlowProvider>
      );

      const backplates = getBackplates(container);

      // EXPECTED BEHAVIOR: Should have 2 backplate layers in dark mode
      // On UNFIXED code, this will be 0 (empty array)
      expect(backplates.length).toBeGreaterThan(0);
      expect(backplates.length).toBe(2);
    });

    it('should have consistent backplate offsets between light and dark mode', () => {
      // Test light mode
      mockTheme.isDark = false;

      const lightNodeProps = {
        id: 'test-node-light',
        type: 'systemNode',
        data: {
          label: 'Service',
          layer: 'compute',
        } as NodeData,
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container: lightContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...lightNodeProps} />
        </ReactFlowProvider>
      );

      const lightBackplates = getBackplates(lightContainer);

      // Test dark mode
      mockTheme.isDark = true;

      const darkNodeProps = { ...lightNodeProps, id: 'test-node-dark' };

      const { container: darkContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...darkNodeProps} />
        </ReactFlowProvider>
      );

      const darkBackplates = getBackplates(darkContainer);

      // EXPECTED BEHAVIOR: Both should have same number of backplates
      expect(darkBackplates.length).toBe(lightBackplates.length);

      // EXPECTED BEHAVIOR: Backplate offsets should match (10px and 5px)
      if (darkBackplates.length > 0 && lightBackplates.length > 0) {
        const darkOffsets = darkBackplates.map(bp => {
          const style = (bp as HTMLElement).style;
          const match = style.transform.match(/translate\((\d+)px/);
          return match ? parseInt(match[1]) : (parseInt(style.top) || 0);
        });

        const lightOffsets = lightBackplates.map(bp => {
          const style = (bp as HTMLElement).style;
          const match = style.transform.match(/translate\((\d+)px/);
          return match ? parseInt(match[1]) : (parseInt(style.top) || 0);
        });

        expect(darkOffsets).toEqual(lightOffsets);
      }
    });
  });

  describe('Property 2: ShapeNode Dark Mode Uses Consistent Backplate Structure', () => {
    it('should use plate-style backplates in dark mode', () => {
      mockTheme.isDark = true;

      const shapeNodeProps = {
        id: 'shape-node-1',
        type: 'shapeNode',
        data: {
          label: 'Cache',
          shape: 'cylinder' as const,
          color: '#0891B2',
        },
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container } = render(
        <ReactFlowProvider>
          <ShapeNode {...shapeNodeProps} />
        </ReactFlowProvider>
      );

      const backplates = container.querySelectorAll('[style*="position: absolute"]');

      // EXPECTED BEHAVIOR: Should have backplate elements
      expect(backplates.length).toBeGreaterThan(0);
    });
  });

  describe('Property 3: SVG Export Dark Mode Uses Solid Fill with Backplates', () => {
    it('should not use gradient fill in dark mode SVG export', () => {
      const nodes: Node[] = [
        {
          id: 'node-1',
          type: 'systemNode',
          position: { x: 100, y: 100 },
          data: {
            label: 'API Gateway',
            subtitle: 'REST API',
            layer: 'edge',
          } as NodeData,
        },
      ];

      const edges: Edge[] = [];

      // Generate SVG in dark mode
      const svg = generatePureSVG(nodes, edges, true, '#0f172a');

      // EXPECTED BEHAVIOR: Should NOT use url(#node-dark-bg) gradient fill
      // On UNFIXED code, this will contain: fill="url(#node-dark-bg)"
      expect(svg).not.toContain('url(#node-dark-bg)');

      // Should use solid fill instead
      expect(svg).toContain('fill="#');
    });

    it('should have backplate rect elements in dark mode SVG export', () => {
      const nodes: Node[] = [
        {
          id: 'node-2',
          type: 'systemNode',
          position: { x: 200, y: 200 },
          data: {
            label: 'Database',
            layer: 'data',
          } as NodeData,
        },
      ];

      const edges: Edge[] = [];

      // Generate SVG in dark mode
      const svg = generatePureSVG(nodes, edges, true, '#0f172a');

      // EXPECTED BEHAVIOR: Should have backplate rect elements
      // On UNFIXED code, backplates will be missing (empty array)
      // Count rect elements - should have main rect + backplate rects
      const rectMatches = svg.match(/<rect/g);

      expect(rectMatches).toBeTruthy();
      if (rectMatches) {
        // Should have at least 3 rects: background + 2 backplates + main node
        expect(rectMatches.length).toBeGreaterThan(2);
      }
    });

    it('should not define node-dark-bg gradient when using plate design', () => {
      const nodes: Node[] = [
        {
          id: 'node-3',
          type: 'systemNode',
          position: { x: 300, y: 300 },
          data: {
            label: 'Service',
            layer: 'compute',
          } as NodeData,
        },
      ];

      const edges: Edge[] = [];

      // Generate SVG in dark mode
      const svg = generatePureSVG(nodes, edges, true, '#0f172a');

      // EXPECTED BEHAVIOR: Should not reference the gradient since we're using solid fills
      const gradientUsage = svg.match(/fill="url\(#node-dark-bg\)"/g);
      expect(gradientUsage).toBeNull();
    });
  });

  describe('Property 4: Theme Switching Maintains Structural Consistency', () => {
    it('should maintain plate design structure when switching themes', () => {
      const nodeData = {
        label: 'Auth Service',
        subtitle: 'OAuth2',
        layer: 'observe',
      } as NodeData;

      // Render in light mode
      mockTheme.isDark = false;

      const lightProps = {
        id: 'theme-test-light',
        type: 'systemNode',
        data: nodeData,
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container: lightContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...lightProps} />
        </ReactFlowProvider>
      );

      const lightBackplates = getBackplates(lightContainer);
      const lightMainNode = lightContainer.querySelector('[style*="background"]');

      // Render in dark mode
      mockTheme.isDark = true;

      const darkProps = { ...lightProps, id: 'theme-test-dark' };

      const { container: darkContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...darkProps} />
        </ReactFlowProvider>
      );

      const darkBackplates = getBackplates(darkContainer);
      const darkMainNode = darkContainer.querySelector('[style*="background"]');

      // EXPECTED BEHAVIOR: Both themes should have the same structural design
      // Same number of backplates
      expect(darkBackplates.length).toBe(lightBackplates.length);

      // Both should have main node element
      expect(lightMainNode).toBeTruthy();
      expect(darkMainNode).toBeTruthy();

      // Dark mode should NOT use gradient (structural difference)
      if (darkMainNode) {
        const darkBg = (darkMainNode as HTMLElement).style.background;
        expect(darkBg).not.toContain('linear-gradient');
      }
    });
  });
});
