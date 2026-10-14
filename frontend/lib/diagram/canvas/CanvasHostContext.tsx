'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Edge, Node } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import type { DiagramRenderStyleId } from '@/lib/theme/renderStyles';
import type { NodeIconMode } from '@/lib/diagram/nodes/nodeIconVisibility';

/**
 * What a React Flow host (editor, share viewer, embed, tutorial, …) tells the
 * shared node/edge components about itself.
 *
 * Node and edge components are reused by every host, but used to read the
 * graph and view settings from — and write size/waypoint fixes back into —
 * the editor's global `useDiagramStore`. In a viewer that meant rendering
 * against the wrong graph and silently mutating (and saving) the visitor's
 * own canvas whenever node ids collided. Hosts now describe their own graph
 * here; anything left unset falls back to the editor store.
 */
export interface CanvasHost {
  /** Only the editor may write back into `useDiagramStore`. */
  readOnly: boolean;
  nodes?: Node[];
  edges?: Edge[];
  renderStyleId?: DiagramRenderStyleId;
  colorThemeId?: string;
  iconMode?: NodeIconMode;
  direction?: 'LR' | 'TD';
  /** Canvas light/dark for this host (e.g. embed `?theme=`), independent of the app theme. */
  isDark?: boolean;
  /** Cache key for this host's settled geometry plans. */
  planKey?: string;
  /** Show live agent-activity badges in a read-only host (the live watch page). */
  showLiveActivity?: boolean;
}

// Hosts that don't opt in (tutorial, demos) must never write to the editor.
const READ_ONLY_HOST: CanvasHost = { readOnly: true };
export const EDITOR_HOST: CanvasHost = { readOnly: false };

const CanvasHostContext = createContext<CanvasHost>(READ_ONLY_HOST);

export function CanvasHostProvider({ value, children }: { value: CanvasHost; children: ReactNode }) {
  return <CanvasHostContext.Provider value={value}>{children}</CanvasHostContext.Provider>;
}

export function useCanvasHost(): CanvasHost {
  return useContext(CanvasHostContext);
}

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

/** Graph rendered by the current host. */
export function useHostGraph(): { nodes: Node[]; edges: Edge[] } {
  const host = useCanvasHost();
  const storeNodes = useDiagramStore((s) => (host.nodes ? EMPTY_NODES : s.nodes));
  const storeEdges = useDiagramStore((s) => (host.edges ? EMPTY_EDGES : s.edges));
  return { nodes: host.nodes ?? storeNodes, edges: host.edges ?? storeEdges };
}

/** View settings for the current host, falling back to editor preferences. */
export function useCanvasView() {
  const host = useCanvasHost();
  const storeRenderStyle = useDiagramStore((s) => s.diagramRenderStyle);
  const storeColorTheme = useDiagramStore((s) => s.diagramStyleTheme);
  const storeIconMode = useDiagramStore((s) => s.iconMode);
  const storeDirection = useDiagramStore((s): 'LR' | 'TD' => (s.activeLayoutPresetId === 'layered-tb' ? 'TD' : 'LR'));
  const activeCanvasId = useDiagramStore((s) => s.activeCanvasId);
  return useMemo(() => ({
    readOnly: host.readOnly,
    renderStyleId: host.renderStyleId ?? storeRenderStyle,
    colorThemeId: host.colorThemeId ?? storeColorTheme,
    iconMode: host.iconMode ?? storeIconMode,
    direction: host.direction ?? storeDirection,
    planKey: host.planKey ?? activeCanvasId ?? 'active-canvas',
    showLiveActivity: !host.readOnly || host.showLiveActivity === true,
  }), [host, storeRenderStyle, storeColorTheme, storeIconMode, storeDirection, activeCanvasId]);
}
