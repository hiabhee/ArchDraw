'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Node, type NodeDragHandler, type NodeChange } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { computeAlignmentGuides } from '@/lib/diagram/geometry/alignmentGuides';
import { nodeSize, nodeTopLeft } from '@/lib/diagram/geometry/nodeBox';

const ALIGN_THRESHOLD = 8;

/**
 * Alignment helper lines + magnetic snap.
 * - Shows guides when dragged edge/center aligns with others (within threshold)
 * - Snaps position magnetically; hold Alt to disable snap
 * - Supports multi-select via draggedNodes bounding box
 * - Uses actual node dimensions (width/height) not fixed grid
 * - Grid snap remains handled by ReactFlow snapToGrid
 */
export function useSnapping() {
    const setGuideLines = useDiagramStore((s) => s.setGuideLines);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const altDown = useRef(false);
    useEffect(() => {
        const update = (event: KeyboardEvent) => { altDown.current = event.altKey; };
        const reset = () => { altDown.current = false; };
        window.addEventListener('keydown', update);
        window.addEventListener('keyup', update);
        window.addEventListener('blur', reset);
        return () => {
            window.removeEventListener('keydown', update);
            window.removeEventListener('keyup', update);
            window.removeEventListener('blur', reset);
            if (clearTimer.current) clearTimeout(clearTimer.current);
        };
    }, []);

    // Transform React Flow's position changes before committing them. There is
    // one graph write per frame, and event nodes are never mutated.
    const onNodesChange = useCallback((incoming: NodeChange[]) => {
            const store = useDiagramStore.getState();
            // React Flow's release can carry its unsnapped drag coordinates.
            // Keep the displayed position rather than jumping back on mouseup.
            const changes = incoming.map((change) => {
                if (change.type !== 'position' || change.dragging !== false) return change;
                const node = store.nodes.find((n) => n.id === change.id);
                if (!node?.dragging) return change;
                return { ...change, position: node.position, positionAbsolute: node.positionAbsolute };
            });
            const positions = new Map(changes.flatMap((change) =>
                change.type === 'position' && change.dragging && change.position ? [[change.id, change] as const] : []));
            if (!positions.size || altDown.current) {
                if (altDown.current) setGuideLines([]);
                store.onNodesChange(changes);
                return;
            }
            if (clearTimer.current) clearTimeout(clearTimer.current);
            const allNodes = store.nodes;
            const edges = store.edges;
            const draggedIds = new Set(positions.keys());
            // Resolve absolute coordinates from the pending relative positions,
            // including nested parents. Persisted nodes may lack positionAbsolute.
            const byId = new Map(allNodes.map((n) => [n.id, n]));
            const absolute = (node: Node, visited = new Set<string>()): { x: number; y: number } => {
                const position = positions.get(node.id)?.position ?? node.position;
                if (visited.has(node.id)) return position;
                visited.add(node.id);
                const parentId = node.parentNode ?? (node as Node & { parentId?: string }).parentId;
                const parent = parentId ? byId.get(parentId) : undefined;
                if (!parent) return position;
                const at = absolute(parent, visited);
                return { x: at.x + position.x, y: at.y + position.y };
            };
            const measured = allNodes.map((n) => ({ ...n, positionAbsolute: absolute(n) }));
            // Descendants already move with a dragged parent, so cannot guide it.
            const movesWithSelection = (node: Node): boolean => {
                const seen = new Set<string>();
                let current: Node | undefined = node;
                while (current && !seen.has(current.id)) {
                    if (draggedIds.has(current.id)) return true;
                    seen.add(current.id);
                    const parentId: string | undefined = current.parentNode ?? (current as Node & { parentId?: string }).parentId;
                    current = parentId ? byId.get(parentId) : undefined;
                }
                return false;
            };
            const others = measured.filter((n) => !movesWithSelection(n));
            const draggedNodes = measured.filter((n) => draggedIds.has(n.id));
            const draggedNode = draggedNodes[0];
            if (!draggedNode) { store.onNodesChange(changes); return; }

            // If multi-drag, use bounding box center; else single node
            let dragProxy: Node | { position: { x: number; y: number }; width: number; height: number; id: string } = draggedNode;
            if (draggedNodes && draggedNodes.length > 1) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const n of draggedNodes) {
                    const { width: w, height: h } = nodeSize(n);
                    const { x: ax, y: ay } = nodeTopLeft(n);
                    minX = Math.min(minX, ax);
                    minY = Math.min(minY, ay);
                    maxX = Math.max(maxX, ax + w);
                    maxY = Math.max(maxY, ay + h);
                }
                dragProxy = {
                    id: '__bbox__',
                    position: { x: minX, y: minY },
                    width: maxX - minX,
                    height: maxY - minY,
                } as unknown as Node;
                // Store bbox for snap calc; actual snap delta applied to each dragged node
                (dragProxy as unknown as { positionAbsolute: { x: number; y: number } }).positionAbsolute = { x: minX, y: minY };
            }

            const { guides, snapX, snapY } = computeAlignmentGuides(
                dragProxy as Node,
                others,
                ALIGN_THRESHOLD,
                edges,
                draggedIds
            );

            setGuideLines(guides);

            const dx = snapX ?? 0, dy = snapY ?? 0;
            store.onNodesChange(changes.map((change) => {
                if (change.type !== 'position' || !change.position || !positions.has(change.id)) return change;
                return {
                    ...change,
                    position: { x: change.position.x + dx, y: change.position.y + dy },
                    ...(change.positionAbsolute ? { positionAbsolute: {
                        x: change.positionAbsolute.x + dx, y: change.positionAbsolute.y + dy,
                    } } : {}),
                };
            }));
        }, [setGuideLines]);

    const onNodeDragStop: NodeDragHandler = useCallback(() => {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setGuideLines([]), 400);
    }, [setGuideLines]);

    return { onNodesChange, onNodeDragStop };
}
