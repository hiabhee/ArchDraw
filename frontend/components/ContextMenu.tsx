'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { useDiagramStore } from '@/store/diagramStore';
import { getViewportCenter } from '@/lib/utils';
import { 
  Copy, Clipboard, Scissors, Trash2, Group, Type, 
  MessageSquare, CheckSquare, Layers, ZoomIn, ZoomOut,
  Maximize2, ChevronRight, GitBranch
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createNode } from '@/lib/factory';

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
  flowX?: number;
  flowY?: number;
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const {
    nodes, edges, removeNode, deleteEdge: storeDeleteEdge, setSelectedNodeId,
    selectedNodeIds, setSelectedNodeIds, createGroup, ungroupNodes, moveToGroup,
    pushHistory, fitView: storeFitView, updateEdgeData, appendNode,
  } = useDiagramStore();

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') { onClose(); return; }
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  const addAtPosition = useCallback((type: string, data: Record<string, unknown>) => {
    const pos = getViewportCenter();
    pushHistory();
    appendNode(createNode(type, (data.label as string) || 'Unnamed', pos, { type, data }));
    onClose();
  }, [pushHistory, onClose, appendNode]);

  const addTextLabel = useCallback((fontSize: 'small' | 'medium' | 'large' | 'heading') => {
    addAtPosition('textLabelNode', { text: 'Label', fontSize });
  }, [addAtPosition]);

  const duplicateNode = useCallback(() => {
    if (!menu.nodeId) return;
    const node = nodes.find((n) => n.id === menu.nodeId);
    if (!node) return;
    pushHistory();
    
    const { id, position, data, type, ...rest } = node;
    const newPos = { x: position.x + 24, y: position.y + 24 };
    const typeId = (data?.typeId as string) || type || 'systemNode';
    const label = (data?.label as string) || 'Unnamed';
    
    const newNode = createNode(typeId, label, newPos, { 
      type, 
      data, 
      ...rest, 
      selected: false 
    });

    appendNode(newNode);
    onClose();
  }, [menu.nodeId, nodes, pushHistory, onClose, appendNode]);

  const deleteNode = useCallback(() => {
    if (menu.nodeId) { setConfirmDelete(true); }
  }, [menu.nodeId]);

  const handleDeleteConfirm = useCallback(() => {
    if (menu.nodeId) { removeNode(menu.nodeId); onClose(); }
    setConfirmDelete(false);
  }, [menu.nodeId, removeNode, onClose]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  const addToGroup = useCallback(() => {
    if (!menu.nodeId) return;
    const ids = selectedNodeIds.length > 0 ? selectedNodeIds : [menu.nodeId];
    setSelectedNodeIds(ids);
    createGroup();
    onClose();
  }, [menu.nodeId, selectedNodeIds, createGroup, onClose, setSelectedNodeIds]);

  const addNestedGroup = useCallback(() => {
    if (!menu.nodeId) return;
    const node = nodes.find((n) => n.id === menu.nodeId);
    if (!node) return;
    const ids = selectedNodeIds.length > 0 ? selectedNodeIds : [menu.nodeId];
    setSelectedNodeIds(ids);
    createGroup(node.parentId || node.id);
    onClose();
  }, [menu.nodeId, nodes, selectedNodeIds, createGroup, onClose, setSelectedNodeIds]);

  const handleUngroup = useCallback(() => {
    if (!menu.nodeId) return;
    const node = nodes.find((n) => n.id === menu.nodeId);
    if (node?.type === 'groupNode') {
      ungroupNodes(menu.nodeId);
    }
    onClose();
  }, [menu.nodeId, nodes, ungroupNodes, onClose]);

  const removeFromGroup = useCallback(() => {
    if (!menu.nodeId) return;
    moveToGroup(menu.nodeId, null);
    onClose();
  }, [menu.nodeId, moveToGroup, onClose]);

  const deleteEdge = useCallback(() => {
    if (menu.edgeId) { setConfirmDelete(true); }
  }, [menu.edgeId]);

  const handleDeleteEdgeConfirm = useCallback(() => {
    if (menu.edgeId) { storeDeleteEdge(menu.edgeId); onClose(); }
    setConfirmDelete(false);
  }, [menu.edgeId, storeDeleteEdge, onClose]);

  const changeEdgeType = useCallback((connectionType: string) => {
    if (!menu.edgeId) return;
    pushHistory();
    updateEdgeData(menu.edgeId, { connectionType });
    onClose();
  }, [menu.edgeId, pushHistory, updateEdgeData, onClose]);

  const selectAll = useCallback(() => {
    const allIds = nodes.map((n) => n.id);
    setSelectedNodeIds(allIds);
    onClose();
  }, [nodes, onClose, setSelectedNodeIds]);

  const resetZoom = useCallback(() => {
    fitView({ padding: 0.1, duration: 300 });
    onClose();
  }, [fitView, onClose]);

  const zoomIn = useCallback(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (viewport) {
      const transform = viewport.style.transform;
      const match = transform.match(/scale\(([^)]+)\)/);
      const currentZoom = match ? parseFloat(match[1]) : 1;
      const newZoom = Math.min(currentZoom * 1.2, 2);
      viewport.style.transform = viewport.style.transform.replace(
        /scale\([^)]+\)/,
        `scale(${newZoom})`
      );
    }
    onClose();
  }, [onClose]);

  const zoomOut = useCallback(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (viewport) {
      const transform = viewport.style.transform;
      const match = transform.match(/scale\(([^)]+)\)/);
      const currentZoom = match ? parseFloat(match[1]) : 1;
      const newZoom = Math.max(currentZoom / 1.2, 0.1);
      viewport.style.transform = viewport.style.transform.replace(
        /scale\([^)]+\)/,
        `scale(${newZoom})`
      );
    }
    onClose();
  }, [onClose]);

  const isNodeMenu = !!menu.nodeId;
  const isEdgeMenu = !!menu.edgeId;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: menu.y,
        left: menu.x,
        zIndex: 1000,
        minWidth: 200,
      }}
      className="bg-card rounded-2xl shadow-soft-4 overflow-hidden py-2 animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {isEdgeMenu ? (
        <>
          <MenuItemWithSubmenu 
            icon={<GitBranch size={14} />} 
            label="Connection Type"
            submenuOpen={openSubmenu === 'connectionType'} 
            onMouseEnter={() => setOpenSubmenu('connectionType')}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <SubmenuItem onClick={() => changeEdgeType('sync')}>Sync</SubmenuItem>
            <SubmenuItem onClick={() => changeEdgeType('async')}>Async</SubmenuItem>
            <SubmenuItem onClick={() => changeEdgeType('stream')}>Stream</SubmenuItem>
            <SubmenuItem onClick={() => changeEdgeType('event')}>Event</SubmenuItem>
            <SubmenuItem onClick={() => changeEdgeType('dep')}>Dependency</SubmenuItem>
          </MenuItemWithSubmenu>
          <Separator />
          <MenuItem icon={<Scissors size={14} />} onClick={deleteEdge} danger>
            Delete
            <Shortcut>kbd Del</Shortcut>
          </MenuItem>
        </>
      ) : isNodeMenu ? (
        <>
          <MenuItem icon={<Copy size={14} />} onClick={duplicateNode}>
            Duplicate
            <Shortcut>kbd ⌘D</Shortcut>
          </MenuItem>
          <MenuItem icon={<Scissors size={14} />} onClick={deleteNode} danger>
            Delete
            <Shortcut>kbd Del</Shortcut>
          </MenuItem>
          <Separator />
          <MenuItem icon={<Group size={14} />} onClick={addToGroup}>
            Add to Group
          </MenuItem>
          <MenuItem icon={<Group size={14} />} onClick={addNestedGroup}>
            Create Nested Group
          </MenuItem>
          {(() => {
            const node = nodes.find((n) => n.id === menu.nodeId);
            if (node?.type === 'groupNode') {
              return (
                <>
                  <MenuItem icon={<Group size={14} />} onClick={handleUngroup}>
                    Ungroup
                  </MenuItem>
                </>
              );
            }
            if (node?.parentId) {
              return (
                <MenuItem icon={<Group size={14} />} onClick={removeFromGroup}>
                  Remove from Group
                </MenuItem>
              );
            }
            return null;
          })()}
          <Separator />
          <MenuItemWithSubmenu 
            icon={<Type size={14} />} 
            label="Add Text Label"
            submenuOpen={openSubmenu === 'textLabel'} 
            onMouseEnter={() => setOpenSubmenu('textLabel')}
            onMouseLeave={() => setOpenSubmenu(null)}
            onClick={() => addTextLabel('medium')}
          >
            <SubmenuItem onClick={() => addTextLabel('small')}>Small</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('medium')}>Medium</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('large')}>Large</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('heading')}>Heading</SubmenuItem>
          </MenuItemWithSubmenu>
          <MenuItem icon={<MessageSquare size={14} />} onClick={() => addAtPosition('annotationNode', { title: 'Note', body: '' })}>
            Add Note
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItemWithSubmenu 
            icon={<Type size={14} />} 
            label="Add Text Label"
            submenuOpen={openSubmenu === 'textLabel'} 
            onMouseEnter={() => setOpenSubmenu('textLabel')}
            onMouseLeave={() => setOpenSubmenu(null)}
            onClick={() => addTextLabel('medium')}
          >
            <SubmenuItem onClick={() => addTextLabel('small')}>Small</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('medium')}>Medium</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('large')}>Large</SubmenuItem>
            <SubmenuItem onClick={() => addTextLabel('heading')}>Heading</SubmenuItem>
          </MenuItemWithSubmenu>
          <MenuItem icon={<MessageSquare size={14} />} onClick={() => addAtPosition('annotationNode', { title: 'Note', body: '' })}>
            Add Note
          </MenuItem>
          <Separator />
          <MenuItem icon={<ZoomIn size={14} />} onClick={zoomIn}>
            Zoom In
            <Shortcut>kbd ⌘+</Shortcut>
          </MenuItem>
          <MenuItem icon={<ZoomOut size={14} />} onClick={zoomOut}>
            Zoom Out
            <Shortcut>kbd ⌘-</Shortcut>
          </MenuItem>
          <MenuItem icon={<Maximize2 size={14} />} onClick={resetZoom}>
            Fit to Screen
            <Shortcut>kbd ⌘0</Shortcut>
          </MenuItem>
          <Separator />
          <MenuItem icon={<CheckSquare size={14} />} onClick={selectAll}>
            Select All
            <Shortcut>kbd ⌘A</Shortcut>
          </MenuItem>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete node?"
        description="This action cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}

function MenuItem({ 
  children, 
  onClick, 
  danger,
  icon 
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-xl mx-1 hover:bg-accent group ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground'
      }`}
    >
      {icon && <span className="w-4 h-4 opacity-50 group-hover:opacity-80">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}

function Shortcut({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-muted-foreground/50 font-mono ml-2">
      {children}
    </span>
  );
}

function Separator() {
  return <div className="my-1.5 h-px bg-foreground/10 mx-2" />;
}

function MenuItemWithSubmenu({ 
  children, 
  icon, 
  label,
  submenuOpen,
  onMouseEnter,
  onMouseLeave,
  onClick
}: { 
  children: React.ReactNode; 
  icon?: React.ReactNode;
  label: string;
  submenuOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick?: () => void;
}) {
  return (
    <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-xl mx-1 hover:bg-accent group text-foreground"
      >
        {icon && <span className="w-4 h-4 opacity-50 group-hover:opacity-80">{icon}</span>}
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight size={14} className="opacity-50" />
      </button>
      {submenuOpen && (
        <div 
          className="absolute left-full top-0 ml-1 bg-card rounded-xl shadow-soft-4 py-2 min-w-[120px] animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SubmenuItem({ 
  children, 
  onClick 
}: { 
  children: React.ReactNode; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-3 py-2.5 text-sm transition-all rounded-xl mx-1 hover:bg-accent text-foreground"
    >
      {children}
    </button>
  );
}
