'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Mic, Send, Loader2, ChevronDown, Lightbulb, Clock, Star, Trash2, Code, RotateCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePromptHistory, PROMPT_SUGGESTIONS } from '@/store/promptHistory';

interface FloatingAIBarProps {
  onGenerate: (description: string, diagramSize: 'small' | 'medium' | 'large') => Promise<void>;
  onToggleCode: () => void;
  showCode: boolean;
  hideCodeButton?: boolean;
  isCanvasEmpty?: boolean;
  onRegenerate?: () => Promise<void>;
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
  const [showHistory, setShowHistory] = useState(false);
  const [diagramSize, setDiagramSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [activeTab, setActiveTab] = useState<'inspiration' | 'history'>('inspiration');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { history, addToHistory, clearHistory, addToFavorites } = usePromptHistory();
  
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

    try {
      await onGenerate(input, diagramSize);
      addToHistory(input, diagramSize);
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
  }, [input, onGenerate, diagramSize, addToHistory]);

  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate) return;
    setIsGenerating(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regeneration failed';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [onRegenerate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === 'Escape') {
      setInput('');
    }
  };

  const selectInspiration = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const selectHistoryItem = (item: { prompt: string }) => {
    setInput(item.prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed bottom-0 sm:bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-2 sm:px-4 safe-area-bottom flex items-center gap-2"
    >
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key="input"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className={`flex items-center gap-1.5 w-full rounded-[20px] border bg-card shadow-soft-3 p-1 pr-1.5 transition-all duration-200 ${
            isFirstTime && isCanvasEmpty 
              ? 'shiny-input-glow border-[#5e6ad2]/70 focus-within:border-primary/50' 
              : 'border-border/40 focus-within:border-primary/50'
          }`}
        >
          {/* Left Actions */}
          <div className="flex items-center gap-1 shrink-0 pl-0.5">
            {/* Add Button */}
            <button
              className="solid-icon-btn shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150"
              title="Add component"
              onClick={() => window.dispatchEvent(new CustomEvent('open-create-component'))}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Inspiration Dropdown */}
            <DropdownMenu open={showHistory} onOpenChange={setShowHistory}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/30 hover:bg-[#1c1e22] dark:hover:bg-[#141516] text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer select-none border border-transparent active:scale-95">
                  <Lightbulb className="w-3 h-3" />
                  <span className="hidden sm:inline text-[10px] font-semibold">Inspiration</span>
                  <ChevronDown className="hidden sm:block w-2 h-2 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-72 sm:w-80 p-0 border border-border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden z-[100]"
              >
                <div className="flex border-b border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab('inspiration')}
                    className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === 'inspiration' 
                        ? 'text-primary border-b-2 border-primary bg-primary/5' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      activeTab === 'history' 
                        ? 'text-primary border-b-2 border-primary bg-primary/5' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                    }`}
                  >
                    History ({history.length})
                  </button>
                </div>
                
                <div className="max-h-96 overflow-y-auto p-2">
                  {activeTab === 'inspiration' ? (
                    <>
                      {PROMPT_SUGGESTIONS.map((category) => (
                        <div key={category.category} className="mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-2 py-1">
                            {category.category}
                          </p>
                          {category.prompts.map((item, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                selectInspiration(item.prompt);
                                setShowHistory(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors"
                            >
                              <p className="text-sm font-semibold text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.prompt}</p>
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No history yet</p>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => clearHistory()}
                            className="w-full text-xs text-muted-foreground hover:text-destructive px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear History
                          </button>
                          {history.slice(0, 10).map((item) => (
                            <div
                              key={item.id}
                              className="group flex items-start gap-2 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer"
                              onClick={() => {
                                selectHistoryItem(item);
                                setShowHistory(false);
                              }}
                            >
                              <Clock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm truncate text-foreground">{item.prompt}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {item.model ? `Size: ${item.model}` : 'Just now'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToFavorites(item);
                                  toast.success('Added to favorites');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-all"
                              >
                                <Star className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
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
