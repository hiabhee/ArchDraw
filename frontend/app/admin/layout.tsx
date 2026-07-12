'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Radio, ListOrdered, MessageSquare,
  Filter, Shield, Eye, EyeOff,
} from 'lucide-react';
import { useSyncExternalStore, Suspense, useCallback } from 'react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Live Feed', href: '/admin/live', icon: Radio },
  { label: 'Sessions', href: '/admin/sessions', icon: ListOrdered },
  { label: 'Prompts', href: '/admin/prompts', icon: MessageSquare },
  { label: 'Funnel', href: '/admin/funnel', icon: Filter },
];

function NavItem({ label, icon: Icon, active, onClick }: {
  label: string; icon: React.ComponentType<{ className?: string }>;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
        active
          ? 'bg-[#1E90FF] text-white'
          : 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#18191a]'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function InternalTrafficToggle() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const excludeInternal = searchParams.get('internal') !== 'include';

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (excludeInternal) {
      params.set('internal', 'include');
    } else {
      params.delete('internal');
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [excludeInternal, pathname, searchParams, router]);

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
        excludeInternal
          ? 'border-[#18191a] text-[#8a8f98] hover:border-[#1E90FF]'
          : 'border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/10'
      }`}
      title={excludeInternal ? 'Showing only real traffic (click to include internal)' : 'Including your test traffic (click to exclude)'}
    >
      {excludeInternal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      {excludeInternal ? 'Internal: off' : 'Internal: on'}
    </button>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#010102]">
        <div className="w-6 h-6 border-2 border-[#1E90FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#010102] text-[#f7f8f8]">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-[#18191a] p-4 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <Shield className="w-5 h-5 text-[#1E90FF]" />
          <span className="text-sm font-semibold tracking-wide">Admin</span>
        </div>

        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))}
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>

        <div className="border-t border-[#18191a] pt-3 mt-3">
          <button
            onClick={() => router.push('/editor')}
            className="w-full text-left px-3 py-2 text-xs text-[#8a8f98] hover:text-[#f7f8f8] transition-colors cursor-pointer"
          >
            Back to App
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Top bar with internal traffic toggle */}
        <div className="flex items-center justify-end mb-4">
          <Suspense fallback={null}>
            <InternalTrafficToggle />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
