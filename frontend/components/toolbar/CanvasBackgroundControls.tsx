'use client';

import { useEffect, useRef, useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { Button } from '@/components/ui/button';
import { useCanvasTheme } from '@/lib/theme';

const BG_OPTIONS: Array<{ label: string; value: string | null; swatch: string | null; border: string }> = [
  { label: 'Default (theme)', value: null, swatch: null, border: 'border-border' },
  { label: 'White', value: '#ffffff', swatch: '#ffffff', border: 'border-zinc-200' },
  { label: 'Slate', value: '#f8fafc', swatch: '#f8fafc', border: 'border-zinc-200' },
  { label: 'Dark', value: '#0f172a', swatch: '#0f172a', border: 'border-zinc-700' },
];

export function CanvasBackgroundControls() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const canvasBackground = useDiagramStore((s) => s.canvasBackground);
  const setCanvasBackground = useDiagramStore((s) => s.setCanvasBackground);
  const showGrid = useDiagramStore((s) => s.showGrid);
  const toggleGrid = useDiagramStore((s) => s.toggleGrid);
  const { isDark } = useCanvasTheme();

  // Effective colors for preview when value is null (theme-driven)
  const effectiveBg = canvasBackground.bgColor ?? (isDark ? '#0f172a' : '#ffffff');
  const isDefaultBg = canvasBackground.bgColor === null;

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

  const handleBgSelect = (value: string | null) => {
    setCanvasBackground({ bgColor: value });
  };

  const handleVariantToggle = (enabled: boolean) => {
    if (enabled !== showGrid) toggleGrid();
    if (enabled && canvasBackground.variant === 'plain') {
      setCanvasBackground({ variant: 'dots' });
    }
  };

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
          className="absolute right-0 top-full mt-3 w-[280px] rounded-2xl z-30 bg-popover border border-border text-popover-foreground p-4"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.16)' }}
          role="dialog"
          aria-label="Canvas background"
        >
          <h4 className="text-[13px] font-semibold mb-3">Background</h4>

          {/* Canvas color — core user need */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Canvas color</p>
            <div className="flex gap-2">
              {BG_OPTIONS.map((opt) => {
                const active = canvasBackground.bgColor === opt.value;
                return (
                  <button
                    key={opt.label}
                    onClick={() => handleBgSelect(opt.value)}
                    aria-label={opt.label}
                    title={opt.label}
                    className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                      active ? 'border-primary scale-[1.06] ring-2 ring-primary/20' : `${opt.border} hover:scale-[1.03]`
                    }`}
                    style={{
                      backgroundColor: opt.swatch ?? undefined,
                      backgroundImage:
                        opt.value === null
                          ? isDark
                            ? 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)'
                            : 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)'
                          : undefined,
                      backgroundSize: opt.value === null ? '8px 8px' : undefined,
                      backgroundPosition: opt.value === null ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                    }}
                  >
                    {active && (
                      <Check
                        className={`w-3.5 h-3.5 ${opt.value === '#ffffff' || opt.value === '#f8fafc' ? 'text-zinc-900' : opt.value === null ? (isDark ? 'text-white' : 'text-zinc-900') : 'text-white'}`}
                      />
                    )}
                  </button>
                );
              })}
              <label
                className="w-9 h-9 rounded-full border-2 border-border bg-muted flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative"
                title="Custom color"
                aria-label="Custom color"
              >
                <input
                  type="color"
                  value={effectiveBg}
                  onChange={(e) => setCanvasBackground({ bgColor: e.target.value })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Pick custom background"
                />
                <span className="pointer-events-none text-[9px] font-medium text-muted-foreground">＋</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {isDefaultBg ? 'Using theme default' : effectiveBg}
            </p>
          </div>

          {/* Grid — single thoughtful toggle + one density control */}
          <div className="mb-1">
            <label className="flex items-center justify-between py-2 cursor-pointer group">
              <span className="text-xs font-medium">Grid dots</span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={showGrid && canvasBackground.variant !== 'plain'}
                  onChange={(e) => handleVariantToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="w-9 h-5 bg-muted border border-border rounded-full peer-checked:bg-primary peer-checked:border-primary transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
              </span>
            </label>

            {showGrid && canvasBackground.variant !== 'plain' && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Density</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{canvasBackground.gap}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={32}
                  step={2}
                  value={canvasBackground.gap}
                  onChange={(e) => setCanvasBackground({ gap: Number(e.target.value) })}
                  className="w-full accent-primary h-1"
                  aria-label="Grid gap"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                  <span>Dense</span>
                  <span>Sparse</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCanvasBackground({ bgColor: null, patternColor: null, gap: 20, size: 1, variant: 'dots' });
                if (!showGrid) toggleGrid();
              }}
              className="h-7 text-xs"
            >
              Reset to default
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
