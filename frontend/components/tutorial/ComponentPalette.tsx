'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { CORE_COMPONENTS as components } from '@/lib/component-library/componentRegistry';

type Component = {
  id: string;
  label: string;
  category: string;
  color: string;
  icon?: string;
  technology?: string;
};

type Props = {
  onAddComponent: (component: Component) => void;
  forceOpen?: boolean;
  initialQuery?: string;
  onClose?: () => void;
};

export function ComponentPalette({ onAddComponent, forceOpen, initialQuery, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allComponents = components as Component[];

  const filtered =
    query.trim() === ''
      ? allComponents.slice(0, 12)
      : allComponents
          .filter(
            (c) =>
              c.label.toLowerCase().includes(query.toLowerCase()) ||
              c.category.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 12);

  useEffect(() => {
    if (forceOpen) {
      setTimeout(() => {
        setQuery(initialQuery ?? '');
        setSelectedIndex(0);
        setOpen(true);
      }, 0);
    }
  }, [forceOpen, initialQuery]);

  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
          setQuery('');
          setSelectedIndex(0);
          return true;
        });
      }
      if (e.key === 'Escape') {
        setOpen(false);
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [onClose]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = useCallback(
    (component: Component) => {
      onAddComponent(component);
      setOpen(false);
      setQuery('');
      onClose?.();
    },
    [onAddComponent, onClose]
  );

  const handleKeyDownLocal = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex]); }
  };

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleClose = () => { setOpen(false); onClose?.(); };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={handleClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4">
        <div
          className="bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDownLocal}
              placeholder="Search components..."
              className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')}>
                <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            )}
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 text-[10px] font-mono border border-white/10 flex-shrink-0">ESC</kbd>
          </div>

          <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '320px' }}>
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-slate-500 text-sm">No components found for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <>
                {!query && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider font-medium">Popular components</span>
                  </div>
                )}
                {filtered.map((component, i) => {
                  const isSelected = i === selectedIndex;
                  return (
                    <button
                      key={component.id}
                      onClick={() => handleSelect(component)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isSelected ? 'bg-gray-500/20' : 'hover:bg-white/[0.04]'}`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: component.color + '18', color: component.color }}
                      >
                        {component.label.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{component.label}</p>
                        <p className="text-[11px] text-slate-500 truncate">{component.category}</p>
                      </div>
                      {isSelected && (
                        <kbd className="px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 text-[10px] font-mono border border-gray-500/30 flex-shrink-0">
                          &#8629;
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-slate-500 text-[10px] font-mono border border-white/10">&#8593;</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-slate-500 text-[10px] font-mono border border-white/10">&#8595;</kbd>
              <span className="text-[10px] text-slate-600">navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 text-[10px] font-mono border border-white/10">&#8629;</kbd>
              <span className="text-[10px] text-slate-600">add to canvas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 text-[10px] font-mono border border-white/10">esc</kbd>
              <span className="text-[10px] text-slate-600">close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
