'use client';

import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { Button } from '@/components/ui/button';
import type { CanvasBackgroundVariant } from '@/store/diagram/types';

const PATTERNS: Array<{ id: CanvasBackgroundVariant; label: string; preview: string }> = [
  { id: 'dots', label: 'Dots', preview: 'radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)' },
  { id: 'lines', label: 'Lines', preview: 'repeating-linear-gradient(0deg, transparent 0 18px, #e2e8f0 18px 19px)' },
  { id: 'cross', label: 'Cross', preview: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)' },
  { id: 'plain', label: 'Plain', preview: 'none' },
];

export function CanvasBackgroundControls() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const canvasBackground = useDiagramStore((s) => s.canvasBackground);
  const setCanvasBackground = useDiagramStore((s) => s.setCanvasBackground);
  const showGrid = useDiagramStore((s) => s.showGrid);
  const toggleGrid = useDiagramStore((s) => s.toggleGrid);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="!w-8 sm:!w-9 !h-8 sm:!h-9"
        aria-label="Canvas background"
        aria-expanded={open}
        title="Background"
      >
        <Palette className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-3 w-[260px] rounded-2xl z-30 bg-popover border border-border text-popover-foreground p-4"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.16)' }}
          role="dialog"
          aria-label="Background pattern"
        >
          <h4 className="text-[13px] font-semibold mb-3">Background pattern</h4>
          <div className="grid grid-cols-2 gap-2">
            {PATTERNS.map((p) => {
              const active = canvasBackground.variant === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setCanvasBackground({ variant: p.id });
                    // Ensure grid visibility matches variant: plain → hidden, others → visible
                    if (p.id === 'plain' && showGrid) toggleGrid();
                    if (p.id !== 'plain' && !showGrid) toggleGrid();
                  }}
                  className={`relative h-[72px] rounded-xl border-2 overflow-hidden flex flex-col items-center justify-end pb-2 transition-all ${
                    active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                  }`}
                  aria-label={p.label}
                  title={p.label}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: '#ffffff',
                      backgroundImage: p.preview === 'none' ? 'none' : p.preview,
                      backgroundSize: p.id === 'dots' ? '16px 16px' : p.id === 'lines' ? '100% 20px' : '20px 20px',
                      backgroundPosition: 'center',
                    }}
                  />
                  <span
                    className={`relative text-xs font-medium px-2 py-1 rounded-full ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-white/90 text-foreground border border-border'
                    }`}
                  >
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Pattern follows theme (light/dark) automatically.</p>
        </div>
      )}
    </div>
  );
}
