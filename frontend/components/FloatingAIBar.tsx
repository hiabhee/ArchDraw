'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, Send, Loader2, Code, RotateCw, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { analytics } from '@/lib/analytics';
import { usePromptHistory } from '@/store/promptHistory';

const STARTER_PROMPTS = [
  'E-commerce checkout flow',
  'Real-time chat app',
  'Video streaming platform',
  'URL shortener system',
  'Ride-sharing app',
] as const;

type CodeAction = 'show' | 'hide' | 'hidden';
interface FloatingAIBarProps {
  onGenerate: (description: string, detailLevel: 1 | 2 | 3) => Promise<void>;
  onToggleCode: () => void;
  /** Preferred: enum controls code button (avoids 2 bools with 4 states). */
  codeAction?: CodeAction;
  /** @deprecated use codeAction */
  showCode?: boolean;
  /** @deprecated use codeAction='hidden' */
  hideCodeButton?: boolean;
  isCanvasEmpty?: boolean;
  onRegenerate?: (detailLevel: 1 | 2 | 3) => Promise<void>;
  hasLastPrompt?: boolean;
}

export function FloatingAIBar({ 
  onGenerate, 
  onToggleCode, 
  codeAction,
  showCode, 
  hideCodeButton, 
  isCanvasEmpty = false,
  onRegenerate,
  hasLastPrompt = false
}: FloatingAIBarProps) {
  // Derive enum from deprecated bools when codeAction not provided — incremental migration.
  const derivedCodeAction: CodeAction = codeAction ?? (hideCodeButton ? 'hidden' : showCode ? 'hide' : 'show');
  const showCodeDerived = derivedCodeAction === 'hide';
  const hideCodeButtonDerived = derivedCodeAction === 'hidden';
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<1 | 2 | 3>(2);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addToHistory } = usePromptHistory();
  
  // Auto-grow textarea height calculation for thin input (minimum 24px)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 20), 96)}px`;
    }
  }, [input]);

  // Check if it is the first time using the canvas
  useEffect(() => {
    try {
      const hasUsed = localStorage.getItem('archdraw-has-used-canvas') === 'true';
      if (!hasUsed) {
        setIsFirstTime(true);
      }
    } catch { /* localStorage may throw in private browsing */ }
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
        if (!isInput && !(e as unknown as Record<string, unknown>).__archdrawFitView) {
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
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);

    const sizeLabel = detailLevel === 1 ? 'small' : detailLevel === 2 ? 'medium' : 'large';

    if (typeof window !== 'undefined') {
      analytics.track({
        event_type: 'ai_generation',
        event_name: 'diagram_generation_started',
        page_path: window.location.pathname,
        payload: { 
          detail_level: detailLevel,
          prompt_length: input.length,
          is_first_time: isFirstTime
        }
      });
    }

    try {
      await onGenerate(input, detailLevel);
      addToHistory(input, sizeLabel);
      setInput('');
      localStorage.setItem('archdraw-has-used-canvas', 'true');
      setIsFirstTime(false);
      
      if (typeof window !== 'undefined') {
          analytics.track({
          event_type: 'ai_generation',
          event_name: 'diagram_generation_success',
          page_path: window.location.pathname,
          payload: { detail_level: detailLevel }
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      toast.error(message);
      
      if (typeof window !== 'undefined') {
          analytics.track({
          event_type: 'ai_generation',
          event_name: 'diagram_generation_error',
          page_path: window.location.pathname,
          payload: { 
            detail_level: detailLevel,
            error_message: message
          }
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }, [input, onGenerate, detailLevel, addToHistory, isGenerating, isFirstTime]);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setIsGenerating(true);
    setError(null);
    
    if (typeof window !== 'undefined') {
      analytics.track({
        event_type: 'ai_generation',
        event_name: 'diagram_regeneration_started',
        page_path: window.location.pathname,
        payload: { detail_level: detailLevel }
      });
    }
    
    try {
      await onRegenerate(detailLevel);
      
      if (typeof window !== 'undefined') {
          analytics.track({
          event_type: 'ai_generation',
          event_name: 'diagram_regeneration_success',
          page_path: window.location.pathname,
          payload: { detail_level: detailLevel }
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      setError(message);
      toast.error(message);
      
      if (typeof window !== 'undefined') {
          analytics.track({
          event_type: 'ai_generation',
          event_name: 'diagram_regeneration_error',
          page_path: window.location.pathname,
          payload: { 
            detail_level: detailLevel,
            error_message: message
          }
        });
      }
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

  const handlePromptClick = useCallback((prompt: string) => {
    // Pill shows short label (e.g. "Real-time chat app") but the actual
    // prompt sent to AI should be the full architecture request.
    const fullPrompt = `describe ${prompt} architecture`;
    setInput(fullPrompt);
    // Focus the textarea so user can immediately press Enter
    requestAnimationFrame(() => textareaRef.current?.focus());

    if (typeof window !== 'undefined') {
      analytics.track({
        event_type: 'ui_interaction',
        event_name: 'starter_prompt_clicked',
        page_path: window.location.pathname,
        payload: { prompt: fullPrompt, pill_label: prompt },
      });
    }
  }, []);

  // Mobile keyboard handling: adjust bottom when visual viewport shrinks (iOS keyboard)
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-3 sm:px-6 flex items-center gap-2"
      style={{ bottom: `max(12px, env(safe-area-inset-bottom, 12px))`, marginBottom: keyboardOffset ? `${keyboardOffset}px` : undefined, transition: 'margin-bottom 0.2s ease' }}
    >
      <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
        {/* Detail Level Toggle + Code — above the input, horizontally scrollable on mobile */}
        <div className="flex items-center gap-1.5 max-w-full overflow-x-auto scrollbar-none -mx-1 px-1">
          {hasLastPrompt && onRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/10 bg-muted/20 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-all text-[10px] font-semibold cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Regenerate diagram"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCw className="w-3 h-3" />
              )}
              <span>Regenerate</span>
            </button>
          )}

          <div className="flex items-center gap-0.5 bg-muted/20 rounded-full p-0.5 border border-border/10">
            {([1, 2, 3] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDetailLevel(level);
                  if (typeof window !== 'undefined') {
                                  analytics.track({
                      event_type: 'ai_settings',
                      event_name: 'detail_level_changed',
                      page_path: window.location.pathname,
                      payload: { level }
                    });
                  }
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
                  detailLevel === level
                    ? 'bg-[#1E90FF]/20 text-[#1E90FF] shadow-sm'
                    : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
                }`}
                title={level === 1 ? 'Simple — only core components' : level === 2 ? 'Moderate — balanced detail' : 'Detailed — full architecture depth'}
                aria-pressed={detailLevel === level}
              >
                L{level}
              </button>
            ))}
          </div>

          {!hideCodeButtonDerived && (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                              analytics.track({
                    event_type: 'ui_interaction',
                    event_name: 'code_view_toggled',
                    page_path: window.location.pathname,
                    payload: { show_code: !showCodeDerived }
                  });
                }
                onToggleCode();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-[background,border-color,color] text-[10px] font-semibold cursor-pointer active:scale-95 ${
                showCodeDerived 
                  ? 'bg-[#1E90FF]/15 text-[#1E90FF] border-[#1E90FF]/30' 
                  : 'bg-muted/20 border-border/10 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Code</span>
            </button>
          )}
        </div>

        {/* Starter prompt pills — only on empty canvas with no input, directly above the input */}
        <AnimatePresence>
          {isCanvasEmpty && !input.trim() && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-wrap justify-center gap-1.5 max-w-full px-1"
              aria-label="Starter prompts"
            >
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-card border border-border/40 shadow-sm text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap"
                  title={`Use prompt: ${prompt}`}
                >
                  <Sparkles className="w-3 h-3 opacity-60" />
                  {prompt}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key="input"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
              className={`flex items-center gap-2 w-full rounded-[16px] border bg-card shadow-soft-3 px-2 py-1 transition-all duration-200 ${
                isFirstTime && isCanvasEmpty 
                  ? 'shiny-input-glow border-[#1E90FF]/70 focus-within:border-primary/50' 
                  : 'border-border/40 focus-within:border-primary/50'
              } ${isCanvasEmpty ? 'py-3' : ''}`}
        >
          {/* Input Text Area */}
          <div className="flex-1 min-w-0 flex items-center">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Describe your architecture, or paste a GitHub repo link…"
              className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent resize-none text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/60 py-1 sm:py-0.5 px-1 max-h-24 shadow-none focus:shadow-none focus-visible:!outline-none focus:!outline-none"
              disabled={isGenerating}
              style={{ height: 'auto', minHeight: isCanvasEmpty ? '48px' : '24px' }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Mic Button - larger touch target on mobile */}
            <button
              className="w-10 h-10 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-transparent text-muted-foreground/35 cursor-not-allowed shrink-0"
              disabled
              title="Voice coming soon"
              aria-label="Voice input (coming soon)"
            >
              <Mic className="w-4 h-4 sm:w-3 sm:h-3" />
            </button>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={!input.trim() || isGenerating}
              aria-label={isGenerating ? 'Generating' : 'Generate diagram'}
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-[#1E90FF] text-white hover:bg-[#4dabf7] transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-5 h-5 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>
        </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
