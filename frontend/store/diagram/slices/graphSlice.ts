import type { StateCreator } from 'zustand';
import type { Connection, Edge, Node } from 'reactflow';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { toast } from 'sonner';
import { runClarityCompiler } from '@/lib/features/clarityCompiler';
import { getNodeShape } from '@/lib/nodeShapes';
import { getStrictPortConfig } from '@/lib/componentPorts';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import { createNode, createEdge } from '@/lib/factory';
import { calculateNodeDimensions } from '@/lib/utils/nodeSizing';
import { isTextNode } from '@/lib/mermaid/textNodes';
import { ensureDiagramHeading } from '@/lib/mermaid/diagramHeading';
import { placeTextNodes } from '@/lib/mermaid/textPlacement';
import logger from '@/lib/logger';
import type { RFNode } from '@/lib/mermaid/types';
import type { DiagramState, NodeData } from '../types';
import { MAX_GUEST_NODES, MAX_AUTH_NODES } from '../constants';
import { stripReservedLayerNodes, normalizeNodes } from '../helpers/nodeHelpers';
import { normalizeEdges, distributeTargetHandles } from '../helpers/edgeHelpers';

export type GraphSlice = Pick<
  DiagramState,
  | 'onNodesChange'
  | 'onEdgesChange'
  | 'onConnect'
  | 'addNodeOnEdgeDrop'
  | 'addNode'
  | 'removeNode'
  | 'duplicateNode'
  | 'updateNodeData'
  | 'updateNodeSize'
  | 'updateEdgeData'
  | 'importDiagram'
  | 'clearDiagram'
  | 'deleteSelected'
  | 'selectAll'
  | 'createGroup'
  | 'ungroupNodes'
  | 'moveToGroup'
  | 'loadTemplate'
  | 'loadDefaultArchitecture'
  | 'alignConnectedNodes'
  | 'recalculateHandles'
  | 'fixMissingLabels'
>;

export const createGraphSlice: StateCreator<
  DiagramState,
  [['zustand/persist', unknown]],
  [],
  GraphSlice
> = (set, get) => ({
  onNodesChange: (changes) => {
    const structural = changes.filter((c) => c.type === 'add' || c.type === 'remove');
    const isStructural = structural.length > 0;

    if (isStructural) get().pushHistory();

    let nodes = applyNodeChanges(changes, get().nodes);
    if (isStructural) {
      nodes = validateAndFixNodes(nodes);
    }

    const activeId = get().activeCanvasId;
    const canvases = get().canvases.map((c) =>
      c.id === activeId ? { ...c, nodes, ...(isStructural ? { updatedAt: Date.now() } : {}) } : c
    );
    set({ canvases });

    if (isStructural) {
      get().saveCanvasToDB(activeId);
    }
  },

  onEdgesChange: (changes) => {
    const structural = changes.filter((c) => c.type === 'remove');
    const isStructural = structural.length > 0;

    if (isStructural) get().pushHistory();

    const rawEdges = applyEdgeChanges(changes, get().edges);
    const edges = isStructural
      ? distributeTargetHandles(get().nodes, rawEdges, get().activeLayoutPresetId)
      : rawEdges;
    const activeId = get().activeCanvasId;
    const canvases = get().canvases.map((c) =>
      c.id === activeId ? { ...c, edges, ...(isStructural ? { updatedAt: Date.now() } : {}) } : c
    );
    set({ canvases });

    if (isStructural) {
      get().saveCanvasToDB(activeId);
    }
  },

  onConnect: (connection) => {
    get().pushHistory();
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) return;

    const newEdge = createEdge(source, target, '', {
      sourceHandle,
      targetHandle,
    });

    const rawEdges = addEdge(newEdge, get().edges);
    const edges = distributeTargetHandles(get().nodes, rawEdges, get().activeLayoutPresetId);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );

    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  addNodeOnEdgeDrop: ({ originNodeId, originHandleType, position }) => {
    const state = get();
    const isGuest = !state.userProfile || state.userProfile.id === 'guest';
    const nodeLimit = isGuest ? MAX_GUEST_NODES : MAX_AUTH_NODES;
    // Node caps count shape/leaf nodes only — text title/note elements are excluded.
    if (state.nodes.filter((n) => !isTextNode(n)).length >= nodeLimit) {
      toast.error(
        isGuest
          ? `Guest limit: ${nodeLimit} nodes per canvas. Sign in for ${MAX_AUTH_NODES}.`
          : `Canvas limit: ${nodeLimit} nodes.`
      );
      return '';
    }

    get().pushHistory();

    const newNode = {
      ...createNode('service', '', position, {
        type: 'systemNode',
        data: {
          category: 'Compute',
          color: '#3b82f6',
          icon: 'Box',
          shape: getNodeShape('Compute'),
          label: '',
          autoStartLabelEdit: true,
          addedVia: 'edge-drop',
          addedViaAt: Date.now(),
        },
      }),
      selected: true,
    };

    let source: string;
    let target: string;
    if (originHandleType === 'target') {
      source = newNode.id;
      target = originNodeId;
    } else {
      source = originNodeId;
      target = newNode.id;
    }

    const newEdge = createEdge(source, target, '', {
      sourceHandle: undefined,
      targetHandle: undefined,
    });

    const nodes = [...get().nodes.map((n) => ({ ...n, selected: false })), newNode];
    const rawEdges = addEdge(newEdge, get().edges);
    const edges = distributeTargetHandles(nodes, rawEdges, get().activeLayoutPresetId);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, edges, updatedAt: Date.now() } : c
    );
    set({
      canvases,
      selectedNodeId: newNode.id,
      selectedNodeIds: [newNode.id],
    });
    get().saveCanvasToDB(get().activeCanvasId);
    return newNode.id;
  },

  addNode: (type, label, category, color, icon, technology, position) => {
    const state = get();
    const isGuest = !state.userProfile || state.userProfile.id === 'guest';
    const nodeLimit = isGuest ? MAX_GUEST_NODES : MAX_AUTH_NODES;
    // Node caps count shape/leaf nodes only — text title/note elements are excluded.
    if (state.nodes.filter((n) => !isTextNode(n)).length >= nodeLimit) {
      toast.error(
        isGuest
          ? `Guest limit: ${nodeLimit} nodes per canvas. Sign in for ${MAX_AUTH_NODES}.`
          : `Canvas limit: ${nodeLimit} nodes.`
      );
      return;
    }

    get().pushHistory();

    let newNode: Node<NodeData>;

    if (typeof type === 'object' && 'id' in type && 'data' in type) {
      newNode = type as Node<NodeData>;
    } else {
      const pos = position ?? { x: 400 + Math.random() * 200 - 100, y: 300 + Math.random() * 200 - 100 };
      const shape = getNodeShape(category || 'Compute');

      let componentType = type;
      try {
        getStrictPortConfig(type);
      } catch {
        componentType = (category || 'compute').toLowerCase().replace(/[^a-z0-9]/g, '_');
      }

      newNode = createNode(type, label || type, pos, {
        type: 'systemNode',
        data: {
          category: category || 'Compute',
          color,
          icon,
          technology,
          shape,
          componentType,
        },
      }) as Node<NodeData>;
    }

    const nodes = [...get().nodes, newNode];
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  removeNode: (id) => {
    get().pushHistory();
    const nodes = get().nodes;
    const targetNode = nodes.find((n) => n.id === id);

    let updatedNodes = nodes.filter((n) => n.id !== id);

    if (targetNode?.type === 'groupNode' || targetNode?.type === 'group') {
      const groupPosition = targetNode.position;
      updatedNodes = updatedNodes.map((n) => {
        if (n.parentId === id || (n as Record<string, unknown>).parentNode === id) {
          return {
            ...n,
            position: {
              x: n.position.x + groupPosition.x,
              y: n.position.y + groupPosition.y,
            },
            parentId: undefined,
            parentNode: undefined,
            extent: undefined,
          };
        }
        return n;
      });
    }

    const validatedNodes = validateAndFixNodes(updatedNodes);

    const rawEdges = get().edges.filter((e) => e.source !== id && e.target !== id);
    const edges = distributeTargetHandles(validatedNodes, rawEdges, get().activeLayoutPresetId);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes: validatedNodes, edges, updatedAt: Date.now() } : c
    );
    set({ canvases, selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  /**
   * Single duplicate-node path shared by every UI entry point (node toolbar,
   * properties panel, context menu) so copies are always identical.
   *
   * Transient React Flow / UI-only fields are dropped; structural metadata
   * (shape, typeId, serviceType, size, group membership) is preserved.
   */
  duplicateNode: (nodeId, options) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return undefined;

    const offset = options?.offset ?? { x: 30, y: 30 };
    const labelSuffix = options?.labelSuffix ?? '';

    get().pushHistory();

    const TRANSIENT_FIELDS = new Set([
      'selected',
      'dragging',
      'resizing',
      'measured',
      'internals',
      'dragHandle',
      'positionAbsolute',
    ]);

    const newId = `${nodeId}-copy-${Date.now()}`;
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (!TRANSIENT_FIELDS.has(key)) clone[key] = value;
    }
    const newNode: Node = {
      ...(clone as Node),
      id: newId,
      selected: true,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      data: {
        ...node.data,
        label: `${node.data?.label ?? ''}${labelSuffix}`,
      },
    };

    const nodes = [...get().nodes.map((n) => ({ ...n, selected: false })), newNode];
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
    );
    set({ canvases, selectedNodeId: newId, selectedNodeIds: [newId] });
    get().saveCanvasToDB(get().activeCanvasId);
    return newId;
  },

  updateNodeData: (id, data) => {
    // If shape is being changed, recalculate dimensions
    if (data.shape) {
      const node = get().nodes.find((n) => n.id === id);
      if (node) {
        const label = node.data?.label || '';
        const subtitle = node.data?.subtitle || '';
        const newDimensions = calculateNodeDimensions(label, subtitle, { shape: data.shape });
        
        // Update both data and dimensions
        const nodes = get().nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                data: { ...n.data, ...data },
                style: { ...n.style, width: newDimensions.width, height: newDimensions.height },
                width: newDimensions.width,
                height: newDimensions.height,
              }
            : n
        );
        const canvases = get().canvases.map((c) =>
          c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
        );
        set({ canvases });
        get().saveCanvasToDB(get().activeCanvasId);
        return;
      }
    }
    
    // Normal path for non-shape updates
    const nodes = get().nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...data } } : n
    );
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  updateNodeSize: (id, size) => {
    const nodes = get().nodes.map((n) => {
      if (n.id !== id) return n;
      const style = { ...(n.style || {}) };
      if (size.width !== undefined) style.width = size.width;
      if (size.height !== undefined) style.height = size.height;
      return {
        ...n,
        style,
        ...(size.width !== undefined && { width: size.width }),
        ...(size.height !== undefined && { height: size.height }),
        data: {
          ...n.data,
          ...(size.width !== undefined && { nodeWidth: size.width }),
          ...(size.height !== undefined && { nodeHeight: size.height }),
        },
      };
    });
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  updateEdgeData: (id, data) => {
    const edges = get().edges.map((e) =>
      e.id === id
        ? {
            ...e,
            label: data.label !== undefined ? (data.label as string) : e.label,
            data: { ...e.data, ...data },
          }
        : e
    );
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, edges, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  importDiagram: (nodes, edges) => {
    get().pushHistory();

    const normalizedNodes = normalizeNodes(nodes);
    const cleanedNodes = stripReservedLayerNodes(normalizedNodes);
    const validatedNodes = validateAndFixNodes(cleanedNodes);
    const normalizedEdges = normalizeEdges(edges);

    const { nodes: clarityNodes, edges: clarityEdges, report } = runClarityCompiler(
      validatedNodes,
      normalizedEdges
    );

    if (report.warnings.length > 0) {
      logger.warn('[ClarityCompiler]', report.warnings.join('; '));
    }

    const edgesWithHandles = distributeTargetHandles(clarityNodes, clarityEdges, get().activeLayoutPresetId);

    const activeCanvas = get().canvases.find((c) => c.id === get().activeCanvasId);
    const withHeading = ensureDiagramHeading(clarityNodes, activeCanvas?.name);
    const placedNodes = placeTextNodes(withHeading as RFNode[]) as Node[];

    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId
        ? { ...c, nodes: placedNodes, edges: edgesWithHandles, updatedAt: Date.now() }
        : c
    );
    set({ canvases, clarityReport: report });
    get().saveCanvasToDB(get().activeCanvasId);
    setTimeout(() => get().fitView(), 80);
  },

  clearDiagram: () => {
    get().pushHistory();
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes: [], edges: [], updatedAt: Date.now() } : c
    );
    set({ canvases, selectedNodeId: null });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  deleteSelected: () => {
    const {
      selectedNodeId,
      selectedNodeIds,
      selectedEdgeId,
      deleteEdge,
      pushHistory,
      nodes: currentNodes,
      edges: currentEdges,
      canvases: currentCanvases,
      activeCanvasId,
    } = get();

    if (selectedEdgeId) {
      pushHistory();
      deleteEdge(selectedEdgeId);
      return;
    }

    const idsToDelete = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];

    if (idsToDelete.length === 0) return;

    pushHistory();

    const groupIdsToDelete = idsToDelete.filter((id) => {
      const node = currentNodes.find((n) => n.id === id);
      return node?.type === 'groupNode';
    });

    const childIdsOfGroups = new Set(
      groupIdsToDelete.flatMap((gid) =>
        currentNodes
          .filter((n) => n.parentId === gid || (n as Record<string, unknown>).parentNode === gid)
          .map((n) => n.id)
      )
    );

    const allIdsToDelete = new Set([...idsToDelete, ...Array.from(childIdsOfGroups)]);

    let finalNodes = currentNodes.filter((n) => !allIdsToDelete.has(n.id));
    finalNodes = validateAndFixNodes(finalNodes);

    const rawEdges = currentEdges.filter((e) => {
      if (allIdsToDelete.has(e.source) || allIdsToDelete.has(e.target)) return false;
      return true;
    });
    const newEdges = distributeTargetHandles(finalNodes, rawEdges, get().activeLayoutPresetId);

    const syncedCanvases = currentCanvases.map((c) =>
      c.id === activeCanvasId ? { ...c, nodes: finalNodes, edges: newEdges, updatedAt: Date.now() } : c
    );

    set({ canvases: syncedCanvases, selectedNodeIds: [], selectedNodeId: null });
    get().saveCanvasToDB(activeCanvasId);
  },

  selectAll: () => {
    const { canvases, activeCanvasId } = get();
    const active = canvases.find((c) => c.id === activeCanvasId);
    if (!active) return;
    set({
      canvases: canvases.map((c) =>
        c.id === activeCanvasId
          ? {
              ...c,
              nodes: c.nodes.map((n) => ({ ...n, selected: true })),
              edges: c.edges.map((e) => ({ ...e, selected: true })),
            }
          : c
      ),
      selectedNodeId: null,
      selectedNodeIds: active.nodes.map((n) => n.id),
      selectedEdgeId: null,
    });
  },

  createGroup: (parentId?: string) => {
    const { nodes, selectedNodeIds, selectedNodeId, pushHistory, activeCanvasId, canvases } = get();
    const idsToGroup =
      selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    if (idsToGroup.length < 1) return;
    pushHistory();

    const selected = nodes.filter((n) => idsToGroup.includes(n.id));
    const isNested = !!parentId;

    // Top pad clears the group's caption label (top:16 + ~14px text) plus
    // breathing room so title never crowds node — increased for air.
    const PAD_SIDE = isNested ? 10 : 14;
    const PAD_TOP = isNested ? 48 : 56;
    const PAD_BOT = isNested ? 8 : 10;

    const rawMinX = Math.min(...selected.map((n) => n.position.x));
    const rawMinY = Math.min(...selected.map((n) => n.position.y));
    const rawMaxX = Math.max(...selected.map((n) => n.position.x + (n.width ?? 160)));
    const rawMaxY = Math.max(...selected.map((n) => n.position.y + (n.height ?? 80)));

    let positionOffset = { x: 0, y: 0 };
    if (parentId) {
      const parent = nodes.find((n) => n.id === parentId);
      if (parent) {
        positionOffset = { x: parent.position.x, y: parent.position.y };
      }
    }

    const minX = rawMinX - PAD_SIDE;
    const minY = rawMinY - PAD_TOP;
    const maxX = rawMaxX + PAD_SIDE;
    const maxY = rawMaxY + PAD_BOT;

    const existingGroupCount = nodes.filter((n) => n.type === 'groupNode' || n.data?.isGroup).length;
    const colors = ['#3b82f6', '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#2563eb', '#06b6d4'];
    const groupColor = colors[existingGroupCount % colors.length];

    const groupId = `group-${Date.now()}`;
    const groupNode: Node = {
      id: groupId,
      type: 'groupNode',
      position: {
        x: isNested ? rawMinX - positionOffset.x - PAD_SIDE : minX,
        y: isNested ? rawMinY - positionOffset.y - PAD_TOP : minY,
      },
      style: { width: maxX - minX, height: maxY - minY },
      width: maxX - minX,
      height: maxY - minY,
      data: { label: 'Group', groupLabel: 'Group', groupColor, autoStartLabelEdit: true },
      zIndex: -1,
      draggable: true,
      selectable: true,
      ...(parentId ? { parentId, parentNode: parentId, extent: 'parent' as const } : {}),
    };

    const newNodes = [
      ...nodes.filter((n) => !idsToGroup.includes(n.id)),
      groupNode,
      ...selected.map((n) => ({
        ...n,
        parentId: groupId,
        parentNode: groupId,
        extent: 'parent' as const,
        position: {
          x: isNested
            ? n.position.x - positionOffset.x - (rawMinX - positionOffset.x - PAD_SIDE)
            : n.position.x - minX,
          y: isNested
            ? n.position.y - positionOffset.y - (rawMinY - positionOffset.y - PAD_TOP)
            : n.position.y - minY,
        },
      })),
    ];

    const newCanvases = canvases.map((c) =>
      c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
    );
    set({ canvases: newCanvases, selectedNodeIds: [], selectedNodeId: groupId });
    get().saveCanvasToDB(activeCanvasId);
  },

  ungroupNodes: (groupId: string) => {
    const { nodes, pushHistory, activeCanvasId, canvases } = get();
    const group = nodes.find((n) => n.id === groupId);
    if (!group || group.type !== 'groupNode') return;
    pushHistory();

    const children = nodes.filter(
      (n) => n.parentId === groupId || (n as Record<string, unknown>).parentNode === groupId
    );
    const parentOffset = { x: group.position.x, y: group.position.y };

    const grandParentId =
      group.parentId || ((group as Record<string, unknown>).parentNode as string | undefined);

    let newNodes = nodes
      .filter((n) => n.id !== groupId)
      .map((n) => {
        if (n.parentId === groupId || (n as Record<string, unknown>).parentNode === groupId) {
          if (grandParentId) {
            return {
              ...n,
              parentId: grandParentId,
              parentNode: grandParentId,
              extent: 'parent' as const,
              position: { x: n.position.x + parentOffset.x, y: n.position.y + parentOffset.y },
            };
          }
          return {
            ...n,
            parentId: undefined,
            parentNode: undefined,
            extent: undefined,
            position: { x: n.position.x + parentOffset.x, y: n.position.y + parentOffset.y },
          };
        }
        return n;
      });
    newNodes = validateAndFixNodes(newNodes);

    const newCanvases = canvases.map((c) =>
      c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
    );
    set({ canvases: newCanvases, selectedNodeIds: children.map((c) => c.id) });
    get().saveCanvasToDB(activeCanvasId);
  },

  moveToGroup: (nodeId: string, groupId: string | null) => {
    const { nodes, pushHistory, activeCanvasId, canvases } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    pushHistory();

    const parentId = node.parentId || (node as { parentNode?: string }).parentNode;
    let newPosition = { ...node.position };
    if (groupId) {
      const group = nodes.find((n) => n.id === groupId);
      if (group) {
        newPosition = { x: node.position.x - group.position.x, y: node.position.y - group.position.y };
      }
    } else if (parentId) {
      const parent = nodes.find((n) => n.id === parentId);
      if (parent) {
        newPosition = { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y };
      }
    }

    const newNodes = nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            parentId: groupId ?? undefined,
            parentNode: groupId ?? undefined,
            extent: groupId ? ('parent' as const) : undefined,
            position: newPosition,
          }
        : n
    );

    const newCanvases = canvases.map((c) =>
      c.id === activeCanvasId ? { ...c, nodes: newNodes, updatedAt: Date.now() } : c
    );
    set({ canvases: newCanvases });
    get().saveCanvasToDB(activeCanvasId);
  },

  loadTemplate: (nodes, edges) => {
    get().importDiagram(nodes, edges);
    set({ selectedNodeId: null, selectedEdgeId: null });
  },

  loadDefaultArchitecture: () => {
    const defaultNodes: Node[] = [
      createNode('client-1', 'Web Client', { x: 50, y: 100 }, { type: 'systemNode', data: { icon: '🌐', category: 'Client' } }),
      createNode('client-2', 'Mobile App', { x: 50, y: 250 }, { type: 'systemNode', data: { icon: '📱', category: 'Client' } }),
      createNode('gateway', 'API Gateway', { x: 300, y: 175 }, { type: 'systemNode', data: { icon: '🚪', category: 'Compute' } }),
      createNode('auth', 'Auth Service', { x: 550, y: 50 }, { type: 'systemNode', data: { icon: '🔐', category: 'Compute' } }),
      createNode('core', 'Core API', { x: 550, y: 175 }, { type: 'systemNode', data: { icon: '⚙️', category: 'Compute' } }),
      createNode('billing', 'Billing Service', { x: 550, y: 300 }, { type: 'systemNode', data: { icon: '💳', category: 'Compute' } }),
      createNode('queue', 'Task Queue', { x: 800, y: 175 }, { type: 'systemNode', data: { icon: '📋', category: 'Message' } }),
      createNode('email', 'Email Service', { x: 1050, y: 100 }, { type: 'systemNode', data: { icon: '📧', category: 'Compute' } }),
      createNode('notif', 'Notification Svc', { x: 1050, y: 250 }, { type: 'systemNode', data: { icon: '🔔', category: 'Compute' } }),
      createNode('db', 'PostgreSQL', { x: 1300, y: 175 }, { type: 'systemNode', data: { icon: '🐘', category: 'Database' } }),
      createNode('cache', 'Redis Cache', { x: 1300, y: 300 }, { type: 'systemNode', data: { icon: '⚡', category: 'Cache' } }),
    ] as Node[];

    const defaultEdges: Edge[] = [
      createEdge('client-1', 'gateway', 'HTTPS'),
      createEdge('client-2', 'gateway', 'HTTPS'),
      createEdge('gateway', 'auth', 'auth'),
      createEdge('gateway', 'core', 'API'),
      createEdge('gateway', 'billing', 'API'),
      createEdge('core', 'queue', 'enqueue', { data: { edgeType: 'async' } }),
      createEdge('billing', 'queue', 'enqueue', { data: { edgeType: 'async' } }),
      createEdge('queue', 'email', 'process', { data: { edgeType: 'async' } }),
      createEdge('queue', 'notif', 'notify', { data: { edgeType: 'async' } }),
      createEdge('core', 'db', 'read/write'),
      createEdge('core', 'cache', 'cache'),
      createEdge('billing', 'db', 'read/write'),
    ];

    get().pushHistory();
    const normalizedNodes = normalizeNodes(defaultNodes);
    const normalizedEdges = normalizeEdges(defaultEdges);
    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId
        ? { ...c, nodes: normalizedNodes, edges: normalizedEdges, updatedAt: Date.now() }
        : c
    );
    set({ canvases, selectedNodeId: null, selectedEdgeId: null });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  alignConnectedNodes: () => {
    const { nodes, edges, selectedNodeIds } = get();
    const sel = new Set(selectedNodeIds);
    if (sel.size < 2) return;

    const relevantEdges = edges.filter((e) => sel.has(e.source) && sel.has(e.target));
    if (relevantEdges.length === 0) return;

    get().pushHistory();

    const updated = nodes.map((n) => ({
      ...n,
      position: { ...n.position },
      data: { ...n.data } as NodeData,
    }));

    for (const edge of relevantEdges) {
      const source = updated.find((n) => n.id === edge.source);
      const target = updated.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;

      const sw = source.width ?? (source.data as NodeData)?.nodeWidth ?? 180;
      const sh = source.height ?? 70;
      const tw = target.width ?? (target.data as NodeData)?.nodeWidth ?? 180;
      const th = target.height ?? 70;

      if (Math.abs(dx) > Math.abs(dy)) {
        const srcCenterY = source.position.y + sh / 2;
        target.position.y = srcCenterY - th / 2;
      } else {
        const srcCenterX = source.position.x + sw / 2;
        target.position.x = srcCenterX - tw / 2;
      }
    }

    const canvases = get().canvases.map((c) =>
      c.id === get().activeCanvasId ? { ...c, nodes: updated, updatedAt: Date.now() } : c
    );
    set({ canvases });
    get().saveCanvasToDB(get().activeCanvasId);
  },

  recalculateHandles: (nodesOverride?: Node[]) => {
    const { edges, activeCanvasId, canvases, activeLayoutPresetId } = get();
    const nodes = nodesOverride ?? get().nodes;
    // Skip bundling during handle recalculation: bundling replaces N edges
    // with 1 bundle edge (new ID), which causes React Flow to unmount old
    // edge components and lose track of them (edges "disappear" during drag).
    // Lane-side assignments are still recalculated so handles stay aligned.
    const edgesWithHandles = distributeTargetHandles(nodes, edges, activeLayoutPresetId, { skipBundling: true });

    // Avoid unnecessary store updates when edge data is structurally identical.
    // distributeTargetHandles always creates new objects (spread operators),
    // but the actual handle values may be the same — skip the set() if so.
    const edgesChanged = edgesWithHandles.length !== edges.length ||
      edgesWithHandles.some((e, i) => {
        const old = edges[i];
        return e.id !== old.id ||
          e.sourceHandle !== old.sourceHandle ||
          e.targetHandle !== old.targetHandle;
      });

    if (!edgesChanged) return;

    const nextCanvases = canvases.map((c) =>
      c.id === activeCanvasId ? { ...c, edges: edgesWithHandles, updatedAt: Date.now() } : c
    );
    set({ canvases: nextCanvases });
    get().saveCanvasToDB(activeCanvasId);
  },

  /**
   * Utility to fix nodes with missing labels or iconOnly=true.
   * Ensures all nodes have visible labels.
   */
  fixMissingLabels: () => {
    const { nodes, activeCanvasId, canvases } = get();
    let fixed = false;

    const updatedNodes = nodes.map((node) => {
      const hasNoLabel = !node.data?.label || node.data.label.trim() === '';
      const hasIconOnly = node.data?.iconOnly === true;

      if (hasNoLabel || hasIconOnly) {
        fixed = true;
        return {
          ...node,
          data: {
            ...node.data,
            label: node.data?.label || 'Service',
            iconOnly: false,
          },
        };
      }
      return node;
    });

    if (fixed) {
      const newCanvases = canvases.map((c) =>
        c.id === activeCanvasId ? { ...c, nodes: updatedNodes, updatedAt: Date.now() } : c
      );
      set({ canvases: newCanvases });
      get().saveCanvasToDB(activeCanvasId);
      toast.success('Fixed nodes with missing labels');
    } else {
      toast.info('No nodes need fixing - all labels are visible');
    }
  },
});
