'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, Send, Loader2, Code, RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePromptHistory } from '@/store/promptHistory';

interface FloatingAIBarProps {
  onGenerate: (description: string, detailLevel: 1 | 2 | 3) => Promise<void>;
  onToggleCode: () => void;
  showCode: boolean;
  hideCodeButton?: boolean;
  isCanvasEmpty?: boolean;
  onRegenerate?: (detailLevel: 1 | 2 | 3) => Promise<void>;
  hasLastPrompt?: boolean;
}

export function FloatingAIBar({ 
  onGenerate, 
  onToggleCode, 
  showCode, 
  hideCodeButton, 
  isCanvasEmpty = false,
  onRegenerate,
  hasLastPrompt = false
}: FloatingAIBarProps) {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<1 | 2 | 3>(2);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addToHistory } = usePromptHistory();
  
  // Auto-grow textarea height calculation for thin input (minimum 21px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 21), 120)}px`;
    }
  }, [input]);

  // Check if it is the first time using the canvas
  useEffect(() => {
    try {
      const hasUsed = localStorage.getItem('archdraw-has-used-canvas') === 'true';
      if (!hasUsed) {
        setIsFirstTime(true);
      }
    } catch {}
  }, []);

  // Global keyboard shortcut: Shift+? to focus prompt input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?') {
        const active = document.activeElement;
        const isInput = active && (
          active.tagName === 'INPUT' || 
          active.tagName === 'TEXTAREA' || 
          active.getAttribute('contenteditable') === 'true'
        );
        if (!isInput) {
          e.preventDefault();
          textareaRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) {
      toast.error('Please describe your architecture');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const sizeLabel = detailLevel === 1 ? 'small' : detailLevel === 2 ? 'medium' : 'large';

    try {
      await onGenerate(input, detailLevel);
      addToHistory(input, sizeLabel);
      setInput('');
      localStorage.setItem('archdraw-has-used-canvas', 'true');
      setIsFirstTime(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [input, onGenerate, detailLevel, addToHistory]);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setIsGenerating(true);
    setError(null);
    try {
      await onRegenerate(detailLevel);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [onRegenerate, detailLevel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      setInput('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed bottom-3 sm:bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-2 sm:px-4 safe-area-bottom flex items-center gap-2"
    >
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key="input"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className={`flex items-center gap-1.5 w-full rounded-[20px] border bg-card shadow-soft-3 p-1.5 pr-1.5 transition-all duration-200 ${
            isFirstTime && isCanvasEmpty 
              ? 'shiny-input-glow border-[#5e6ad2]/70 focus-within:border-primary/50' 
              : 'border-border/40 focus-within:border-primary/50'
          }`}
        >
          {/* Left Actions */}
          <div className="flex items-center gap-1 shrink-0 pl-0.5">
            {/* Detail Level Toggle */}
            <div className="flex items-center gap-0.5 bg-muted/20 rounded-full p-0.5 border border-border/10">
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDetailLevel(level);
                  }}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
                    detailLevel === level
                      ? 'bg-primary/20 text-primary shadow-sm'
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
                  }`}
                  title={level === 1 ? 'Simple — only core components' : level === 2 ? 'Moderate — balanced detail' : 'Detailed — full architecture depth'}
                  aria-pressed={detailLevel === level}
                >
                  L{level}
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-4 bg-border/20 shrink-0" />

          {/* Input Text Area */}
          <div className="flex-1 min-w-0 flex items-center">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Describe your architecture, or paste a GitHub repo link…"
              className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent resize-none text-xs text-foreground placeholder:text-muted-foreground/60 py-0.5 px-1.5 max-h-32 shadow-none focus:shadow-none focus-visible:!outline-none focus:!outline-none"
              disabled={isGenerating}
              style={{ height: 'auto', minHeight: '21px' }}
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* View Code Button */}
            {!hideCodeButton && (
              <button
                type="button"
                onClick={onToggleCode}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border border-transparent transition-all text-[10px] font-semibold cursor-pointer active:scale-95 ${
                  showCode 
                    ? 'bg-primary/10 text-primary border-primary/20' 
                    : 'bg-muted/30 hover:bg-[#1c1e22] dark:hover:bg-[#141516] text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3 h-3" />
                <span className="hidden sm:inline">Code</span>
              </button>
            )}

            {/* Mic Button */}
            <button 
              className="w-6 h-6 rounded-full flex items-center justify-center bg-transparent text-muted-foreground/35 cursor-not-allowed" 
              disabled 
              title="Voice coming soon"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={!input.trim() || isGenerating}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-[#5e6ad2] text-white hover:bg-[#828fff] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>

      {hasLastPrompt && onRegenerate && (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-[20px] border border-border/40 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 shadow-soft-3 flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Regenerate diagram"
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCw className="w-4 h-4" />
          )}
        </button>
      )}
    </motion.div>
  );
}
