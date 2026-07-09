import type { Node, Edge } from 'reactflow';

export const COLLISION_MARGIN = 40;
export const NODE_DEFAULT_WIDTH = 160;
export const NODE_DEFAULT_HEIGHT = 110;
export const EDGE_HITBOX = 8;

export interface CollisionRect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export function getNodeExtent(node: Node, margin: number = COLLISION_MARGIN): CollisionRect {
    const w = node.width ?? NODE_DEFAULT_WIDTH;
    const h = node.height ?? NODE_DEFAULT_HEIGHT;
    return {
        x1: node.position.x - margin,
        y1: node.position.y - margin,
        x2: node.position.x + w + margin,
        y2: node.position.y + h + margin,
    };
}

export function hasNodeOverlap(a: Node, b: Node, margin: number = COLLISION_MARGIN): boolean {
    const extA = getNodeExtent(a, margin);
    const extB = getNodeExtent(b, margin);
    const overlapX = Math.min(extA.x2, extB.x2) - Math.max(extA.x1, extB.x1);
    const overlapY = Math.min(extA.y2, extB.y2) - Math.max(extA.y1, extB.y1);
    return overlapX > 0 && overlapY > 0;
}

export function getOverlapAmount(a: Node, b: Node, margin: number = COLLISION_MARGIN): { x: number; y: number } | null {
    const extA = getNodeExtent(a, margin);
    const extB = getNodeExtent(b, margin);
    const overlapX = Math.min(extA.x2, extB.x2) - Math.max(extA.x1, extB.x1);
    const overlapY = Math.min(extA.y2, extB.y2) - Math.max(extA.y1, extB.y1);
    if (overlapX > 0 && overlapY > 0) {
        return { x: overlapX, y: overlapY };
    }
    return null;
}

export function getEdgeBounds(edge: Edge, nodes: Node[]): CollisionRect | null {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;
    
    const sx = sourceNode.position.x + (sourceNode.width ?? NODE_DEFAULT_WIDTH) / 2;
    const sy = sourceNode.position.y + (sourceNode.height ?? NODE_DEFAULT_HEIGHT) / 2;
    const tx = targetNode.position.x + (targetNode.width ?? NODE_DEFAULT_WIDTH) / 2;
    const ty = targetNode.position.y + (targetNode.height ?? NODE_DEFAULT_HEIGHT) / 2;
    
    return {
        x1: Math.min(sx, tx) - EDGE_HITBOX,
        y1: Math.min(sy, ty) - EDGE_HITBOX,
        x2: Math.max(sx, tx) + EDGE_HITBOX,
        y2: Math.max(sy, ty) + EDGE_HITBOX,
    };
}

export function isEdgeOverlappingNode(edge: Edge, node: Node, allNodes: Node[]): boolean {
    const bounds = getEdgeBounds(edge, allNodes);
    if (!bounds) return false;
    
    const ext = getNodeExtent(node);
    const overlapX = Math.min(bounds.x2, ext.x2) - Math.max(bounds.x1, ext.x1);
    const overlapY = Math.min(bounds.y2, ext.y2) - Math.max(bounds.y1, ext.y1);
    return overlapX > 0 && overlapY > 0;
}

function getNodeParentId(node: Node): string | undefined {
    return (node as Node & { parentNode?: string }).parentNode ?? node.parentId;
}

export function resolveNodeCollisions(nodes: Node[], margin: number = COLLISION_MARGIN): Node[] {
    if (!nodes || !Array.isArray(nodes)) return [];
    const result = nodes.map(n => ({ ...n, position: { ...n.position } }));
    
    for (let iter = 0; iter < 50; iter++) {
        let moved = false;
        
        for (let i = 0; i < result.length; i++) {
            for (let j = i + 1; j < result.length; j++) {
                const a = result[i];
                const b = result[j];
                
                // Only resolve collisions within same parent group
                if (getNodeParentId(a) !== getNodeParentId(b)) continue;
                
                const overlap = getOverlapAmount(a, b, margin);
                if (overlap) {
                    if (overlap.x < overlap.y) {
                        const dx = a.position.x < b.position.x ? -margin - 5 : margin + 5;
                        a.position.x += dx;
                        b.position.x -= dx;
                    } else {
                        const dy = a.position.y < b.position.y ? -margin - 5 : margin + 5;
                        a.position.y += dy;
                        b.position.y -= dy;
                    }
                    moved = true;
                }
            }
        }
        
        if (!moved) break;
    }
    
    return result;
}