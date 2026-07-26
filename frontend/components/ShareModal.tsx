'use client';

import { useState, useRef, useEffect } from 'react';
import { analytics } from '@/lib/analytics';
import { Link, Link2, Check, Copy, X, ChevronDown, Users, Globe, Lock, Mail } from 'lucide-react';

export interface SharePerson {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'can edit' | 'can view';
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  sessionId?: string;
  initialPeople?: SharePerson[];
  accessType?: 'restricted' | 'anyone';
  linkPermission?: 'viewer' | 'editor';
  onAccessChange?: (accessType: 'restricted' | 'anyone', linkPermission: 'viewer' | 'editor') => void;
  onInvite?: (email: string, role: 'can edit' | 'can view') => void;
  onRemove?: (userId: string) => void;
  onRoleChange?: (userId: string, role: 'can edit' | 'can view') => void;
  onCopyLink?: (url: string) => void;
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  shareUrl, 
  sessionId,
  initialPeople = [],
  accessType: initialAccessType,
  linkPermission: initialLinkPermission,
  onAccessChange,
  onInvite,
  onRemove,
  onRoleChange,
  onCopyLink: externalOnCopyLink
}: ShareModalProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'can edit' | 'can view'>('can view');
  const [accessMode, setAccessMode] = useState<'invited' | 'link'>(initialAccessType === 'anyone' ? 'link' : 'invited');
  const [linkPerm, setLinkPerm] = useState<'can edit' | 'can view'>(initialLinkPermission === 'editor' ? 'can edit' : 'can view');
  const [copied, setCopied] = useState(false);
  const [people, setPeople] = useState<SharePerson[]>(initialPeople);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(null);
        setShowInviteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopyLink = async (url: string) => {
    if (typeof window !== 'undefined') {
      analytics.track({
        event_type: 'sharing',
        event_name: 'share_link_copied',
        page_path: window.location.pathname,
        payload: { 
          access_mode: accessMode,
          link_permission: linkPerm,
          session_id: sessionId 
        }
      });
    }

    if (externalOnCopyLink) {
      externalOnCopyLink(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const fallbackCopy = (text: string) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try { document.execCommand('copy'); setCopied(true) } catch { /* clipboard fallback may not work in all browsers */ }
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(url); setCopied(true) }
      catch { fallbackCopy(url) }
    } else {
      fallbackCopy(url);
    }

    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleInvite = () => {
    if (!validateEmail(inviteEmail)) return;
    
    const newPerson: SharePerson = {
      id: inviteEmail,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: invitePermission,
    };

    if (typeof window !== 'undefined') {
      analytics.track({
        event_type: 'sharing',
        event_name: 'user_invited',
        page_path: window.location.pathname,
        payload: { 
          permission: invitePermission,
          session_id: sessionId 
        }
      });
    }

    if (onInvite) {
      onInvite(inviteEmail, invitePermission);
    } else {
      setPeople([...people, newPerson]);
    }
    setInviteEmail('');
  };

  const handleRemove = (userId: string) => {
    if (onRemove) {
      onRemove(userId);
    } else {
      setPeople(people.filter(p => p.id !== userId));
    }
  };

  const handleRoleChange = (userId: string, role: 'can edit' | 'can view') => {
    if (onRoleChange) {
      onRoleChange(userId, role);
    } else {
      setPeople(people.map(p => p.id === userId ? { ...p, role } : p));
    }
    setShowRoleDropdown(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose} 
      />

      {/* Modal */}
      <div className="relative w-full max-w-[520px] mx-4 bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F3F4F6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-[#F3F4F6]">
                <Users className="w-5 h-5 text-[#111118]" />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#111118] leading-tight">Share</h2>
                <p className="text-[13px] text-[#6B7280] mt-0.5">Invite people and manage access</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-[10px] hover:bg-[#F3F4F6] text-[#6B7280] transition-all duration-150"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* SECTION 1: INVITE ROW */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  ref={inputRef}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  placeholder="Email, name..."
                  className="w-full pl-11 pr-4 py-[10px] text-[14px] bg-white border border-[#E5E7EB] rounded-[10px] outline-none text-[#111118] placeholder:text-[#9CA3AF] focus:border-[#111118] focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all duration-150"
                />
              </div>
              
              {/* Permission dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowInviteDropdown(!showInviteDropdown)}
                  className="flex items-center gap-1 px-4 py-[10px] text-[14px] bg-white border border-[#E5E7EB] rounded-[10px] hover:bg-[#F9FAFB] transition-all duration-150 text-[#6B7280]"
                >
                  <span>{invitePermission}</span>
                  <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                </button>
                
                {showInviteDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-36 rounded-[10px] overflow-hidden z-10 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-[#E5E7EB]">
                    <button
                      onClick={() => { setInvitePermission('can view'); setShowInviteDropdown(false); }}
                      className="w-full px-3 py-2.5 text-[14px] text-left hover:bg-[#F9FAFB] text-[#111118] transition-colors duration-150"
                    >
                      can view
                    </button>
                    <button
                      onClick={() => { setInvitePermission('can edit'); setShowInviteDropdown(false); }}
                      className="w-full px-3 py-2.5 text-[14px] text-left hover:bg-[#F9FAFB] text-[#111118] transition-colors duration-150"
                    >
                      can edit
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleInvite}
                disabled={!validateEmail(inviteEmail)}
                className="px-5 py-[10px] text-[14px] font-medium text-white bg-[#1E90FF] rounded-[9999px] hover:bg-[#4dabf7] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              >
                Invite
              </button>
            </div>
          </div>

          <hr className="border-none border-t border-[#F3F4F6] my-5" />

          {/* SECTION 2: GENERAL ACCESS */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]">General access</label>
            
            <div className="space-y-2">
              {/* Restricted */}
              <button
                onClick={() => {
                  setAccessMode('invited');
                  onAccessChange?.('restricted', linkPerm === 'can edit' ? 'editor' : 'viewer');
                  if (typeof window !== 'undefined') {
                                  analytics.track({
                      event_type: 'sharing',
                      event_name: 'access_mode_changed',
                      page_path: window.location.pathname,
                      payload: { 
                        mode: 'restricted',
                        session_id: sessionId 
                      }
                    });
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-[10px] transition-all duration-150 ${
                  accessMode === 'invited' ? 'bg-[#1E90FF]/10 border border-[#1E90FF]/30' : 'hover:bg-[#F9FAFB]'
                }`}
              >
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all duration-150 ${
                  accessMode === 'invited' ? 'bg-[#1E90FF]' : 'bg-[#F3F4F6]'
                }`}>
                  {accessMode === 'invited' ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Users className="w-5 h-5 text-[#6B7280]" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium text-[#111118]">Only those invited</p>
                  <p className="text-[13px] text-[#6B7280]">{people.length} people</p>
                </div>
                <Lock className="w-4 h-4 text-[#9CA3AF]" />
              </button>
              
              {/* Link access */}
              <button
                onClick={() => {
                  setAccessMode('link');
                  onAccessChange?.('anyone', linkPerm === 'can edit' ? 'editor' : 'viewer');
                  if (typeof window !== 'undefined') {
                                  analytics.track({
                      event_type: 'sharing',
                      event_name: 'access_mode_changed',
                      page_path: window.location.pathname,
                      payload: { 
                        mode: 'anyone_with_link',
                        session_id: sessionId 
                      }
                    });
                  }
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-[10px] transition-all duration-150 ${
                  accessMode === 'link' ? 'bg-[#1E90FF]/10 border border-[#1E90FF]/30' : 'hover:bg-[#F9FAFB]'
                }`}
              >
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-all duration-150 ${
                  accessMode === 'link' ? 'bg-[#1E90FF]' : 'bg-[#F3F4F6]'
                }`}>
                  {accessMode === 'link' ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <Link2 className="w-5 h-5 text-[#6B7280]" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium text-[#111118]">Link access</p>
                  <p className="text-[13px] text-[#6B7280]">Anyone with the link</p>
                </div>
                <Globe className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>
            
            {/* Link permission selector */}
            {accessMode === 'link' && (
              <div className="flex items-center gap-3 mt-3 ml-13">
                <span className="text-[13px] text-[#6B7280]">People with link can:</span>
                <button
                  onClick={() => {
                    setLinkPerm('can view');
                    onAccessChange?.('anyone', 'viewer');
                    if (typeof window !== 'undefined') {
                                      analytics.track({
                        event_type: 'sharing',
                        event_name: 'link_permission_changed',
                        page_path: window.location.pathname,
                        payload: { 
                          permission: 'viewer',
                          session_id: sessionId 
                        }
                      });
                    }
                  }}
                  className={`px-3 py-1.5 text-[13px] rounded-[6px] transition-all duration-150 ${
                    linkPerm === 'can view' ? 'bg-[#1E90FF] text-white font-medium' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                  }`}
                >
                  View
                </button>
                <button
                  onClick={() => {
                    setLinkPerm('can edit');
                    onAccessChange?.('anyone', 'editor');
                    if (typeof window !== 'undefined') {
                                      analytics.track({
                        event_type: 'sharing',
                        event_name: 'link_permission_changed',
                        page_path: window.location.pathname,
                        payload: { 
                          permission: 'editor',
                          session_id: sessionId 
                        }
                      });
                    }
                  }}
                  className={`px-3 py-1.5 text-[13px] rounded-[6px] transition-all duration-150 ${
                    linkPerm === 'can edit' ? 'bg-[#1E90FF] text-white font-medium' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                  }`}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <hr className="border-none border-t border-[#F3F4F6] my-5" />

          {/* SECTION 3: PEOPLE WITH ACCESS */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]">
              People with access {people.length > 0 && `(${people.length})`}
            </label>
            
            {people.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 mx-auto mb-2 text-[#D1D5DB]" />
                <p className="text-[14px] text-[#6B7280]">No one has access yet</p>
                <p className="text-[13px] text-[#9CA3AF] mt-1">Invite people above to share this</p>
              </div>
            ) : (
              <div className="space-y-1">
                {people.map((person) => (
                  <div
                    key={person.id}
                    className="group flex items-center gap-3 px-3 py-3 rounded-[10px] hover:bg-[#F9FAFB] transition-all duration-150"
                  >
                    {/* Avatar */}
                    {person.avatar ? (
                      <img
                        src={person.avatar}
                        alt={person.name}
                        className="w-10 h-10 rounded-[9999px] object-cover border-2 border-white"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-[9999px] bg-[#F3F4F6] flex items-center justify-center text-[14px] font-medium text-[#6B7280]">
                        {getInitials(person.name)}
                      </div>
                    )}
                    
                    {/* Name/Email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#111118] truncate">
                        {person.name}
                      </p>
                      <p className="text-[13px] text-[#6B7280] truncate">{person.email}</p>
                    </div>
                    
                    {/* Role */}
                    {person.role === 'owner' ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#DCFCE7]">
                        <Check className="w-3 h-3 text-[#22C55E]" />
                        <span className="text-[11px] font-semibold text-[#22C55E]">owner</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => setShowRoleDropdown(showRoleDropdown === person.id ? null : person.id)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-[6px] hover:bg-[#F3F4F6] transition-all duration-150 text-[#6B7280]"
                        >
                          {person.role}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showRoleDropdown === person.id && (
                          <div className="absolute right-0 mt-1 w-32 rounded-[10px] overflow-hidden z-10 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-[#E5E7EB]">
                            <button
                              onClick={() => handleRoleChange(person.id, 'can view')}
                              className="w-full px-3 py-2.5 text-[14px] text-left hover:bg-[#F9FAFB] text-[#111118] transition-colors duration-150"
                            >
                              can view
                            </button>
                            <button
                              onClick={() => handleRoleChange(person.id, 'can edit')}
                              className="w-full px-3 py-2.5 text-[14px] text-left hover:bg-[#F9FAFB] text-[#111118] transition-colors duration-150"
                            >
                              can edit
                            </button>
                            <button
                              onClick={() => handleRemove(person.id)}
                              className="w-full px-3 py-2.5 text-[14px] text-left hover:bg-[#FEF2F2] text-[#EF4444] transition-colors duration-150"
                            >
                              remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Remove button (visible on hover) */}
                    {person.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(person.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[6px] hover:bg-[#FEF2F2] text-[#9CA3AF] hover:text-[#EF4444] transition-all duration-150"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: COPY LINK ROW */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F3F4F6]">
          <div className="flex items-center justify-between gap-3">
            {/* Faded URL */}
            <div className="relative flex-1 min-w-0 overflow-hidden">
              <p className="text-[13px] text-[#9CA3AF] whitespace-nowrap overflow-hidden text-ellipsis">
                {shareUrl}
              </p>
              <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#F9FAFB] to-transparent pointer-events-none" />
            </div>

            {/* Copy link button */}
            <button
              onClick={() => handleCopyLink(shareUrl)}
              disabled={copied}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-[9999px] text-[14px] font-medium transition-all duration-150
                ${copied
                  ? 'bg-[#DCFCE7] text-[#22C55E] cursor-default'
                  : 'bg-[#1E90FF] text-white hover:bg-[#4dabf7]'
                }`}
            >
              {copied
                ? <Check className="w-4 h-4" />
                : <Link className="w-4 h-4" />
              }
              <span>{copied ? 'Copied!' : 'Copy link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
