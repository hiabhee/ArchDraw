'use client';

import { X, Check, Sparkles } from 'lucide-react';
import { SignInButtons } from '@/components/SignInButtons';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  message: string;
  benefits: string[];
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature,
  message,
  benefits,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md bg-card rounded-[20px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-gradient-to-br from-[#1E90FF] to-[#4dabf7] shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-foreground leading-tight">
                    Sign in to unlock {feature}
                  </h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">{message}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-[10px] hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Benefits */}
          <div className="px-6 py-5 space-y-3">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className="w-5 h-5 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-150">
                  <Check className="w-3 h-3 text-[#22C55E]" />
                </div>
                <span className="text-[14px] text-foreground/90 leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 space-y-3">
            <SignInButtons />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <a
              href="mailto:jamdadeabhishek039@gmail.com?subject=ArchDraw%20Pro%20Plan%20Inquiry&body=Hi%2C%0A%0AI'm%20interested%20in%20the%20Pro%20plan%20for%20unlimited%20access.%0A%0AThank%20you!"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[12px] border border-border/50 hover:border-border hover:bg-secondary/50 transition-all duration-150 text-foreground"
            >
              <Sparkles className="w-4 h-4" />
              Contact for Pro Plan
            </a>

            <p className="text-center">
              <button 
                type="button" 
                onClick={onClose}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Maybe later
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export const UPGRADE_BENEFITS = {
  export: [
    'Export to PNG, SVG, and JSON',
    'No watermarks on exports',
    '5 saved canvases',
    '10 AI generations per day',
  ],
  share: [
    'Create shareable links (7-day expiry)',
    'View or edit collaboration',
    'Control who sees your diagrams',
    '5 saved canvases',
  ],
  templates: [
    'Access to all 9+ templates',
    'Advanced architecture patterns',
    '5 saved canvases',
    '10 AI generations per day',
  ],
  canvas: [
    'Save up to 5 canvases permanently',
    'Auto-save every 30 seconds',
    'Canvas versioning (last 3 versions)',
    'Access from any device',
  ],
  general: [
    '10 AI generations per day (vs 3/hour)',
    'Save up to 5 canvases (vs 1 session)',
    'Export PNG/SVG without watermarks',
    'Share diagrams with your team',
    'Full tutorial system access',
    'Dashboard & analytics',
  ],
};
