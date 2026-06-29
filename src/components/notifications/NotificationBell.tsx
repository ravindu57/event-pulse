'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Notification } from '@/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const typeIcons: Record<string, string> = {
  analysis_complete: 'auto_awesome',
  needs_attention: 'warning',
  milestone_due: 'flag',
  daily_reminder: 'schedule',
  streak_broken: 'local_fire_department',
};

const typeColors: Record<string, string> = {
  analysis_complete: 'text-primary bg-primary/10',
  needs_attention: 'text-error bg-error/10',
  milestone_due: 'text-amber-600 bg-amber-50',
  daily_reminder: 'text-secondary bg-surface-container-highest',
  streak_broken: 'text-orange-500 bg-orange-50',
};

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=15');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        id="notification-bell-btn"
        onClick={() => { setOpen(prev => !prev); if (!open) fetchNotifications(); }}
        className={cn(
          'flex items-center gap-3 rounded-xl text-label-md font-medium transition-all relative',
          compact
            ? 'text-secondary hover:bg-surface-container-low p-2 rounded-full'
            : 'w-full px-4 py-2 text-on-surface-variant hover:bg-surface-container-high'
        )}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {!compact && 'Notifications'}
        {unreadCount > 0 && (
          <span className={cn(
            'bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0',
            compact
              ? 'absolute -top-1 -right-1 w-4 h-4'
              : 'ml-auto w-5 h-5'
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-50 bg-surface border border-outline-variant rounded-2xl shadow-xl overflow-hidden animate-fade-in',
            compact
              ? 'right-0 top-10 w-80'
              : 'left-full ml-2 top-0 w-80'
          )}
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container-lowest">
            <h4 className="font-geist text-label-md font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined fill-icon text-primary text-[18px]">notifications</span>
              Notifications
              {unreadCount > 0 && (
                <span className="bg-error text-on-error text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-label-sm text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-secondary">
                <span className="material-symbols-outlined text-[40px] mb-2">notifications_off</span>
                <p className="text-body-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-outline-variant/50 transition-colors hover:bg-surface-container-lowest',
                    !n.read ? 'bg-primary/[0.03]' : 'bg-surface'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                    typeColors[n.type] || 'text-secondary bg-surface-container-high'
                  )}>
                    <span className="material-symbols-outlined fill-icon text-[16px]">
                      {typeIcons[n.type] || 'info'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-label-sm leading-tight',
                        !n.read ? 'font-semibold text-on-surface' : 'font-medium text-on-surface-variant'
                      )}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    {n.body && (
                      <p className="text-body-sm text-secondary mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-secondary/70 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
