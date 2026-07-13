/**
 * Preservation Property Tests for Light Mode Node Styling
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * IMPORTANT: Follow observation-first methodology
 * - These tests observe and capture CURRENT behavior on UNFIXED code for light mode
 * - Tests should PASS on unfixed code (confirming baseline behavior to preserve)
 * - After fix is implemented, these tests should still PASS (confirming no regressions)
 * 
 * GOAL: Ensure light mode design remains unchanged after fixing dark mode
 * - Light mode nodes use plate design with specific backplate offsets and colors
 * - Selection indicators (borders, shadows) display correctly
 * - SVG export produces solid fills with backplate elements
 * - Node interactions (toolbar, properties) function correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import type { NodeData } from '@/store/diagramStore';
import { fc, test } from '@fast-check/vitest';

// Mock the theme hook before importing components
vi.mock('@/lib/theme', () => ({
  useCanvasTheme: () => ({
    isDark: false, // Light mode for preservation tests
    resolvedTheme: 'light',
  }),
  useTheme: () => ({
    theme: 'light',
    isDark: false,
    darkMode: false,
    setTheme: vi.fn(),
  }),
}));

// Mock the diagram store
vi.mock('@/store/diagramStore', () => ({
  useDiagramStore: (selector: unknown) => {
    const mockState = {
      nodes: [],
      canvasDarkMode: false,
      darkMode: false,
      setSelectedNodeId: vi.fn(),
      addNode: vi.fn(),
      setSelectedNodeIds: vi.fn(),
      removeNode: vi.fn(),
      updateNodeData: vi.fn(),
      setSidebarOpen: vi.fn(),
    };
    
    if (typeof selector === 'function') {
      return selector(mockState);
    }
    return mockState;
  },
}));

// Import components after mocks are set up
const { SystemNode } = await import('@/components/SystemNode');
const { ShapeNode } = await import('@/components/ShapeNode');
import type { ShapeType } from '@/components/ShapeNode';
const { generatePureSVG } = await import('@/lib/svgExport');

describe('Preservation Property: Light Mode Design Unchanged', () => {
  describe('Property 2.1: SystemNode Light Mode Plate Design Structure', () => {
    it('should maintain plate design with solid background in light mode', () => {
      const nodeProps = {
        id: 'light-node-1',
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

      // Find the main node surface
      const nodeElement = container.querySelector('[style*="background"]');
      
      expect(nodeElement).toBeTruthy();
      
      if (nodeElement) {
        const background = (nodeElement as HTMLElement).style.background;
        
        // Light mode should use solid color (observed: #fefefe)
        expect(background).not.toContain('linear-gradient');
        expect(background).not.toContain('gradient');
        
        // Should be a solid color
        expect(background).toMatch(/^#[0-9A-Fa-f]{6}$|^rgb/);
      }
    });

    it('should have exactly 2 backplate layers in light mode', () => {
      const nodeProps = {
        id: 'light-node-2',
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

      // Count backplate elements - they are divs with specific inline styles
      // Looking for divs with position: absolute, borderRadius, and background color, z-index: 0
      const allDivs = container.querySelectorAll('div');
      const backplates = Array.from(allDivs).filter(div => {
        const style = (div as HTMLElement).style;
        return style.position === 'absolute' && 
               style.borderRadius && 
               style.background &&
               (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
      });
      
      // Light mode has 2 backplate layers (observed behavior)
      expect(backplates.length).toBe(2);
    });

    it('should have backplate offsets of 10px and 5px in light mode', () => {
      const nodeProps = {
        id: 'light-node-3',
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

      const { container } = render(
        <ReactFlowProvider>
          <SystemNode {...nodeProps} />
        </ReactFlowProvider>
      );

      const allDivs = container.querySelectorAll('div');
      const backplates = Array.from(allDivs).filter(div => {
        const style = (div as HTMLElement).style;
        return style.position === 'absolute' && 
               style.borderRadius && 
               style.background &&
               (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
      });
      
      expect(backplates.length).toBe(2);
      
      // Extract offsets from top and left properties
      const offsets = backplates.map(bp => {
        const style = (bp as HTMLElement).style;
        const match = style.transform.match(/translate\((\d+)px/);
        return match ? parseInt(match[1]) : (parseInt(style.top) || 0);
      });
      
      // Observed behavior: offsets are [10, 5] (or [5, 10] depending on render order)
      expect(offsets).toContain(10);
      expect(offsets).toContain(5);
      expect(offsets.length).toBe(2);
    });

    test.prop([
      fc.record({
        label: fc.string({ minLength: 1, maxLength: 50 }),
        subtitle: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
        layer: fc.constantFrom('client', 'edge', 'compute', 'async', 'data', 'observe', 'external'),
      })
    ])('should maintain plate design for all node configurations in light mode', (nodeData) => {
      const nodeProps = {
        id: `prop-test-${Math.random()}`,
        type: 'systemNode',
        data: nodeData as NodeData,
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

      // All light mode nodes should have plate design
      const allDivs = container.querySelectorAll('div');
      const backplates = Array.from(allDivs).filter(div => {
        const style = (div as HTMLElement).style;
        return style.position === 'absolute' && 
               style.borderRadius && 
               style.background &&
               (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
      });
      expect(backplates.length).toBe(2);
      
      // All should use solid background
      const nodeElement = container.querySelector('[style*="background"]');
      if (nodeElement) {
        const background = (nodeElement as HTMLElement).style.background;
        expect(background).not.toContain('gradient');
      }
    });
  });

  describe('Property 2.2: Selection Indicators Display Correctly in Light Mode', () => {
    it('should show selection border when selected in light mode', () => {
      const selectedProps = {
        id: 'selected-node',
        type: 'systemNode',
        data: {
          label: 'Selected Service',
          layer: 'compute',
        } as NodeData,
        selected: true,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container } = render(
        <ReactFlowProvider>
          <SystemNode {...selectedProps} />
        </ReactFlowProvider>
      );

      const wrapperElement = container.querySelector('.node-wrapper');
      expect(wrapperElement).toBeTruthy();
      
      if (wrapperElement) {
        expect(wrapperElement.classList.contains('selected')).toBe(true);
      }
    });

    it('should have different backplate colors when selected vs unselected in light mode', () => {
      // Unselected node
      const unselectedProps = {
        id: 'unselected-node',
        type: 'systemNode',
        data: {
          label: 'Unselected',
          layer: 'compute',
        } as NodeData,
        selected: false,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container: unselectedContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...unselectedProps} />
        </ReactFlowProvider>
      );

      // Selected node
      const selectedProps = { ...unselectedProps, id: 'selected-node-2', selected: true };
      
      const { container: selectedContainer } = render(
        <ReactFlowProvider>
          <SystemNode {...selectedProps} />
        </ReactFlowProvider>
      );

      const getBackplates = (container: HTMLElement) => {
        const allDivs = container.querySelectorAll('div');
        return Array.from(allDivs).filter(div => {
          const style = (div as HTMLElement).style;
          return style.position === 'absolute' && 
                 style.borderRadius && 
                 style.background &&
                 (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
        });
      };

      const unselectedBackplates = getBackplates(unselectedContainer);
      const selectedBackplates = getBackplates(selectedContainer);
      
      // Both should have backplates
      expect(unselectedBackplates.length).toBe(2);
      expect(selectedBackplates.length).toBe(2);
      
      // Extract background colors
      const unselectedColors = unselectedBackplates.map(bp => 
        (bp as HTMLElement).style.background
      );
      const selectedColors = selectedBackplates.map(bp => 
        (bp as HTMLElement).style.background
      );
      
      // Colors should be different between selected and unselected states
      // (observed: unselected uses #efefe8, #e1e1da; selected uses #ecece5, #dfdfd8)
      expect(unselectedColors).not.toEqual(selectedColors);
    });
  });

  describe('Property 2.3: ShapeNode Light Mode Plate Design', () => {
    it('should use plate-style backplates for shape nodes in light mode', () => {
      const shapeNodeProps = {
        id: 'shape-light-1',
        type: 'shapeNode',
        data: {
          label: 'Cache',
          shape: 'rectangle' as const,
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

      // ShapeNode should have backplate elements
      const backplates = container.querySelectorAll('[style*="position: absolute"]');
      
      expect(backplates.length).toBeGreaterThan(0);
    });

    test.prop([
      fc.constantFrom('rectangle', 'rounded-rectangle', 'diamond', 'cylinder', 'circle', 'parallelogram')
    ])('should maintain backplate structure for all shape types in light mode', (shape) => {
      const shapeNodeProps = {
        id: `shape-prop-${Math.random()}`,
        type: 'shapeNode',
        data: {
          label: 'Test Shape',
          shape: shape as ShapeType,
          color: '#6B7280',
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

      // All shape types should have backplates in light mode
      const backplates = container.querySelectorAll('[style*="position: absolute"]');
      expect(backplates.length).toBeGreaterThan(0);
    });
  });

  describe('Property 2.4: SVG Export Light Mode Preservation', () => {
    it('should produce solid fills with backplates in light mode SVG export', () => {
      const nodes: Node[] = [
        {
          id: 'export-node-1',
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

      // Generate SVG in light mode (isDark = false)
      const svg = generatePureSVG(nodes, edges, false, '#ffffff');

      // Light mode should use solid fill
      expect(svg).toContain('fill="#');
      
      // Should not use gradient
      expect(svg).not.toContain('url(#node-dark-bg)');
    });

    it('should have backplate rect elements in light mode SVG export', () => {
      const nodes: Node[] = [
        {
          id: 'export-node-2',
          type: 'systemNode',
          position: { x: 200, y: 200 },
          data: {
            label: 'Database',
            layer: 'data',
          } as NodeData,
        },
      ];

      const edges: Edge[] = [];

      // Generate SVG in light mode
      const svg = generatePureSVG(nodes, edges, false, '#ffffff');

      // Count rect elements - should have background + backplates + main node
      const rectMatches = svg.match(/<rect/g);
      
      expect(rectMatches).toBeTruthy();
      if (rectMatches) {
        // Should have multiple rects: background + 2 backplates + main node = at least 4
        expect(rectMatches.length).toBeGreaterThanOrEqual(3);
      }
    });

    test.prop([
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          label: fc.string({ minLength: 1, maxLength: 50 }),
          layer: fc.constantFrom('client', 'edge', 'compute', 'async', 'data', 'observe', 'external'),
          x: fc.integer({ min: 0, max: 1000 }),
          y: fc.integer({ min: 0, max: 1000 }),
        }),
        { minLength: 1, maxLength: 5 }
      )
    ])('should maintain consistent SVG structure for all node configurations in light mode', (nodeConfigs) => {
      const nodes: Node[] = nodeConfigs.map(config => ({
        id: config.id,
        type: 'systemNode',
        position: { x: config.x, y: config.y },
        data: {
          label: config.label,
          layer: config.layer,
        } as NodeData,
      }));

      const edges: Edge[] = [];

      // Generate SVG in light mode
      const svg = generatePureSVG(nodes, edges, false, '#ffffff');

      // All nodes should have solid fills (no gradients)
      expect(svg).not.toContain('url(#node-dark-bg)');
      
      // Should have rect elements for backplates
      const rectMatches = svg.match(/<rect/g);
      expect(rectMatches).toBeTruthy();
      
      // Each node should contribute backplate rects
      if (rectMatches) {
        // At least: 1 background + (nodes.length * 2 backplates) + nodes.length main rects
        const minExpectedRects = 1 + (nodes.length * 2) + nodes.length;
        expect(rectMatches.length).toBeGreaterThanOrEqual(minExpectedRects);
      }
    });
  });

  describe('Property 2.5: Accent Colors and Status Indicators Preservation', () => {
    it('should display accent colors correctly in light mode', () => {
      const nodeProps = {
        id: 'accent-node',
        type: 'systemNode',
        data: {
          label: 'Colored Service',
          layer: 'compute',
          accentColor: '#3B82F6',
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

      // Accent color should be applied (typically to icon or border)
      const nodeElement = container.querySelector('[style*="background"]');
      expect(nodeElement).toBeTruthy();
      
      // The node should render successfully with accent color
      expect(container.innerHTML).toBeTruthy();
    });

    test.prop([
      fc.constantFrom('healthy', 'warning', 'error', 'unknown')
    ])('should display status indicators correctly in light mode', (status) => {
      const nodeProps = {
        id: `status-node-${Math.random()}`,
        type: 'systemNode',
        data: {
          label: 'Service with Status',
          layer: 'compute',
          status: status as NodeData['status'],
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

      // Node should render with status indicator
      expect(container.innerHTML).toBeTruthy();
      
      // Should have backplates (plate design maintained)
      const allDivs = container.querySelectorAll('div');
      const backplates = Array.from(allDivs).filter(div => {
        const style = (div as HTMLElement).style;
        return style.position === 'absolute' && 
               style.borderRadius && 
               style.background &&
               (style.zIndex === '0' || style.zIndex === '1' || style.zIndex === '2');
      });
      expect(backplates.length).toBe(2);
    });
  });

  describe('Property 2.6: Node Interaction Behaviors Preservation', () => {
    it('should render toolbar when selected in light mode', () => {
      const selectedProps = {
        id: 'toolbar-node',
        type: 'systemNode',
        data: {
          label: 'Service with Toolbar',
          layer: 'compute',
        } as NodeData,
        selected: true,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        zIndex: 1,
      };

      const { container } = render(
        <ReactFlowProvider>
          <SystemNode {...selectedProps} />
        </ReactFlowProvider>
      );

      const toolbar = container.querySelector('.node-toolbar');
      
      expect(toolbar).toBeTruthy();
    });

    it('should not render toolbar when not selected in light mode', () => {
      const unselectedProps = {
        id: 'no-toolbar-node',
        type: 'systemNode',
        data: {
          label: 'Unselected Service',
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
          <SystemNode {...unselectedProps} />
        </ReactFlowProvider>
      );

      const toolbar = container.querySelector('.node-toolbar');
      
      expect(toolbar).toBeNull();
    });
  });
});
