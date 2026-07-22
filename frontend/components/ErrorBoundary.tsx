'use client';

import { Component, type ReactNode } from 'react';
import type { Node } from 'reactflow';
import { validateAndFixNodes } from '@/lib/utils/nodeValidation';
import { useDiagramStore } from '@/store/diagramStore';
import logger from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.error('[Archflow] Uncaught error:', error, info.componentStack);
    
    // Auto-recover from parentNode errors
    if (error.message.includes('Parent node') && error.message.includes('not found')) {
      this.tryRecoverFromParentNodeError(error.message);
    }
  }

  tryRecoverFromParentNodeError = (errorMessage: string) => {
    try {
      // Extract parent ID from error message
      const match = errorMessage.match(/Parent node ([^\s]+) not found/);
      if (match) {
        const missingParentId = match[1];
        logger.log('[ErrorBoundary] Attempting to recover from missing parent:', missingParentId);
        
        // Get current nodes and clean them
        const currentNodes = useDiagramStore.getState().nodes;
        const fixedNodes = currentNodes.map(node => {
          const parentNode = (node as Node & { parentNode?: string }).parentNode;
          if (parentNode === missingParentId) {
            const { parentNode: _p, extent: _e, ...cleanNode } = node as Node & { parentNode?: string };
            logger.log('[ErrorBoundary] Removed invalid parentNode from:', node.id);
            return cleanNode as typeof node;
          }
          return node;
        });
        
        // Validate and fix all nodes
        const validatedNodes = validateAndFixNodes(fixedNodes);
        
        // Update store
        useDiagramStore.getState().setNodes(validatedNodes);
        
        logger.log('[ErrorBoundary] Recovery successful');
        
        // Reset error state after a short delay
        setTimeout(() => {
          this.setState({ hasError: false, error: undefined });
        }, 100);
      }
    } catch (e) {
      logger.error('[ErrorBoundary] Recovery failed:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Something went wrong</p>
              <p className="text-white/50 text-sm mt-1">
                {this.state.error?.message ?? 'An unexpected error occurred.'}
              </p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
