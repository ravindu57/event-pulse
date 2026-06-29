import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/demo-data';
import { Notification } from '@/types';

// In-memory notification store for demo mode
const demoNotifications: Notification[] = [
  {
    id: 'n-1',
    user_id: 'demo-user',
    type: 'needs_attention',
    title: 'Attention Required: Logistics Committee',
    body: 'AI flagged critical blockers in today\'s submission — venue confirmation still pending.',
    read: false,
    metadata: { committee_id: 'c-1', submission_id: 's-1' },
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-2',
    user_id: 'demo-user',
    type: 'analysis_complete',
    title: 'Analysis Complete: Marketing Committee',
    body: 'AI analysis finished with 78% confidence. Positive sentiment detected.',
    read: false,
    metadata: { committee_id: 'c-2', submission_id: 's-2' },
    created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-3',
    user_id: 'demo-user',
    type: 'milestone_due',
    title: 'Milestone Approaching: Sponsor Outreach',
    body: 'This milestone is due in 3 days. Current progress is at 45%.',
    read: false,
    metadata: { milestone_id: 'm-1' },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-4',
    user_id: 'demo-user',
    type: 'streak_broken',
    title: 'Streak Broken: Technical Committee',
    body: 'Technical Committee missed their daily submission. 5-day streak ended.',
    read: true,
    metadata: { committee_id: 'c-3' },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-5',
    user_id: 'demo-user',
    type: 'daily_reminder',
    title: 'Daily Reminder: 2 committees haven\'t submitted',
    body: 'Decorations and Hospitality committees have not filed their daily progress report.',
    read: true,
    metadata: {},
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  try {
    if (isDemoMode()) {
      const unreadCount = demoNotifications.filter(n => !n.read).length;
      return NextResponse.json({ notifications: demoNotifications, unread_count: unreadCount });
    }

    const supabase = getAdminSupabase();
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const unreadCount = (data || []).filter((n: Notification) => !n.read).length;
    return NextResponse.json({ notifications: data || [], unread_count: unreadCount });
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, mark_all_read } = body;

    if (isDemoMode()) {
      if (mark_all_read) {
        demoNotifications.forEach(n => { n.read = true; });
      } else if (id) {
        const n = demoNotifications.find(n => n.id === id);
        if (n) n.read = true;
      }
      return NextResponse.json({ success: true });
    }

    const supabase = getAdminSupabase();

    if (mark_all_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
      if (error) throw error;
    } else if (id) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PUT /api/notifications error:', err);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
