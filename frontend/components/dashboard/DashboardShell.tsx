'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Bell,
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDiagramStore } from '@/store/diagramStore';
import { UserAvatar, SettingsPanel } from '@/components/UserAvatar';
import { RecentCanvases } from './RecentCanvases';

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: string;
}

function SidebarItem({ icon: Icon, label, active, onClick, badge }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-brand-bg text-brand-text shadow-sm'
          : 'text-text-secondary hover:bg-brand-bg hover:text-brand-text'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium flex-1 text-left">{label}</span>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
          active ? 'bg-brand text-white' : 'bg-brand-bg text-brand-text'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function CollapsibleGroup({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] transition-all duration-200 text-text-primary hover:bg-brand-bg hover:text-brand-text group cursor-pointer"
      >
        <Icon className="w-5 h-5" />
        <span className="text-xs font-semibold flex-1 text-left tracking-wider uppercase opacity-60">
          {label}
        </span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-brand-text transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-text transition-colors" />
        )}
      </button>
      {isOpen && <div className="mt-1 pl-7 space-y-1">{children}</div>}
    </div>
  );
}

function SubmenuItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-[12px] transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-brand-bg text-brand-text shadow-sm'
          : 'text-text-muted hover:bg-brand-bg hover:text-brand-text'
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

interface DashboardShellProps {
  children: React.ReactNode;
  activePage: string;
}

function DashboardSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const queryParam = searchParams.get('q') || '';
  const [searchVal, setSearchVal] = useState(queryParam);

  useEffect(() => {
    setSearchVal(queryParam);
  }, [queryParam]);

  const handleSearchChange = (val: string) => {
    setSearchVal(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('q', val);
    } else {
      params.delete('q');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border flex-1 min-w-0 bg-surface-page">
      <Search className="w-4 h-4 shrink-0 text-text-muted" />
      <input
        type="text"
        placeholder="Search..."
        value={searchVal}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm w-full text-text-primary p-0"
      />
    </div>
  );
}

export function DashboardShell({ children, activePage }: DashboardShellProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addCanvas, canvases } = useDiagramStore();

  // Use state with initial value from a ref or just skip setMounted if not needed
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleNewCanvas = () => {
    addCanvas();
    router.push('/editor');
  };

  const openCanvases = canvases.filter(c => c.isOpen);
  const stats = `${canvases.length} canvases • ${openCanvases.length} open`;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="w-8 h-8 border-2 border-border-strong border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-surface-page">
      <div className="max-w-[1400px] mx-auto grid md:grid-cols-[260px_1fr] gap-4 md:gap-6">
        
        {/* MOBILE DRAWER SIDEBAR */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-[#000000]/40 backdrop-blur-xs z-40 md:hidden animate-fade-in" 
            onClick={() => setMobileMenuOpen(false)} 
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 w-[280px] z-50 p-5 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col border-r border-border bg-surface-panel ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-text-primary block leading-tight">ArchDraw</span>
                <span className="text-[10px] text-text-muted">Workspace</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)} 
              className="p-1.5 rounded-lg hover:bg-surface-page text-text-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-2 mb-4 text-[11px] text-text-muted">
            {stats}
          </div>

          <div className="border-b border-border mb-4" />

          {/* Navigation */}
          <nav className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  Home
                </span>
              </div>
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                active={activePage === 'Dashboard'}
                onClick={() => { router.push('/dashboard'); setMobileMenuOpen(false); }}
              />
            </div>

            <CollapsibleGroup icon={FolderOpen} label="Quick Access" defaultOpen>
              <RecentCanvases />
            </CollapsibleGroup>

            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  Library
                </span>
              </div>
              <SubmenuItem
                label="All Canvases"
                active={activePage === 'Canvases-All'}
                onClick={() => { router.push('/editor'); setMobileMenuOpen(false); }}
              />
              <SubmenuItem
                label="Templates"
                active={activePage === 'Templates'}
                onClick={() => { router.push('/dashboard/templates'); setMobileMenuOpen(false); }}
              />
              <SubmenuItem
                label="Tutorials"
                active={activePage === 'Learn'}
                onClick={() => { router.push('/dashboard/learn'); setMobileMenuOpen(false); }}
              />
              <SubmenuItem
                label="Docs"
                active={activePage === 'Docs'}
                onClick={() => { router.push('/docs'); setMobileMenuOpen(false); }}
              />
              <SubmenuItem
                label="Blog"
                active={activePage === 'Blog'}
                onClick={() => { router.push('/blogs'); setMobileMenuOpen(false); }}
              />
              {user?.email === 'jamdadeabhishek039@gmail.com' && (
                <SubmenuItem
                  label="Admin"
                  active={activePage === 'Admin'}
                  onClick={() => { router.push('/admin'); setMobileMenuOpen(false); }}
                />
              )}
            </div>

            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  AI Tools
                </span>
              </div>
              <SidebarItem
                icon={Sparkles}
                label="AI Generate"
                onClick={() => { setMobileMenuOpen(false); }}
              />
            </div>
          </nav>

          <div className="border-b border-border my-4" />

          <div className="px-2 py-2 text-[10px] text-text-muted">
            Storage: 2.1MB / 5MB
          </div>
        </aside>

        {/* LEFT SIDEBAR (DESKTOP) */}
        <aside
          className="hidden md:block rounded-xl p-4 self-start sticky top-6 border border-border bg-surface-panel shadow-[0_8px_28px_rgba(0,0,0,0.04)] h-fit"
        >
          {/* Logo & Title */}
          <div className="flex items-center gap-3 px-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-text-primary block leading-tight">ArchDraw</span>
              <span className="text-[10px] text-text-muted">Workspace</span>
            </div>
          </div>

          {/* Stats */}
          <div className="px-2 mb-4 text-[11px] text-text-muted">
            {stats}
          </div>

          <div className="border-b border-border mb-4" />

          {/* Navigation */}
          <nav className="space-y-3">
            {/* HOME Section */}
            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  Home
                </span>
              </div>
              <SidebarItem
                icon={LayoutDashboard}
                label="Dashboard"
                active={activePage === 'Dashboard'}
                onClick={() => router.push('/dashboard')}
              />
            </div>

            {/* QUICK ACCESS Section */}
            <CollapsibleGroup icon={FolderOpen} label="Quick Access" defaultOpen>
              <RecentCanvases />
            </CollapsibleGroup>

            {/* LIBRARY Section */}
            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  Library
                </span>
              </div>
              <SubmenuItem
                label="All Canvases"
                active={activePage === 'Canvases-All'}
                onClick={() => router.push('/editor')}
              />
              <SubmenuItem
                label="Templates"
                active={activePage === 'Templates'}
                onClick={() => router.push('/dashboard/templates')}
              />
              <SubmenuItem
                label="Tutorials"
                active={activePage === 'Learn'}
                onClick={() => router.push('/dashboard/learn')}
              />
              <SubmenuItem
                label="Docs"
                active={activePage === 'Docs'}
                onClick={() => router.push('/docs')}
              />
              <SubmenuItem
                label="Blog"
                active={activePage === 'Blog'}
                onClick={() => router.push('/blogs')}
              />
              {user?.email === 'jamdadeabhishek039@gmail.com' && (
                <SubmenuItem
                  label="Admin"
                  active={activePage === 'Admin'}
                  onClick={() => router.push('/admin')}
                />
              )}
            </div>

            {/* AI TOOLS Section */}
            <div>
              <div className="px-4 mb-1">
                <span className="text-[10px] font-semibold tracking-wider uppercase opacity-60 text-text-muted">
                  AI Tools
                </span>
              </div>
              <SidebarItem
                icon={Sparkles}
                label="AI Generate"
                onClick={() => {}}
              />
            </div>
          </nav>

          <div className="border-b border-border my-4" />

          {/* Footer - Storage */}
          <div className="px-2 py-2 text-[10px] text-text-muted">
            Storage: 2.1MB / 5MB
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="space-y-6 md:space-y-8 overflow-hidden min-w-0">
          {/* Header */}
          <header
            className="flex flex-col gap-4 p-4 md:px-5 md:py-3.5 rounded-xl border border-border bg-surface-panel shadow-[0_8px_28px_rgba(0,0,0,0.03)]"
          >
            {/* Top row layout */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface-page text-text-muted"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-text-primary leading-tight truncate">
                  {activePage === 'Dashboard' && 'Dashboard'}
                  {activePage === 'Templates' && 'Architecture Templates'}
                  {activePage === 'Learn' && 'System Design Tutorials'}
                  {activePage === 'Canvases-All' && 'All Canvases'}
                  {activePage === 'Docs' && 'Documentation'}
                  {activePage === 'Blog' && 'Engineering Blog'}
                  {activePage === 'Admin' && 'Admin Panel'}
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  aria-label="Notifications"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors bg-surface-page text-text-secondary hover:bg-border-default"
                >
                  <Bell className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <UserAvatar />
              </div>
            </div>

            {/* Actions / Inputs row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full border-t border-border/40 pt-3 sm:pt-0 sm:border-t-0">
              <Suspense fallback={
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border flex-1 min-w-0 bg-surface-page animate-pulse">
                  <Search className="w-4 h-4 shrink-0 text-text-muted" />
                  <div className="h-4 bg-border-default/50 rounded-sm w-20" />
                </div>
              }>
                <DashboardSearch />
              </Suspense>
            </div>
          </header>

          {/* Page Content */}
          {children}
        </main>
      </div>

      <SettingsPanel open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
