import { mockCommittees, mockDashboard, mockMilestones, mockSubmissions } from '@/lib/mock-data';
import type { Committee, DailySubmission } from '@/types';

const STORAGE_KEY = 'eventpulse_demo_submissions';

export function isDemoMode() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('dummy') || supabaseAnonKey.includes('dummy') || supabaseAnonKey.includes('your_');
}

export function getDemoDashboardPayload() {
  return {
    summary: mockDashboard,
    committees: mockCommittees,
    todays_submissions: getDemoSubmissionsPayload(),
    upcoming_milestones: mockMilestones.filter(m => ['upcoming', 'in_progress', 'at_risk'].includes(m.status)).slice(0, 5),
  };
}

export function getDemoCommitteesPayload() {
  return mockCommittees;
}

export function getDemoMilestonesPayload() {
  return mockMilestones;
}

export function getDemoSubmissionsPayload(): DailySubmission[] {
  if (typeof window === 'undefined') {
    return mockSubmissions;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return mockSubmissions;
    const parsed = JSON.parse(stored) as DailySubmission[];
    return [...mockSubmissions, ...parsed];
  } catch {
    return mockSubmissions;
  }
}

export function addDemoSubmission(submission: Omit<DailySubmission, 'id'>): DailySubmission {
  const newSubmission: DailySubmission = {
    ...submission,
    id: `demo-${Date.now()}`,
  };

  if (typeof window === 'undefined') {
    return newSubmission;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as DailySubmission[]) : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...parsed, newSubmission]));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([newSubmission]));
  }

  return newSubmission;
}
