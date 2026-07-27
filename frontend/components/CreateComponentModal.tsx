'use client';

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useState, useEffect, useRef } from 'react';
import {
  Server, Database, Radio, Globe, Monitor, Brain, Shield,
  HardDrive, Box, X, Plus, Zap, Cloud, Webhook,
} from 'lucide-react';

export interface ComponentType {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  group: 'compute' | 'data' | 'infra' | 'external';
}

export const COMPONENT_TYPES: ComponentType[] = [
  // Compute group
  { id: 'service', label: 'Service', icon: Server, color: '#3b82f6', group: 'compute' },
  { id: 'client', label: 'Client', icon: Monitor, color: '#10b981', group: 'compute' },
  { id: 'gateway', label: 'Gateway', icon: Globe, color: '#3b82f6', group: 'compute' },
  { id: 'queue', label: 'Queue', icon: Radio, color: '#f59e0b', group: 'compute' },
  // Data group
  { id: 'database', label: 'Database', icon: Database, color: '#f97316', group: 'data' },
  { id: 'storage', label: 'Storage', icon: HardDrive, color: '#f97316', group: 'data' },
  { id: 'cache', label: 'Cache', icon: Zap, color: '#ef4444', group: 'data' },
  // Infrastructure group
  { id: 'infrastructure', label: 'Infra', icon: Cloud, color: '#64748b', group: 'infra' },
  { id: 'container', label: 'Container', icon: Box, color: '#0891b2', group: 'infra' },
  // External group
  { id: 'ai-ml', label: 'AI / ML', icon: Brain, color: '#ec4899', group: 'external' },
  { id: 'security', label: 'Security', icon: Shield, color: '#ef4444', group: 'external' },
  { id: 'other', label: 'Other', icon: Webhook, color: '#3b82f6', group: 'external' },
];

export interface CreateComponentData {
  name: string;
  type: string;
  description: string;
}

export interface ComponentToEdit {
  id: string;
  label: string;
  category: string;
  description?: string;
}

interface CreateComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateComponentData) => void;
  onUpdate?: (id: string, data: CreateComponentData) => void;
  existingNames: string[];
  editComponent?: ComponentToEdit | null;
}

export function CreateComponentModal({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  existingNames,
  editComponent,
}: CreateComponentModalProps) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  const isEditing = !!editComponent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Soft backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 scrollbar-thin"
        style={{ boxShadow: '0 24px 48px hsl(var(--foreground) / 0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isEditing ? 'Edit Component' : 'New Component'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-brand/60 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <ModalContent
          existingNames={existingNames}
          editComponent={editComponent}
          onCreate={(data) => {
            onCreate(data);
            onClose();
          }}
          onUpdate={(data) => {
            if (editComponent && onUpdate) {
              onUpdate(editComponent.id, data);
              onClose();
            }
          }}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

interface ModalContentProps {
  onClose: () => void;
  onCreate: (data: CreateComponentData) => void;
  onUpdate: (data: CreateComponentData) => void;
  existingNames: string[];
  editComponent?: ComponentToEdit | null;
}

function ModalContent({ onClose, onCreate, onUpdate, existingNames, editComponent }: ModalContentProps) {
  const isEditing = !!editComponent;
  const typeFromCategory = COMPONENT_TYPES.find(t => t.label.toLowerCase() === editComponent?.category?.toLowerCase());
  
  const [name, setName] = useState(editComponent?.label || '');
  const [selectedType, setSelectedType] = useState<string | null>(typeFromCategory?.id || null);
  const [description, setDescription] = useState(editComponent?.description || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const selectedTypeData = COMPONENT_TYPES.find(t => t.id === selectedType);

  const validateName = (value: string): string | null => {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length < 2) return 'Min 2 characters';
    const lowerName = value.trim().toLowerCase();
    const namesToCheck = existingNames.filter(n => {
      if (isEditing && editComponent) {
        return n !== editComponent.label.toLowerCase();
      }
      return true;
    });
    if (namesToCheck.includes(lowerName)) return 'Name already exists';
    return null;
  };

  const handleSubmit = () => {
    const error = validateName(name);
    if (error) {
      setNameError(error);
      nameInputRef.current?.focus();
      return;
    }
    if (!selectedType) {
      return;
    }

    setIsCreating(true);
    setTimeout(() => {
      const data = {
        name: name.trim(),
        type: selectedType,
        description: description.trim(),
      };
      
      if (isEditing) {
        onUpdate(data);
      } else {
        onCreate(data);
        // Dispatch event to notify other components (like CommandPalette) to refresh
        window.dispatchEvent(new CustomEvent('custom-component-added'));
      }
      
      setIsCreating(false);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isValid = name.trim().length >= 2 && selectedType !== null;

  return (
    <div className="p-5 space-y-5" onKeyDown={handleKeyDown}>
      {/* Name Input - Primary Focus */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Name
          </label>
          {selectedTypeData && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand">
              <selectedTypeData.icon
                className="w-3 h-3"
                style={{ color: selectedTypeData.color }}
              />
              <span className="text-[10px] font-medium text-foreground">
                {selectedTypeData.label}
              </span>
            </div>
          )}
        </div>
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(validateName(e.target.value));
          }}
          placeholder="Auth Service, API Gateway, Payment…"
          className={`w-full px-4 py-3 text-sm bg-background rounded-xl outline-none transition-all ${nameError
            ? 'ring-2 ring-destructive/50'
            : 'focus:ring-2 focus:ring-ring/30'
            }`}
        />
        {nameError && (
          <p className="text-xs text-destructive mt-1">{nameError}</p>
        )}
      </div>

      {/* Type Selection - Soft Grid */}
      <div className="space-y-2 shrink-0">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Type
        </label>

        <div className="grid grid-cols-4 gap-2">
          {COMPONENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`group relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all ${isSelected
                  ? 'bg-primary/10'
                  : 'hover:bg-brand/50'
                  }`}
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: `${type.color}15`,
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: type.color }}
                  />
                </div>
                <span className={`text-[11px] font-medium text-center ${isSelected
                  ? 'text-foreground'
                  : 'text-muted-foreground'
                  }`}>
                  {type.label}
                </span>
                {isSelected && (
                  <div
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: type.color, boxShadow: `0 0 8px ${type.color}60` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description - Optional */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </label>
          <span className="text-[10px] text-muted-foreground/60">
            Optional
          </span>
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 80))}
          placeholder="What does this component do?"
          maxLength={80}
          className="w-full px-4 py-2.5 text-sm bg-background rounded-xl outline-none focus:ring-2 focus:ring-ring/30 transition-all"
        />
        <div className="flex justify-end">
          <span className="text-[10px] text-muted-foreground/60">{description.length}/80</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-brand/50 rounded-xl transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || isCreating}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${isValid && !isCreating
            ? 'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
        >
          {isCreating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isEditing ? 'Saving…' : 'Creating…'}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {isEditing ? 'Save' : 'Create'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
