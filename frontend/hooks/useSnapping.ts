'use client';

import { useCallback, useRef } from 'react';
import { Node, NodeDragHandler } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { computeAlignmentGuides } from '@/lib/utils/alignmentGuides';

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

    const onNodeDrag: NodeDragHandler = useCallback(
        (event, draggedNode, draggedNodes) => {
            if (!draggedNode) return;
            // Alt disables snap/guides
            const e = event as unknown as MouseEvent & KeyboardEvent;
            const altDisabled = e?.altKey;
            if (altDisabled) {
                setGuideLines([]);
                return;
            }

            const allNodes = useDiagramStore.getState().nodes;
            const edges = useDiagramStore.getState().edges;
            // For multi-select, compute guides against nodes not in selection
            const draggedIds = new Set((draggedNodes ?? [draggedNode]).map((n) => n.id));
            const others = allNodes.filter((n) => !draggedIds.has(n.id));

            // If multi-drag, use bounding box center; else single node
            let dragProxy: Node | { position: { x: number; y: number }; width: number; height: number; id: string } = draggedNode;
            if (draggedNodes && draggedNodes.length > 1) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const n of draggedNodes) {
                    const w = n.width ?? (n.data as { nodeWidth?: number })?.nodeWidth ?? 200;
                    const h = n.height ?? (n.data as { nodeHeight?: number })?.nodeHeight ?? 88;
                    const ax = (n as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute?.x ?? n.position.x;
                    const ay = (n as unknown as { positionAbsolute?: { y: number } }).positionAbsolute?.y ?? n.position.y;
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

            // Magnetic snap: apply delta to dragged nodes via store
            if ((snapX !== null && snapX !== 0) || (snapY !== null && snapY !== 0)) {
                const dx = snapX ?? 0;
                const dy = snapY ?? 0;
                if (dx !== 0 || dy !== 0) {
                    const toUpdate = draggedNodes && draggedNodes.length > 1 ? draggedNodes : [draggedNode];
                    // Mutate position for immediate visual feedback and update store
                    // React Flow will still emit onNodesChange, but we preemptively snap
                    const currentNodes = useDiagramStore.getState().nodes;
                    const snapped = currentNodes.map((n) => {
                        if (!draggedIds.has(n.id)) return n;
                        // For bbox mode, apply same delta to each
                        const abs = (n as unknown as { positionAbsolute?: { x: number; y: number } }).positionAbsolute;
                        if (abs) {
                            // Convert absolute snap to relative (if inside group, position is relative)
                            // Simplest: snap in absolute then convert back via parent offset
                            // For now apply dx/dy directly to position (works for top-level; nested groups rare during drag)
                        }
                        return {
                            ...n,
                            position: { x: n.position.x + dx, y: n.position.y + dy },
                        };
                    });
                    // Use setNodes to avoid history push on every drag frame
                    useDiagramStore.getState().setNodes(snapped);
                    // Also mutate the event node for RF internal state (prevents jitter)
                    draggedNode.position.x += dx;
                    draggedNode.position.y += dy;
                    if (draggedNodes) {
                        for (const dn of draggedNodes) {
                            dn.position.x += dx;
                            dn.position.y += dy;
                        }
                    }
                }
            }
        },
        [setGuideLines]
    );

    const onNodeDragStop: NodeDragHandler = useCallback(() => {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setGuideLines([]), 400);
    }, [setGuideLines]);

    return { onNodeDrag, onNodeDragStop };
}
