'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

const navItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/committees', icon: 'groups', label: 'Committees' },
  { href: '/timeline', icon: 'timeline', label: 'Timeline' },
  { href: '/milestones', icon: 'flag', label: 'Milestones' },
  { href: '/files', icon: 'folder_open', label: 'Files' },
  { href: '/submissions', icon: 'edit_note', label: 'Submissions' },
  { href: '/reports', icon: 'analytics', label: 'Reports' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex flex-col h-screen fixed left-0 top-0 py-6 border-r border-outline-variant bg-surface-container-low w-60 z-40">
      {/* Logo */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined fill-icon text-[18px]">bolt</span>
        </div>
        <div>
          <h1 className="font-geist text-[16px] font-black text-on-surface leading-tight">EventPulse</h1>
          <p className="text-[11px] text-secondary font-medium">AI Progress Tracking</p>
        </div>
      </div>

      {/* New Submission CTA */}
      <div className="px-4 mb-6">
        <Link
          href="/submissions/new"
          className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary rounded-xl px-4 py-2.5 text-label-md font-medium hover:bg-surface-tint transition-colors shadow-sm btn-tactile"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Submission
        </Link>
      </div>

      {/* Nav Links */}
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2 mx-2 rounded-xl text-label-md font-medium transition-all',
                isActive
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              <span className={cn('material-symbols-outlined text-[20px]', isActive && 'fill-icon')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Footer Links */}
      <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant pt-4 mx-4">
        <NotificationBell />
        <button className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high rounded-xl text-label-md font-medium transition-all w-full">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Log Out
        </button>
      </div>
    </nav>
  );
}

export function MobileHeader() {
  return (
    <header className="md:hidden sticky top-0 z-50 flex items-center justify-between px-6 py-3 w-full bg-surface border-b border-outline-variant">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined fill-icon text-[16px]">bolt</span>
        </div>
        <span className="font-geist font-black text-primary text-[18px]">EventPulse</span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell compact />
      </div>
    </header>
  );
}
