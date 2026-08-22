'use client';

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { category: 'Selection', items: [
    { key: 'Click',          action: 'Select node' },
    { key: '⇧ + Click',     action: 'Add to selection' },
    { key: '⌘ A',            action: 'Select all' },
    { key: 'Esc',            action: 'Deselect all' },
  ]},
  { category: 'Clipboard', items: [
    { key: '⌘ C',            action: 'Copy' },
    { key: '⌘ V',            action: 'Paste' },
    { key: '⌘ X',            action: 'Cut' },
    { key: '⌘ D',            action: 'Duplicate' },
  ]},
  { category: 'Movement', items: [
    { key: 'Arrow keys',     action: 'Move node 1px' },
    { key: '⇧ + Arrows',    action: 'Move node 10px' },
  ]},
  { category: 'Canvas', items: [
    { key: 'Space + Drag',   action: 'Pan canvas' },
    { key: 'Scroll',         action: 'Zoom in / out' },
    { key: '⌘ + / -',       action: 'Zoom in / out' },
    { key: '⌘ 0',           action: 'Reset zoom' },
    { key: 'f',              action: 'Fit to screen' },
    { key: 'Middle click',   action: 'Pan canvas' },
  ]},
  { category: 'Edit', items: [
    { key: 'Delete / ⌫',    action: 'Delete selected' },
    { key: '⌘ Z',           action: 'Undo' },
    { key: '⌘ ⇧ Z',        action: 'Redo' },
    { key: '⌘ K',           action: 'Command palette' },
    { key: '?',             action: 'Show shortcuts' },
  ]},
  { category: 'Nodes', items: [
    { key: 'Drag node',      action: 'Move node' },
    { key: 'Drag port',     action: 'Create connection' },
    { key: 'Right-click',   action: 'Context menu' },
    { key: 'T',             action: 'Add text label' },
    { key: 'N',             action: 'Add rectangle (draft)' },
    { key: 'D',             action: 'Add diamond' },
    { key: 'C',             action: 'Add circle' },
    { key: 'Y',             action: 'Add cylinder' },
    { key: 'Double-click canvas', action: 'Add rectangle draft' },
  ]},
  { category: 'Groups', items: [
    { key: '⇧ + Drag',     action: 'Create group rectangle' },
    { key: '⌘ G',         action: 'Group selected nodes' },
    { key: '⌘ ⇧ G',      action: 'Ungroup selected' },
  ]},
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') onOpenChange(false); 
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[75vh] overflow-hidden flex flex-col gap-0">
        <DialogHeader className="flex flex-row items-center gap-2 shrink-0 px-6 pt-4 pb-2">
          <div className="w-8 h-8 rounded-xl bg-brand/60 flex items-center justify-center">
            <Keyboard className="w-4 h-4 text-foreground/70" />
          </div>
          <DialogTitle className="text-sm font-semibold">Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            A reference of all available keyboard shortcuts for the canvas editor.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {SHORTCUTS.map((section) => (
              <div key={section.category}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {section.category}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ key, action }) => (
                    <div 
                      key={key} 
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-xs text-foreground/80">{action}</span>
                      <kbd className="text-[10px] font-mono font-medium text-foreground/70 bg-brand/60 rounded-lg px-2 py-1 ml-2 shrink-0">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-3 shrink-0 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground/60 text-center">Press ? to toggle this panel</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
