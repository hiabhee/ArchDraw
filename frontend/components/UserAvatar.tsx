'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  LogOut, 
  FolderOpen, 
  Settings, 
  User, 
  Shield, 
  Bell, 
  CreditCard,
  ChevronRight,
  Camera,
  Sparkles,
  Palette,
  Zap,
  Globe,
  Eye,
  Grid3X3,
  Magnet,
  Map,
  Keyboard,
  Bot,
  Clock,
  Link2,
  Lock,
  Mail,
  Search,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { useModalStore } from '@/store/modalStore';

type SettingsTab = 'general' | 'profile' | 'editor' | 'ai' | 'security' | 'notifications' | 'billing';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="w-11 h-6 rounded-full transition-colors relative"
      style={{ background: enabled ? '#1A1A1A' : '#E0E0E0' }}
    >
      <span 
        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ 
          left: enabled ? 'auto' : '2px',
          right: enabled ? '2px' : 'auto',
          transform: enabled ? 'translateX(-5px)' : 'translateX(0)'
        }}
      />
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>{children}</h3>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-3" style={{ color: '#6B6B6B' }}>{children}</p>;
}

function SettingRow({ icon: Icon, title, desc, children }: { icon?: React.ElementType; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-4 h-4" style={{ color: '#6B6B6B' }} />}
        <div>
          <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{title}</p>
          {desc && <p className="text-xs" style={{ color: '#6B6B6B' }}>{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { user, signOut } = useAuthStore();
  const { showGrid, toggleGrid, edgeAnimations, userProfile, canvases } = useDiagramStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const ref = useRef<HTMLDivElement>(null);
  
  const [autoSave, setAutoSave] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [defaultZoom, setDefaultZoom] = useState('100');
  const [showLabels, setShowLabels] = useState(true);
  const [shortcutHints, setShortcutHints] = useState(true);
  const [dragAnimations, setDragAnimations] = useState(true);
  const [aiModel, setAiModel] = useState('llama');
  const [responseStyle, setResponseStyle] = useState('balanced');
  const [autoSuggestions, setAutoSuggestions] = useState(true);
  const [aiAutoLayout, setAiAutoLayout] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [collabInvites, setCollabInvites] = useState(true);
  const [sharedUpdates, setSharedUpdates] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open, onOpenChange]);

  const [prevProfileName, setPrevProfileName] = useState(userProfile?.name);
  if (userProfile?.name !== prevProfileName) {
    setPrevProfileName(userProfile?.name);
    if (userProfile?.name) setDisplayName(userProfile.name);
  }

  const profile = userProfile ?? (user ? { id: user.id, email: user.email ?? undefined, name: user.name } : null);
  if (!profile) return null;

  const initials = (profile.name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase();

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'editor' as const, label: 'Editor', icon: Palette },
    { id: 'ai' as const, label: 'AI Settings', icon: Bot },
    { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.3)' }} onClick={() => onOpenChange(false)} />
      
      <div 
        ref={ref}
        className="relative mx-4 overflow-hidden flex"
        style={{ 
          background: 'white', 
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          width: 850,
          maxWidth: '90vw',
          maxHeight: '90vh',
        }}
      >
        {/* Sidebar */}
        <div 
          className="w-[220px] shrink-0 p-4 flex flex-col"
          style={{ background: '#FAFAFA' }}
        >
          <h2 className="text-sm font-semibold mb-4 px-2" style={{ color: '#1A1A1A' }}>Settings</h2>
          <nav className="space-y-1 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[12px] transition-all ${
                  activeTab === tab.id ? 'bg-white shadow-sm' : 'hover:bg-gray-100'
                }`}
                style={{ 
                  color: activeTab === tab.id ? '#1A1A1A' : '#6B6B6B'
                }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* User info at bottom of sidebar */}
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-3 p-3 rounded-[12px]" style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-semibold" style={{ background: '#1A1A1A' }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: '#1A1A1A' }}>{profile.name ?? 'User'}</p>
                <p className="text-[10px] truncate" style={{ color: '#6B6B6B' }}>{profile.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 text-sm rounded-[12px] transition-colors hover:bg-red-50"
              style={{ color: '#E5484D' }}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div 
            className="h-[60px] px-6 flex items-center justify-between shrink-0 border-b"
            style={{ borderColor: '#F2F2F2' }}
          >
            <h3 className="text-base font-semibold" style={{ color: '#1A1A1A' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: '#6B6B6B' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>General</SectionTitle>
                <SectionDesc>Manage your account settings</SectionDesc>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Clock} title="Auto-save diagrams" desc="Automatically save changes">
                  <Toggle enabled={autoSave} onChange={setAutoSave} />
                </SettingRow>
                
                <SettingRow icon={Grid3X3} title="Show grid on canvas" desc="Display alignment grid">
                  <Toggle enabled={showGrid} onChange={toggleGrid} />
                </SettingRow>
                
                <SettingRow icon={Magnet} title="Snap to grid" desc="Align nodes to grid">
                  <Toggle enabled={snapToGrid} onChange={setSnapToGrid} />
                </SettingRow>
                
                <SettingRow icon={Map} title="Show mini-map" desc="Display navigation minimap">
                  <Toggle enabled={showMinimap} onChange={setShowMinimap} />
                </SettingRow>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Globe} title="Default language" desc="UI language">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border-none outline-none"
                    style={{ background: 'white', color: '#1A1A1A' }}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </SettingRow>
              </div>


            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Profile</SectionTitle>
                <SectionDesc>Manage your public profile</SectionDesc>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl text-white font-semibold" style={{ background: '#1A1A1A' }}>
                    {initials}
                  </div>
                  <button className="absolute bottom-0 right-0 p-2 rounded-full bg-white shadow-md">
                    <Camera className="w-3 h-3" style={{ color: '#1A1A1A' }} />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Profile photo</p>
                  <p className="text-xs" style={{ color: '#6B6B6B' }}>Click to upload</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#1A1A1A' }}>Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-3 text-sm rounded-[14px] outline-none"
                  style={{ background: '#F8F8F8', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.04)', color: '#1A1A1A' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#1A1A1A' }}>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="w-full px-4 py-3 text-sm rounded-[14px] outline-none resize-none"
                  style={{ background: '#F8F8F8', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.04)', color: '#1A1A1A' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#1A1A1A' }}>Portfolio / Website</label>
                <input
                  type="url"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="https://yourportfolio.com"
                  className="w-full px-4 py-3 text-sm rounded-[14px] outline-none"
                  style={{ background: '#F8F8F8', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.04)', color: '#1A1A1A' }}
                />
              </div>

              <button className="w-full py-3 text-sm font-medium text-white rounded-[14px] hover:opacity-90" style={{ background: '#1A1A1A', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                Save changes
              </button>

              <div className="p-4 mt-6 rounded-[16px]" style={{ background: '#FFF4F4', border: '1px solid #FFE5E5' }}>
                <SettingRow icon={Trash2} title="Reset all data" desc="Clear all diagrams and local storage">
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete all diagrams and settings? This cannot be undone.')) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-white hover:opacity-90 transition-opacity"
                    style={{ background: '#E5484D' }}
                  >
                    Reset Data
                  </button>
                </SettingRow>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Editor Preferences</SectionTitle>
                <SectionDesc>Customize your diagram editing experience</SectionDesc>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Zap} title="Enable smooth connections" desc="Animate edge connections">
                  <Toggle enabled={edgeAnimations} onChange={() => useDiagramStore.getState().toggleEdgeAnimations()} />
                </SettingRow>
                
                <SettingRow icon={Eye} title="Show node labels" desc="Display component labels">
                  <Toggle enabled={showLabels} onChange={setShowLabels} />
                </SettingRow>
                
                <SettingRow icon={Keyboard} title="Keyboard shortcuts hints" desc="Show shortcut tooltips">
                  <Toggle enabled={shortcutHints} onChange={setShortcutHints} />
                </SettingRow>
                
                <SettingRow icon={Sparkles} title="Drag animations" desc="Animate node dragging">
                  <Toggle enabled={dragAnimations} onChange={setDragAnimations} />
                </SettingRow>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Search} title="Default zoom level" desc="Initial zoom when opening canvas">
                  <select 
                    value={defaultZoom}
                    onChange={(e) => setDefaultZoom(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border-none outline-none"
                    style={{ background: 'white', color: '#1A1A1A' }}
                  >
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                    <option value="150">150%</option>
                  </select>
                </SettingRow>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>AI Settings</SectionTitle>
                <SectionDesc>Configure AI-powered features</SectionDesc>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Bot} title="Default AI model" desc="Model for diagram generation">
                  <select 
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border-none outline-none"
                    style={{ background: 'white', color: '#1A1A1A' }}
                  >
                    <option value="llama">LLaMA 3 (default)</option>
                    <option value="gpt4o">GPT-4o</option>
                    <option value="claude">Claude</option>
                  </select>
                </SettingRow>
                
                <SettingRow icon={Zap} title="Response style" desc="AI response detail level">
                  <select 
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value)}
                    className="text-sm px-3 py-1.5 rounded-lg border-none outline-none"
                    style={{ background: 'white', color: '#1A1A1A' }}
                  >
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </SettingRow>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Sparkles} title="Auto-generate suggestions" desc="AI suggests improvements">
                  <Toggle enabled={autoSuggestions} onChange={setAutoSuggestions} />
                </SettingRow>
                
                <SettingRow icon={LayoutGrid} title="AI auto-layout" desc="Automatically arrange nodes">
                  <Toggle enabled={aiAutoLayout} onChange={setAiAutoLayout} />
                </SettingRow>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Security</SectionTitle>
                <SectionDesc>Manage your account security</SectionDesc>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <button className="w-full flex items-center justify-between p-3 rounded-[12px] hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Change password</p>
                      <p className="text-xs" style={{ color: '#6B6B6B' }}>Update your account password</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                </button>
                
                <button className="w-full flex items-center justify-between p-3 rounded-[12px] hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Two-factor authentication</p>
                      <p className="text-xs" style={{ color: '#6B6B6B' }}>Add an extra layer of security</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Notifications</SectionTitle>
                <SectionDesc>Configure how you receive updates</SectionDesc>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <SettingRow icon={Mail} title="Email notifications" desc="Receive updates via email">
                  <Toggle enabled={emailNotifs} onChange={setEmailNotifs} />
                </SettingRow>
                
                <SettingRow icon={Link2} title="Collaboration invites" desc="Notify when invited to canvas">
                  <Toggle enabled={collabInvites} onChange={setCollabInvites} />
                </SettingRow>
                
                <SettingRow icon={FolderOpen} title="Shared canvas updates" desc="Notify on shared diagram changes">
                  <Toggle enabled={sharedUpdates} onChange={setSharedUpdates} />
                </SettingRow>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <SectionTitle>Billing & Subscription</SectionTitle>
                <SectionDesc>Manage your plan and billing</SectionDesc>
              </div>

              <div className="p-5 rounded-[16px] border-2" style={{ borderColor: '#1A1A1A' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Free plan</span>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#1A1A1A', color: 'white' }}>Current</span>
                </div>
                <p className="text-sm mb-4" style={{ color: '#6B6B6B' }}>5 canvases, basic features</p>
                <button className="w-full py-2.5 text-sm font-medium text-white rounded-[12px] hover:opacity-90" style={{ background: '#1A1A1A' }}>
                  Upgrade to Pro
                </button>
              </div>

              <div className="p-4 rounded-[16px]" style={{ background: '#F8F8F8' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Canvases used</p>
                    <p className="text-xs mt-1" style={{ color: '#6B6B6B' }}>{canvases.length} of 5</p>
                  </div>
                  <div className="w-24 h-2 rounded-full" style={{ background: '#E0E0E0' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(canvases.length * 20, 100)}%`, background: '#1A1A1A' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserAvatar() {
  const { user, signOut } = useAuthStore();
  const { userProfile, canvases } = useDiagramStore();
  const { isProfileOpen, openProfile, closeProfile } = useModalStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeProfile();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [closeProfile]);

  const profile = userProfile ?? (user ? { id: user.id, email: user.email ?? undefined, name: user.name } : null);
  if (!profile) return null;

  const initials = (profile.name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase();

  const handleSignOut = async () => {
    closeProfile();
    await signOut();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openProfile}
        className="flex items-center gap-2 p-1.5 rounded-[12px] transition-colors hover:bg-gray-100"
      >
        {profile && 'avatar_url' in profile && profile.avatar_url ? (
          <img src={profile.avatar_url} alt={initials} className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-semibold" style={{ background: '#1A1A1A' }}>
            {initials}
          </div>
        )}
      </button>

      {isProfileOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-[16px] overflow-hidden z-50" style={{ background: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
          <div className="p-4 border-b" style={{ borderColor: '#F2F2F2' }}>
            <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{profile.name ?? 'User'}</p>
            <p className="text-xs truncate" style={{ color: '#6B6B6B' }}>{profile.email}</p>
          </div>
          
          <div className="p-2">
            <button
              onClick={openProfile}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-[12px] transition-colors hover:bg-gray-50"
              style={{ color: '#1A1A1A' }}
            >
              <Settings className="w-4 h-4" style={{ color: '#6B6B6B' }} />
              Settings
            </button>
            
            <button
              onClick={closeProfile}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-[12px] transition-colors hover:bg-gray-50"
              style={{ color: '#1A1A1A' }}
            >
              <FolderOpen className="w-4 h-4" style={{ color: '#6B6B6B' }} />
              <span className="flex-1 text-left">Your canvases</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F2F2F2', color: '#6B6B6B' }}>{canvases.length}</span>
            </button>
          </div>

          <div className="p-2 border-t" style={{ borderColor: '#F2F2F2' }}>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-[12px] transition-colors hover:bg-red-50"
              style={{ color: '#E5484D' }}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
      
      <SettingsPanel open={isProfileOpen} onOpenChange={(open) => open ? openProfile() : closeProfile()} />
    </div>
  );
}
